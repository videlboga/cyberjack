# Включить деформирование у костей, на которых реально висят веса.
#
# В файле 35.5 % вершин тела привязаны к костям вида root.x, arm_stretch, forearm_twist,
# c_arm_twist_offset — и у всех use_deform = False. В Blender такая кость не деформирует меш,
# поэтому эти вершины остаются в bind-позе, пока соседние уезжают: получаются «полосы» вместо
# плеча и вывернутые кисти. Флаг проставляем тем костям, у которых есть веса.
#
#   blender -b asset.blend --python fix-deform-flags.py -- out.blend
import bpy, sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_path = argv[0] if argv else None

arm = bpy.data.objects['rig_E']
bones = arm.data.bones

weighted = set()
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    for vg in obj.vertex_groups:
        if vg.name in bones:
            weighted.add(vg.name)

# кость считается «несущей веса», если у неё есть вершины с ненулевым весом
nonempty = set()
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    groups = {g.index: g.name for g in obj.vertex_groups if g.name in bones}
    for v in obj.data.vertices:
        for g in v.groups:
            if g.weight > 1e-4 and g.group in groups:
                nonempty.add(groups[g.group])

flip = sorted(n for n in nonempty if not bones[n].use_deform)
for n in flip:
    bones[n].use_deform = True

print('WEIGHTED_BONES', len(nonempty))
print('FLIPPED', len(flip), flip[:20])
if out_path:
    bpy.ops.wm.save_as_mainfile(filepath=out_path)
    print('SAVED', out_path)
print('DEFORM_FLAGS_OK')
