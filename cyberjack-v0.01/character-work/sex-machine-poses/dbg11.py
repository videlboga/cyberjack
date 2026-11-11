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
# place
b=pb['Left leg']
delta=hip-head_w('Left leg')
R=b.bone.matrix_local.to_3x3()
b.location += R.inverted() @ delta
bpy.context.view_layer.update()
print('head', tuple(round(x,4) for x in head_w('Left leg')))
# aim with WORLD quaternion (not converted)
cur=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
d=(knee-hip).normalized()
q_world=cur.rotation_difference(d)   # world-space quaternion
print('q_world', tuple(round(x,4) for x in q_world))
# Test: does setting rotation_quaternion = q_world rotate the bone correctly in world?
b.rotation_mode='QUATERNION'
b.rotation_quaternion = q_world
bpy.context.view_layer.update()
cur2=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
print('after world-q: axis', tuple(round(x,4) for x in cur2), 'target', tuple(round(x,4) for x in d))
print('head after', tuple(round(x,4) for x in head_w('Left leg')))
