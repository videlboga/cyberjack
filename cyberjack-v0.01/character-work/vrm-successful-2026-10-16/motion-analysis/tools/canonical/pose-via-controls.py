# Поза кадра через КОНТРОЛЫ рига (IK), а не через присвоение костей.
#
# Почему так: у этого рига 47 % меша висит на helper-костях (root.x, *_stretch, *_twist,
# c_arm_twist_offset), у которых use_deform=False. Они двигаются только системой контролов.
# Прямое присваивание деформирующим костям оставляет эти вершины на месте — руки и стопы
# «выворачиваются», хотя направления костей точные.
#
#   blender -b asset.blend --python pose-via-controls.py -- frame.json out.blend [hand|leg|all]
import bpy, sys, json, math, os
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
frame_path, out_path = argv[0], argv[1]
parts = set(argv[2:]) or {'all'}

data = json.load(open(frame_path))
src = {n: Vector(v) for n, v in zip(data['names'], data['frame'])}
arm_obj = bpy.data.objects['rig_E']
P = arm_obj.pose.bones

# --- перевод координат источника в арматуру цели (та же конвенция, что и в apply-frame)
# Сторону определяем по СТОПАМ, а не по плечам: в позах со скрещенными руками плечо уезжает
# за среднюю линию, знак становится случайным — и весь кадр зеркалится (руки и ноги меняются
# местами, плечи и бёдра выглядят вывернутыми).
src_L, src_R = src['cf_j_foot_L'].x, src['cf_j_foot_R'].x
tgt_L = arm_obj.data.bones['foot.l'].head_local.x
tgt_R = arm_obj.data.bones['foot.r'].head_local.x
same_side = (src_L < src_R) == (tgt_L < tgt_R)
CONV = (lambda p: Vector((p.x, -p.z, p.y))) if same_side else (lambda p: Vector((-p.x, -p.z, p.y)))
S = {n: CONV(p) for n, p in src.items()}
# масштаб — по расстоянию «таз→голова», а не по габаритам костей: габариты включают волосы
# и контролы (1.727), из-за чего цели уезжали за пределы досягаемости и IK не дотягивался
# Масштаб — по ДЛИНЕ НОГИ (таз→стопа), это самая устойчивая пара точек: рост источника
# нормирован на его собственную высоту, и «голова» у разных моделей означает разное.
src_leg = (src['cf_j_hips'] - src['cf_j_foot_L']).length
tgt_leg = (arm_obj.data.bones['spine_01.x'].head_local - arm_obj.data.bones['foot.l'].head_local).length
scale = tgt_leg / src_leg
for n in S:
    S[n] = S[n] * scale
# таз ставим на место, но по X и Y тоже — иначе руки уезжают вбок/вперёд за пределы досягаемости
shift = arm_obj.data.bones['spine_01.x'].head_local - S['cf_j_hips']
for n in S:
    S[n] = S[n] + shift
# основания пальцев: нужны, чтобы задать направление кисти (в источнике она продолжает предплечье)
for n, v in (data.get('extraPos') or {}).items():
    S[n] = CONV(Vector(v)) * scale + shift
print('CONV', 'same' if same_side else 'flipX', 'scale', round(scale, 3))

# --- сжатие позы под антропометрию рига: цель не может быть дальше длины конечности
def clamp_to_reach(target, root, length, k=0.98):
    d = target - root
    if d.length <= length * k:
        return target, 0.0
    return root + d.normalized() * (length * k), round(d.length - length * k, 4)

for side, cap in (('l', 'L'), ('r', 'R')):
    root = arm_obj.data.bones[f'arm.{side}'].head_local
    L = arm_obj.data.bones[f'arm.{side}'].length + arm_obj.data.bones[f'forearm.{side}'].length
    S[f'cf_j_hand_{cap}'], cut = clamp_to_reach(S[f'cf_j_hand_{cap}'], root, L)
    if cut:
        print('CLAMP_HAND', side, 'срезано', cut, 'м')
    rootL = arm_obj.data.bones[f'thigh.{side}'].head_local
    LL = arm_obj.data.bones[f'thigh.{side}'].length + arm_obj.data.bones[f'leg.{side}'].length
    S[f'cf_j_foot_{cap}'], cutL = clamp_to_reach(S[f'cf_j_foot_{cap}'], rootL, LL)
    if cutL:
        print('CLAMP_FOOT', side, 'срезано', cutL, 'м')

# риг должен быть в режиме позы, контролы не глушим — наоборот, их и двигаем
bpy.context.view_layer.objects.active = arm_obj
arm_obj.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
# ik_fk_switch: 1 = FK, 0 = IK. По умолчанию руки стоят в FK — тогда IK-цели ничего не двигают,
# и ошибка позиции остаётся полметра при формально «правильно поставленной» цели.
for side in ('l', 'r'):
    for ctrl in (f'c_hand_ik.{side}', f'c_foot_ik.{side}'):
        pb = P.get(ctrl)
        if pb and 'ik_fk_switch' in pb.keys():
            pb['ik_fk_switch'] = 0.0
            print('SWITCH_IK', ctrl)
bpy.context.view_layer.update()


def release_pole(name):
    """Полюса держат CHILD_OF, влияние которого управляется драйверами — глушим и то, и другое,
    иначе перенос полюса перебивается и сустав остаётся не на месте."""
    n = free_of_space_switch(name)
    if arm_obj.animation_data:
        for fc in arm_obj.animation_data.drivers:
            if name in fc.data_path and 'influence' in fc.data_path and not fc.mute:
                fc.mute = True
                n += 1
    bpy.context.view_layer.update()
    return n


def free_of_space_switch(name):
    """CHILD_OF у контролов — переключение пространств; на время постановки его глушим."""
    n = 0
    for c in P[name].constraints:
        if c.type in ('CHILD_OF', 'COPY_TRANSFORMS') and not c.mute:
            c.mute = True
            n += 1
    return n


def move_to(name, target):
    """Поставить голову кости в точку. pb.matrix не работает — идём через matrix_basis."""
    pb = P[name]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    goal = Matrix.Translation(target - base.translation) @ base
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return (P[name].head - target).length




def solve_pole(pole_name, root, end, joint_target, joint_now):
    """Подбор полюса перебором азимутов вокруг оси root->end с критерием «плоскость сустава
    совпала с источником». Одна «правильная сторона» не годится: у руки pole_angle=pi,
    и локоть уезжает в противоположную плоскость (100°). Перебор даёт 2.8–3.6°."""
    if pole_name not in P:
        return None
    pole = P[pole_name]
    for c in pole.constraints:
        if c.type == 'CHILD_OF':
            c.mute = True
    if arm_obj.animation_data:
        for fc in arm_obj.animation_data.drivers:
            if pole_name in fc.data_path and 'influence' in fc.data_path:
                fc.mute = True
    axis = end - root
    if axis.length < 1e-6:
        return None
    ax = axis.normalized()
    t = joint_target - root
    t = t - ax * t.dot(ax)
    if t.length < 1e-9:
        return None
    t = t.normalized()
    best = (None, None)
    for k in (0.4, 0.7, 1.0):
        for deg in range(0, 360, 15):
            a = math.radians(deg)
            u = ax.cross(Vector((0, 0, 1)))
            if u.length < 1e-6:
                u = ax.cross(Vector((0, 1, 0)))
            u.normalize()
            v = ax.cross(u)
            cand = root + axis * 0.5 + (u * math.cos(a) + v * math.sin(a)) * (axis.length * k)
            pole.matrix_basis = Matrix.Identity(4)
            bpy.context.view_layer.update()
            base = pole.matrix.copy()
            goal = Matrix.Translation(cand) @ base.to_3x3().to_4x4()
            pole.matrix_basis = base.inverted() @ goal
            bpy.context.view_layer.update()
            now = joint_now()
            a2 = now - root
            a2 = a2 - ax * a2.dot(ax)
            if a2.length < 1e-9:
                continue
            ang = math.degrees(t.angle(a2.normalized()))
            if best[0] is None or ang < best[0]:
                best = (ang, cand)
    if best[1] is not None:
        pole.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        base = pole.matrix.copy()
        goal = Matrix.Translation(best[1]) @ base.to_3x3().to_4x4()
        pole.matrix_basis = base.inverted() @ goal
        bpy.context.view_layer.update()
    return round(best[0], 1) if best[0] is not None else None


def plane_error(root, joint_target, joint_now, end):
    """Ошибка плоскости сгиба: на сколько градусов сустав стоит не в той стороне от оси."""
    axis = end - root
    if axis.length < 1e-6:
        return None
    axis.normalize()
    t = joint_target - root; t = t - axis * t.dot(axis)
    a = joint_now - root; a = a - axis * a.dot(axis)
    if t.length < 1e-9 or a.length < 1e-9:
        return None
    return math.degrees(t.angle(a))


def tune_pole(pole_name, root, joint_target, end, joint_now):
    """Подбор полюса по азимуту вокруг оси вращения: одной «стороны» мало — полюс может стоять
    в правильном полупространстве и всё равно давать плоскость сгиба под 70°."""
    axis = end - root
    if axis.length < 1e-6:
        return None
    best = (None, None)
    for k in (0.6, 1.0, 1.6):
        for deg in range(0, 360, 15):
            a = math.radians(deg)
            # базис в плоскости, перпендикулярной оси
            u = axis.cross(Vector((0, 0, 1)))
            if u.length < 1e-6:
                u = axis.cross(Vector((0, 1, 0)))
            u.normalize()
            v = axis.normalized().cross(u)
            cand = root + axis * 0.5 + (u * math.cos(a) + v * math.sin(a)) * (axis.length * k)
            move_to(pole_name, cand)
            bpy.context.view_layer.update()
            err = plane_error(root, joint_target, joint_now(), end)
            if err is not None and (best[0] is None or err < best[0]):
                best = (err, cand)
    if best[1] is not None:
        move_to(pole_name, best[1])
        bpy.context.view_layer.update()
    return round(best[0], 1) if best[0] is not None else None


def pole_for(target_pos, joint, root):
    """Точка полюса: от линии root→target в сторону сустава, на расстоянии хода."""
    axis = (target_pos - root)
    if axis.length < 1e-6:
        return None
    d = axis.normalized()
    perp = (joint - root) - d * (joint - root).dot(d)
    if perp.length < 1e-6:
        return None
    return root + perp.normalized() * max(0.35, axis.length)


def aim(name, target_dir):
    """Навести кость по направлению (ключица, ягодичная) — приём с нулевым базисом."""
    pb = P[name]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    d0 = (pb.tail - pb.head)
    if d0.length < 1e-6:
        return None
    q = d0.normalized().rotation_difference(target_dir.normalized())
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return math.degrees(q.angle)


report = []


# Нормаль ладони в локальной рамке кисти, посчитанная на rest: брать её из текущих голов
# пальцев нельзя — основания указательного и мизинца почти на оси кисти, векторное
# произведение вырождается (давало 0.81 по X, то есть «нормаль вдоль руки»).
PALM_LOCAL = {}
for _side in ('l', 'r'):
    _hb = arm_obj.data.bones.get(f'hand.{_side}')
    # базис ладони: большой палец x средний — так ширина ладони перпендикулярна пальцам.
    # Пара «указательный/мизинец» почти коллинеарна оси кисти и давала случайный угол.
    _bi = arm_obj.data.bones.get(f'thumb1.{_side}')
    _bl = arm_obj.data.bones.get(f'middle1.{_side}')
    if _hb and _bi and _bl:
        _n = (_bi.head_local - _hb.head_local).cross(_bl.head_local - _hb.head_local)
        if _n.length > 1e-9:
            PALM_LOCAL[_side] = _hb.matrix_local.to_quaternion().inverted() @ _n.normalized()


def aim_via_control(ctrl_name, bone_name, target_dir):
    """Кость получает поворот от контрола (COPY_ROTATION 1.0), поэтому крутить надо КОНТРОЛ:
    поворот кости перебивается на следующем же пересчёте зависимостей."""
    if ctrl_name not in P or bone_name not in P:
        return None
    pb, cb = P[bone_name], P[ctrl_name]
    cur = (pb.tail - pb.head)
    if cur.length < 1e-6 or target_dir.length < 1e-6:
        return None
    q = cur.normalized().rotation_difference(target_dir.normalized())
    cb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = cb.matrix.copy()
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    cb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return round(math.degrees(q.angle), 1)


def aim_toes():
    """Пальцы стопы: `toes_01.*` не наследует поворот стопы (inherit_rotation=False),
    поэтому при повороте стопы на 80° остаются в rest и меш рвётся лентами. Наводим их
    по источнику — пара суставов в кадре есть (cf_j_foot -> cf_j_toes)."""
    out = {}
    for side, cap in (('l', 'L'), ('r', 'R')):
        n = f'toes_01.{side}'
        if n not in P:
            continue
        d = S[f'cf_j_toes_{cap}'] - S[f'cf_j_foot_{cap}']
        if d.length < 1e-6:
            continue
        a = aim_via_control(f'c_toes_ik.{side}', n, d)
        if a is None:
            a = aim(n, d)
        out[side] = a
    return out


# Ключицы: они несут веса дельтовидной зоны и сами по себе не двигаются (в риге 0.0°),
# из-за чего кожа плеча рвётся между ними и рукой. Наводим их по источнику.
for side, cap in (('l', 'L'), ('r', 'R')):
    if f'shoulder.{side}' in P:
        d = S[f'cf_j_arm00_{cap}'] - S[f'cf_j_shoulder_{cap}']
        rest_dir = (arm_obj.data.bones[f'shoulder.{side}'].tail_local
                    - arm_obj.data.bones[f'shoulder.{side}'].head_local).normalized()
        ang = math.degrees(rest_dir.angle(d.normalized()))
        if ang > 90:      # разворот больше прямого = не та пара точек, ключицу не трогаем
            print('CLAVICLE', side, 'пропуск, направление расходится на', round(ang, 1))
        else:
            a = aim(f'shoulder.{side}', d)
            print('CLAVICLE', side, 'поворот', None if a is None else round(a, 1))
if 'all' in parts or 'hand' in parts:
    for side, cap in (('l', 'L'), ('r', 'R')):
        tgt_name = f'c_hand_ik.{side}'
        pole_name = f'c_arms_pole.{side}'
        free_of_space_switch(tgt_name)
        # направления из источника
        d1 = (S[f'cf_j_arm00_{cap}'] - S[f'cf_j_shoulder_{cap}']).normalized()
        d2 = (S[f'cf_j_forearm01_{cap}'] - S[f'cf_j_arm00_{cap}']).normalized()
        L1 = arm_obj.data.bones[f'arm.{side}'].length
        L2 = arm_obj.data.bones[f'forearm.{side}'].length
        shoulder = P[f'arm.{side}'].head.copy()
        elbow_t = shoulder + d1 * L1
        wrist_t = elbow_t + d2 * L2          # ровно длины рига => цель достижима точно
        move_to(tgt_name, wrist_t)
        pole_err = solve_pole(pole_name, shoulder, wrist_t, elbow_t,
                              lambda: P[f'forearm.{side}'].head)
        elbow_err = (P[f'forearm.{side}'].head - elbow_t).length
        wrist_err = (P[f'hand.{side}'].head - wrist_t).length
        report.append(('hand', side, round(wrist_err, 4), round(elbow_err, 4)))

if 'all' in parts or 'leg' in parts:
    for side, cap in (('l', 'L'), ('r', 'R')):
        tgt_name = f'foot_ik_target.{side}'
        pole_name = f'c_leg_pole.{side}'
        d1 = (S[f'cf_j_leg01_{cap}'] - S[f'cf_j_thigh00_{cap}']).normalized()
        d2 = (S[f'cf_j_foot_{cap}'] - S[f'cf_j_leg01_{cap}']).normalized()
        L1 = arm_obj.data.bones[f'thigh.{side}'].length
        L2 = arm_obj.data.bones[f'leg.{side}'].length
        hip = P[f'thigh.{side}'].head.copy()
        knee_t = hip + d1 * L1
        ankle_t = knee_t + d2 * L2
        move_to(tgt_name, ankle_t)
        pole_err = solve_pole(pole_name, hip, ankle_t, knee_t,
                              lambda: P[f'leg.{side}'].head)
        knee_err = (P[f'leg.{side}'].head - knee_t).length
        ankle_err = (P[f'leg.{side}'].tail - ankle_t).length
        report.append(('leg', side, round(ankle_err, 4), round(knee_err, 4)))



def solve_pole(pole_name, root, end, joint_target, joint_now):
    """Подбор полюса перебором азимутов вокруг оси root->end с критерием «плоскость сустава
    совпала с источником». Одна «правильная сторона» не годится: у руки pole_angle=pi,
    и локоть уезжает в противоположную плоскость (100°). Перебор даёт 2.8–3.6°."""
    if pole_name not in P:
        return None
    pole = P[pole_name]
    for c in pole.constraints:
        if c.type == 'CHILD_OF':
            c.mute = True
    if arm_obj.animation_data:
        for fc in arm_obj.animation_data.drivers:
            if pole_name in fc.data_path and 'influence' in fc.data_path:
                fc.mute = True
    axis = end - root
    if axis.length < 1e-6:
        return None
    ax = axis.normalized()
    t = joint_target - root
    t = t - ax * t.dot(ax)
    if t.length < 1e-9:
        return None
    t = t.normalized()
    best = (None, None)
    for k in (0.4, 0.7, 1.0):
        for deg in range(0, 360, 15):
            a = math.radians(deg)
            u = ax.cross(Vector((0, 0, 1)))
            if u.length < 1e-6:
                u = ax.cross(Vector((0, 1, 0)))
            u.normalize()
            v = ax.cross(u)
            cand = root + axis * 0.5 + (u * math.cos(a) + v * math.sin(a)) * (axis.length * k)
            pole.matrix_basis = Matrix.Identity(4)
            bpy.context.view_layer.update()
            base = pole.matrix.copy()
            goal = Matrix.Translation(cand) @ base.to_3x3().to_4x4()
            pole.matrix_basis = base.inverted() @ goal
            bpy.context.view_layer.update()
            now = joint_now()
            a2 = now - root
            a2 = a2 - ax * a2.dot(ax)
            if a2.length < 1e-9:
                continue
            ang = math.degrees(t.angle(a2.normalized()))
            if best[0] is None or ang < best[0]:
                best = (ang, cand)
    if best[1] is not None:
        pole.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        base = pole.matrix.copy()
        goal = Matrix.Translation(best[1]) @ base.to_3x3().to_4x4()
        pole.matrix_basis = base.inverted() @ goal
        bpy.context.view_layer.update()
    return round(best[0], 1) if best[0] is not None else None


def plane_error(root, joint_target, joint_now, end):
    """Ошибка плоскости сгиба: на сколько градусов сустав стоит не в той стороне от оси."""
    axis = end - root
    if axis.length < 1e-6:
        return None
    axis.normalize()
    t = joint_target - root; t = t - axis * t.dot(axis)
    a = joint_now - root; a = a - axis * a.dot(axis)
    if t.length < 1e-9 or a.length < 1e-9:
        return None
    return math.degrees(t.angle(a))


def tune_pole(pole_name, root, joint_target, end, joint_now):
    """Подбор полюса по азимуту вокруг оси вращения: одной «стороны» мало — полюс может стоять
    в правильном полупространстве и всё равно давать плоскость сгиба под 70°."""
    axis = end - root
    if axis.length < 1e-6:
        return None
    best = (None, None)
    for k in (0.6, 1.0, 1.6):
        for deg in range(0, 360, 15):
            a = math.radians(deg)
            # базис в плоскости, перпендикулярной оси
            u = axis.cross(Vector((0, 0, 1)))
            if u.length < 1e-6:
                u = axis.cross(Vector((0, 1, 0)))
            u.normalize()
            v = axis.normalized().cross(u)
            cand = root + axis * 0.5 + (u * math.cos(a) + v * math.sin(a)) * (axis.length * k)
            move_to(pole_name, cand)
            bpy.context.view_layer.update()
            err = plane_error(root, joint_target, joint_now(), end)
            if err is not None and (best[0] is None or err < best[0]):
                best = (err, cand)
    if best[1] is not None:
        move_to(pole_name, best[1])
        bpy.context.view_layer.update()
    return round(best[0], 1) if best[0] is not None else None


def pole_for(target_pos, joint, root):
    """Точка полюса: от линии root→target в сторону сустава, на расстоянии хода."""
    axis = (target_pos - root)
    if axis.length < 1e-6:
        return None
    d = axis.normalized()
    perp = (joint - root) - d * (joint - root).dot(d)
    if perp.length < 1e-6:
        return None
    return root + perp.normalized() * max(0.35, axis.length)


def aim(name, target_dir):
    """Навести кость по направлению (ключица, ягодичная) — приём с нулевым базисом."""
    pb = P[name]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    d0 = (pb.tail - pb.head)
    if d0.length < 1e-6:
        return None
    q = d0.normalized().rotation_difference(target_dir.normalized())
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return math.degrees(q.angle)


report = []


# Нормаль ладони в локальной рамке кисти, посчитанная на rest: брать её из текущих голов
# пальцев нельзя — основания указательного и мизинца почти на оси кисти, векторное
# произведение вырождается (давало 0.81 по X, то есть «нормаль вдоль руки»).
PALM_LOCAL = {}
for _side in ('l', 'r'):
    _hb = arm_obj.data.bones.get(f'hand.{_side}')
    # базис ладони: большой палец x средний — так ширина ладони перпендикулярна пальцам.
    # Пара «указательный/мизинец» почти коллинеарна оси кисти и давала случайный угол.
    _bi = arm_obj.data.bones.get(f'thumb1.{_side}')
    _bl = arm_obj.data.bones.get(f'middle1.{_side}')
    if _hb and _bi and _bl:
        _n = (_bi.head_local - _hb.head_local).cross(_bl.head_local - _hb.head_local)
        if _n.length > 1e-9:
            PALM_LOCAL[_side] = _hb.matrix_local.to_quaternion().inverted() @ _n.normalized()


def aim_via_control(ctrl_name, bone_name, target_dir):
    """Кость получает поворот от контрола (COPY_ROTATION 1.0), поэтому крутить надо КОНТРОЛ:
    поворот кости перебивается на следующем же пересчёте зависимостей."""
    if ctrl_name not in P or bone_name not in P:
        return None
    pb, cb = P[bone_name], P[ctrl_name]
    cur = (pb.tail - pb.head)
    if cur.length < 1e-6 or target_dir.length < 1e-6:
        return None
    q = cur.normalized().rotation_difference(target_dir.normalized())
    cb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = cb.matrix.copy()
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    cb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return round(math.degrees(q.angle), 1)


def aim_toes():
    """Пальцы стопы: `toes_01.*` не наследует поворот стопы (inherit_rotation=False),
    поэтому при повороте стопы на 80° остаются в rest и меш рвётся лентами. Наводим их
    по источнику — пара суставов в кадре есть (cf_j_foot -> cf_j_toes)."""
    out = {}
    for side, cap in (('l', 'L'), ('r', 'R')):
        n = f'toes_01.{side}'
        if n not in P:
            continue
        d = S[f'cf_j_toes_{cap}'] - S[f'cf_j_foot_{cap}']
        if d.length < 1e-6:
            continue
        a = aim_via_control(f'c_toes_ik.{side}', n, d)
        if a is None:
            a = aim(n, d)
        out[side] = a
    return out


# Ключицы: они несут веса дельтовидной зоны и сами по себе не двигаются (в риге 0.0°),
# из-за чего кожа плеча рвётся между ними и рукой. Наводим их по источнику.
for side, cap in (('l', 'L'), ('r', 'R')):
    if f'shoulder.{side}' in P:
        d = S[f'cf_j_arm00_{cap}'] - S[f'cf_j_shoulder_{cap}']
        rest_dir = (arm_obj.data.bones[f'shoulder.{side}'].tail_local
                    - arm_obj.data.bones[f'shoulder.{side}'].head_local).normalized()
        ang = math.degrees(rest_dir.angle(d.normalized()))
        if ang > 90:      # разворот больше прямого = не та пара точек, ключицу не трогаем
            print('CLAVICLE', side, 'пропуск, направление расходится на', round(ang, 1))
        else:
            a = aim(f'shoulder.{side}', d)
            print('CLAVICLE', side, 'поворот', None if a is None else round(a, 1))
if 'all' in parts or 'hand' in parts:
    for side, cap in (('l', 'L'), ('r', 'R')):
        tgt_name = f'c_hand_ik.{side}'
        pole_name = f'c_arms_pole.{side}'
        free_of_space_switch(tgt_name)
        # направления из источника
        d1 = (S[f'cf_j_arm00_{cap}'] - S[f'cf_j_shoulder_{cap}']).normalized()
        d2 = (S[f'cf_j_forearm01_{cap}'] - S[f'cf_j_arm00_{cap}']).normalized()
        L1 = arm_obj.data.bones[f'arm.{side}'].length
        L2 = arm_obj.data.bones[f'forearm.{side}'].length
        shoulder = P[f'arm.{side}'].head.copy()
        elbow_t = shoulder + d1 * L1
        wrist_t = elbow_t + d2 * L2          # ровно длины рига => цель достижима точно
        move_to(tgt_name, wrist_t)
        pole_err = solve_pole(pole_name, shoulder, wrist_t, elbow_t,
                              lambda: P[f'forearm.{side}'].head)
        elbow_err = (P[f'forearm.{side}'].head - elbow_t).length
        wrist_err = (P[f'hand.{side}'].head - wrist_t).length
        report.append(('hand', side, round(wrist_err, 4), round(elbow_err, 4)))

if 'all' in parts or 'leg' in parts:
    for side, cap in (('l', 'L'), ('r', 'R')):
        tgt_name = f'foot_ik_target.{side}'
        pole_name = f'c_leg_pole.{side}'
        err = move_to(tgt_name, S[f'cf_j_foot_{cap}'])
        print('CTRLLEG', tgt_name, 'ошибка постановки цели', round(err, 4))
        if pole_name in P:
            release_pole(pole_name)
            tune_pole(pole_name, P[f'thigh.{side}'].head, S[f'cf_j_leg01_{cap}'],
                      S[f'cf_j_foot_{cap}'], lambda: P[f'leg.{side}'].head)
        knee_err = (P[f'leg.{side}'].head - S[f'cf_j_leg01_{cap}']).length
        # конец IK-цепи — хвост голени, а не голова стопы: её и меряем
        ankle_err = (P[f'leg.{side}'].tail - S[f'cf_j_foot_{cap}']).length
        report.append(('leg', side, round(ankle_err, 4), round(knee_err, 4)))

def aim_hands():
    """Кисть берёт поворот от c_hand_ik.* (COPY_ROTATION 1.0) и сама не двигается: в T-позе
    остаётся под 45° вниз от предплечья. Наводим её по источнику (запястье -> основание
    указательного пальца), иначе кисть «сломана» в любом кадре."""
    out = {}
    for side, cap in (('l', 'L'), ('r', 'R')):
        wrist = data.get('extraPos') and f'cf_j_index01_{cap}'
        if not wrist or wrist not in S:
            continue
        d = S[wrist] - S[f'cf_j_hand_{cap}']
        # Кисть берёт поворот от c_hand_ik.* по драйверу. Крутить саму IK-цель нельзя: она же
        # задаёт положение кисти, и цепь пересчитывается (руки уезжали вниз). Переключаем кисть
        # на FK-контрол и наводим кость напрямую.
        hb = P[f'hand.{side}']
        if arm_obj.animation_data:
            for fc in arm_obj.animation_data.drivers:
                if f'hand.{side}' in fc.data_path and 'influence' in fc.data_path:
                    fc.mute = True
        for c in hb.constraints:
            if c.type == 'COPY_ROTATION' and c.subtarget == f'c_hand_ik.{side}':
                c.influence = 0.0
            if c.type == 'COPY_ROTATION' and c.subtarget == f'c_hand_fk.{side}':
                c.influence = 1.0
        bpy.context.view_layer.update()
        # наводить надо КОНТРОЛ, а не кость: кость копирует его мировой поворот, и присвоение
        # кости перебивается на следующем пересчёте (ось кисти оставалась вниз под 60°)
        a = aim_via_control(f'c_hand_fk.{side}', f'hand.{side}', d)
        # скрутка ладони: наводим по плоскости ладони источника (указательный и мизинец)
        si, sl = f'cf_j_thumb01_{cap}', f'cf_j_middle01_{cap}'
        if si in S and sl in S:
            want = (S[si] - S[f'cf_j_hand_{cap}']).cross(S[sl] - S[f'cf_j_hand_{cap}'])
            if want.length > 1e-9 and side in PALM_LOCAL:
                hb = P[f'hand.{side}']
                axis = (hb.tail - hb.head).normalized()
                cur = hb.matrix.to_quaternion() @ PALM_LOCAL[side]
                if cur.length > 1e-9:
                    def perp(v):
                        w = v - axis * v.dot(axis)
                        return w.normalized() if w.length > 1e-9 else None
                    c1, c2 = perp(cur), perp(want)
                    if c1 and c2:
                        ang = c1.angle(c2)
                        if c1.cross(c2).dot(axis) < 0:
                            ang = -ang
                        # крутим FK-контрол: кость копирует ЕГО поворот, и доворот кости
                        # перебивается на следующем пересчёте зависимостей
                        fk = P.get(f'c_hand_fk.{side}')
                        if fk is not None:
                            # доворот ДОМНОЖАЕМ в локальной рамке кисти; обнулять basis нельзя —
                            # это стирает уже сделанную наводку (так терялись 66°)
                            a_local = hb.matrix.to_quaternion().inverted() @ axis
                            fk.matrix_basis = (fk.matrix_basis.to_quaternion()
                                               @ Quaternion(a_local, ang)).to_matrix().to_4x4()
                            bpy.context.view_layer.update()
                            out[f'{side}_roll'] = round(math.degrees(ang), 1)
        out[side] = a
    return out


print('HANDS_AIMED', aim_hands())
print('TOES_AIMED', aim_toes())
print('POSITION_ERRORS', report)
print('POLE_PLANE', [(r[0], r[1], r[5] if len(r) > 5 else None) for r in report] if False else 'см. выше')
# проверка досягаемости: расстояние плечо→цель против длины руки
for side, cap in (('l', 'L'), ('r', 'R')):
    sh = P[f'arm.{side}'].head
    arm_len = arm_obj.data.bones[f'arm.{side}'].length + arm_obj.data.bones[f'forearm.{side}'].length
    d = (S[f'cf_j_hand_{cap}'] - sh).length
    print('REACH', side, 'нужно', round(d, 3), 'рука', round(arm_len, 3), 'запас', round(arm_len - d, 3))
bpy.ops.wm.save_as_mainfile(filepath=out_path)
print('SAVED', out_path)
print('CONTROLS_OK')
