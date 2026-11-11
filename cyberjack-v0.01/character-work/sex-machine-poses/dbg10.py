import bpy, json
from mathutils import Vector, Matrix
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
TGT=json.loads(Path('out/pose067_blender_targets.json').read_text())
def head_w(n): return arm.matrix_world @ pb[n].head
def move_head_to(name, target):
    b=pb[name]
    bpy.context.view_layer.update()
    delta=Vector(target)-head_w(name)
    R=b.bone.matrix_local.to_3x3()
    b.location += R.inverted() @ delta
    bpy.context.view_layer.update()
hip=Vector(TGT['hip']); hip[0]=0.0782
knee=Vector(TGT['knee'])
move_head_to('Left leg', hip)
print('leg head ok:', tuple(round(x,4) for x in head_w('Left leg')))
# manual aim: compute current axis and target, apply rotation, check
b=pb['Left leg']
cur=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
d=(knee-hip).normalized()
print('cur axis', tuple(round(x,4) for x in cur))
print('tgt dir ', tuple(round(x,4) for x in d))
q=cur.rotation_difference(d)
print('q', tuple(round(x,4) for x in q))
mw3=arm.matrix_world.to_3x3()
local_q=(mw3.inverted() @ q.to_matrix() @ mw3).to_quaternion()
print('local_q', tuple(round(x,4) for x in local_q))
b.rotation_quaternion = local_q @ b.rotation_quaternion
bpy.context.view_layer.update()
cur2=((arm.matrix_world @ b.tail)-head_w('Left leg')).normalized()
print('after: axis', tuple(round(x,4) for x in cur2), 'head', tuple(round(x,4) for x in head_w('Left leg')))
print('knee head after aim:', tuple(round(x,4) for x in head_w('Left knee')))
# The aim rotates around the bone HEAD in pose space — Blender rotates pose bone around its head. Check:
print('leg tail after:', tuple(round(x,4) for x in (arm.matrix_world @ b.tail)))
