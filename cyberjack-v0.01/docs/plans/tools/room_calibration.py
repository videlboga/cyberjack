"""Калибровочная v3: 7.6 × 5.6, кушетка, чистый состав.

Что изменилось против v2:
  * комната крупнее (было 6.0 × 4.4), потолок 2.70;
  * вместо «столика» из ассета — кушетка: станина, матрас, подголовник, ремни, подушка;
  * убран настенный пульт, который читался как часы;
  * экран монитора сидит на стойке от пола, а не висит в воздухе;
  * убраны рельсы/педали/поручни ассета — в комнате только понятные предметы.

Сцена центрирована в начале координат.
Запуск: blender -b --factory-startup -noaudio --python tools/room_calibration.py
Выход: blockout/calib_v3_*.png, blockout/room_calibration.blend
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
W, D = 7.6, 5.6                     # габарит комнаты
X0, X1 = -W / 2, W / 2
Y0, Y1 = -D / 2, D / 2
H, T = 2.70, 0.20
PANEL, SEAM = 1.20, 0.02
PLINTH = 0.10
STRIPE_Z, STRIPE_H = 1.15, 0.12
DOOR_AT, DOOR_W, DOOR_H = 0.0, 1.10, 2.10

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'


def mat(name, color, rough=0.55, metal=0.0, emit=None, emit_strength=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
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
M_LIGHT = mat('ceiling_light', (0.95, 0.95, 0.92), 0.4, emit=(1.0, 0.97, 0.90), emit_strength=10.0)
M_STEEL = mat('steel', (0.60, 0.62, 0.64), 0.32, 0.9)
M_PAINT = mat('paint', (0.16, 0.18, 0.19), 0.5, 0.0)
M_SOFT = mat('upholstery', (0.30, 0.31, 0.32), 0.7)
M_STRAP = mat('strap', (0.07, 0.07, 0.08), 0.6)
M_ACCENT = mat('accent', (0.13, 0.38, 0.35), 0.35, emit=(0.20, 0.55, 0.50), emit_strength=1.5)
M_WHITE = mat('ceramics', (0.90, 0.90, 0.88), 0.2)
M_CORR_LIGHT = mat('corr_light', (0.45, 0.45, 0.43), 0.6, emit=(1.0, 0.95, 0.85), emit_strength=0.55)
M_PANEL_DIM = mat('wall_panel_dim', (0.62, 0.62, 0.61), 0.65)


def box(name, x0, x1, y0, y1, z0, z1, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.transform(Matrix.Diagonal((max(abs(x1 - x0), 0.001), max(abs(y1 - y0), 0.001),
                                      max(abs(z1 - z0), 0.001), 1)))
    o.data.transform(Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)))
    o.data.materials.append(material)
    return o


def taper_box(name, x0, x1, y0, y1, z0, z1, material, shrink=0.10):
    """Корпус с сужением книзу: убирает эффект «кирпич на ножках»."""
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    dx = (x1 - x0) * shrink
    dy = (y1 - y0) * shrink
    top = [bm.verts.new(v) for v in ((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    bot = [bm.verts.new(v) for v in ((x0 + dx, y0 + dy, z0), (x1 - dx, y0 + dy, z0),
                                     (x1 - dx, y1 - dy, z0), (x0 + dx, y1 - dy, z0))]
    bm.faces.new(top[::-1])
    bm.faces.new(bot)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((top[i], top[j], bot[j], bot[i]))
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def bevel(obj, width, segments=2, angle=0.62):
    """Фаска/скругление: без неё любая коробка читается как примитив."""
    m = obj.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = angle
    m.miter_outer = 'MITER_ARC'


def smooth(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    except Exception:
        pass
    obj.select_set(False)


def finish_shapes():
    """Один проход по всей сцене: скругления по размеру детали + сглаживание."""
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        n = o.name
        if n.startswith('tile_'):
            w, s = 0.004, 1
        elif 'pillow' in n:
            w, s = 0.050, 6
        elif any(k in n for k in ('mattress', 'headrest')):
            w, s = 0.030, 4
        elif n.startswith(('panel_', 'stripe_', 'plinth_')):
            w, s = 0.004, 1
        elif any(k in n for k in ('couch_frame', 'cabinet_body', 'cart_', 'sink_body',
                                 'slot_', 'monitor_', 'jamb', 'door_', 'corr_', 'wall_',
                                 'light_', 'ceiling', 'floor_base')):
            w, s = 0.012, 2
        elif any(k in n for k in ('strap', 'handle', 'bag', 'bin', 'dispenser', 'basin')):
            w, s = 0.005, 2
        else:
            w, s = 0.008, 2
        bevel(o, w, s)
        smooth(o)


def cyl(name, x, y, z0, z1, r, material):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0),
                                        location=(x, y, (z0 + z1) / 2), vertices=20)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    return o


# --- оболочка ---------------------------------------------------------------
def build_shell():
    box('floor_base', X0, X1, Y0, Y1, -0.10, -0.005, M_GROUT)
    n = 0
    x = X0
    while x < X1 - 0.01:
        y = Y0
        while y < Y1 - 0.01:
            box(f'tile_{n}', x + 0.005, min(x + 0.605, X1), y + 0.005,
                min(y + 0.605, Y1), -0.005, 0.0, M_FLOOR)
            n += 1
            y += 0.61
        x += 0.61
    box('ceiling', X0, X1, Y0, Y1, H, H + 0.06, M_CEIL)
    for i, (lx0, lx1) in enumerate(((-2.2, -1.0), (0.8, 2.0))):
        # рамка-кольцо, а не сплошная плита: иначе закрывает светильник
        box(f'light_lip_l_{i}', lx0 - 0.04, lx0, -0.84, 0.44, H - 0.05, H - 0.005, M_STEEL)
        box(f'light_lip_r_{i}', lx1, lx1 + 0.04, -0.84, 0.44, H - 0.05, H - 0.005, M_STEEL)
        box(f'light_lip_s_{i}', lx0, lx1, -0.84, -0.8, H - 0.05, H - 0.005, M_STEEL)
        box(f'light_lip_n_{i}', lx0, lx1, 0.4, 0.44, H - 0.05, H - 0.005, M_STEEL)
        box(f'light_{i}', lx0, lx1, -0.8, 0.4, H - 0.02, H - 0.005, M_LIGHT)

    # декоративный профиль в углах: закрывает стык панелей двух стен
    s = 0.05
    for i, (px, py) in enumerate(((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1))):
        cx = px + s if px < 0 else px - s          # столб заходит внутрь комнаты
        cy = py + s if py < 0 else py - s
        box(f'corner_post_{i}', min(px, cx), max(px, cx), min(py, cy), max(py, cy),
            0.0, H, M_STEEL)

    walls = {'south': (Y0, -1, True), 'north': (Y1, 1, True),
             'west': (X0, -1, False), 'east': (X1, 1, False)}
    for side, (f, out, horiz) in walls.items():
        a0, a1 = (X0, X1) if horiz else (Y0, Y1)
        if side == 'north':
            dl, dr = DOOR_AT - DOOR_W / 2, DOOR_AT + DOOR_W / 2
            box('wall_north_l', X0, dl, f, f + out * T, 0, H, M_SEAM)
            box('wall_north_r', dr, X1, f, f + out * T, 0, H, M_SEAM)
            box('wall_north_lintel', dl, dr, f, f + out * T, DOOR_H, H, M_SEAM)
        elif horiz:
            box(f'wall_{side}', a0, a1, f, f + out * T, 0, H, M_SEAM)
        else:
            box(f'wall_{side}', f, f + out * T, a0, a1, 0, H, M_SEAM)
        if horiz:
            box(f'plinth_{side}', a0, a1, min(f, f - out * 0.02),
                max(f, f - out * 0.02) + 0.02, 0, PLINTH, M_PLINTH)
        else:
            box(f'plinth_{side}', min(f, f - out * 0.02), max(f, f - out * 0.02) + 0.02,
                a0, a1, 0, PLINTH, M_PLINTH)
        a, i = a0, 0
        while a < a1 - 0.02:
            pa = min(a + PANEL, a1)
            z, j = PLINTH, 0
            while z < H - 0.02:
                pz = min(z + PANEL, H)
                in_door = (side == 'north'
                           and not (pa <= DOOR_AT - DOOR_W / 2 or a >= DOOR_AT + DOOR_W / 2)
                           and z < DOOR_H)
                if not in_door:
                    if horiz:
                        box(f'panel_{side}_{i}_{j}', a + SEAM / 2, pa - SEAM / 2,
                            f - out * 0.004, f - out * 0.024, z + SEAM / 2, pz - SEAM / 2, M_PANEL)
                    else:
                        box(f'panel_{side}_{i}_{j}', f - out * 0.004, f - out * 0.024,
                            a + SEAM / 2, pa - SEAM / 2, z + SEAM / 2, pz - SEAM / 2, M_PANEL)
                z = pz + SEAM
                j += 1
            a = pa + SEAM
            i += 1
        if horiz:
            box(f'stripe_{side}', a0, a1, f - out * 0.018, f - out * 0.006,
                STRIPE_Z, STRIPE_Z + STRIPE_H, M_STRIPE)
        else:
            box(f'stripe_{side}', f - out * 0.018, f - out * 0.006, a0, a1,
                STRIPE_Z, STRIPE_Z + STRIPE_H, M_STRIPE)


def build_doorway():
    dl, dr = DOOR_AT - DOOR_W / 2, DOOR_AT + DOOR_W / 2
    for name, x in (('jamb_l', dl), ('jamb_r', dr)):
        box(name, x - 0.04, x + 0.04, Y1 - 0.08, Y1 + T + 0.08, 0.0, DOOR_H, M_STEEL)
    box('door_head', dl - 0.04, dr + 0.04, Y1 - 0.08, Y1 + T + 0.08,
        DOOR_H - 0.08, DOOR_H, M_STEEL)
    y0, y1 = Y1 + T, Y1 + T + 1.60
    x0, x1 = DOOR_AT - 1.20, DOOR_AT + 1.20
    box('corr_floor', x0, x1, y0, y1, -0.06, 0.0, M_FLOOR)
    box('corr_ceil', x0, x1, y0, y1, 2.55, 2.60, M_CEIL)
    box('corr_wall_l', x0 - T, x0, y0, y1, 0.0, 2.55, M_PANEL_DIM)
    box('corr_wall_r', x1, x1 + T, y0, y1, 0.0, 2.55, M_PANEL_DIM)
    box('corr_wall_end', x0 - T, x1 + T, y1, y1 + T, 0.0, 2.55, M_PANEL_DIM)
    box('corr_plinth', x0 - T, x1 + T, y1 - 0.02, y1, 0.0, 0.10, M_PLINTH)
    box('corr_light', x0 + 0.3, x1 - 0.3, y0 + 0.4, y1 - 0.4, 2.52, 2.55, M_CORR_LIGHT)


# --- оборудование -----------------------------------------------------------
COUCH_X, COUCH_Y = -0.30, -0.60
COUCH_L, COUCH_Wd, COUCH_H = 2.00, 0.80, 0.78


def build_couch():
    x0, x1 = COUCH_X - COUCH_L / 2, COUCH_X + COUCH_L / 2
    y0, y1 = COUCH_Y - COUCH_Wd / 2, COUCH_Y + COUCH_Wd / 2
    taper_box('couch_frame', x0 + 0.04, x1 - 0.04, y0 + 0.04, y1 - 0.04,
              COUCH_H - 0.20, COUCH_H - 0.04, M_PAINT, shrink=0.14)
    for i, (lx, ly) in enumerate(((x0 + 0.12, y0 + 0.12), (x1 - 0.12, y0 + 0.12),
                                  (x0 + 0.12, y1 - 0.12), (x1 - 0.12, y1 - 0.12))):
        cyl(f'couch_leg_{i}', lx, ly, 0.06, COUCH_H - 0.16, 0.025, M_STEEL)
        cyl(f'couch_wheel_{i}', lx, ly, 0.0, 0.06, 0.045, M_PAINT)
    # мягкая юбка под матрасом: убирает эффект «плита на ножках»
    box('couch_skirt', x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02,
        COUCH_H - 0.10, COUCH_H + 0.02, M_SOFT)
    box('couch_mattress', x0, x1, y0, y1, COUCH_H + 0.02, COUCH_H + 0.13, M_SOFT)
    hx0, hx1 = x0, x0 + 0.42
    box('couch_headrest', hx0, hx1, y0 + 0.02, y1 - 0.02,
        COUCH_H + 0.13, COUCH_H + 0.20, M_SOFT)
    box('couch_pillow', hx0 + 0.05, hx0 + 0.39, COUCH_Y - 0.29, COUCH_Y + 0.29,
        COUCH_H + 0.20, COUCH_H + 0.30, M_WHITE)
    # подголовник поднят на 12° вокруг внутренней кромки
    pivot = Vector((hx1, COUCH_Y, COUCH_H + 0.13))
    rot = (Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(12), 4, 'Y')
           @ Matrix.Translation(-pivot))
    for n in ('couch_headrest', 'couch_pillow'):
        o = bpy.data.objects[n]
        o.data.transform(rot)
    for i, xc in enumerate((COUCH_X + 0.10, COUCH_X + 0.62)):
        box(f'couch_strap_{i}', xc - 0.035, xc + 0.035, y0 - 0.01, y1 + 0.01,
            COUCH_H + 0.12, COUCH_H + 0.145, M_STRAP)
    # поперечные связи и пульт на боковой штанге
    for i, xx in enumerate((x0 + 0.10, x1 - 0.10)):
        cyl(f'couch_rail_{i}', xx, COUCH_Y, COUCH_H - 0.30, COUCH_H - 0.26, 0.018, M_STEEL)
    box('couch_pad', x1 - 0.26, x1 - 0.02, COUCH_Y + 0.30, COUCH_Y + 0.40,
        COUCH_H - 0.02, COUCH_H + 0.06, M_PAINT)


def build_monitor():
    """Экран на стойке от пола — ничего не висит в воздухе."""
    mx, my = 1.45, 0.55
    cyl('monitor_pole', mx, my, 0.06, 1.55, 0.028, M_STEEL)
    cyl('monitor_base', mx, my, 0.0, 0.06, 0.22, M_PAINT)
    box('monitor_screen', mx - 0.17, mx + 0.17, my - 0.03, my + 0.03, 1.20, 1.44, M_PAINT)
    box('monitor_glass', mx - 0.15, mx + 0.15, my - 0.035, my - 0.03, 1.22, 1.42, M_ACCENT)
    box('monitor_arm', mx - 0.03, mx + 0.03, my - 0.03, my + 0.03, 1.20, 1.24, M_STEEL)


def build_cabinet():
    x0, x1 = X0 + 0.02, X0 + 0.46
    y0, y1 = -1.15, -0.25
    box('cabinet_body', x0, x1, y0, y1, 0.06, 1.98, M_PAINT)
    box('cabinet_cap', x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, 1.98, 2.04, M_PAINT)
    box('cabinet_toe', x0, x1 - 0.02, y0, y1, 0.0, 0.06, M_PLINTH)
    # створки впотай: полотно чуть меньше корпуса, по центру шов
    ym = (y0 + y1) / 2
    for i, (ya, yb) in enumerate(((y0 + 0.015, ym - 0.006), (ym + 0.006, y1 - 0.015))):
        box(f'cabinet_door_{i}', x1 - 0.018, x1 - 0.002, ya, yb, 0.10, 1.94, M_PAINT)
        box(f'cabinet_handle_{i}', x1 - 0.004, x1 + 0.024, ya + 0.04, ya + 0.06, 1.10, 1.34, M_STEEL)
    box('cabinet_vent', x1 - 0.004, x1 + 0.002, y0 + 0.10, y1 - 0.10, 1.70, 1.86, M_SEAM)


def build_sink():
    x0, x1 = X0 + 0.02, X0 + 0.60
    y0, y1 = 1.30, 1.90
    box('sink_body', x0, x1, y0, y1, 0.0, 0.85, M_WHITE)
    box('sink_basin', x0 + 0.08, x1 - 0.08, y0 + 0.10, y1 - 0.10, 0.85, 0.88, M_STEEL)
    cyl('sink_tap', x0 + 0.30, y1 - 0.06, 0.88, 1.12, 0.018, M_STEEL)
    box('sink_dispenser', x0 + 0.10, x0 + 0.26, y0 + 0.04, y0 + 0.14, 0.88, 1.14, M_WHITE)
    # фронт: два ящика со швами и ручкой
    for i, (za, zb) in enumerate(((0.10, 0.42), (0.46, 0.80))):
        box(f'sink_drawer_{i}', x1 - 0.008, x1 + 0.004, y0 + 0.04, y1 - 0.04, za, zb, M_WHITE)
        box(f'sink_drawer_gap_{i}', x1 + 0.002, x1 + 0.006, y0 + 0.05, y1 - 0.05,
            za - 0.01, za, M_SEAM)
        cyl(f'sink_drawer_handle_{i}', x1 + 0.02, (y0 + y1) / 2, zb - 0.06, zb - 0.03,
            0.010, M_STEEL)


def build_slots():
    """Ниша под модуль: рамка с крепежом и питанием, а не глухая створка."""
    for i, yc in enumerate((-1.35, 0.55)):
        # рамка
        box(f'slot_frame_{i}', X1 - 0.14, X1 - 0.04, yc - 0.62, yc + 0.62, 0.26, 1.72, M_STEEL)
        # ниша (утоплена в стену)
        box(f'slot_niche_{i}', X1 - 0.04, X1 - 0.01, yc - 0.54, yc + 0.54, 0.34, 1.64, M_SEAM)
        # площадка под крепление
        box(f'slot_pad_{i}', X1 - 0.17, X1 - 0.14, yc - 0.36, yc + 0.36, 0.40, 0.46, M_PAINT)
        # питание и шина данных
        box(f'slot_power_{i}', X1 - 0.19, X1 - 0.15, yc - 0.30, yc - 0.14, 1.02, 1.16, M_PAINT)
        box(f'slot_data_{i}', X1 - 0.18, X1 - 0.15, yc + 0.10, yc + 0.24, 1.04, 1.14, M_ACCENT)
        # бирка
        box(f'slot_label_{i}', X1 - 0.16, X1 - 0.15, yc - 0.10, yc + 0.10, 1.34, 1.40, M_ACCENT)
        for k, dy in enumerate((-0.48, 0.48)):
            cyl(f'slot_bolt_{i}_{k}', X1 - 0.13, yc + dy, 0.32, 0.36, 0.018, M_STEEL)


def build_misc():
    cyl('stool_seat', -1.775, -1.775, 0.44, 0.48, 0.175, M_SOFT)
    for i, (sx, sy) in enumerate(((-1.92, -1.92), (-1.63, -1.92), (-1.92, -1.63), (-1.63, -1.63))):
        cyl(f'stool_leg_{i}', sx, sy, 0.0, 0.44, 0.012, M_STEEL)
    box('cart_body', 1.55, 2.15, -2.10, -1.65, 0.55, 0.60, M_STEEL)
    box('cart_shelf', 1.55, 2.15, -2.10, -1.65, 0.20, 0.24, M_STEEL)
    for i, (cx, cy) in enumerate(((1.62, -2.02), (2.08, -2.02), (1.62, -1.72), (2.08, -1.72))):
        cyl(f'cart_leg_{i}', cx, cy, 0.0, 0.20, 0.012, M_STEEL)
    box('cart_lip', 1.53, 2.17, -2.12, -1.63, 0.60, 0.63, M_STEEL)
    for i, (za, zb) in enumerate(((0.26, 0.40), (0.42, 0.56))):
        box(f'cart_drawer_{i}', 1.55, 2.15, -2.10, -2.075, za, zb, M_STEEL)
        cyl(f'cart_handle_{i}', 1.62, -2.06, zb - 0.06, zb - 0.03, 0.010, M_STEEL)
    cyl('cart_push_handle', 2.10, -1.88, 0.62, 1.02, 0.014, M_STEEL)
    box('cart_bin_1', 1.62, 1.86, -2.02, -1.75, 0.63, 0.78, M_WHITE)
    box('cart_bin_2', 1.90, 2.10, -2.02, -1.75, 0.63, 0.74, M_ACCENT)
    cyl('iv_pole', -1.85, 0.35, 0.0, 1.85, 0.018, M_STEEL)
    cyl('iv_base', -1.85, 0.35, 0.0, 0.05, 0.20, M_PAINT)
    box('iv_bag', -1.92, -1.78, 0.31, 0.39, 1.45, 1.68, M_WHITE)


build_shell()
build_doorway()
build_couch()
build_monitor()
build_cabinet()
build_sink()
build_slots()
build_misc()

finish_shapes()

print('=== ROOM ===', f'{W} x {D} x {H} m', 'area', round(W * D, 1))
print('COUCH', COUCH_L, COUCH_Wd, COUCH_H,
      'gap_south', round(COUCH_Y - COUCH_Wd / 2 - Y0, 2),
      'gap_north', round(Y1 - (COUCH_Y + COUCH_Wd / 2), 2))


# --- свет ------------------------------------------------------------------
def area(name, loc, size, energy, rot=(0, 0, 0), color=(1.0, 0.96, 0.90)):
    d = bpy.data.lights.new(name, 'AREA')
    d.size, d.size_y = size[0], size[1]
    d.energy = energy
    d.color = color
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = rot
    sc.collection.objects.link(o)


area('key_couch', (COUCH_X, COUCH_Y, H - 0.12), (1.60, 0.90), 90)
area('fill_door', (DOOR_AT, Y1 - 0.30, 1.95), (1.20, 1.80), 25, rot=(math.radians(90), 0, 0))
area('rim_east', (X1 - 0.35, 0.0, 2.20), (0.40, 3.00), 20,
     rot=(0, math.radians(-80), 0), color=(0.75, 0.85, 0.95))
area('fill_west', (X0 + 0.35, -0.5, 2.30), (0.40, 2.60), 14,
     rot=(0, math.radians(80), 0))

world = bpy.data.worlds.new('W')
sc.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.03, 0.035, 0.04, 1)

# --- рендер ----------------------------------------------------------------
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 48
sc.eevee.use_raytracing = True
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
        if o.name == 'ceiling' or o.name.startswith(('light_', 'corr_ceil')):
            o.hide_render = True
    cd.type = 'ORTHO'
    cd.ortho_scale = W + 1.2
    cam.location = (0.0, 0.4, 9.0)
    cam.rotation_euler = (0, 0, 0)
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects:
        if o.name == 'ceiling' or o.name.startswith(('light_', 'corr_ceil')):
            o.hide_render = False


shot('calib_v3_a.png', (3.10, -2.35, 1.62), (-1.90, 1.60, 1.05), lens=22)
shot('calib_v3_b.png', (-3.10, -2.35, 1.62), (2.20, 1.60, 1.05), lens=22)
shot('calib_v3_couch.png', (-2.60, 1.70, 1.45), (0.60, -0.90, 0.85), lens=28)
shot_top('calib_v3_top.png')

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'room_calibration.blend'))
print('SAVED')
