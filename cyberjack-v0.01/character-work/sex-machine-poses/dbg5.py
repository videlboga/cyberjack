import bpy, json
from mathutils import Vector, Matrix
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
b=pb['Left leg']
print('bone.matrix (bone space, Y along bone):')
print(b.bone.matrix)
print('bone.matrix_local:')
print(b.bone.matrix_local)
print('pose matrix_basis:')
print(b.matrix_basis)
print('=> matrix_basis translation should be in PARENT-pose space, scaled by parent rest')
# Test: set location to a known vector and see where head goes
b.location = Vector((1.0,0,0))
bpy.context.view_layer.update()
print('after loc=(1,0,0): head', tuple(round(x,4) for x in (arm.matrix_world @ b.head)))
b.location = Vector((0,0,0))
bpy.context.view_layer.update()
# try location in bone space: matrix_basis translation is applied in bone-local rest orientation?
# From Blender docs: pose bone location is in bone local space (along bone axes)
b.location = b.bone.matrix_local.to_3x3().inverted() @ Vector((0.5,0,0))
bpy.context.view_layer.update()
print('after bone-space +X*0.5 loc: head', tuple(round(x,4) for x in (arm.matrix_world @ b.head)))
