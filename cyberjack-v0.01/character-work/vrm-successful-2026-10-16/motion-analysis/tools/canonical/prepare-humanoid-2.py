# Подготовка базовой модели, шаг 2: пальцы для гуманоидной цепочки и карта VRM.
#
# В базовой модели на палец приходится один deform-сустав (index1.l), а VRM требует три.
# Создаём index2/index3 как копии rest-трансформов _ref-костей: они не деформируют меш
# (весов у них нет), но дают валидную цепочку и место для будущей анимации пальцев.
#
#   blender -b base-rigged-humanoid.blend --python prepare-humanoid-2.py -- out.blend map.json
import bpy, sys, json
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
out_path, map_path = argv[0], argv[1]
arm = bpy.data.objects['rig_E']
mapping = json.load(open(map_path))['map']

FINGERS = (('index', 'Index'), ('middle', 'Middle'), ('ring', 'Ring'), ('pinky', 'Little'), ('thumb', 'Thumb'))

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
created = []
for side in ('l', 'r'):
    for rig, _ in FINGERS:
        for idx, ref in ((2, f'{rig}2_ref.{side}'), (3, f'{rig}3_ref.{side}')):
            name = f'{rig}{idx}.{side}'
            if name in eb or ref not in eb:
                continue
            src = eb[ref]
            b = eb.new(name)
            b.head = src.head.copy()
            b.tail = src.tail.copy()
            b.roll = src.roll
            b.use_deform = False
            parent = eb.get(f'{rig}{idx - 1}.{side}') or eb.get(f'{rig}1.{side}')
            if parent:
                b.parent = parent
                b.use_connect = False
            created.append(name)
bpy.ops.object.mode_set(mode='OBJECT')
print('FINGER_BONES_CREATED', len(created), created[:6])

# карта: теперь адреса пальцев — новые кости, а не _ref
fixed = {}
for vrm_name, rig_name in mapping.items():
    if rig_name.endswith('_ref.l') or rig_name.endswith('_ref.r'):
        side = rig_name[-1]
        short = rig_name.split('.')[0].replace('_ref', '')
        if short in (f'{r}{i}' for r, _ in FINGERS for i in (2, 3)):
            rig_name = f'{short}.{side}'
    fixed[vrm_name] = rig_name
mapping = fixed

ext = arm.data.vrm_addon_extension
hb = ext.vrm1.humanoid.human_bones
assigned = 0
import re
def snake(name):
    # аддон VRM хранит слоты в snake_case: leftIndexProximal → left_index_proximal
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()

slots = {p.identifier for p in hb.bl_rna.properties}
for vrm_name, rig_name in mapping.items():
    slot = vrm_name if vrm_name in slots else snake(vrm_name)
    if slot not in slots:
        print('NO_VRM_SLOT', vrm_name, slot)
        continue
    if rig_name not in arm.data.bones:
        print('NO_RIG_BONE', vrm_name, rig_name)
        continue
    getattr(hb, slot).node.bone_name = rig_name
    assigned += 1
print('MAP_ASSIGNED', assigned, 'из', len(mapping))


def under_hips(name, root='hips'):
    b = arm.data.bones.get(name)
    while b:
        if b.name == root:
            return True
        b = b.parent
    return False


bad = [(k, v) for k, v in mapping.items() if not under_hips(v)]
print('NOT_UNDER_HIPS', len(bad), bad[:5])

# цепочки пальцев
broken = []
for side in ('left', 'right'):
    for _, f in FINGERS:
        chain = [mapping.get(f'{side}{f}{s}') for s in ('Proximal', 'Intermediate', 'Distal')]
        if any(c is None for c in chain):
            broken.append((side, f, 'нет кости'))
            continue
        for a, b in zip(chain, chain[1:]):
            if arm.data.bones[b].parent is None or arm.data.bones[b].parent.name != a:
                broken.append((side, f, a, b))
print('FINGER_CHAIN_BROKEN', len(broken), broken[:3])

bpy.ops.wm.save_as_mainfile(filepath=out_path)
print('SAVED', out_path)
print('PREPARE2_OK')
