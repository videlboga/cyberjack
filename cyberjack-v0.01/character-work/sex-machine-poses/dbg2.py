import bpy, json
from mathutils import Vector
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
def wh(n): return arm.matrix_world @ pb[n].head
def wt(n): return arm.matrix_world @ pb[n].tail
b=pb['Left leg']
print('rest head', tuple(round(x,3) for x in b.head), 'rest tail', tuple(round(x,3) for x in b.tail))
print('pose loc', tuple(round(x,3) for x in b.location), 'quat', tuple(round(x,3) for x in b.rotation_quaternion), 'mode', b.rotation_mode)
print('matrix_basis\n', b.matrix_basis)
print('bone head_local', tuple(round(x,3) for x in b.bone.head_local), 'tail_local', tuple(round(x,3) for x in b.bone.tail_local))
print('parent', b.parent.name if b.parent else None)
print('arm.matrix_world', arm.matrix_world)
# check use_inherit_rotation / inherit_scale
print('inherit_scale', b.bone.inherit_scale, 'use_inherit_rotation', b.bone.use_inherit_rotation)
print('use_connect', b.bone.use_connect)
