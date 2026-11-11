import bpy, json
from mathutils import Vector
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
TGT=json.loads(Path('out/pose067_blender_targets.json').read_text())
hip=Vector(TGT['hip'])
def wh(n): return arm.matrix_world @ pb[n].head
# set location directly (matrix_basis)
pb['Left leg'].location = hip - pb['Left leg'].bone.head_local
bpy.context.view_layer.update()
print('direct loc set -> head', tuple(round(x,3) for x in wh('Left leg')))
# now delta approach
pb['Left leg'].location = (0,0,0)
bpy.context.view_layer.update()
print('reset -> head', tuple(round(x,3) for x in wh('Left leg')))
pb['Left leg'].location += (hip - wh('Left leg'))
bpy.context.view_layer.update()
print('delta -> head', tuple(round(x,3) for x in wh('Left leg')))
print('location after delta', tuple(round(x,4) for x in pb['Left leg'].location))
