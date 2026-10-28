"""Тест взаимодействия: кисти в креплениях рук, стопы в манжетах ног.

Кисти и стопы привязываются к креплениям (Child Of), после чего двигаются
САМИ КРЕПЛЕНИЯ — и конечности едут за ними. На трёх кадрах замеряется
расстояние «кисть ↔ центр площадки» и «стопа ↔ манжета»: если тест проходит,
оно постоянное, а не нулевое только в статике.

Запуск: blender -b blockout/table_adj.blend -noaudio --python tools/table_interaction_test.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
CH = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/anna_nude.glb'

sc = bpy.context.scene
arm = bpy.data.objects['table_rig']

# ---------- персонаж на стол ---------------------------------------------------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CH)
bpy.context.view_layer.update()
new = [o for o in bpy.data.objects if o not in before]
char_arm = next(o for o in new if o.type == 'ARMATURE')
meshes = [o for o in new if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
for o in [x for x in new if x.type == 'MESH' and x not in meshes]:
    bpy.data.objects.remove(o, do_unlink=True)


def pts_of(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        out += [mw @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    return out


pts = pts_of(meshes)
k = 1.62 / (max(p.z for p in pts) - min(p.z for p in pts))
char_arm.matrix_world = Matrix.Scale(k, 4) @ char_arm.matrix_world
bpy.context.view_layer.update()


def mean(axis, name):
    o = bpy.data.objects.get(name)
    if not o:
        return 0.0
    ps = pts_of([o])
    return sum(getattr(p, axis) for p in ps) / len(ps)


face_dir = 1 if mean('y', 'Face') > mean('y', 'Body') else -1
rot = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Rotation(math.radians(90 * face_dir), 4, 'X')
char_arm.matrix_world = rot @ char_arm.matrix_world
bpy.context.view_layer.update()
pts = pts_of(meshes)
cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
z_mat = 0.865
char_arm.matrix_world = Matrix.Translation(Vector((-cx, -cy, z_mat - min(p.z for p in pts) + 0.003))) @ char_arm.matrix_world
bpy.context.view_layer.update()
pts = pts_of(meshes)

if mean('z', 'Face') < mean('z', 'Body'):
    c = Vector((0, 0, (min(p.z for p in pts) + max(p.z for p in pts)) / 2))
    M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(180), 4, 'X') @ Matrix.Translation(-c)
    char_arm.matrix_world = M @ char_arm.matrix_world
    bpy.context.view_layer.update()
print('PLACED', [round(v, 3) for v in (min(p.x for p in pts), max(p.x for p in pts))])


def bw(name):
    pb = char_arm.pose.bones.get(name)
    return char_arm.matrix_world @ pb.tail if pb else None


# руки вдоль тела
for side in ('L', 'R'):
    pb = char_arm.pose.bones.get(f'J_Bip_{side}_UpperArm')
    if not pb:
        continue
    pb.rotation_mode = 'XYZ'
    best = None
    for axis in range(3):
        for deg in (40, 50, 60, 70, 80, -40, -50, -60, -70, -80):
            e = [0, 0, 0]
            e[axis] = math.radians(deg)
            pb.rotation_euler = e
            bpy.context.view_layer.update()
            w = bw(f'J_Bip_{side}_Hand')
            if w is None:
                continue
            d = abs(abs(w.y) - 0.26) + abs(w.x - 0.05)
            if best is None or d < best[0]:
                best = (d, axis, deg)
            pb.rotation_euler = (0, 0, 0)
    e = [0, 0, 0]
    e[best[1]] = math.radians(best[2])
    pb.rotation_euler = e
bpy.context.view_layer.update()

wrist = {s: bw(f'J_Bip_{s}_Hand') for s in ('L', 'R')}
ankle = {s: bw(f'J_Bip_{s}_Foot') for s in ('L', 'R')}
print('WRIST', {s: [round(v, 3) for v in wrist[s]] for s in wrist})

# ---------- крепления точно к конечностям -------------------------------------
def tail_world(bone):
    return arm.matrix_world @ arm.pose.bones[bone].tail


def head_world(bone):
    return arm.matrix_world @ arm.pose.bones[bone].head


def fit(bone, target, use_head=False, probe=0.02, rounds=3):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    get = head_world if use_head else tail_world
    for _ in range(rounds):
        p0 = get(bone)
        cols = []
        for ax in range(3):
            e = [0.0, 0.0, 0.0]
            e[ax] = probe
            pb.location = e
            bpy.context.view_layer.update()
            cols.append((get(bone) - p0) / probe)
        pb.location = (0, 0, 0)
        bpy.context.view_layer.update()
        M = Matrix((cols[0], cols[1], cols[2])).transposed()
        try:
            pb.location = M.inverted() @ (target - p0)
        except ValueError:
            print('SINGULAR', bone)
            return
        bpy.context.view_layer.update()
    print('FIT', bone, 'err', round((get(bone) - target).length, 4))


for s in ('L', 'R'):
    rest = arm.matrix_world @ arm.data.bones[f'arm_{s}_rail'].head_local
    pb = arm.pose.bones[f'arm_{s}_rail']
    pb.rotation_mode = 'XYZ'
    pb.location = (wrist[s].x - rest.x, 0, 0)
    bpy.context.view_layer.update()
    fit(f'arm_{s}_pitch', wrist[s] + Vector((0, 0, -0.02)))   # площадка под ладонью
    fit(f'leg_{s}_cuff', ankle[s], use_head=True)            # манжета вокруг голени

# ---------- конечности следуют за креплениями ---------------------------------
pairs = [('J_Bip_L_Hand', 'arm_L_pitch'), ('J_Bip_R_Hand', 'arm_R_pitch'),
         ('J_Bip_L_Foot', 'leg_L_cuff'), ('J_Bip_R_Foot', 'leg_R_cuff')]


def hand_of(bone):
    return char_arm.matrix_world @ char_arm.pose.bones[bone].tail


def target_of(bone, side_is_head):
    return (head_world if side_is_head else tail_world)(bone)


for owner, tgt in pairs:
    pb = char_arm.pose.bones[owner]
    if not pb:
        continue
    c = pb.constraints.new('CHILD_OF')
    c.target = arm
    c.subtarget = tgt
    use_head = tgt.startswith('leg_')
    ref = head_world(tgt) if use_head else tail_world(tgt)
    for _ in range(3):
        bpy.context.view_layer.update()
        cur = head_world(tgt) if use_head else tail_world(tgt)
        delta = ref - cur
        c.inverse_matrix = Matrix.Translation(delta) @ c.inverse_matrix
    bpy.context.view_layer.update()
    print('BOUND', owner, '->', tgt)

# ---------- анимация механизмов ----------------------------------------------
def key(bone, loc=None, rot=None, frame=1):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert('location', frame=frame)
    if rot is not None:
        pb.rotation_euler = tuple(math.radians(a) for a in rot)
        pb.keyframe_insert('rotation_euler', frame=frame)


for f, tilt, lift, slide, yaw, cuff, colh in (
        (1, 0, 0, 0, 0, 0, 0),
        (20, -16, 12, 0.06, 14, 10, 0.08),
        (40, 8, -10, -0.05, -12, -8, -0.09),
        (60, 0, 0, 0, 0, 0, 0)):
    key('tilt', rot=(tilt, 0, 0), frame=f)
    key('column_move', loc=(0, 0, colh), frame=f)
    for s, sign in (('L', 1), ('R', -1)):
        key(f'arm_{s}_rail', loc=(slide, 0, 0), frame=f)
        key(f'arm_{s}_yaw', rot=(0, 0, yaw * sign), frame=f)
        key(f'arm_{s}_pitch', rot=(lift * 0.3, 0, 0), frame=f)
        key(f'leg_{s}_cuff', rot=(cuff, 0, 0), frame=f)

sc.frame_start, sc.frame_end = 1, 60

# ---------- проверка на кадрах -----------------------------------------------
cam = bpy.data.objects['cam']
sc.render.resolution_x, sc.render.resolution_y = 1200, 820
checks = {}
for f in (1, 20, 40):
    sc.frame_set(f)
    bpy.context.view_layer.update()
    row = []
    for owner, tgt in pairs:
        h = hand_of(owner)
        t = head_world(tgt) if tgt.startswith('leg_') else tail_world(tgt)
        row.append(round((h - t).length, 3))
    checks[f] = row
    print('CHECK frame', f, 'dist hand->pad / foot->cuff', row)


def shot(name, loc, aim, lens=50):
    cam.data.type = 'PERSP'
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


for f in (1, 20, 40):
    sc.frame_set(f)
    shot(f'it_f{f:02d}_34.png', (1.85, -2.05, 1.55), (0, 0, 0.9), lens=50)

sc.frame_set(20)
shot('it_detail_hand.png', (0.55, -0.75, 1.25), (0.0, 0.25, 0.95), lens=85)
shot('it_detail_foot.png', (1.15, -0.7, 1.1), (0.6, 0.08, 0.98), lens=85)

sc.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'table_interaction.blend'))
print('SAVED table_interaction.blend')
