import bpy, json
from mathutils import Vector
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
TGT=json.loads(Path('out/pose067_blender_targets.json').read_text())
hip=Vector(TGT['hip']); knee=Vector(TGT['knee'])
def wh(n): return arm.matrix_world @ pb[n].head
def wt(n): return arm.matrix_world @ pb[n].tail
print('BEFORE: Left leg head', tuple(round(x,3) for x in wh('Left leg')), 'tail', tuple(round(x,3) for x in wt('Left leg')))
print('BEFORE: Left knee head', tuple(round(x,3) for x in wh('Left knee')), 'tail', tuple(round(x,3) for x in wt('Left knee')))
print('targets hip', tuple(round(x,3) for x in hip), 'knee', tuple(round(x,3) for x in knee))
# place Left leg head at hip target
pb['Left leg'].location += (hip - wh('Left leg'))
bpy.context.view_layer.update()
print('AFTER move: Left leg head', tuple(round(x,3) for x in wh('Left leg')))
print('AFTER move: Left knee head (child followed?)', tuple(round(x,3) for x in wh('Left knee')))
# aim Left leg at knee
cur=(wt('Left leg')-wh('Left leg')).normalized()
d=(knee-hip).normalized()
print('cur dir', tuple(round(x,3) for x in cur), 'target dir', tuple(round(x,3) for x in d))
q=cur.rotation_difference(d)
mw3=arm.matrix_world.to_3x3()
local_q=(mw3.inverted() @ q.to_matrix() @ mw3).to_quaternion()
pb['Left leg'].rotation_quaternion = local_q @ pb['Left leg'].rotation_quaternion
bpy.context.view_layer.update()
print('AFTER aim: Left leg head', tuple(round(x,3) for x in wh('Left leg')), 'tail', tuple(round(x,3) for x in wt('Left leg')))
print('AFTER aim: Left knee head', tuple(round(x,3) for x in wh('Left knee')))
