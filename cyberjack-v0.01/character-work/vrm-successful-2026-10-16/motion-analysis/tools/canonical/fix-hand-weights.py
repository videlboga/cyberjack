# Перенос весов кисти с контролов (c_*) на деформирующие кости.
#
# Причина: в меше тела 1 681 вершина кисти висит на c_index1_base.l, c_thumb3.l, c_middle3.l и т.д.
# Контролы двигаются своей логикой, и как только риг ставится извне (наш перенос позы, экспорт в
# VRM/Unity), кисть уезжает и рвётся на ленты. Веса должны стоять на скин-костях.
#
#   blender -b base-rigged-humanoid.blend --python fix-hand-weights.py -- out.blend
import bpy, sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_path = argv[0] if argv else None

arm = bpy.data.objects['rig_E']
bones = arm.data.bones

# карта: группа контрола -> деформирующая кость
FINGER_PREFIX = ('index', 'middle', 'ring', 'pinky', 'thumb')
mapping = {}
for b in bones:
    n = b.name
    if not n.startswith('c_'):
        continue
    stem = n[2:]
    for suf in ('_base', '_rot', '_ik'):
        if stem.endswith(suf):
            stem = stem[:-len(suf)]
    if '.' in stem:
        base, side = stem.rsplit('.', 1)      # index3 / l
    else:
        base, side = stem, ''
    if not base.startswith(FINGER_PREFIX):
        continue
    # цели — деформирующие *_ref-кости: именно они повторяют цепочку контролов.
    # c_index3.l -> index3_ref.l, c_index1_base.l -> index1_base_ref.l и т.д.
    cands = [f'{base}_ref.{side}', f'{base}.{side}'] if side else [f'{base}_ref', base]
    for cand in cands:
        if cand in bones and bones[cand].use_deform:
            mapping[n] = cand
            break

print('MAPPING', len(mapping), sorted(mapping.items())[:6])

changed_verts = 0
moved_weight = 0.0
for obj in bpy.data.objects:
    if obj.type != 'MESH' or not any(m.type == 'ARMATURE' for m in obj.modifiers):
        continue
    groups = {g.name: g.index for g in obj.vertex_groups}
    for _, dst in mapping.items():                     # цели могут отсутствовать — создаём
        if dst not in groups:
            obj.vertex_groups.new(name=dst)
    groups = {g.name: g.index for g in obj.vertex_groups}
    todo = [(src, dst) for src, dst in mapping.items() if src in groups and dst in groups]
    if not todo:
        continue
    touched = 0
    for v in obj.data.vertices:
        moved = []
        for g in list(v.groups):
            name = obj.vertex_groups[g.group].name
            for src, dst in todo:
                if name == src and g.weight > 1e-4:
                    moved.append((src, dst, g.weight))
                    break
        if not moved:
            continue
        for src, dst, w in moved:
            obj.vertex_groups[dst].add([v.index], w, 'REPLACE')
            obj.vertex_groups[src].add([v.index], 0.0, 'REPLACE')
            moved_weight += w
        touched += 1
    if touched:
        print('OBJECT', obj.name, 'вершин перевешено', touched)
    changed_verts += touched

print('CHANGED_VERTS', changed_verts, 'MOVED_WEIGHT', round(moved_weight, 1))

if out_path:
    bpy.ops.wm.save_as_mainfile(filepath=out_path)
    print('SAVED', out_path)
print('FIX_OK')
