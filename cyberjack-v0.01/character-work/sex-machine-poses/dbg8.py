import bpy, json
from mathutils import Vector, Matrix
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
def head_w(n): return arm.matrix_world @ pb[n].head
TGT=json.loads(Path('out/pose067_blender_targets.json').read_text())
target=Vector(TGT['hip'])  # (0, 0.332, 0.503)
b=pb['Left leg']
bpy.context.view_layer.update()
print('head before', tuple(round(x,4) for x in head_w('Left leg')))
delta=target-head_w('Left leg')
print('delta needed', tuple(round(x,4) for x in delta))
R=b.bone.matrix_local.to_3x3()
L=R.inverted() @ delta
print('L = R^-1 @ delta', tuple(round(x,4) for x in L))
b.location += L
bpy.context.view_layer.update()
print('head after ', tuple(round(x,4) for x in head_w('Left leg')))
print('target     ', tuple(round(x,4) for x in target))
# check: R @ L should equal delta
print('R@L', tuple(round(x,4) for x in (R@L)), 'vs delta', tuple(round(x,4) for x in delta))
