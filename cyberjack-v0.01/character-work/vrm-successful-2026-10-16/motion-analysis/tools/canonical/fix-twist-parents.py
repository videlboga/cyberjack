# Twisty-«помощники» (носители весов) вешаются на деформирующий сегмент конечности.
#
# В этом риге кости вида arm_twist / forearm_twist / thigh_twist / leg_twist висят на контролах
# (c_shoulder, forearm_stretch, c_thigh_b, leg_stretch). Когда риг ставят извне, контролы не
# двигаются, а конечность двигается — и эти кости остаются на месте, растягивая меш лентами.
#
#   blender -b file.blend --python fix-twist-parents.py -- out.blend
import bpy, sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_path = argv[0] if argv else None

MAP = {
    'arm_twist': 'arm',
    'forearm_twist': 'forearm',
    'thigh_twist': 'thigh',
    'leg_twist': 'leg',
    'hand_rot_twist': 'hand',
}

arm = bpy.data.objects['rig_E']
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones

report = []
for b in list(eb):
    stem, _, side = b.name.partition('.')
    target = None
    for key, dst in MAP.items():
        if stem.startswith(key):
            target = f'{dst}.{side}' if side else dst
            break
    if not target or target not in eb:
        continue
    if b.parent and b.parent.name == target:
        continue
    before = b.parent.name if b.parent else None
    b.parent = eb[target]
    b.use_connect = False
    report.append((b.name, before, target))

bpy.ops.object.mode_set(mode='OBJECT')
print('TWIST_REPARENTED', len(report))
for r in report:
    print('  TW', r[0], r[1], '->', r[2])
if out_path:
    bpy.ops.wm.save_as_mainfile(filepath=out_path)
    print('SAVED', out_path)
print('TWIST_OK')
