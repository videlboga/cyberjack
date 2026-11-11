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
hip=Vector(TGT['hipL']); knee=Vector(TGT['kneeL']); ankle=Vector(TGT['ankleL'])
print('=== ISOLATED KNEE BONE TEST ===')
b=pb['Left knee']
print('knee bone rest head', tuple(round(x,4) for x in b.bone.head_local))
print('knee parent', b.parent.name, 'parent head', tuple(round(x,4) for x in b.parent.head))
# current knee head
print('knee head world (rest pose)', tuple(round(x,4) for x in head_w('Left knee')))
# move knee bone head to knee target
delta=knee-head_w('Left knee')
R=b.bone.matrix_local.to_3x3()
b.location += R.inverted() @ delta
bpy.context.view_layer.update()
print('after move: knee head', tuple(round(x,4) for x in head_w('Left knee')), 'target', tuple(round(x,4) for x in knee))
print('  ankle head (child)', tuple(round(x,4) for x in head_w('Left ankle')))
print('  LEG head (parent — MUST NOT MOVE)', tuple(round(x,4) for x in head_w('Left leg')))
print()
print('=== ARM CHAIN: same test ===')
b=pb['Left elbow']
hand=Vector(TGT['handL'])
print('elbow parent', b.parent.name)
