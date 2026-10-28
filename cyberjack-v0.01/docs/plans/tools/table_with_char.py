"""Кладём риг-гуманоида на регулируемый стол и подгоняем крепления под него.

Трансформации применяются ТОЛЬКО к армтуре: меши — её дети, иначе поворот
и масштаб считаются дважды. Подгонка кареток — численная (перебор углов с
замером положения площадки/манжеты против кисти/стопы), а не на глаз.

Запуск: blender -b blockout/table_adj.blend -noaudio --python tools/table_with_char.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
CH = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/anna_nude.glb'

sc = bpy.context.scene
arm = bpy.data.objects['table_rig']

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
h = max(p.z for p in pts) - min(p.z for p in pts)
k = 1.62 / h
char_arm.matrix_world = Matrix.Scale(k, 4) @ char_arm.matrix_world
bpy.context.view_layer.update()
print('SCALED', round(k, 4), 'meshes', [o.name for o in meshes])

# лицо смотрит в -Y или +Y — по смещению меша Face относительно Body
def mean_y(name):
    o = bpy.data.objects.get(name)
    if not o:
        return 0.0
    ps = pts_of([o])
    return sum(p.y for p in ps) / len(ps)


face_dir = 1 if mean_y('Face') > mean_y('Body') else -1
print('FACE_DIR', face_dir)

# на спину, головой к -X: Rz(90) · Rx(-90·face_dir)
rot = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Rotation(math.radians(90 * face_dir), 4, 'X')
char_arm.matrix_world = rot @ char_arm.matrix_world
bpy.context.view_layer.update()

pts = pts_of(meshes)
cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
z_top = 0.865
char_arm.matrix_world = Matrix.Translation(Vector((-cx, -cy, z_top - min(p.z for p in pts) + 0.003))) @ char_arm.matrix_world
bpy.context.view_layer.update()
pts = pts_of(meshes)
print('CHAR_X', round(min(p.x for p in pts), 2), round(max(p.x for p in pts), 2),
      'Y', round(min(p.y for p in pts), 2), round(max(p.y for p in pts), 2),
      'Z', round(min(p.z for p in pts), 3), round(max(p.z for p in pts), 3))


# лицо должно смотреть вверх: если меш Face ниже центра тела — переворачиваем
def mean_z(name):
    o = bpy.data.objects.get(name)
    if not o:
        return 0.0
    ps = pts_of([o])
    return sum(p.z for p in ps) / len(ps)


if mean_z('Face') < mean_z('Body'):
    c = Vector((0, 0, (min(p.z for p in pts) + max(p.z for p in pts)) / 2))
    M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(180), 4, 'X') @ Matrix.Translation(-c)
    char_arm.matrix_world = M @ char_arm.matrix_world
    bpy.context.view_layer.update()
    print('FLIPPED face-up')
else:
    print('FACE_UP ok')


def bw(name):
    pb = char_arm.pose.bones.get(name)
    return char_arm.matrix_world @ pb.tail if pb else None


# --- руки в стороны: перебор осей/знаков по максимуму |y| кисти ---------------
for side in ('L', 'R'):
    pb = char_arm.pose.bones.get(f'J_Bip_{side}_UpperArm')
    if not pb:
        continue
    pb.rotation_mode = 'XYZ'
    base = {s: bw(f'J_Bip_{s}_Hand') for s in ('L', 'R')}
    best = None
    for axis in range(3):
        for deg in (40, 50, 60, 70, 80, -40, -50, -60, -70, -80):
            p2 = char_arm.pose.bones[f'J_Bip_{side}_UpperArm']
            e = [0, 0, 0]
            e[axis] = math.radians(deg)
            p2.rotation_euler = e
            bpy.context.view_layer.update()
            w = bw(f'J_Bip_{side}_Hand')
            if w is None:
                continue
            # хотим: кисть рядом с телом (|y| 0.20-0.32) и ближе к тазу, чем к голове
            d = abs(abs(w.y) - 0.26) + abs(w.x - 0.05)
            if best is None or d < best[0]:
                best = (d, axis, deg)
            p2.rotation_euler = (0, 0, 0)
    e = [0, 0, 0]
    e[best[1]] = math.radians(best[2])
    pb.rotation_euler = e
    print('ARM', side, 'axis', best[1], 'deg', best[2], 'err', round(best[0], 3))
bpy.context.view_layer.update()

wrist = {s: bw(f'J_Bip_{s}_Hand') for s in ('L', 'R')}
ankle = {s: bw(f'J_Bip_{s}_Foot') for s in ('L', 'R')}
for s in ('L', 'R'):
    print('WRIST', s, [round(v, 3) for v in wrist[s]], 'ANKLE', s, [round(v, 3) for v in ankle[s]])


def pad_pos(s):
    return arm.matrix_world @ arm.pose.bones[f'arm_{s}_pitch'].tail


def cuff_pos(s):
    return arm.matrix_world @ arm.pose.bones[f'leg_{s}_cuff'].tail


# --- подгонка узлов: сдвиг кости решается численно (якобиан по локальным осям)
def tail_world(bone_name):
    return arm.matrix_world @ arm.pose.bones[bone_name].tail


def fit_bone_to(bone_name, target, probe=0.02, rounds=3):
    pb = arm.pose.bones[bone_name]
    pb.rotation_mode = 'XYZ'
    for _ in range(rounds):
        p0 = tail_world(bone_name)
        cols = []
        for ax in range(3):
            e = [0.0, 0.0, 0.0]
            e[ax] = probe
            pb.location = e
            bpy.context.view_layer.update()
            cols.append((tail_world(bone_name) - p0) / probe)
        pb.location = (0, 0, 0)
        bpy.context.view_layer.update()
        M = Matrix((cols[0], cols[1], cols[2])).transposed()
        try:
            sol = M.inverted() @ (target - p0)
        except ValueError:
            print('FIT_SINGULAR', bone_name)
            return
        pb.location = sol
        bpy.context.view_layer.update()
    print('FIT', bone_name, 'err', round((tail_world(bone_name) - target).length, 3))


for s in ('L', 'R'):
    # каретка руки по X кисти, затем площадка точно под кисть
    rest = arm.matrix_world @ arm.data.bones[f'arm_{s}_rail'].head_local
    pb = arm.pose.bones[f'arm_{s}_rail']
    pb.rotation_mode = 'XYZ'
    pb.location = (wrist[s].x - rest.x, 0, 0)
    bpy.context.view_layer.update()
    fit_bone_to(f'arm_{s}_pitch', wrist[s])
    fit_bone_to(f'leg_{s}_cuff', ankle[s])
    print('PAD', s, [round(v, 3) for v in tail_world(f'arm_{s}_pitch')])
    print('CUFF', s, [round(v, 3) for v in tail_world(f'leg_{s}_cuff')])

# --- рендер ------------------------------------------------------------------
cam = bpy.data.objects['cam']
sc.render.resolution_x, sc.render.resolution_y = 1300, 900


def shot(name, loc, aim, lens=50):
    cam.data.type = 'PERSP'
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


shot('chr_A_34.png', (1.9, -2.1, 1.5), (0, 0, 0.9), lens=50)
shot('chr_A_top.png', (0.35, -0.75, 2.7), (0.05, 0, 0.85), lens=45)
shot('chr_A_side.png', (2.9, 0.1, 1.0), (0, 0, 0.85), lens=60)

arm.pose.bones['tilt'].rotation_mode = 'XYZ'
arm.pose.bones['tilt'].rotation_euler = (math.radians(-20), 0, 0)
arm.pose.bones['column_move'].location = (0, 0, 0.08)
bpy.context.view_layer.update()
shot('chr_B_34.png', (1.9, -2.1, 1.55), (0, 0, 0.95), lens=50)

arm.pose.bones['tilt'].rotation_euler = (0, 0, 0)
arm.pose.bones['column_move'].location = (0, 0, 0)
bpy.context.view_layer.update()
shot('chr_detail.png', (0.85, -0.9, 1.15), (0.2, 0, 0.9), lens=70)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'table_with_char.blend'))
print('SAVED table_with_char.blend')