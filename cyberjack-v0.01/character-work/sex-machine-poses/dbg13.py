import bpy, json, math
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
Rb=b.bone.matrix_local.to_3x3()
b.location += Rb.inverted() @ delta
bpy.context.view_layer.update()

cur=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
d=(knee-hip).normalized()
q_world=cur.rotation_difference(d)

# Convert world rotation to pose-bone local: the bone's rest orientation Rb maps bone-local to armature.
# A world-space rotation q_world must be expressed in bone-local space as:
#   q_local = Rb^-1 @ q_world @ Rb   (conjugation)
q_local=(Rb.inverted() @ q_world.to_matrix() @ Rb).to_quaternion()
b.rotation_quaternion = q_local @ b.rotation_quaternion
bpy.context.view_layer.update()
cur2=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
print('method Rb-conjugate: axis', tuple(round(x,4) for x in cur2), 'target', tuple(round(x,4) for x in d))
print('head', tuple(round(x,4) for x in head_w('Left leg')))
print('knee head', tuple(round(x,4) for x in head_w('Left knee')))
