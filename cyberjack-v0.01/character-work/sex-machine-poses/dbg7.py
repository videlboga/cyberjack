import bpy, json
from mathutils import Vector, Matrix
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
b=pb['Left leg']
print('R_rest=bone.matrix_local.to_3x3()')
print(b.bone.matrix_local)
# location (1,0,0) moved head by...
b.location=Vector((1,0,0))
bpy.context.view_layer.update()
h1=arm.matrix_world @ b.head
b.location=Vector((0,0,0))
bpy.context.view_layer.update()
h0=arm.matrix_world @ b.head
print('delta for loc(1,0,0):', tuple(round(x,4) for x in (h1-h0)))
# so effective columns:
# loc(1,0,0) -> world delta = column? Let's get all three
for i,ax in enumerate([(1,0,0),(0,1,0),(0,0,1)]):
    b.location=Vector(ax); bpy.context.view_layer.update()
    hi=arm.matrix_world @ b.head
    b.location=Vector((0,0,0)); bpy.context.view_layer.update()
    print(f'loc{ax} -> world delta', tuple(round(x,4) for x in (hi-h0)))
# parent pose matrix
p=b.parent
print('parent', p.name)
print('parent pose matrix (armature space):')
print(p.matrix)
print('parent bone matrix_local:')
print(p.bone.matrix_local)
