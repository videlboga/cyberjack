"""Регулируемый стол-фиксатор для Cyberjack (без привязки к референсу).

Механика, которую видно в модели и на скелете:
  высота      — телескопическая колонна (внутренняя труба едет в наружной, обойма-зажим)
  наклон      — сектор с болтом на вилке, стол качается вокруг поперечной оси
  изголовье   — подпорка с регулируемым углом
  руки        — каретки на боковых рельсах (вдоль стола) + поворот + наклон кистевой площадки
  ноги        — каретки на нижних рельсах у ножного конца + подъём + разведение
  крепление   — маркер персонажа на столе

Запуск: blender -b --factory-startup -noaudio --python tools/table_adjustable.py
"""
import bpy, os, math
from mathutils import Vector

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'


def mat(name, color, rough=0.5, metal=0.0):
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
M_DARK = mat('ta_dark', (0.15, 0.16, 0.18), 0.5, 0.3)
M_METAL = mat('ta_metal', (0.66, 0.68, 0.71), 0.25, 0.95)
M_BODY = mat('ta_body', (0.90, 0.91, 0.93), 0.4, 0.1)
M_PAD = mat('ta_pad', (0.21, 0.22, 0.24), 0.85)
M_ACC = mat('ta_acc', (0.13, 0.55, 0.52), 0.4)

parts = []


def _fin(o, material, bone):
    o.data.materials.append(material)
    parts.append((o, bone))
    return o


def box(name, size, center, material, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = Vector(size)            # куб 1x1x1 → масштаб = габарит
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return _fin(o, material, bone)


def cyl(name, r, h, center, material, bone, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=center, rotation=rot)
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


# --- стек высот (базовая, средняя высота) -----------------------------------
BASE_T = 0.045
FIX_H = 0.44          # наружная труба
MOV_H = 0.46          # внутренняя (телескоп)
COLLAR_H = 0.06
YOKE_H = 0.10
FRAME_T = 0.07
MAT_T = 0.09

z_base = BASE_T                      # 0.045
z_fix = z_base + FIX_H               # 0.485
z_mov = z_base + MOV_H               # 0.505 (внутренняя выходит из наружной)
z_yoke = z_fix + YOKE_H + 0.10       # 0.685 — низ вилки (верх внутренней трубы)
z_frame = z_yoke + 0.02              # 0.705 низ рамы стола
z_mat = z_frame + FRAME_T + MAT_T    # 0.865 верх матраса

L_T, W_T = 1.98, 0.62
L_M, W_M = 1.92, 0.58

# --- основание ---------------------------------------------------------------
box('base_plate', (0.86, 0.56, BASE_T), (0, 0, z_base / 2), M_BODY, 'base')
box('base_cover', (0.44, 0.34, 0.05), (0, 0, z_base + 0.025), M_DARK, 'base')
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'foot_{sx}_{sy}', 0.035, 0.02, (sx * 0.34, sy * 0.22, 0.01), M_DARK, 'base', seg=12)

# --- колонна -----------------------------------------------------------------
cyl('col_outer', 0.085, FIX_H, (0, 0, z_base + FIX_H / 2), M_DARK, 'column_fixed', seg=28)
cyl('col_inner', 0.062, MOV_H, (0, 0, z_base + MOV_H / 2), M_METAL, 'column_move', seg=24)
cyl('col_collar', 0.095, COLLAR_H, (0, 0, z_fix - COLLAR_H / 2), M_BODY, 'column_fixed', seg=28)
cyl('col_knob', 0.022, 0.06, (0.11, 0, z_fix - COLLAR_H / 2), M_ACC, 'column_fixed',
    rot=(0, math.radians(90), 0), seg=12)
box('col_scale', (0.012, 0.03, MOV_H * 0.7), (0.062, 0, z_base + MOV_H * 0.45), M_BODY, 'column_move')

# --- вилка и ось наклона ------------------------------------------------------
for sy in (-1, 1):
    box(f'yoke_{sy}', (0.10, 0.045, YOKE_H), (0, sy * 0.115, z_fix + YOKE_H / 2), M_DARK, 'tilt')
cyl('tilt_axle', 0.032, 0.30, (0, 0, z_yoke), M_METAL, 'tilt', rot=(math.radians(90), 0, 0), seg=18)
cyl('tilt_knob', 0.028, 0.05, (0, -0.19, z_yoke), M_ACC, 'tilt', rot=(math.radians(90), 0, 0), seg=12)
box('tilt_sector', (0.16, 0.02, 0.09), (-0.10, -0.115, z_yoke + 0.02), M_METAL, 'tilt')

# --- стол ---------------------------------------------------------------------
box('table_frame', (L_T, W_T, FRAME_T), (0, 0, z_frame + FRAME_T / 2), M_DARK, 'table')
box('table_mattress', (L_M, W_M, MAT_T), (0, 0, z_frame + FRAME_T + MAT_T / 2), M_PAD, 'table')
for sy in (-1, 1):
    box(f'rim_{sy}', (L_M + 0.02, 0.028, 0.028),
        (0, sy * (W_M / 2 + 0.004), z_mat - 0.014), M_BODY, 'table')
for sx in (-1, 1):
    box(f'rim_end_{sx}', (0.028, W_M + 0.02, 0.028),
        (sx * (L_M / 2 + 0.004), 0, z_mat - 0.014), M_BODY, 'table')

# подпорка изголовья с регулировкой угла
box('head_hinge', (0.05, 0.32, 0.04), (-(L_M / 2 + 0.02), 0, z_mat - 0.02), M_DARK, 'back_pad')
box('head_pad', (0.26, 0.36, 0.05), (-(L_M / 2 + 0.11), 0, z_mat + 0.05), M_PAD, 'back_pad',
    rot=(0, math.radians(22), 0))

# --- боковые рельсы для кареток рук -----------------------------------------
RAIL_Y = W_M / 2 + 0.075
RAIL_Z = z_mat - 0.075
for sy in (-1, 1):
    bar(f'arm_rail_{sy}', (-0.90, sy * RAIL_Y, RAIL_Z), (0.40, sy * RAIL_Y, RAIL_Z),
        0.018, M_METAL, 'table')
    for x in (-0.84, -0.10, 0.34):
        bar(f'arm_rail_strut_{sy}_{x}', (x, sy * RAIL_Y, RAIL_Z),
            (x, sy * (W_M / 2), z_mat - 0.03), 0.014, M_METAL, 'table')

# --- каретки рук --------------------------------------------------------------
for side, sy in (('L', -1), ('R', 1)):
    cx = -0.34 if side == 'L' else 0.06
    y = sy * RAIL_Y
    box(f'arm_car_{side}', (0.15, 0.09, 0.10), (cx, y, RAIL_Z), M_DARK, f'arm_{side}_rail')
    cyl(f'arm_post_{side}', 0.020, 0.17, (cx, y, RAIL_Z + 0.135), M_METAL, f'arm_{side}_yaw', seg=12)
    cyl(f'arm_swivel_{side}', 0.042, 0.03, (cx, y, RAIL_Z + 0.235), M_BODY, f'arm_{side}_yaw', seg=16)
    # консоль от каретки к площадке над столом
    box(f'arm_horiz_{side}', (0.075, 0.095, 0.032),
        (cx, y - sy * 0.055, RAIL_Z + 0.235), M_METAL, f'arm_{side}_yaw')
    box(f'arm_pad_{side}', (0.19, 0.13, 0.045),
        (cx, y - sy * 0.115, RAIL_Z + 0.252), M_PAD, f'arm_{side}_pitch')
    box(f'arm_strap_{side}', (0.16, 0.028, 0.035),
        (cx, y - sy * 0.115, RAIL_Z + 0.288), M_DARK, f'arm_{side}_pitch')
    cyl(f'arm_knob_{side}', 0.016, 0.04, (cx - 0.06, y, RAIL_Z + 0.20), M_ACC, f'arm_{side}_yaw', seg=10)

# --- ножные упоры: пазы на столе, стойки с манжетами над плоскостью ----------
for sy in (-1, 1):
    box(f'leg_slot_{sy}', (0.44, 0.075, 0.012), (0.58, sy * 0.155, z_mat + 0.006),
        M_METAL, 'table')

for side, sy in (('L', -1), ('R', 1)):
    x = 0.58
    y = sy * 0.155
    box(f'leg_car_{side}', (0.10, 0.085, 0.055), (x, y, z_mat + 0.032), M_DARK, f'leg_{side}_slide')
    cyl(f'leg_post_{side}', 0.017, 0.16, (x, y, z_mat + 0.14), M_METAL, f'leg_{side}_lift', seg=12)
    # манжета: П-образная скоба из трёх пластин
    box(f'cuff_base_{side}', (0.11, 0.13, 0.022), (x, y, z_mat + 0.225), M_DARK, f'leg_{side}_cuff')
    for sx2 in (-1, 1):
        box(f'cuff_side_{side}_{sx2}', (0.018, 0.13, 0.065),
            (x + sx2 * 0.055, y, z_mat + 0.265), M_DARK, f'leg_{side}_cuff')
    box(f'cuff_strap_{side}', (0.11, 0.11, 0.018), (x, y, z_mat + 0.295), M_PAD, f'leg_{side}_cuff')
    cyl(f'leg_knob_{side}', 0.015, 0.035, (x - 0.062, y, z_mat + 0.032), M_ACC, f'leg_{side}_slide', seg=10)

# --- упор для стоп -----------------------------------------------------------
box('foot_rest', (0.20, 0.34, 0.035), (1.02, 0, z_mat - 0.06), M_BODY, 'foot_rest',
    rot=(0, math.radians(-16), 0))

# --- проверка стыков ---------------------------------------------------------
print('Z', dict(base=round(z_base, 3), fix=round(z_fix, 3), yoke=round(z_yoke, 3),
               frame=round(z_frame, 3), mat=round(z_mat, 3)))

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


bone('root', (0, 0, 0), (0, 0, z_base))
bone('base', (0, 0, z_base), (0, 0, z_base + 0.05), 'root')
bone('column_fixed', (0, 0, z_base), (0, 0, z_fix), 'base')
bone('column_move', (0, 0, z_fix), (0, 0, z_yoke), 'column_fixed')
bone('tilt', (0, 0, z_yoke), (0, 0, z_frame), 'column_move')
bone('table', (0, 0, z_frame), (0, 0, z_mat), 'tilt')
bone('back_pad', (-(L_M / 2 + 0.03), 0, z_mat), (-(L_M / 2 + 0.20), 0, z_mat + 0.20), 'table')
bone('foot_rest', (0.94, 0, z_mat - 0.04), (1.10, 0, z_mat - 0.10), 'table')
for side, sy in (('L', -1), ('R', 1)):
    cx = -0.34 if side == 'L' else 0.02
    bone(f'arm_{side}_rail', (cx, sy * RAIL_Y, RAIL_Z), (cx + 0.1, sy * RAIL_Y, RAIL_Z), 'table')
    bone(f'arm_{side}_yaw', (cx, sy * RAIL_Y, RAIL_Z + 0.10), (cx, sy * RAIL_Y, RAIL_Z + 0.27),
         f'arm_{side}_rail')
    bone(f'arm_{side}_pitch', (cx, sy * RAIL_Y, RAIL_Z + 0.27), (cx, sy * RAIL_Y, RAIL_Z + 0.36),
         f'arm_{side}_yaw')
    bone(f'leg_{side}_slide', (0.58, sy * 0.155, z_mat + 0.032), (0.68, sy * 0.155, z_mat + 0.032), 'table')
    bone(f'leg_{side}_lift', (0.58, sy * 0.155, z_mat + 0.06), (0.58, sy * 0.155, z_mat + 0.22),
         f'leg_{side}_slide')
    bone(f'leg_{side}_cuff', (0.58, sy * 0.155, z_mat + 0.22), (0.58, sy * 0.155, z_mat + 0.30),
         f'leg_{side}_lift')
bone('anchor', (0, 0, z_mat), (0, 0, z_mat + 0.18), 'table')
bpy.ops.object.mode_set(mode='OBJECT')

# --- веса, скин --------------------------------------------------------------
bpy.context.view_layer.update()
for o, bname in parts:
    if bname not in [b.name for b in ad.bones]:
        raise RuntimeError(f'нет кости {bname} для {o.name}')
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
                          ('rim', (-0.1, 0.8, 0.4), 1.1)):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    d.use_shadow = (name == 'key')
    d.angle = math.radians(10)
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)

w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.64, 0.67, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = 'floor'
floor.data.materials.append(mat('ta_floor', (0.50, 0.52, 0.55), 0.9))

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


def reset():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()


def set_pose(d):
    reset()
    for bname, (loc, rot) in d.items():
        pb = arm.pose.bones[bname]
        pb.location = loc
        pb.rotation_euler = tuple(math.radians(a) for a in rot)
    bpy.context.view_layer.update()


def shot(name, loc=(2.1, -2.4, 1.45), aim=(0, 0, 0.85), lens=50):
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


# A: нейтраль
reset()
shot('adj_A_34.png')
shot('adj_A_side.png', loc=(3.2, 0.05, 0.95), lens=55)

# B: высоко, наклон вперёд, руки шире, ноги подняты и разведены
set_pose({
    'column_move': ((0, 0, 0.16), (0, 0, 0)),
    'tilt': ((0, 0, 0), (-24, 0, 0)),
    'back_pad': ((0, 0, 0), (-12, 0, 0)),
    'arm_L_rail': ((0.12, 0, 0), (0, 0, 0)),
    'arm_R_rail': ((0.12, 0, 0), (0, 0, 0)),
    'arm_L_yaw': ((0, 0, 0), (0, 0, 22)),
    'arm_R_yaw': ((0, 0, 0), (0, 0, -22)),
    'arm_L_pitch': ((0, 0, 0), (14, 0, 0)),
    'arm_R_pitch': ((0, 0, 0), (14, 0, 0)),
    'leg_L_slide': ((0, 0, 0), (0, 0, 0)),
    'leg_L_lift': ((0, 0, 0), (26, 0, 0)),
    'leg_R_lift': ((0, 0, 0), (26, 0, 0)),
    'leg_L_cuff': ((0, 0, 0), (0, 18, 0)),
    'leg_R_cuff': ((0, 0, 0), (0, -18, 0)),
    'foot_rest': ((0, 0, 0), (12, 0, 0)),
})
shot('adj_B_34.png')
shot('adj_B_side.png', loc=(3.2, 0.05, 0.95), lens=55)

# C: низко, наклон назад, руки внутрь, ноги опущены
set_pose({
    'column_move': ((0, 0, -0.18), (0, 0, 0)),
    'tilt': ((0, 0, 0), (10, 0, 0)),
    'arm_L_rail': ((-0.10, 0, 0), (0, 0, 0)),
    'arm_R_rail': ((-0.10, 0, 0), (0, 0, 0)),
    'arm_L_yaw': ((0, 0, 0), (0, 0, -16)),
    'arm_R_yaw': ((0, 0, 0), (0, 0, 16)),
    'leg_L_lift': ((0, 0, 0), (-14, 0, 0)),
    'leg_R_lift': ((0, 0, 0), (-14, 0, 0)),
})
shot('adj_C_34.png')

reset()
blend = os.path.join(OUT, 'table_adj.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

glb = os.path.join(OUT, 'table_adj.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=False)
print('EXPORTED', glb)