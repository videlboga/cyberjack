import bpy, json
from mathutils import Vector, Matrix
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
def wh(n): return arm.matrix_world @ pb[n].head

b=pb['Left leg']
print('bone.matrix_local (rest):')
print(b.bone.matrix_local)
print('pose bone matrix BEFORE:')
print(b.matrix)
target=Vector((0.0,0.332,0.503))
b.location += (target - wh('Left leg'))
bpy.context.view_layer.update()
print('pose bone matrix AFTER loc:')
print(b.matrix)
print('actual wh', tuple(round(x,3) for x in wh('Left leg')))
p=b.parent
while p:
    print('parent', p.name, 'loc', tuple(round(x,3) for x in p.location), 'quat', tuple(round(x,3) for x in p.rotation_quaternion))
    p=p.parent
