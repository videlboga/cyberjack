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
def tail_w(n): return arm.matrix_world @ pb[n].tail
def move_head_to(name, target):
    b=pb[name]; bpy.context.view_layer.update()
    delta=Vector(target)-head_w(name)
    R=b.bone.matrix_local.to_3x3()
    b.location += R.inverted() @ delta
    bpy.context.view_layer.update()
def aim(name, dir_world):
    b=pb[name]; bpy.context.view_layer.update()
    cur=(tail_w(name)-head_w(name)).normalized()
    d=Vector(dir_world).normalized()
    q_world=cur.rotation_difference(d)
    Rb=b.bone.matrix_local.to_3x3()
    q_local=(Rb.inverted() @ q_world.to_matrix() @ Rb).to_quaternion()
    b.rotation_quaternion = q_local @ b.rotation_quaternion
    bpy.context.view_layer.update()

hip=Vector(TGT['hipL']); knee=Vector(TGT['kneeL']); ankle=Vector(TGT['ankleL']); toe=Vector(TGT['toe'])
print('targets hip',tuple(round(x,3) for x in hip),' knee',tuple(round(x,3) for x in knee),' ankle',tuple(round(x,3) for x in ankle))
move_head_to('Left leg', hip)
print('1. leg head', tuple(round(x,4) for x in head_w('Left leg')), 'knee head', tuple(round(x,4) for x in head_w('Left knee')))
aim('Left leg', knee-hip)
print('2. after aim leg: head', tuple(round(x,4) for x in head_w('Left leg')))
print('   leg tail', tuple(round(x,4) for x in tail_w('Left leg')))
print('   knee head (child)', tuple(round(x,4) for x in head_w('Left knee')))
move_head_to('Left knee', knee)
print('3. after move knee: knee head', tuple(round(x,4) for x in head_w('Left knee')))
print('   ankle head (child)', tuple(round(x,4) for x in head_w('Left ankle')))
print('   leg head still', tuple(round(x,4) for x in head_w('Left leg')))
aim('Left knee', ankle-knee)
print('4. after aim shin: knee head', tuple(round(x,4) for x in head_w('Left knee')), 'ankle head', tuple(round(x,4) for x in head_w('Left ankle')))
move_head_to('Left ankle', ankle)
print('5. after move ankle: ankle head', tuple(round(x,4) for x in head_w('Left ankle')))
