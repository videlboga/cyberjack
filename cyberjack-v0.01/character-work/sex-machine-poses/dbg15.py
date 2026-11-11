import bpy, json, math
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
    b=pb[name]; bpy.context.view_layer.update()
    delta=Vector(target)-head_w(name)
    R=b.bone.matrix_local.to_3x3()
    b.location += R.inverted() @ delta
    bpy.context.view_layer.update()
def aim_segment(bone_name, next_bone_name, dir_world):
    b=pb[bone_name]; bpy.context.view_layer.update()
    cur=(head_w(next_bone_name)-head_w(bone_name)).normalized()
    d=Vector(dir_world).normalized()
    q_world=cur.rotation_difference(d)
    Rb=b.bone.matrix_local.to_3x3()
    q_local=(Rb.inverted() @ q_world.to_matrix() @ Rb).to_quaternion()
    b.rotation_quaternion = q_local @ b.rotation_quaternion
    bpy.context.view_layer.update()

hip=Vector(TGT['hipL']); knee=Vector(TGT['kneeL']); ankle=Vector(TGT['ankleL'])
print('=== LEG CHAIN DEBUG ===')
print('start: leg head', tuple(round(x,4) for x in head_w('Left leg')), 'knee head', tuple(round(x,4) for x in head_w('Left knee')))
move_head_to('Left leg', hip)
print('after move hip: leg head', tuple(round(x,4) for x in head_w('Left leg')))
print('  knee head (should be UNCHANGED relative to leg, i.e. moved with parent)', tuple(round(x,4) for x in head_w('Left knee')))
aim_segment('Left leg','Left knee', knee-hip)
print('after aim thigh: leg head', tuple(round(x,4) for x in head_w('Left leg')))
print('  knee head (rotated around leg head)', tuple(round(x,4) for x in head_w('Left knee')))
print('  target knee', tuple(round(x,4) for x in knee))
move_head_to('Left knee', knee)
print('after move knee to target: knee head', tuple(round(x,4) for x in head_w('Left knee')))
print('  ankle head', tuple(round(x,4) for x in head_w('Left ankle')))
print('  LEG head (parent moved with child? NO — parent should not move)', tuple(round(x,4) for x in head_w('Left leg')))
aim_segment('Left knee','Left ankle', ankle-knee)
print('after aim shin: knee head', tuple(round(x,4) for x in head_w('Left knee')), 'ankle head', tuple(round(x,4) for x in head_w('Left ankle')))
move_head_to('Left ankle', ankle)
print('after move ankle: ankle head', tuple(round(x,4) for x in head_w('Left ankle')))
print('  knee head (should NOT move)', tuple(round(x,4) for x in head_w('Left knee')))
print('  leg head (should NOT move)', tuple(round(x,4) for x in head_w('Left leg')))
