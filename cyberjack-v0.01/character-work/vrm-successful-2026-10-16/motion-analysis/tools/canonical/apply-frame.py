# Один кадр из библиотеки → подготовленный rig_E, с проверкой по углам суставов.
#
# Принцип: направление каждой кости ставится по мировым положениям суставов из проверенного
# декодера проекта (geometry.mjs → analyze → preview.frames), а не самодельным FK.
# Ограничители на время примерки глушатся: их задача — вести риг контролами, а мы проверяем
# сам перенос. Углы считает Blender по фактическим позициям костей, а не мой код.
#
#   blender -b base-rigged-humanoid.blend --python apply-frame.py -- frame.json out.blend
import bpy, sys, json, math, os
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
frame_path, out_path = argv[0], argv[1]
data = json.load(open(frame_path))
names = data['names']
pos = {n: Vector(v) for n, v in zip(names, data['frame'])}
SRC = pos

CHAIN_SRC = {
    'spine': ['cf_j_hips', 'cf_j_spine01', 'cf_j_spine02', 'cf_j_spine03', 'cf_j_neck', 'cf_j_head'],
    'armL': ['cf_j_shoulder_L', 'cf_j_arm00_L', 'cf_j_forearm01_L', 'cf_j_hand_L'],
    'armR': ['cf_j_shoulder_R', 'cf_j_arm00_R', 'cf_j_forearm01_R', 'cf_j_hand_R'],
    'legL': ['cf_j_thigh00_L', 'cf_j_leg01_L', 'cf_j_foot_L', 'cf_j_toes_L'],
    'legR': ['cf_j_thigh00_R', 'cf_j_leg01_R', 'cf_j_foot_R', 'cf_j_toes_R'],
}
CHAIN_TGT = {
    'spine': ['spine_01.x', 'spine_02.x', 'spine_03.x', 'spine_04.x', 'neck.x', 'head.x'],
    'armL': ['shoulder.l', 'arm.l', 'forearm.l', 'hand.l'],
    'armR': ['shoulder.r', 'arm.r', 'forearm.r', 'hand.r'],
    'legL': ['thigh.l', 'leg.l', 'foot.l', 'toes_01.l'],
    'legR': ['thigh.r', 'leg.r', 'foot.r', 'toes_01.r'],
}

# --- выбор пересчёта координат: Unity (Y вверх, левая система) → Blender (Z вверх, правая)
# Проверяем по стороне тела: где у источника левое плечо по X, где у цели.
src_lx = pos['cf_j_shoulder_L'].x
arm_obj = bpy.data.objects['rig_E']
tgt_lx = arm_obj.data.bones['shoulder.l'].head_local.x
same_side = (src_lx > 0) == (tgt_lx > 0)
CONV = (lambda p: Vector((p.x, -p.z, p.y))) if same_side else (lambda p: Vector((-p.x, -p.z, p.y)))
print('SIDE', round(src_lx, 3), round(tgt_lx, 3), 'same', same_side, 'conv', 'asis' if same_side else 'flipX')

tgt_pos = {n: CONV(p) for n, p in pos.items()}
# рост источника нормирован (1.0 = рост), у цели рост 1.727
scale = float(max(b.head_local.z for b in arm_obj.data.bones) - min(b.head_local.z for b in arm_obj.data.bones))
for n in tgt_pos:
    tgt_pos[n] = tgt_pos[n] * scale
# совмещаем таз
shift = arm_obj.data.bones['spine_01.x'].head_local - tgt_pos['cf_j_hips']
for n in tgt_pos:
    tgt_pos[n] = tgt_pos[n] + shift

P = arm_obj.pose.bones
# глушим ограничители на время примерки
muted = 0
for pb in P:
    for c in pb.constraints:
        if not c.mute:
            c.mute = True
            muted += 1
# 606 драйверов на риге перезаписывают позу поверх присвоенных значений — их тоже глушим
drv = 0
if arm_obj.animation_data:
    for fc in arm_obj.animation_data.drivers:
        if not fc.mute:
            fc.mute = True
            drv += 1
print('MUTED_CONSTRAINTS', muted, 'MUTED_DRIVERS', drv)
bpy.context.view_layer.objects.active = arm_obj
arm_obj.select_set(True)
bpy.ops.object.mode_set(mode='POSE')     # в объектном режиме pose-матрицы не пересчитываются
bpy.context.view_layer.update()


def head(pb):
    return pb.head.copy()


def aim(bone_name, desired):
    """Навести кость на направление. Работает при любых флагах наследования.

    Хитрость вместо вывода формулы: обнуляем матрицу базиса и читаем, что даёт риг —
    это и есть «мир без нашего поворота». Дальше нужный базис получается одним умножением.
    Иначе кости с inherit_rotation=False (у этого рига это forearm.l/r) уезжают на угол родителя.
    """
    pb = P[bone_name]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    d0 = (pb.tail - pb.head)
    if d0.length < 1e-6:
        return None
    q = d0.normalized().rotation_difference(desired.normalized())
    target = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    pb.matrix_basis = base.inverted() @ target
    bpy.context.view_layer.update()
    return q.angle


# --- перенос полной ориентации (направление + скрутка), где есть мировые повороты источника
wq_src = {k: Quaternion((v[3], v[0], v[1], v[2])) for k, v in (data.get('worldQ') or {}).items()}
wq_rest = {k: Quaternion((v[3], v[0], v[1], v[2])) for k, v in (data.get('restWorldQ') or {}).items()}
# matrix_local у кости Blender УЖЕ в пространстве арматуры: накопление родителей по нему —
# двойное преобразование (из-за него и доворот стопы выходил на 90°, и earlier-скрутка ломалась)
tgt_rest_world = {b.name: b.matrix_local.to_quaternion() for b in arm_obj.data.bones}


def set_world_rot(bone_name, q_target):
    pb = P[bone_name]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    target = Matrix.Translation(base.translation) @ q_target.to_matrix().to_4x4()
    pb.matrix_basis = base.inverted() @ target
    bpy.context.view_layer.update()


def twist_transfer():
    """Перенос поворота кости целиком, в собственной рамке рига.

    Нельзя переносить мировую ориентацию: у источника T-поза, у цели A-поза, и поправка
    «мировой rest цели ÷ мировой rest источника» тащит эту разницу поз. Правильно —
    сопряжение локального поворота: q_цели = M · q_источника · M⁻¹, где
    M = R_rest_цели⁻¹ · R_rest_источника (формула из RIG_COMPAT §1, там же проверена).
    """
    lq_src = {k: Quaternion((v[3], v[0], v[1], v[2])) for k, v in (data.get('localQ') or {}).items()}
    done = 0
    for chain, srcnames in CHAIN_SRC.items():
        for s_name, t_name in zip(srcnames, CHAIN_TGT[chain]):
            if s_name not in lq_src or s_name not in wq_rest:
                continue
            M = tgt_rest_world[t_name].inverted() @ wq_rest[s_name]
            q = M @ lq_src[s_name] @ M.inverted()
            pb = P[t_name]
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = q
            done += 1
    bpy.context.view_layer.update()
    return done


def roll_about_axis(bone_name, reference, target):
    """Довернуть кость вокруг её собственной оси так, чтобы опорный вектор лёг на цель.

    matrix_basis живёт в собственной рамке кости, поэтому мировую ось переводим в неё:
    q_local = R_bone⁻¹ · axis. Иначе поворот уходит не по той оси и «доворот» ломает позу.
    """
    pb = P[bone_name]
    axis = (pb.tail - pb.head).normalized()
    def perp(v):
        w = v - axis * v.dot(axis)
        return w.normalized() if w.length > 1e-9 else None
    cur, want = perp(reference), perp(target)
    if cur is None or want is None:
        return None
    ang = cur.angle(want)
    if cur.cross(want).dot(axis) < 0:
        ang = -ang
    # ось в ТЕКУЩЕЙ мировой ориентации кости, иначе при не-нулевой позе доворот уходит
    # с оси кости и ломает направление
    a_local = pb.matrix.to_quaternion().inverted() @ axis
    pb.matrix_basis = (pb.matrix_basis.to_quaternion() @ Quaternion(a_local, ang)).to_matrix().to_4x4()
    bpy.context.view_layer.update()
    return math.degrees(ang)


def palm_sole_normal(bone_name):
    """Нормаль ладони (или подошвы) по костям-детям, в мировых координатах."""
    kids = {'hand.l': ('index1.l', 'pinky1.l'), 'hand.r': ('index1.r', 'pinky1.r'),
            'foot.l': ('toes_01.l',), 'foot.r': ('toes_01.r',)}
    pb = P[bone_name]
    pair = kids.get(bone_name, ())
    a = pair[0] if len(pair) > 0 else None
    b = pair[1] if len(pair) > 1 else None
    if not a or a not in P:
        return None
    v1 = P[a].head - pb.head
    v2 = P[b].head - pb.head if (b and b in P) else None
    if v2 is None:
        # у стопы второго пальцевого ориентира нет — берём направление «вбок» от самой кости
        v2 = (pb.tail - pb.head).normalized().cross(Vector((0, 0, 1)))
    n = v1.cross(v2)
    return n.normalized() if n.length > 1e-9 else None


def hinge_axis(upper, lower):
    """Ось сгиба: перпендикуляр к плоскости пары костей (локоть, колено)."""
    a = (P[upper].tail - P[upper].head).normalized()
    b = (P[lower].tail - P[lower].head).normalized()
    n = a.cross(b)
    return n.normalized() if n.length > 1e-9 else None


def roll_limb_ends():
    """Ладонь и подошва разворачиваются по оси сгиба: у человека нормаль ладони и подошвы
    практически перпендикулярна плоскости сгиба. Это правило, а не измерение источника —
    в данных позы нет ни плоскости ладони, ни подошвы."""
    out = {}
    for hand, up, low in (('hand.l', 'arm.l', 'forearm.l'), ('hand.r', 'arm.r', 'forearm.r')):
        ax = hinge_axis(up, low)
        n = palm_sole_normal(hand) if ax else None
        if ax and n:
            out[hand] = roll_about_axis(hand, n, ax)
    # Стопа: ось сгиба здесь ЛАТЕРАЛЬНАЯ, а подошва смотрит ВНИЗ — они перпендикулярны,
    # поэтому правилом «подошва вдоль оси сгиба» стопы и заворачивались в пуанты.
    # Для стопы правило другое: подошва параллельна полу, когда носок у пола.
    for foot in ('foot.l', 'foot.r'):
        # нормаль подошвы берём из rest: в rest стопа стоит подошвой вниз, значит в локальной
        # рамке кости «низ» — фиксированный вектор. Дальше требуем, чтобы он снова смотрел вниз.
        b = arm_obj.data.bones[foot]
        n_local = (tgt_rest_world[foot].inverted() @ Vector((0, 0, -1)))
        n_cur = P[foot].matrix.to_quaternion() @ n_local
        out[foot] = roll_about_axis(foot, n_cur, Vector((0, 0, -1)))
    return out


applied = {}
for chain, src in CHAIN_SRC.items():
    tgt = CHAIN_TGT[chain]
    for i in range(len(src) - 1):
        d = tgt_pos[src[i + 1]] - tgt_pos[src[i]]
        a = aim(tgt[i], d)
        if a is not None:
            applied[tgt[i]] = round(math.degrees(a), 1)
            got = (P[tgt[i]].tail - P[tgt[i]].head).normalized()
            residual = round(math.degrees(got.angle(d.normalized())), 1)
            if residual > 1.0:
                print('RESIDUAL', tgt[i], residual, 'хотели', [round(v, 3) for v in d.normalized()],
                      'получили', [round(v, 3) for v in got])
print('AIMED', applied)
if os.environ.get('ROLL', 'off') == 'on':
    print('ROLL_APPLIED', roll_limb_ends())
# Скрутка ставится ПОСЛЕ наведения: наведение задаёт только направление и стёрло бы её.
# По умолчанию ВЫКЛЮЧЕНА: сопряжение по мировым rest-поворотам даёт 38° ошибки направления
# (источник T-поза, цель A-поза). Включать только вместе с честным swing-twist.
if os.environ.get('TWIST', 'off') == 'on':
    print('TWIST_BONES', twist_transfer())

# --- проверка: угол между направлениями соседних костей (не зависит от связности рига)
def ang(a, b, c):
    u, v = a - b, c - b
    if u.length < 1e-9 or v.length < 1e-9:
        return None
    return math.degrees(u.angle(v))


def joint_angles(get):
    out = {}
    for chain, tgt in CHAIN_TGT.items():
        pts = [get(n) for n in tgt]
        for i in range(1, len(pts) - 1):
            a = ang(pts[i - 1], pts[i], pts[i + 1])
            if a is not None:
                out[f'{chain}:{tgt[i]}'] = round(a, 1)
    return out


src_angles = joint_angles(lambda n: tgt_pos[n] if n.startswith('cf_j_') else None) if False else None
# углы источника считаем по его же точкам
# та же мера, что и у цели: угол между направлениями соседних сегментов (0° = прямая линия)
src_a = {}
for chain, srcnames in CHAIN_SRC.items():
    dirs = [(tgt_pos[srcnames[i + 1]] - tgt_pos[srcnames[i]]) for i in range(len(srcnames) - 1)]
    for i in range(1, len(dirs)):
        src_a[f'{chain}:{CHAIN_TGT[chain][i]}'] = round(math.degrees(dirs[i - 1].angle(dirs[i])), 1)

tgt_a = {}
for chain, tgt in CHAIN_TGT.items():
    # направление каждой кости цели: хвост минус голова
    dirs = [(P[n].tail - P[n].head) for n in tgt[:-1]]
    for i in range(1, len(dirs)):
        if dirs[i - 1].length > 1e-9 and dirs[i].length > 1e-9:
            tgt_a[f'{chain}:{tgt[i]}'] = round(math.degrees(dirs[i - 1].angle(dirs[i])), 1)

diffs = []
for k in sorted(src_a):
    if k in tgt_a:
        diffs.append((k, src_a[k], tgt_a[k], round(abs(src_a[k] - tgt_a[k]), 1)))
print('ANGLES')
for k, s, t, d in diffs:
    print(f'  {k:22s} источник {s:6.1f}°  риг {t:6.1f}°  разница {d:5.1f}°')
worst = max((d for _, _, _, d in diffs), default=None)
print('WORST_DIFF', worst)

# масштаб костей: приём «обнулить базис и поделить» может притащить масштаб и растянуть меш
bad = []
for chain in CHAIN_TGT:
    for n in CHAIN_TGT[chain]:
        sc = P[n].matrix.to_scale()
        if max(abs(sc.x - 1), abs(sc.y - 1), abs(sc.z - 1)) > 1e-3:
            bad.append((n, round(sc.x, 3), round(sc.y, 3), round(sc.z, 3)))
print('SCALED_BONES', bad)

# --- сохраняем СНАЧАЛА, иначе нельзя: если вернуть ограничители до сохранения, система
# управления ригом (IK по контролам) мгновенно возвращает его в rest-позу и поза теряется.
bpy.ops.wm.save_as_mainfile(filepath=out_path)
# и только теперь возвращаем ограничители в исходное состояние
for pb in P:
    for c in pb.constraints:
        c.mute = False
if arm_obj.animation_data:
    for fc in arm_obj.animation_data.drivers:
        fc.mute = False
bpy.context.view_layer.update()
print('SAVED', out_path)
print('APPLY_OK' if worst is not None and worst < 8.0 else 'APPLY_IMPRECISE')
