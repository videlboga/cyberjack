# Чистый гуманоидный скелет (52 слота VRM) из rig_E + перенос весов.
#
# Зачем: у rig_E веса размазаны по helper-костям (root.x, *_stretch, *_twist), а кости ведёт
# слой контролов. Из-за этого любой перенос позы превращается в борьбу с ригом. Здесь строится
# вторая арматура строго по карте гуманоида (позиции rest копируются с rig_E, поэтому меш не
# должен сдвинуться ни на миллиметр), и веса перекладываются на неё.
#
#   blender -b file.blend --python build-humanoid-rig.py -- out.blend
import bpy, sys, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_path = argv[0] if argv else None
MAP_PATH = ('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/'
            'vrm-successful-2026-10-16/motion-analysis/data/canonical/rigE-humanoid-map.json')

humanoid = json.load(open(MAP_PATH))['map']
src_arm = bpy.data.objects['rig_E']
src_bones = src_arm.data.bones

# --- иерархия гуманоида (родитель для каждого слота)
PARENT = {
    'hips': None,
    'spine': 'hips', 'chest': 'spine', 'upperChest': 'chest', 'neck': 'upperChest', 'head': 'neck',
    'leftShoulder': 'upperChest', 'leftUpperArm': 'leftShoulder', 'leftLowerArm': 'leftUpperArm',
    'leftHand': 'leftLowerArm',
    'rightShoulder': 'upperChest', 'rightUpperArm': 'rightShoulder', 'rightLowerArm': 'rightUpperArm',
    'rightHand': 'rightLowerArm',
    'leftUpperLeg': 'hips', 'leftLowerLeg': 'leftUpperLeg', 'leftFoot': 'leftLowerLeg',
    'leftToes': 'leftFoot',
    'rightUpperLeg': 'hips', 'rightLowerLeg': 'rightUpperLeg', 'rightFoot': 'rightLowerLeg',
    'rightToes': 'rightFoot',
}
for side in ('left', 'right'):
    for finger, prox in (('Index', 'IndexProximal'), ('Middle', 'MiddleProximal'),
                         ('Ring', 'RingProximal'), ('Little', 'LittleProximal')):
        PARENT[f'{side}{finger}Proximal'] = f'{side}Hand'
        PARENT[f'{side}{finger}Intermediate'] = f'{side}{finger}Proximal'
        PARENT[f'{side}{finger}Distal'] = f'{side}{finger}Intermediate'
    PARENT[f'{side}ThumbMetacarpal'] = f'{side}Hand'
    PARENT[f'{side}ThumbProximal'] = f'{side}ThumbMetacarpal'
    PARENT[f'{side}ThumbDistal'] = f'{side}ThumbProximal'

# --- создаём арматуру
arm_data = bpy.data.armatures.new('rig_H')
arm_obj = bpy.data.objects.new('rig_H', arm_data)
bpy.context.scene.collection.objects.link(arm_obj)
bpy.context.view_layer.objects.active = arm_obj
arm_obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')

made = {}
order = [s for s in humanoid if s in PARENT]
order.sort(key=lambda s: 0 if PARENT[s] is None else 1)
pending = list(order)
while pending:
    progressed = False
    for slot in list(pending):
        parent = PARENT[slot]
        if parent and parent not in made:
            continue
        src = src_bones.get(humanoid[slot])
        if src is None:
            pending.remove(slot)
            continue
        eb = arm_data.edit_bones.new(slot)
        eb.head = src.head_local
        eb.tail = src.tail_local
        eb.roll = 0.0
        if parent:
            eb.parent = made[parent]
            eb.use_connect = False
        made[slot] = eb
        pending.remove(slot)
        progressed = True
    if not progressed:
        break
bpy.ops.object.mode_set(mode='OBJECT')
print('BUILT_BONES', len(made), 'из', len(humanoid))

# --- соответствие старое имя -> слот
old_to_slot = {humanoid[s]: s for s in made}

# --- для несопоставленных костей (helper) ищем ближайший слот по расстоянию между сегментами
def seg_dist(a1, a2, b1, b2):
    # грубая метрика: минимум из расстояний конец-конец и середина-середина
    mid_a = (a1 + a2) * 0.5
    mid_b = (b1 + b2) * 0.5
    return min((a1 - b1).length, (a2 - b2).length, (mid_a - mid_b).length)

slots_rest = {s: (made[s].head.copy(), made[s].tail.copy()) for s in made}
# Веса helper-костей раскладываем на ТРИ ближайших слота с затуханием по расстоянию:
# «один ближайший» даёт жёсткие стыки — на повороте плеча 30° растягивалось 193 ребра.
def slot_by_role(name):
    """Helper-кость относится к своему сегменту по смыслу имени, а не по расстоянию.
    Иначе `arm_stretch` уезжает на локоть, а `root.x` тянет бедро — и меш «размягчается». """
    n = name.lower()
    side = '.l' if n.endswith('.l') else ('.r' if n.endswith('.r') else '')
    pre = 'left' if side == '.l' else ('right' if side == '.r' else '')
    if any(k in n for k in ('index', 'middle', 'ring', 'pinky')):
        for f, slot in (('index', 'Index'), ('middle', 'Middle'), ('ring', 'Ring'), ('pinky', 'Little')):
            if f in n:
                if '3' in n:
                    return f'{pre}{slot}Distal'
                if '2' in n:
                    return f'{pre}{slot}Intermediate'
                return f'{pre}{slot}Proximal'
    if 'thumb' in n:
        if '3' in n:
            return f'{pre}ThumbDistal'
        if '2' in n:
            return f'{pre}ThumbProximal'
        return f'{pre}ThumbMetacarpal'
    if 'forearm' in n or 'wrist' in n:
        return f'{pre}LowerArm'
    if 'hand' in n:
        return f'{pre}Hand'
    if 'arm' in n or 'shoulder' in n or 'clavicle' in n:
        return f'{pre}UpperArm' if 'arm' in n else f'{pre}Shoulder'
    if 'thigh' in n:
        return f'{pre}UpperLeg'
    if 'leg' in n or 'shin' in n or 'knee' in n or 'calf' in n:
        return f'{pre}LowerLeg'
    if 'foot' in n or 'heel' in n or 'ankle' in n:
        return f'{pre}Foot'
    if 'toe' in n:
        return f'{pre}Toes'
    if 'neck' in n:
        return 'neck'
    # всё, что относится к голове и лицу, обязано идти в head: иначе брови/нос/щёки/уши
    # расходятся по ближайшим слотам и лицо превращается в месиво
    if any(k in n for k in ('head', 'face', 'eye', 'jaw', 'brow', 'nose', 'cheek', 'mouth',
                            'lip', 'tongue', 'ear', 'hair', 'teeth', 'eyelash', 'iris', 'pupil')):
        return 'head'
    if 'upperchest' in n or 'chest' in n:
        return 'chest'
    if any(k in n for k in ('spine', 'torso', 'waist')):
        return 'spine'
    if any(k in n for k in ('root', 'hips', 'pelvis', 'butt')):
        return 'hips'
    return None


nearest = {}
# «Экстра»-кости (параметрика, язык, юбка) НЕ принадлежат гуманоидным слотам: их веса нельзя
# размазывать по слотам, иначе слой параметрики умирает (проверено: суммы весов Vagina_* → 0).
import re as _re
EXTRA_RE = _re.compile(r'(agin|anus|^vag$|VaginaOpen|kutu|penis|clit|breast|bust|hair|skirt|cloth|_JNT)', _re.I)
extra_bones = [b.name for b in src_bones if EXTRA_RE.search(b.name)]
print('EXTRA_KEEP', len(extra_bones))
for b in src_bones:
    if b.name in old_to_slot or b.name in extra_bones:
        continue
    by_role = slot_by_role(b.name)
    if by_role and by_role in slots_rest:
        nearest[b.name] = [(by_role, 1.0)]
        continue
    scored = []
    for slot, (h, t) in slots_rest.items():
        d = seg_dist(b.head_local, b.tail_local, h, t)
        scored.append((d, slot))
    nearest[b.name] = [(scored[0][1], 1.0)]   # жёстко, без размазывания
print('HELPER_MAPPED', len(nearest))

# --- переносим веса
total_moved = 0
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    if not any(m.type == 'ARMATURE' and m.object == src_arm for m in obj.modifiers):
        continue
    groups = {g.name for g in obj.vertex_groups}
    plan = {}
    for name in groups:
        if name in old_to_slot:
            plan[name] = old_to_slot[name]
        elif name in nearest and nearest[name]:
            plan[name] = nearest[name]        # список (слот, доля)
        else:
            plan[name] = None            # маска/служебная группа — оставляем как есть
    # новые группы
    def slots_of(val):
        if val is None:
            return []
        if isinstance(val, str):
            return [(val, 1.0)]
        return val
    for val in plan.values():
        for slot, _ in slots_of(val):
            if slot not in groups:
                obj.vertex_groups.new(name=slot)
    # собираем веса по вершинам
    for v in obj.data.vertices:
        acc = {}
        for g in v.groups:
            gname = obj.vertex_groups[g.group].name
            for slot, share in slots_of(plan.get(gname)):
                acc[slot] = acc.get(slot, 0.0) + g.weight * share
        if not acc:
            continue
        total = sum(acc.values())
        if total <= 1e-9:
            continue
        for slot, w in acc.items():
            obj.vertex_groups[slot].add([v.index], w / total, 'REPLACE')
        for g in list(v.groups):
            gname = obj.vertex_groups[g.group].name
            if plan.get(gname):
                obj.vertex_groups[gname].add([v.index], 0.0, 'REPLACE')
        total_moved += 1
    # переключаем модификатор на новую арматуру
    for m in obj.modifiers:
        if m.type == 'ARMATURE' and m.object == src_arm:
            m.object = arm_obj
print('WEIGHTS_TRANSFERRED', total_moved)

# --- добивка весов: вершины, у которых суммарный вес на слоты меньше единицы (остальное висело
# на масках вроде 'Jacket Mask'/'Body2'), привязывались к случайной кости и улетали на 12 см —
# это и давало «разрез» на груди. Досыпаем остаток на ближайший по расстоянию слот.
slot_seg = {s: (arm_obj.data.bones[s].head_local.copy(), arm_obj.data.bones[s].tail_local.copy()) for s in slots_rest}
fixed = 0
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    if not any(m.type == 'ARMATURE' and m.object == arm_obj for m in obj.modifiers):
        continue
    slot_names = set(slots_rest)
    groups = {g.name: g for g in obj.vertex_groups}
    for gname in slot_names:
        if gname not in groups:
            obj.vertex_groups.new(name=gname)
    for v in obj.data.vertices:
        have = {obj.vertex_groups[g.group].name: g.weight for g in v.groups
                if obj.vertex_groups[g.group].name in slot_names}
        total = sum(have.values())
        if total > 0.999:
            continue
        p = obj.matrix_world @ v.co
        best = min(slot_names, key=lambda s: seg_dist(p, p, slot_seg[s][0], slot_seg[s][1]))
        cur = have.get(best, 0.0)
        obj.vertex_groups[best].add([v.index], cur + (1.0 - total), 'REPLACE')
        fixed += 1
print('WEIGHTS_FIXED', fixed)


# --- возвращаем «экстра»-кости в новый риг отдельным слоем, чтобы параметрика не умерла
if 'extra_bones' in dir() and extra_bones:
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_obj.data.edit_bones
    sb = {b.name: b for b in src_bones}
    added = []
    for n in extra_bones:
        if n in eb:
            continue
        b = sb[n]
        nb = eb.new(n)
        nb.head = b.head_local
        nb.tail = b.tail_local
        nb.use_deform = True
        added.append(n)
    for n in added:
        p = sb[n].parent.name if sb[n].parent else None
        if p in eb:
            eb[n].parent = eb[p]
        else:
            for root in ('hips', 'c_root.x', 'spine_01_cns.x'):
                if root in eb:
                    eb[n].parent = eb[root]
                    break
    bpy.ops.object.mode_set(mode='OBJECT')
    for n in added:
        arm_obj.data.bones[n].use_deform = True
    print('EXTRA_ADDED', len(added))


src_arm.hide_viewport = True
src_arm.hide_render = True
if out_path:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=out_path, check_existing=False,
                                compress=False, relative_remap=False)
    print('SAVED', out_path)
print('HUMANOID_RIG_OK')
