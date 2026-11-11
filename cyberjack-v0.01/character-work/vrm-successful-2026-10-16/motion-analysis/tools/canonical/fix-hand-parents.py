# Подчинённость пальцевых скин-костей кисти.
#
# В файле цепочка *_ref (по ней висят веса пальцев) висит не на hand.l, а на контролах,
# поэтому при внешнем управлении кисть уезжает, а пальцы остаются на месте и меш рвётся
# лентами. Здесь цепочка ставится на руку: <палец>1_ref -> hand, 2_ref -> 1_ref, 3_ref -> 2_ref.
#
#   blender -b base-rigged-humanoid.blend --python fix-hand-parents.py -- out.blend
import bpy, sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_path = argv[0] if argv else None

arm = bpy.data.objects['rig_E']
FINGERS = ('index', 'middle', 'ring', 'pinky', 'thumb')
SIDES = ('l', 'r')

bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones

before = {}
for f in FINGERS:
    for s in SIDES:
        for k in (1, 2, 3):
            n = f'{f}{k}_ref.{s}'
            if n in eb:
                before[n] = eb[n].parent.name if eb[n].parent else None

planned = 0
for f in FINGERS:
    for s in SIDES:
        # цепочка включает base_ref: именно она держит основания пальцев, и если оставить её
        # на контроле, основания остаются на месте, а кисть уезжает — меш рвётся лентами
        chain = [f'{f}1_base_ref.{s}', f'{f}1_ref.{s}', f'{f}2_ref.{s}', f'{f}3_ref.{s}']
        chain = [n for n in chain if n in eb]
        parent = f'hand.{s}'
        for n in chain:
            if parent not in eb:
                break
            eb[n].parent = eb[parent]
            eb[n].use_connect = False
            planned += 1
            parent = n

bpy.ops.object.mode_set(mode='OBJECT')

after = {}
for n in before:
    b = arm.data.bones[n]
    after[n] = b.parent.name if b.parent else None

print('REPARENTED', planned)
print('BEFORE_SAMPLE', list(before.items())[:4])
print('AFTER_SAMPLE', list(after.items())[:4])
if out_path:
    bpy.ops.wm.save_as_mainfile(filepath=out_path)
    print('SAVED', out_path)
print('PARENT_OK')
