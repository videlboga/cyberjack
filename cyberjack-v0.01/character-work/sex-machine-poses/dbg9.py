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
def aim(name, dir_world):
    b=pb[name]
    bpy.context.view_layer.update()
    cur=((arm.matrix_world @ pb[name].tail) - head_w(name)).normalized()
    d=Vector(dir_world).normalized()
    q=cur.rotation_difference(d)
    mw3=arm.matrix_world.to_3x3()
    local_q=(mw3.inverted() @ q.to_matrix() @ mw3).to_quaternion()
    b.rotation_quaternion = local_q @ b.rotation_quaternion
    bpy.context.view_layer.update()

hip=Vector(TGT['hip']); knee=Vector(TGT['knee']); ankle=Vector(TGT['ankle']); toe=Vector(TGT['toe'])
hip[0]=0.0782
print('targets: hip',tuple(hip),'knee',tuple(knee),'ankle',tuple(ankle),'toe',tuple(toe))
move_head_to('Left leg', hip)
print('after move: leg head', tuple(round(x,4) for x in head_w('Left leg')))
print('after move: knee head', tuple(round(x,4) for x in head_w('Left knee')))
aim('Left leg', knee-hip)
print('after aim: leg head', tuple(round(x,4) for x in head_w('Left leg')))
print('after aim: leg tail', tuple(round(x,4) for x in (arm.matrix_world @ pb['Left leg'].tail)))
print('after aim: knee head', tuple(round(x,4) for x in head_w('Left knee')))
move_head_to('Left knee', knee)
print('after move knee: knee head', tuple(round(x,4) for x in head_w('Left knee')))
print('after move knee: ankle head', tuple(round(x,4) for x in head_w('Left ankle')))
