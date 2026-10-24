"""Стилевой лист: каталог общих модулей лаборатории в едином визуальном языке.

Собирает эталонные модули (койка, стол, табурет, шкаф, консоль, люк, санблок,
капсула, монитор, тележка, монтажный слот) из style_lib и рендерит два листа:
  style_modules.png  — ряд модулей в 3/4
  style_board.png    — плитки материалов с подписями палитры

Запуск: blender -b --factory-startup -noaudio --python tools/style_sheet.py
"""
import bpy, sys, os, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from style_lib import Style, PALETTE, GEO, area   # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
S = Style()
S.world(sc)
R90 = math.radians(90)


def bevel(o, width, segs=3):
    m = o.modifiers.new('bev', 'BEVEL')
    m.width, m.segments, m.limit_method = width, segs, 'ANGLE'
    m.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    return o


def box(name, x0, x1, y0, y1, z0, z1, mat, r=0.0, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    bpy.ops.object.transform_apply(scale=True)
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    bpy.ops.object.transform_apply(location=True)
    S.apply(o, mat)
    if r > 0:
        bevel(o, min(r, min(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)) / 2.5), segs)
    return o


def cyl(name, cx, cy, z0, z1, r, mat, verts=32, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0), vertices=verts,
                                        location=(cx, cy, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    S.apply(o, mat)
    if smooth:
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
        o.data.update()
    return o


def plate(name, x0, x1, y0, y1, z0, z1, mat, r=0.004):
    return box(name, x0, x1, y0, y1, z0, z1, mat, r=r, segs=2)


def frame(name, x0, x1, z0, z1, y0, y1, mat, t=0.06):
    """Рамка-окантовка (октогон заменяем на прямоугольную с фаской)."""
    plate(f'{name}_b', x0, x1, y0, y1, z0, z0 + t, mat, r=0.008)
    plate(f'{name}_t', x0, x1, y0, y1, z1 - t, z1, mat, r=0.008)
    plate(f'{name}_l', x0, x0 + t, y0, y1, z0, z1, mat, r=0.008)
    plate(f'{name}_r', x1 - t, x1, y0, y1, z0, z1, mat, r=0.008)


# --- модули -----------------------------------------------------------------
def m_bed(x, y):
    L, W = 2.02, 0.94
    box('bed_kick', x, x + L, y, y + W, 0.0, 0.10, 'kick', 0.02)
    box('bed_base', x + 0.02, x + L - 0.02, y + 0.02, y + W - 0.02, 0.10, 0.34, 'panel', 0.05)
    box('bed_mattress', x + 0.03, x + L - 0.03, y + 0.03, y + W - 0.03, 0.34, 0.49,
        'soft', 0.07, 5)
    box('bed_pillow', x + 0.10, x + 0.52, y + 0.09, y + W - 0.09, 0.49, 0.58, 'light', 0.06, 5)
    box('bed_head', x, x + 0.06, y - 0.04, y + W + 0.04, 0.49, 1.02, 'panel', 0.04)
    box('bed_shelf', x + 0.02, x + 0.38, y - 0.04, y + W + 0.04, 1.42, 1.50, 'panel', 0.02)
    box('bed_shelf_light', x + 0.04, x + 0.32, y - 0.02, y + W + 0.02, 1.38, 1.41, 'accent')
    box('bed_box', x + 0.05, x + 0.33, y + 0.16, y + W - 0.16, 1.50, 1.68, 'panel_dim', 0.02)


def m_table(x, y):
    W, D, H = 1.32, 0.84, 0.76
    box('tbl_top', x, x + W, y, y + D, H - 0.08, H, 'panel', 0.08, 5)
    box('tbl_apron', x + 0.08, x + W - 0.08, y + 0.06, y + D - 0.06, H - 0.20, H - 0.08,
        'panel', 0.03)
    box('tbl_ped', x + W / 2 - 0.26, x + W / 2 + 0.26, y + D / 2 - 0.18, y + D / 2 + 0.18,
        0.10, H - 0.20, 'panel', 0.05)
    box('tbl_kick', x + W / 2 - 0.34, x + W / 2 + 0.34, y + D / 2 - 0.24, y + D / 2 + 0.24,
        0.0, 0.10, 'kick', 0.03)


def m_stool(x, y):
    box('st_kick', x, x + 0.40, y, y + 0.40, 0.0, 0.06, 'kick', 0.02)
    box('st_body', x + 0.03, x + 0.37, y + 0.03, y + 0.37, 0.06, 0.40, 'panel', 0.05)
    box('st_seat', x, x + 0.40, y, y + 0.40, 0.40, 0.48, 'soft', 0.06, 5)


def m_wardrobe(x, y):
    W, D, H = 1.05, 0.34, 2.30
    box('wr_body', x, x + W, y, y + D, 0.0, H, 'panel', 0.03)
    box('wr_kick', x + 0.03, x + W - 0.03, y - 0.02, y + D, 0.0, 0.09, 'kick', 0.02)
    for i in range(2):
        dx = x + i * (W / 2)
        box(f'wr_door{i}', dx + 0.02, dx + W / 2 - 0.03, y - 0.012, y, 0.09, H - 0.04,
            'panel', 0.01, 2)
        box(f'wr_gap{i}', dx + W / 2 - 0.03, dx + W / 2, y - 0.016, y, 0.09, H - 0.04, 'seam')
        box(f'wr_handle{i}', dx + W / 2 - 0.14, dx + W / 2 - 0.10, y - 0.036, y - 0.012,
            1.02, 1.28, 'steel', 0.01, 2)
    box('wr_vent', x + 0.14, x + 0.44, y - 0.018, y - 0.010, 0.32, 0.80, 'seam')
    box('wr_scr', x + 0.62, x + 0.90, y - 0.030, y - 0.008, 1.20, 1.52, 'panel', 0.03)
    box('wr_scr_face', x + 0.645, x + 0.875, y - 0.034, y - 0.028, 1.23, 1.49, 'accent')


def m_console(x, y):
    box('con_body', x, x + 0.26, y, y + 0.10, 1.15, 1.55, 'panel', 0.03)
    box('con_scr', x + 0.05, x + 0.21, y - 0.008, y, 1.22, 1.44, 'accent')
    box('con_btn', x + 0.05, x + 0.21, y - 0.010, y, 1.05, 1.10, 'steel', 0.008, 2)


def m_hatch(x, y):
    W, Hh = 1.30, 2.25
    frame('h_fr', x - 0.07, x + W + 0.07, 0.0, Hh + 0.07, y - 0.10, y + 0.02, 'panel', 0.07)
    box('h_leaf', x + 0.03, x + W - 0.03, y - 0.04, y + 0.02, 0.03, Hh - 0.03, 'panel', 0.04, 4)
    box('h_handle', x + 0.14, x + 0.46, y - 0.09, y - 0.04, 1.02, 1.10, 'steel', 0.02)
    box('h_scr', x + W - 0.30, x + W - 0.12, y - 0.055, y - 0.04, 1.30, 1.54, 'accent')


def m_san(x, y):
    box('san_step', x, x + 1.20, y, y + 0.30, 0.0, 0.05, 'kick', 0.02)
    box('wc_base', x + 0.22, x + 0.62, y + 0.18, y + 0.68, 0.05, 0.42, 'light', 0.05, 5)
    cyl('wc_bowl', x + 0.42, y + 0.30, 0.42, 0.48, 0.19, 'light')
    box('wc_tank', x + 0.21, x + 0.63, y + 0.60, y + 0.74, 0.46, 0.86, 'light', 0.04, 4)
    box('bs_body', x + 0.74, x + 1.10, y + 0.20, y + 0.56, 0.05, 0.80, 'light', 0.05, 5)
    box('bs_bowl', x + 0.77, x + 1.07, y + 0.23, y + 0.53, 0.80, 0.84, 'steel', 0.03)
    cyl('bs_tap', x + 0.92, y + 0.52, 0.84, 1.00, 0.016, 'steel')
    box('san_mirror', x + 0.76, x + 1.08, y + 0.56, y + 0.58, 1.12, 1.66, 'steel', 0.01, 2)


def m_capsule(x, y):
    r, Hh = 0.59, 2.42
    cyl('cap_base', x, y, 0.0, 0.16, r + 0.04, 'panel')
    cyl('cap_base2', x, y, 0.16, 0.30, r + 0.02, 'steel')
    cyl('cap_glass', x, y, 0.30, Hh - 0.26, r, 'steel')
    cyl('cap_top', x, y, Hh - 0.26, Hh, r + 0.04, 'panel')
    o = bpy.data.objects['cap_glass']
    m = o.data.materials[0].copy()
    m.name = 'cap_glass_mat'
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.72, 0.86, 0.88, 1)
    b.inputs['Roughness'].default_value = 0.06
    b.inputs['Alpha'].default_value = 0.28
    b.inputs['Transmission Weight'].default_value = 0.85
    m.blend_method = 'BLEND'
    o.data.materials[0] = m
    # поясок и хомут
    cyl('cap_band', x, y, 1.12, 1.34, r + 0.012, 'steel')
    cyl('cap_band2', x, y, 0.70, 0.80, r + 0.012, 'steel')
    # задняя панель с оборудованием
    box('cap_back', x - 0.30, x + 0.30, y - r - 0.34, y - r - 0.02, 0.20, Hh - 0.10, 'panel', 0.04)
    box('cap_back_scr', x - 0.16, x + 0.16, y - r - 0.37, y - r - 0.33, 1.30, 1.70, 'accent')


def m_monitor(x, y):
    box('mon_base', x + 0.18, x + 0.42, y + 0.12, y + 0.36, 0.0, 0.03, 'kick', 0.02)
    box('mon_post', x + 0.27, x + 0.33, y + 0.21, y + 0.27, 0.03, 1.34, 'steel', 0.02)
    box('mon_frame', x + 0.05, x + 0.55, y + 0.17, y + 0.31, 1.34, 1.86, 'panel', 0.03)
    box('mon_screen', x + 0.09, x + 0.51, y + 0.165, y + 0.175, 1.38, 1.82, 'accent')


def m_cart(x, y):
    box('ct_body', x, x + 0.60, y, y + 0.45, 0.12, 0.80, 'panel', 0.04)
    box('ct_top', x - 0.02, x + 0.62, y - 0.02, y + 0.47, 0.80, 0.85, 'steel', 0.02)
    for i, (dx, dy) in enumerate(((0.10, 0.08), (0.50, 0.08), (0.10, 0.37), (0.50, 0.37))):
        cyl(f'ct_w{i}', x + dx, y + dy, 0.0, 0.12, 0.05, 'dark', verts=16)
    box('ct_handle', x + 0.06, x + 0.54, y - 0.04, y, 0.86, 1.02, 'steel', 0.02)


def m_slot(x, y):
    box('sl_niche', x, x + 1.20, y, y + 0.14, 0.0, 1.65, 'panel_dim', 0.02)
    box('sl_plate', x + 0.04, x + 1.16, y - 0.03, y, 0.0, 0.06, 'kick', 0.01)
    box('sl_power', x + 0.10, x + 0.30, y - 0.05, y - 0.03, 0.90, 1.05, 'steel', 0.01, 2)
    box('sl_bus', x + 0.86, x + 1.10, y - 0.05, y - 0.03, 0.90, 1.05, 'accent', 0.01, 2)
    box('sl_tag', x + 0.52, x + 0.68, y - 0.045, y - 0.03, 1.30, 1.42, 'dark', 0.008, 2)


# --- расстановка: два ряда модулей ------------------------------------------
def build_row(items, z_off):
    before = set(bpy.data.objects)
    x = 0.0
    for fn, w in items:
        fn(x, 0.0)
        x += w + 0.30
    for o in set(bpy.data.objects) - before:
        if o.type == 'MESH':
            o.location.z += z_off
    return x


row_a = [(m_bed, 2.10), (m_table, 1.45), (m_stool, 0.45), (m_wardrobe, 1.10),
         (m_hatch, 1.40), (m_console, 0.35), (m_monitor, 0.65)]
row_b = [(m_san, 1.25), (m_capsule, 1.25), (m_cart, 0.70), (m_slot, 1.30)]
wa = build_row(row_a, 0.0)
wb = build_row(row_b, 3.05)
ROW_W = max(wa, wb)

# фон: пол и стена, чтобы модули читались
box('sheet_floor', -0.6, ROW_W + 0.3, -1.2, 1.2, -0.12, -0.02, 'kick', 0)
box('sheet_wall', -0.6, ROW_W + 0.3, 1.2, 1.35, 0.0, 5.9, 'panel_dim', 0)
box('sheet_floor2', -0.6, ROW_W + 0.3, -1.2, 1.2, 3.03, 3.10, 'panel_dim', 0)


# --- свет и камера ----------------------------------------------------------
cx = ROW_W / 2
area(sc, 'key', (cx, -3.0, 5.2), (6.0, 2.5), 780, (math.radians(48), 0, 0))
area(sc, 'fill', (cx - 3.2, -1.6, 2.2), (3.5, 2.5), 160, (math.radians(72), 0, math.radians(-38)))
area(sc, 'rim', (cx + 2.6, 2.6, 4.2), (4.0, 2.0), 240, (math.radians(-58), 0, math.radians(22)))

cam_d = bpy.data.cameras.new('cam')
cam_d.type = 'ORTHO'
cam_d.ortho_scale = ROW_W + 0.9
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
cam.location = (cx, -14.0, 1.30)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 3000, 760
sc.render.film_transparent = False
sc.eevee.taa_render_samples = 64
sc.eevee.use_raytracing = True
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = -0.35

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
sc.render.filepath = os.path.join(OUT, 'style_modules_a.png')
bpy.ops.render.render(write_still=True)
cam.location = (cx, -14.0, 4.36)
sc.render.filepath = os.path.join(OUT, 'style_modules_b.png')
bpy.ops.render.render(write_still=True)
print('MODULES OK', round(ROW_W, 2))

# --- лист материалов --------------------------------------------------------
for o in list(sc.objects):
    if o.type in {'MESH', 'LIGHT'}:
        bpy.data.objects.remove(o, do_unlink=True)

names = ['panel', 'panel_dim', 'floor', 'ceiling', 'soft', 'steel', 'kick', 'accent',
         'light', 'seam', 'dark', 'glass']
for i, key in enumerate(names):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.40, depth=0.09, vertices=48,
                                        location=(i * 0.95, 0, 0.045))
    o = bpy.context.object
    o.name = f'mat_{key}'
    S.apply(o, key)
    o.rotation_euler = (R90, 0, 0)

box('board_floor', -0.65, len(names) * 0.95 - 0.3, -0.7, 0.7, -0.06, -0.01, 'panel_dim', 0)
cam.location = ((len(names) * 0.95) / 2 - 0.5, -6.0, 1.35)
cam.rotation_euler = (math.radians(84), 0, 0)
cam_d.ortho_scale = len(names) * 0.95 + 0.6
area(sc, 'bkey', ((len(names) * 0.95) / 2 - 0.5, -2.6, 2.4), (5.0, 1.6), 320,
     (math.radians(58), 0, 0))
sc.render.resolution_x, sc.render.resolution_y = 2200, 700
sc.render.filepath = os.path.join(OUT, 'style_board.png')
bpy.ops.render.render(write_still=True)
print('BOARD OK')
