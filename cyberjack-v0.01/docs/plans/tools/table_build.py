"""Стол-фиксатор SKGMB01: сборка «снизу вверх», все детали стыкуются.

Каждый элемент считается от предыдущего: плита → накладка → конус → обойма →
труба → вилка → рама стола → матрас → борт → трубчатая рама → стойки → ручки.
Никаких «на глаз»: если деталь не касается соседней, это видно в логе
(печатаются зазоры по Z), и в рендере не будет парящих элементов.

Запуск: blender -b --factory-startup -noaudio --python tools/table_build.py
"""
import bpy, os, math
from mathutils import Vector

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'

# --- габариты по референсу (м) ------------------------------------------------
PLATE_T = 0.030
PAD_T = 0.022
CONE_H = 0.600
COLLAR_H = 0.035
TUBE_H = 0.200
YOKE_H = 0.060
FRAME_T = 0.060
MAT_T = 0.100
RIM_T = 0.030
TUBE_R = 0.030

L_TABLE, W_TABLE = 1.58, 0.58
L_MAT, W_MAT = 1.50, 0.52


def mat(name, color, rough=0.55, metal=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
M_DARK = mat('tb_dark', (0.15, 0.16, 0.18), 0.5, 0.25)
M_METAL = mat('tb_metal', (0.62, 0.64, 0.67), 0.28, 0.9)
M_WHITE = mat('tb_white', (0.91, 0.92, 0.94), 0.4, 0.15)
M_PAD = mat('tb_pad', (0.20, 0.21, 0.23), 0.85)

parts = []


def _fin(o, material, bone):
    o.data.materials.append(material)
    parts.append((o, bone))
    return o


def box(name, size, center, material, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = Vector(size)          # куб создан 1×1×1, поэтому масштаб = габарит
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return _fin(o, material, bone)


def cyl(name, r, h, center, material, bone, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg,
                                        location=center, rotation=rot)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return _fin(o, material, bone)


def cone(name, r1, r2, h, z0, material, bone, seg=28):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=h, vertices=seg,
                                    location=(0, 0, z0 + h / 2))
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return _fin(o, material, bone)


def bar(name, p1, p2, r, material, bone, seg=14):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=seg, location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    o.location = (p1 + p2) / 2
    bpy.ops.object.transform_apply(location=True)
    return _fin(o, material, bone)


# --- стек высот --------------------------------------------------------------
z0 = 0.0                                  # пол
z_plate = z0 + PLATE_T                    # 0.030
z_pad = z_plate + PAD_T                   # 0.052
z_cone = z_pad + CONE_H                   # 0.652
z_collar = z_cone + COLLAR_H              # 0.687
z_tube = z_collar + TUBE_H                # 0.887
z_yoke = z_tube + YOKE_H                  # 0.947  = низ рамы стола
z_frame = z_yoke + FRAME_T                # 1.007  = верх рамы
z_mat = z_frame + MAT_T                   # 1.107  = верх матраса
z_rim = z_mat                             # борт по верхней кромке
z_tframe = z_mat + RIM_T                  # 1.137  ось трубчатой рамы

# --- основание ---------------------------------------------------------------
box('base_plate', (0.95, 0.50, PLATE_T), (0, 0, z_plate / 2), M_WHITE, 'base')
box('base_pad', (0.36, 0.26, PAD_T), (0, 0, z_plate + PAD_T / 2), M_DARK, 'base')
for sy in (-1, 1):
    box(f'base_foot_{sy}', (0.16, 0.07, 0.012), (-0.34, sy * 0.13, 0.006), M_DARK, 'base')

# --- пьедестал ---------------------------------------------------------------
cone('pedestal', 0.145, 0.100, CONE_H, z_pad, M_DARK, 'column')
box('pedestal_slot', (0.062, 0.02, CONE_H * 0.62), (0, 0.108, z_pad + CONE_H * 0.36),
    M_WHITE, 'column')
box('pedestal_slot_in', (0.036, 0.012, CONE_H * 0.52), (0, 0.114, z_pad + CONE_H * 0.36),
    M_DARK, 'column')
cyl('collar', 0.112, COLLAR_H, (0, 0, z_cone + COLLAR_H / 2), M_WHITE, 'column_ext', seg=28)
cyl('column_tube', 0.088, TUBE_H, (0, 0, z_collar + TUBE_H / 2), M_DARK, 'column_ext', seg=24)

# газлифты: от накладки до вилки, спереди
for sx in (-1, 1):
    cyl(f'gas_body_{sx}', 0.026, 0.40, (sx * 0.085, 0.128, z_pad + 0.20), M_METAL, 'column', seg=16)
    cyl(f'gas_rod_{sx}', 0.013, (z_yoke - 0.02) - (z_pad + 0.38),
        (sx * 0.085, 0.128, (z_pad + 0.38 + z_yoke - 0.02) / 2), M_METAL, 'column_ext', seg=12)

# --- вилка-люлька ------------------------------------------------------------
for sy in (-1, 1):
    box(f'yoke_{sy}', (0.055, 0.05, YOKE_H), (0, sy * 0.115, z_tube + YOKE_H / 2),
        M_DARK, 'tilt')
cyl('tilt_axle', 0.034, 0.28, (0, 0, z_yoke), M_METAL, 'tilt', rot=(math.radians(90), 0, 0), seg=18)

# --- стол --------------------------------------------------------------------
box('table_frame', (L_TABLE, W_TABLE, FRAME_T), (0, 0, z_yoke + FRAME_T / 2), M_DARK, 'table')
box('table_mattress', (L_MAT, W_MAT, MAT_T), (0, 0, z_frame + MAT_T / 2), M_PAD, 'table')

# борт по верхней кромке матраса
for sy in (-1, 1):
    box(f'rim_side_{sy}', (L_MAT + 0.02, 0.030, RIM_T),
        (0, sy * (W_MAT / 2 + 0.005), z_mat - RIM_T / 2), M_WHITE, 'table')
for sx in (-1, 1):
    box(f'rim_end_{sx}', (0.030, W_MAT + 0.02, RIM_T),
        (sx * (L_MAT / 2 + 0.005), 0, z_mat - RIM_T / 2), M_WHITE, 'table')

# площадки по торцам, вровень с матрасом
box('head_plate', (0.16, 0.36, 0.026), (-(L_MAT / 2 + 0.08), 0, z_mat - 0.013), M_WHITE, 'table')
box('foot_plate', (0.30, 0.42, 0.026), (L_MAT / 2 + 0.15, 0, z_mat - 0.013), M_WHITE, 'foot_plate')
box('foot_tongue', (0.18, 0.24, 0.026), (L_MAT / 2 + 0.38, 0, z_mat - 0.013), M_WHITE, 'foot_plate')

# --- трубчатая рама по периметру --------------------------------------------
RX = L_MAT / 2 + TUBE_R + 0.006
RY = W_MAT / 2 + TUBE_R + 0.006
RC = 0.085
FZ = z_tframe


def arc_corner(name, cx, cy, a0, a1, steps=6):
    pts = []
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        pts.append((cx + RC * math.cos(a), cy + RC * math.sin(a), FZ))
    for k in range(steps):
        bar(f'{name}_{k}', pts[k], pts[k + 1], TUBE_R, M_WHITE, 'table')


for sy in (-1, 1):
    bar(f'frame_long_{sy}', (-RX + RC, sy * RY, FZ), (RX - RC, sy * RY, FZ), TUBE_R, M_WHITE, 'table')
for sx in (-1, 1):
    bar(f'frame_short_{sx}', (sx * RX, -RY + RC, FZ), (sx * RX, RY - RC, FZ), TUBE_R, M_WHITE, 'table')
arc_corner('c_fl', -RX + RC, -RY + RC, 180, 270)
arc_corner('c_fr', RX - RC, -RY + RC, 270, 360)
arc_corner('c_br', RX - RC, RY - RC, 0, 90)
arc_corner('c_bl', -RX + RC, RY - RC, 90, 180)

# стойки: от оси трубы вниз до верхней плоскости рамы стола
for x in (-0.60, -0.20, 0.20, 0.60):
    for sy in (-1, 1):
        bar(f'post_{x}_{sy}', (x, sy * RY, FZ), (x, sy * RY, z_frame), 0.018, M_WHITE, 'table')

# --- «крылья»: лопатки, примыкающие к углам рамы ----------------------------
for sx in (-1, 1):
    for sy in (-1, 1):
        bone = ('wing_H' if sx < 0 else 'wing_F') + ('L' if sy < 0 else 'R')
        cx = sx * (RX - RC * 0.3)
        cy = sy * (RY - RC * 0.3)
        box(f'wing_{bone}', (0.13, 0.085, 0.013),
            (cx + sx * 0.045, cy + sy * 0.02, FZ + 0.038),
            M_WHITE, bone, rot=(math.radians(14 * sy), math.radians(-28 * sx), 0))

# --- ручки на столе: стоят на матрасе ---------------------------------------
for i, hx in enumerate((-0.40, 0.04)):
    bar(f'hnd_{i}_l', (hx, -0.13, z_mat), (hx, -0.13, z_mat + 0.14), 0.014, M_WHITE, 'table')
    bar(f'hnd_{i}_r', (hx, 0.13, z_mat), (hx, 0.13, z_mat + 0.14), 0.014, M_WHITE, 'table')
    bar(f'hnd_{i}_t', (hx, -0.13, z_mat + 0.14), (hx, 0.13, z_mat + 0.14), 0.014, M_WHITE, 'table')

# --- П-скоба у изголовья: от площадки изголовья -----------------------------
LX = -(L_MAT / 2 + 0.08)
bar('loop_l', (LX, -0.095, z_mat), (LX, -0.095, z_mat + 0.15), 0.014, M_WHITE, 'loop')
bar('loop_r', (LX, 0.095, z_mat), (LX, 0.095, z_mat + 0.15), 0.014, M_WHITE, 'loop')
bar('loop_top', (LX, -0.095, z_mat + 0.15), (LX, 0.095, z_mat + 0.15), 0.014, M_WHITE, 'loop')

# --- проверка стыков ---------------------------------------------------------
print('Z_STACK', dict(plate=round(z_plate, 3), pad=round(z_pad, 3), cone=round(z_cone, 3),
                      collar=round(z_collar, 3), tube=round(z_tube, 3), yoke=round(z_yoke, 3),
                      frame=round(z_frame, 3), mat=round(z_mat, 3), tframe=round(FZ, 3)))
print('FRAME_RX_RY', round(RX, 3), round(RY, 3), 'table half', L_MAT / 2, W_MAT / 2)

# --- скелет ------------------------------------------------------------------
ad = bpy.data.armatures.new('table_rig')
arm = bpy.data.objects.new('table_rig', ad)
sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = ad.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    if parent:
        b.parent = eb[parent]
    return b


bone('root', (0, 0, 0), (0, 0, z_plate))
bone('base', (0, 0, z_plate), (0, 0, z_pad), 'root')
bone('column', (0, 0, z_pad), (0, 0, z_cone), 'base')
bone('column_ext', (0, 0, z_cone), (0, 0, z_tube), 'column')
bone('tilt', (0, 0, z_tube), (0, 0, z_yoke), 'column_ext')
bone('table', (0, 0, z_yoke), (0, 0, z_mat), 'tilt')
bone('wing_HL', (-RX, -RY, FZ), (-RX - 0.09, -RY - 0.04, FZ + 0.08), 'table')
bone('wing_HR', (-RX, RY, FZ), (-RX - 0.09, RY + 0.04, FZ + 0.08), 'table')
bone('wing_FL', (RX, -RY, FZ), (RX + 0.09, -RY - 0.04, FZ + 0.08), 'table')
bone('wing_FR', (RX, RY, FZ), (RX + 0.09, RY + 0.04, FZ + 0.08), 'table')
bone('foot_plate', (L_MAT / 2 + 0.15, 0, z_mat), (L_MAT / 2 + 0.35, 0, z_mat), 'table')
bone('loop', (LX, 0, z_mat), (LX, 0, z_mat + 0.15), 'table')
bone('anchor', (0, 0, z_mat), (0, 0, z_mat + 0.18), 'table')
bpy.ops.object.mode_set(mode='OBJECT')

# --- веса, скин --------------------------------------------------------------
bpy.context.view_layer.update()
for o, bname in parts:
    vg = o.vertex_groups.new(name=bname)
    vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')

bpy.ops.object.select_all(action='DESELECT')
for o, _ in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'restraint_table'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
body.parent = arm

# --- сцена -------------------------------------------------------------------
for name, vec, energy in (('key', (0.45, 0.7, -0.55), 3.2), ('fill', (-0.5, -0.6, -0.3), 1.2),
                          ('rim', (-0.2, 0.8, 0.4), 1.2)):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    d.use_shadow = (name == 'key')
    d.angle = math.radians(8)
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)

w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.60, 0.62, 0.65, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = 'floor'
floor.data.materials.append(mat('tb_floor', (0.50, 0.52, 0.55), 0.9))

cd = bpy.data.cameras.new('cam')
cd.lens = 55
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1200, 900
sc.eevee.taa_render_samples = 24
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'


def shot(name, loc, aim=None, lens=55, ortho=None):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho:
        cam.data.ortho_scale = ortho
    cam.data.lens = lens
    cam.location = loc
    tgt = Vector(aim) if aim else Vector((0, 0, z_mat - 0.1))
    cam.rotation_euler = (tgt - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


shot('tb_34.png', (2.2, -2.5, 1.55), (0, 0, 1.0), lens=50)
shot('tb_front.png', (0, -6.0, z_mat - 0.1), (0, 0, z_mat - 0.1), ortho=2.4)
shot('tb_side.png', (6.0, 0, z_mat - 0.1), (0, 0, z_mat - 0.1), ortho=2.4)

blend = os.path.join(OUT, 'table_build.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

glb = os.path.join(OUT, 'table_build.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=False)
print('EXPORTED', glb)
