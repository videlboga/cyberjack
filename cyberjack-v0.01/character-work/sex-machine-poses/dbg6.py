import bpy, json
from mathutils import Vector, Matrix
from pathlib import Path
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()
b=pb['Left leg']
# Test: apply a pure +Z world translation via location = R_bone^-1 * delta
R=b.bone.matrix_local.to_3x3()  # bone orientation in armature space at rest
delta_world=Vector((0,0,1.0))
loc_local=R.inverted() @ delta_world
b.location = loc_local
bpy.context.view_layer.update()
print('expected head z +1; actual head', tuple(round(x,4) for x in (arm.matrix_world @ b.head)))
# but careful: matrix_basis loc is applied BEFORE rotation in bone space; with identity rotation
# the effective world delta = R @ loc_local = delta_world. Good if rotation identity.
