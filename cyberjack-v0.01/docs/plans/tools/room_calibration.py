"""Калибровочная 6.0 × 4.4: доработка одной комнаты — материалы, свет, панели.

Конструктив (согласован): панель стены 1.20 × 1.20 со швом 20 мм, плинтус 0.10,
бирюзовая полоса #5FA39A h 0.12 на 1.15, пол плитка 0.60 белый глянец, потолок 2.70.
Устройства — из kit_devices (стол, стойка), слоты и мебель — по плану.

Запуск: blender -b --factory-startup -noaudio --python tools/room_calibration.py
Выход: blockout/calib_v2_*.png, blockout/room_calibration.blend
"""
import bpy, sys, os, math, json
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
import kit_devices as K  # noqa: E402

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
X0, X1, Y0, Y1 = 20.7, 26.7, 7.0, 11.4
H, T = 2.70, 0.20
PANEL, SEAM = 1.20, 0.02
PLINTH = 0.10
STRIPE_Z, STRIPE_H = 1.15, 0.12
DOOR_AT, DOOR_W = 23.7, 1.10
DOOR_H = 2.10

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'


def mat(name, color, rough=0.55, metal=0.0, emit=None, emit_strength=1.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


M_PANEL = mat('wall_panel', (0.80, 0.80, 0.78), 0.62)
M_SEAM = mat('wall_seam', (0.16, 0.17, 0.18), 0.8)
M_PLINTH = mat('plinth', (0.13, 0.14, 0.15), 0.55, 0.2)
M_STRIPE = mat('stripe_teal', (0.155, 0.36, 0.33), 0.45)
M_FLOOR = mat('floor_tile', (0.82, 0.82, 0.80), 0.12)
M_GROUT = mat('floor_grout', (0.35, 0.36, 0.35), 0.7)
M_CEIL = mat('ceiling', (0.76, 0.76, 0.74), 0.8)
M_LIGHT = mat('ceiling_light', (0.95, 0.95, 0.92), 0.4, emit=(1.0, 0.97, 0.90), emit_strength=12.0)
M_STEEL = mat('steel', (0.62, 0.64, 0.66), 0.32, 0.9)
M_PAINT = mat('paint', (0.10, 0.11, 0.12), 0.45, 0.0)
M_SOFT = mat('soft', (0.24, 0.21, 0.22), 0.75)
M_ACCENT = mat('accent', (0.13, 0.38, 0.35), 0.35)
M_DARK = mat('dark_plastic', (0.06, 0.07, 0.08), 0.5)
M_GLASS = mat('glass', (0.70, 0.82, 0.84), 0.08)
M_WHITE = mat('ceramics', (0.90, 0.90, 0.88), 0.2)


def box(name, x0, x1, y0, y1, z0, z1, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.transform(Matrix.Diagonal((max(abs(x1 - x0), 0.001), max(abs(y1 - y0), 0.001),
                                      max(abs(z1 - z0), 0.001), 1)))
    o.data.transform(Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)))
    o.data.materials.append(material)
    return o


# --- оболочка ---------------------------------------------------------------
def build_shell():
    # пол: подложка + плитка 0.60 со швом 10 мм
    box('floor_base', X0, X1, Y0, Y1, -0.10, -0.005, M_GROUT)
    pitch = 0.61
    n = 0
    x = X0
    while x < X1 - 0.01:
        y = Y0
        while y < Y1 - 0.01:
            box(f'tile_{n}', x + 0.005, min(x + 0.605, X1), y + 0.005,
                min(y + 0.605, Y1), -0.005, 0.0, M_FLOOR)
            n += 1
            y += pitch
        x += pitch
    # потолок
    box('ceiling', X0, X1, Y0, Y1, H, H + 0.06, M_CEIL)
    box('ceiling_light_1', 22.2, 23.4, 8.6, 9.8, H - 0.03, H, M_LIGHT)
    box('ceiling_light_2', 24.6, 25.8, 8.6, 9.8, H - 0.03, H, M_LIGHT)

    walls = {
        'south': dict(fixed=Y0, horiz=True, out=-1),
        'north': dict(fixed=Y1, horiz=True, out=1),
        'west': dict(fixed=X0, horiz=False, out=-1),
        'east': dict(fixed=X1, horiz=False, out=1),
    }
    for side, w in walls.items():
        a0, a1 = (X0, X1) if w['horiz'] else (Y0, Y1)
        f = w['fixed']
        # кладка за панелями (тёмная — швы читаются); на северной — с проёмом
        if side == 'north':
            dl, dr = DOOR_AT - DOOR_W / 2, DOOR_AT + DOOR_W / 2
            box('wall_north_back_l', X0, dl, f, f + w['out'] * T, 0, H, M_SEAM)
            box('wall_north_back_r', dr, X1, f, f + w['out'] * T, 0, H, M_SEAM)
            box('wall_north_lintel', dl, dr, f, f + w['out'] * T, DOOR_H, H, M_SEAM)
        elif w['horiz']:
            box(f'wall_{side}_back', a0, a1, f, f + w['out'] * T, 0, H, M_SEAM)
        else:
            box(f'wall_{side}_back', f, f + w['out'] * T, a0, a1, 0, H, M_SEAM)
        # плинтус
        if w['horiz']:
            box(f'plinth_{side}', a0, a1, f - w['out'] * 0.006, f + w['out'] * 0.014,
                0, PLINTH, M_PLINTH)
        else:
            box(f'plinth_{side}', f - w['out'] * 0.006, f + w['out'] * 0.014, a0, a1,
                0, PLINTH, M_PLINTH)
        # панели 1.20 × 1.20
        a = a0
        i = 0
        while a < a1 - 0.02:
            pa = min(a + PANEL, a1)
            z = PLINTH
            j = 0
            while z < H - 0.02:
                pz = min(z + PANEL, H)
                # проём на северной стене
                if side == 'north' and not (pa <= DOOR_AT - DOOR_W / 2 or a >= DOOR_AT + DOOR_W / 2) \
                        and z < DOOR_H:
                    z = pz + SEAM
                    j += 1
                    continue
                if w['horiz']:
                    box(f'panel_{side}_{i}_{j}', a + SEAM / 2, pa - SEAM / 2,
                        f - w['out'] * 0.004, f - w['out'] * 0.024, z + SEAM / 2,
                        pz - SEAM / 2, M_PANEL)
                else:
                    box(f'panel_{side}_{i}_{j}', f - w['out'] * 0.004, f - w['out'] * 0.024,
                        a + SEAM / 2, pa - SEAM / 2, z + SEAM / 2, pz - SEAM / 2, M_PANEL)
                z = pz + SEAM
                j += 1
            a = pa + SEAM
            i += 1
        # бирюзовая полоса
        if w['horiz']:
            box(f'stripe_{side}', a0, a1, f - w['out'] * 0.018, f - w['out'] * 0.006,
                STRIPE_Z, STRIPE_Z + STRIPE_H, M_STRIPE)
        else:
            box(f'stripe_{side}', f - w['out'] * 0.018, f - w['out'] * 0.006, a0, a1,
                STRIPE_Z, STRIPE_Z + STRIPE_H, M_STRIPE)


# --- устройства -------------------------------------------------------------
def assign_materials(prefix):
    for o in bpy.data.objects:
        if not o.name.startswith(prefix) or o.type != 'MESH':
            continue
        n = o.name.lower()
        if 'glass' in n:
            m = M_GLASS
        elif any(k in n for k in ('ложемент', 'сиденье', 'спинка', 'ремень', 'seat', 'soft')):
            m = M_SOFT
        elif any(k in n for k in ('ремень', 'экран', 'визор', 'рамка', 'пульт', 'кнопк')):
            m = M_ACCENT
        elif any(k in n for k in ('стойка', 'support', 'legs', 'wheel', 'frame', 'metal',
                                  'pole', 'rod', 'tank')):
            m = M_STEEL
        elif any(k in n for k in ('корпус', 'база', 'base', 'engine', 'platform')):
            m = M_PAINT
        else:
            m = M_PAINT
        o.data.materials.clear()
        o.data.materials.append(m)


def build_devices():
    log = []
    _, info = K.build_device(K.DEVICES['table'], (23.40, 9.20), yaw=90, prefix='dtable_')
    assign_materials('dtable_')
    log.append(('стол диагностический', [round(v, 2) for v in info['size']], info['tris']))

    _, info = K.build_device(K.DEVICES['stand'], (23.40, 10.30), yaw=0, prefix='stand_')
    assign_materials('stand_')
    log.append(('стойка телеметрии', [round(v, 2) for v in info['size']], info['tris']))

    # шкаф расходников с полками (запад)
    box('cabinet_body', 20.75, 21.15, 7.60, 8.60, 0.0, 2.0, M_PAINT)
    for i in range(4):
        box(f'cabinet_shelf_{i}', 20.77, 21.13, 7.62, 8.58, 0.35 + i * 0.45,
            0.38 + i * 0.45, M_STEEL)
    box('cabinet_handle', 21.16, 21.19, 8.02, 8.18, 1.05, 1.12, M_STEEL)

    # мойка-стерилизатор (северо-запад)
    box('sink_body', 20.75, 21.35, 10.55, 11.10, 0.0, 0.85, M_WHITE)
    box('sink_basin', 20.85, 21.25, 10.68, 10.98, 0.85, 0.88, M_STEEL)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.32, location=(21.05, 11.02, 1.02))
    tap = bpy.context.object
    tap.name = 'sink_tap'
    tap.data.materials.append(M_STEEL)
    box('dispenser', 20.80, 21.10, 10.62, 10.72, 1.30, 1.55, M_WHITE)

    # два монтажных слота: площадка, питание, данные
    for idx, y in enumerate((8.60, 9.90), start=1):
        box(f'slot_plate_{idx}', 26.28, 26.40, y - 0.50, y + 0.50, 0.30, 1.80, M_SEAM)
        box(f'slot_frame_{idx}', 26.22, 26.28, y - 0.54, y + 0.54, 0.26, 1.84, M_STEEL)
        box(f'slot_power_{idx}', 26.20, 26.24, y - 0.10, y + 0.06, 0.95, 1.10, M_DARK)
        box(f'slot_data_{idx}', 26.20, 26.24, y + 0.14, y + 0.26, 0.95, 1.06, M_ACCENT)

    # пульт процедуры у проёма
    box('console_body', 26.10, 26.30, 10.20, 10.60, 1.30, 1.60, M_PAINT)
    box('console_screen', 26.07, 26.10, 10.24, 10.56, 1.34, 1.56, M_ACCENT)

    # кабель-канал по восточной стене к столу
    box('cable_tray', 26.30, 26.40, 8.00, 10.60, 0.18, 0.26, M_STEEL)
    print('=== ROOM CALIBRATION ===')
    for row in log:
        print('DEV', row)


def build_doorway():
    dl, dr = DOOR_AT - DOOR_W / 2, DOOR_AT + DOOR_W / 2
    for name, x in (('jamb_l', dl), ('jamb_r', dr)):
        box(name, x - 0.03, x + 0.03, Y1 - 0.06, Y1 + T + 0.06, 0.0, DOOR_H, M_STEEL)
    box('door_head', dl - 0.03, dr + 0.03, Y1 - 0.06, Y1 + T + 0.06,
        DOOR_H - 0.06, DOOR_H, M_STEEL)
    # короткий тамбур за проёмом: иначе в проёме видна тёмная кладка
    y0, y1 = Y1 + T, Y1 + T + 1.50
    x0, x1 = DOOR_AT - 1.10, DOOR_AT + 1.10
    box('corr_floor', x0, x1, y0, y1, -0.06, 0.0, M_FLOOR)
    box('corr_ceil', x0, x1, y0, y1, 2.55, 2.60, M_CEIL)
    box('corr_wall_l', x0 - T, x0, y0, y1, 0.0, 2.55, M_PANEL)
    box('corr_wall_r', x1, x1 + T, y0, y1, 0.0, 2.55, M_PANEL)
    box('corr_wall_end', x0 - T, x1 + T, y1, y1 + T, 0.0, 2.55, M_PANEL)


build_shell()
build_doorway()
build_devices()

# --- свет ------------------------------------------------------------------
def area(name, loc, size, energy, rot=(0, 0, 0), color=(1.0, 0.96, 0.90)):
    d = bpy.data.lights.new(name, 'AREA')
    d.size = size[0]
    d.size_y = size[1]
    d.energy = energy
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    sc.collection.objects.link(o)
    return o


area('key_table', (23.40, 9.20, H - 0.10), (1.20, 0.60), 70)
area('fill_door', (23.70, 10.90, 1.90), (1.00, 1.60), 22, rot=(math.radians(90), 0, 0))
area('rim_east', (26.40, 9.20, 2.10), (0.40, 2.40), 18,
     rot=(0, math.radians(-80), 0), color=(0.75, 0.85, 0.95))
area('fill_west', (21.00, 9.20, 2.30), (0.60, 3.00), 14,
     rot=(0, math.radians(70), 0))
area('corridor_light', (DOOR_AT, Y1 + T + 0.75, 2.50), (0.60, 1.20), 25)

world = bpy.data.worlds.new('W')
sc.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.03, 0.035, 0.04, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

# --- рендер ----------------------------------------------------------------
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 48
sc.eevee.use_raytracing = True
sc.render.film_transparent = False
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.resolution_x, sc.render.resolution_y = 1500, 940

cd = bpy.data.cameras.new('CAM')
cam = bpy.data.objects.new('CAM', cd)
sc.collection.objects.link(cam)
sc.camera = cam


def shot(name, loc, target, lens=22.0):
    cd.type = 'PERSP'
    cd.lens = lens
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)


def shot_top(name):
    for o in bpy.data.objects:
        if o.name == 'ceiling' or o.name.startswith('ceiling_light'):
            o.hide_render = True
    cd.type = 'ORTHO'
    cd.ortho_scale = 7.0
    cam.location = ((X0 + X1) / 2, (Y0 + Y1) / 2, 9.0)
    cam.rotation_euler = (0, 0, 0)
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects:
        if o.name == 'ceiling' or o.name.startswith('ceiling_light'):
            o.hide_render = False


# два диагональных вида: из юго-восточного и юго-западного углов
shot('calib_v2_a.png', (26.20, 7.60, 1.62), (21.60, 10.30, 1.00), lens=20)
shot('calib_v2_b.png', (21.45, 7.35, 1.62), (26.20, 10.20, 1.00), lens=20)
shot('calib_v2_table.png', (22.20, 8.10, 1.30), (23.90, 9.60, 0.90), lens=32)
shot_top('calib_v2_top.png')

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'room_calibration.blend'))
print('SAVED')
