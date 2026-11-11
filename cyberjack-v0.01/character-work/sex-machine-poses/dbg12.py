import bpy, json
from mathutils import Vector, Matrix, Quaternion
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
TGT=json.loads(Path('out/pose067_blender_targets.json').read_text())
def head_w(n): return arm.matrix_world @ pb[n].head
hip=Vector(TGT['hip']); hip[0]=0.0782
knee=Vector(TGT['knee'])
b=pb['Left leg']
delta=hip-head_w('Left leg')
R=b.bone.matrix_local.to_3x3()
b.location += R.inverted() @ delta
bpy.context.view_layer.update()

cur=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
d=(knee-hip).normalized()
q_world=cur.rotation_difference(d)
print('bone.matrix_local 3x3:')
M=b.bone.matrix_local
print(M)
Rb=M.to_3x3()
print('Rb columns (bone X,Y,Z in armature space):')
print('  X', tuple(round(x,4) for x in Rb.col[0]))
print('  Y', tuple(round(x,4) for x in Rb.col[1]))
print('  Z', tuple(round(x,4) for x in Rb.col[2]))
# The bone axis (head->tail) in rest: 
ax=(b.bone.tail_local-b.bone.head_local).normalized()
print('rest bone axis in armature space:', tuple(round(x,4) for x in ax), ' = Rb @ (0,1,0)?', tuple(round(x,4) for x in (Rb@Vector((0,1,0)))))
# Pose bone rotation_quaternion rotates the bone in its PARENT's pose space? Or bone local?
# Blender: pose bone rotation is applied in bone-local space (matrix_basis = T @ R @ S in bone space).
# Test: set rotation to 90 deg about bone-local X and see what happens to axis
b.rotation_quaternion=Quaternion((1,0,0), 0)  # placeholder identity (w=1)
bpy.context.view_layer.update()
import math
# rotate 90 deg about bone-local Y (bone axis) - should not change axis
b.rotation_quaternion=Quaternion((0,1,0), math.radians(90))
bpy.context.view_layer.update()
cur3=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
print('after +90 about local Y: axis', tuple(round(x,4) for x in cur3))
# rotate about world X by 90
b.rotation_quaternion=Quaternion((1,0,0,1.0))  # w=1? no: Quaternion((axis),angle)
bpy.context.view_layer.update()
