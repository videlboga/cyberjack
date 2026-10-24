"""Комната в инк-стиле по рефу sex_machine.png.

Повторяет язык рефа: белые панели с тонкими швами, плотная сеть труб и кабелей,
настенные экраны с UI, приборный стол с манипулятором, цвет — только в экранах,
колбах и мелких кнопках. Линии — Freestyle по каждой кромке.

Запуск: blender -b --factory-startup -noaudio --python tools/ink_room.py
"""
import bpy, sys, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from ink_lib import Ink   # noqa: E402

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
I = Ink()
I.build()
M = I.M
UI = I.screen_ui()

X0, X1 = -3.2, 3.2
Y0, Y1 = 0.0, 5.2
H = 2.85


def box(name, x0, x1, y0, y1, z0, z1, role='wall', bevel=0.008):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    bpy.ops.object.transform_apply(scale=True)
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    bpy.ops.object.transform_apply(location=True)
    I.apply(o, role)
    if bevel > 0:
        m = o.modifiers.new('b', 'BEVEL')
        m.width, m.segments, m.limit_method = bevel, 2, 'ANGLE'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    return o


def cyl(name, x, y, z0, z1, r, role='metal', verts=24, axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0), vertices=verts,
                                        location=(x, y, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    if axis == 'X':
        o.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        o.rotation_euler = (math.pi / 2, 0, 0)
    I.apply(o, role)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    return o


def pipe(prefix, pts, r=0.055, role='metal'):
    """Труба по точкам: цилиндры + шаровые стыки (читается как единая линия)."""
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        length = math.sqrt(dx * dx + dy * dy + dz * dz)
        if length < 1e-4:
            continue
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=length, vertices=16,
                                            location=((a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
                                                      (a[2] + b[2]) / 2))
        o = bpy.context.object
        o.name = f'{prefix}_{i}'
        o.rotation_euler = (math.atan2(math.sqrt(dx * dx + dy * dy), dz),
                            0, math.atan2(dy, dx))
        I.apply(o, role)
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
        o.data.update()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=8,
                                             location=b)
        s = bpy.context.object
        s.name = f'{prefix}_j{i}'
        I.apply(s, role)


def cable(prefix, pts, r=0.012, role='dark'):
    cu = bpy.data.curves.new(f'{prefix}_c', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 2
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for p, co in zip(sp.bezier_points, pts):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(prefix, cu)
    sc.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    I.apply(bpy.context.object, role)


def screen(name, x0, x1, y, z0, z1, depth=0.05, tilt=0.0, ui=True):
    """Настенный экран: светлая рамка + UI-панель."""
    box(f'{name}_frame', x0, x1, y, y + depth, z0, z1, 'wall', 0.012)
    box(f'{name}_bezel', x0 + 0.02, x1 - 0.02, y + 0.004, y + 0.012,
        z0 + 0.02, z1 - 0.02, 'metal_d', 0.004)
    o = box(f'{name}_ui', x0 + 0.035, x1 - 0.035, y - 0.002, y + 0.004,
            z0 + 0.035, z1 - 0.035, 'wall', 0.0)
    o.data.materials.clear()
    o.data.materials.append(M['screen'])
    if ui:
        # строки и блоки интерфейса: тонкие плашки на лицевой плоскости
        w = (x1 - x0) - 0.07
        hgt = (z1 - z0) - 0.07
        yy = y - 0.004
        box(f'{name}_ui_head', x0 + 0.045, x0 + 0.045 + w * 0.55, yy - 0.002, yy,
            z1 - 0.055 - hgt * 0.10, z1 - 0.050, 'cyan', 0.0)
        for k in range(4):
            zz = z1 - 0.075 - hgt * 0.10 - k * (hgt * 0.13)
            box(f'{name}_ui_l{k}', x0 + 0.045, x0 + 0.045 + w * (0.85 - k * 0.12),
                yy - 0.002, yy, zz - hgt * 0.045, zz, 'cyan', 0.0)
        box(f'{name}_ui_chart', x0 + 0.045 + w * 0.55, x1 - 0.045, yy - 0.002, yy,
            z0 + 0.05, z1 - 0.08 - hgt * 0.45, 'mid', 0.0)


def panel_wall(y, x0, x1, z0, z1, seam=0.9, prefix='wp'):
    """Панельная развёртка: модули с тонкими швами (линии по кромкам)."""
    x = x0
    i = 0
    while x < x1 - 0.01:
        w = min(seam, x1 - x)
        z = z0
        j = 0
        while z < z1 - 0.01:
            hh = min(1.2, z1 - z)
            box(f'{prefix}_{i}_{j}', x + 0.006, x + w - 0.006, y, y + 0.03,
                z + 0.006, z + hh - 0.006, 'wall', 0.004)
            z += hh
            j += 1
        x += seam
        i += 1


# --- оболочка ---------------------------------------------------------------
box('floor', X0, X1, Y0, Y1, -0.08, 0.0, 'floor', 0.01)
for i in range(1, 6):
    box(f'floor_seam_{i}', X0, X1, Y0 + i * 0.86, Y0 + i * 0.86 + 0.012, 0.0, 0.002, 'metal_d')
box('wall_l', X0 - 0.2, X0, Y0, Y1, 0.0, H, 'wall_c', 0.01)
box('wall_r', X1, X1 + 0.2, Y0, Y1, 0.0, H, 'wall_c', 0.01)
box('wall_b', X0 - 0.2, X1 + 0.2, Y1, Y1 + 0.2, 0.0, H, 'wall', 0.01)
box('ceiling', X0 - 0.2, X1 + 0.2, Y0, Y1 + 0.2, H, H + 0.1, 'wall_c', 0.01)
panel_wall(Y1 - 0.03, X0, X1, 0.0, H, 0.9, 'wpb')
panel_wall(X0 + 0.03, Y0, Y1, 0.0, H, 0.9, 'wpl')

# --- потолок: короба, трубы, лампы -----------------------------------------
box('duct_a', X0 + 0.2, X1 - 0.2, 1.05, 1.45, H - 0.34, H - 0.02, 'metal', 0.02)
box('duct_b', X0 + 0.2, X1 - 0.2, 2.55, 3.05, H - 0.30, H - 0.02, 'metal', 0.02)
for i, y in enumerate((0.55, 1.75, 3.35, 4.15)):
    pipe(f'ceil_pipe_{i}', [(X0 + 0.1, y, H - 0.12), (X1 - 0.1, y, H - 0.12)], 0.04)
for i, x in enumerate((-2.2, -0.4, 1.6)):
    box(f'lamp_{i}', x, x + 1.2, 0.30, 0.42, H - 0.06, H - 0.03, 'screen', 0.004)
    box(f'lamp_case_{i}', x - 0.06, x + 1.26, 0.26, 0.46, H - 0.05, H - 0.015, 'metal', 0.006)

# --- правая стена: вертикальные трубы с отводами ---------------------------
pipe('right_a', [(X1 - 0.10, 4.60, 0.0), (X1 - 0.10, 4.60, 2.10), (X1 - 0.10, 3.95, 2.10),
                 (X1 - 0.10, 3.95, H - 0.10)], 0.06)
pipe('right_b', [(X1 - 0.22, 4.05, 0.0), (X1 - 0.22, 4.05, 1.55), (X1 - 0.22, 3.35, 1.55),
                 (X1 - 0.22, 3.35, H - 0.10)], 0.045)
pipe('right_c', [(X1 - 0.10, 2.55, H - 0.10), (X1 - 0.10, 2.55, 2.35), (X1 - 0.10, 2.15, 2.35),
                 (X1 - 0.10, 2.15, 1.85)], 0.05)
for i, y in enumerate((3.9, 3.3, 2.2)):
    box(f'valve_{i}', X1 - 0.30, X1 - 0.18, y - 0.10, y + 0.10, 1.62, 1.86, 'metal', 0.02)
    box(f'valve_wheel_{i}', X1 - 0.36, X1 - 0.18, y - 0.05, y + 0.05, 1.70, 1.78, 'metal_d', 0.01)

# экраны на правой стене
screen('scr_r1', X1 - 0.05, X1 + 0.02, 0.0, 0.0, 0.0)  # заглушка формы
for i, (z0, z1, y) in enumerate(((1.30, 1.90, 3.55), (1.95, 2.45, 3.05))):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = f'wm_{i}'

# --- стол с приборами по центру --------------------------------------------
box('bench_top', -1.55, 1.85, 3.10, 3.95, 0.86, 0.94, 'wall', 0.02)
box('bench_apron', -1.55, 1.85, 3.10, 3.18, 0.72, 0.86, 'metal', 0.01)
for i, (x, y) in enumerate(((-1.35, 3.22), (1.65, 3.22), (-1.35, 3.83), (1.65, 3.83))):
    box(f'bench_leg_{i}', x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0.0, 0.72, 'metal', 0.01)
box('bench_shelf', -1.45, 1.75, 3.14, 3.92, 0.36, 0.40, 'wall', 0.01)

# приборы на столе
box('mon_a', -1.30, -0.75, 3.55, 3.62, 0.94, 1.32, 'wall', 0.01)
box('mon_a_ui', -1.27, -0.78, 3.545, 3.55, 0.97, 1.29, 'wall', 0.0).data.materials.clear()
bpy.data.objects['mon_a_ui'].data.materials.append(UI)
box('mon_a_stand', -1.06, -0.99, 3.57, 3.64, 0.94, 1.00, 'metal', 0.01)
box('mon_b', -0.65, -0.30, 3.55, 3.62, 0.98, 1.28, 'wall', 0.01)
box('device_c', 0.05, 0.40, 3.50, 3.75, 0.94, 1.20, 'wall', 0.012)
box('device_c_scr', 0.08, 0.37, 3.49, 3.50, 1.00, 1.16, 'screen', 0.004)
for i, x in enumerate((0.12, 0.22, 0.32)):
    cyl(f'knob_{i}', x, 3.47, 0.96, 1.00, 0.022, 'metal_d', verts=16, axis='Y')
box('device_d', 0.55, 0.95, 3.48, 3.78, 0.94, 1.16, 'wall', 0.012)
box('device_d_scr', 0.58, 0.92, 3.47, 3.48, 0.98, 1.12, 'screen', 0.004)
# колбы-акценты
cyl('flask_1', -1.42, 3.35, 0.94, 1.12, 0.045, 'orange', verts=20)
cyl('flask_1b', -1.42, 3.35, 1.12, 1.16, 0.02, 'metal', verts=16)
cyl('flask_2', -1.30, 3.35, 0.94, 1.10, 0.045, 'cyan', verts=20)
cyl('flask_2b', -1.30, 3.35, 1.10, 1.14, 0.02, 'metal', verts=16)
cyl('flask_3', -1.36, 3.48, 0.94, 1.06, 0.035, 'pink', verts=20)
# образцы на подставке
for i, x in enumerate((0.02, 0.16, 0.30)):
    cyl(f'sample_{i}', x, 3.28, 0.94, 1.02, 0.05, ('pink', 'cyan', 'pink')[i], verts=20)
box('sample_tray', -0.06, 0.42, 3.22, 3.36, 0.90, 0.94, 'metal', 0.008)

# манипулятор (робот) в центре стола
cyl('rob_base', 1.15, 3.45, 0.94, 1.02, 0.10, 'metal', verts=24)
cyl('rob_col', 1.15, 3.45, 1.02, 1.36, 0.055, 'cyan', verts=20)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, segments=24, ring_count=12,
                                     location=(1.15, 3.45, 1.40))
bpy.context.object.name = 'rob_head'
I.apply(bpy.context.object, 'cyan')
box('rob_arm', 1.12, 1.18, 3.20, 3.42, 1.36, 1.44, 'cyan', 0.01)
cyl('rob_claw', 1.15, 3.16, 1.30, 1.44, 0.03, 'metal_d', verts=16)

# высокий шкаф справа
box('tall', 2.10, 2.75, 4.05, 4.70, 0.0, 1.95, 'wall', 0.02)
box('tall_scr', 2.18, 2.67, 4.03, 4.05, 1.25, 1.70, 'wall', 0.006).data.materials.clear()
bpy.data.objects['tall_scr'].data.materials.append(UI)
box('tall_handle', 2.66, 2.72, 4.00, 4.06, 0.75, 1.15, 'metal', 0.008)
box('tall_base', 2.06, 2.79, 4.01, 4.74, 0.0, 0.12, 'metal_d', 0.01)

# левый пульт со скосом
box('console_body', X0 + 0.10, X0 + 0.75, 1.10, 2.10, 0.0, 1.00, 'wall', 0.02)
box('console_top', X0 + 0.06, X0 + 0.80, 1.05, 2.15, 1.00, 1.08, 'metal', 0.015)
for i, y in enumerate((1.25, 1.45, 1.65, 1.85)):
    box(f'btn_{i}', X0 + 0.22, X0 + 0.42, y - 0.05, y + 0.05, 1.08, 1.11, 'metal_d', 0.004)
box('console_scr', X0 + 0.16, X0 + 0.66, 2.20, 2.22, 0.95, 1.45, 'wall', 0.006).data.materials.clear()
bpy.data.objects['console_scr'].data.materials.append(UI)

# --- стена за столом: экраны, коробки, мелочь ------------------------------
screen('ws_a', -1.95, -0.55, Y1 - 0.06, 1.55, 2.15, 0.06)
screen('ws_b', -0.40, 0.20, Y1 - 0.06, 1.62, 2.10, 0.06)
screen('ws_c', 0.60, 1.50, Y1 - 0.06, 1.50, 2.20, 0.06)
screen('ws_d', 1.85, 2.45, Y1 - 0.06, 1.70, 2.35, 0.06)
for i, (x, z) in enumerate(((-2.60, 1.90), (-2.20, 1.35), (2.70, 1.62))):
    box(f'jbox_{i}', x, x + 0.30, Y1 - 0.14, Y1 - 0.06, z, z + 0.34, 'wall', 0.012)
    box(f'jbox_scr_{i}', x + 0.04, x + 0.26, Y1 - 0.15, Y1 - 0.14, z + 0.16, z + 0.28,
        'screen', 0.003)
    for k in range(3):
        cyl(f'jbox_led_{k}_{i}', x + 0.06 + k * 0.07, Y1 - 0.155, z + 0.07, z + 0.09,
            0.012, ('cyan', 'pink', 'orange')[k], verts=12, axis='Y')

# трубы вдоль задней стены
pipe('back_a', [(X0 + 0.05, Y1 - 0.18, 2.55), (X1 - 0.05, Y1 - 0.18, 2.55)], 0.05)
pipe('back_b', [(X0 + 0.05, Y1 - 0.30, 2.42), (X1 - 0.05, Y1 - 0.30, 2.42)], 0.035)
pipe('back_c', [(-2.75, Y1 - 0.18, 2.55), (-2.75, Y1 - 0.18, 0.0)], 0.05)
pipe('back_d', [(2.55, Y1 - 0.18, 2.55), (2.55, Y1 - 0.18, 0.0)], 0.05)

# трубы перед стеной (второй план) — дают глубину, как в рефе
pipe('front_a', [(X0 + 0.3, Y1 - 0.55, H - 0.05), (X0 + 0.3, Y1 - 0.55, 2.20),
                 (X0 + 0.55, Y1 - 0.55, 2.20), (X0 + 0.55, Y1 - 0.55, 1.80)], 0.045)
pipe('front_b', [(1.05, Y1 - 0.55, H - 0.05), (1.05, Y1 - 0.55, 2.05),
                 (1.35, Y1 - 0.55, 2.05), (1.35, Y1 - 0.55, 1.62)], 0.04)
pipe('front_c', [(X0 + 0.3, Y1 - 0.40, 2.35), (X1 - 0.6, Y1 - 0.40, 2.35)], 0.03)
# висячие кабели от потолка к столу
cable('hang_1', [(0.75, Y1 - 0.5, H - 0.05), (0.85, Y1 - 1.0, 2.20),
                 (0.95, Y1 - 1.3, 1.55), (1.05, Y1 - 1.35, 1.00)], r=0.010)
cable('hang_2', [(-0.20, Y1 - 0.6, H - 0.05), (-0.15, Y1 - 1.1, 2.10),
                 (-0.05, Y1 - 1.35, 1.50), (0.05, Y1 - 1.4, 1.00)], r=0.010)
cable('hang_3', [(2.30, Y1 - 0.7, H - 0.05), (2.25, Y1 - 1.2, 2.05),
                 (2.15, Y1 - 1.5, 1.45)], r=0.009)

# --- кабели по полу ---------------------------------------------------------
cables = [
    [(-2.90, 1.05, 0.02), (-1.60, 1.35, 0.02), (-0.40, 1.05, 0.02), (0.70, 1.55, 0.02),
     (1.90, 1.30, 0.02)],
    [(-2.20, 0.55, 0.02), (-1.20, 0.95, 0.02), (-0.10, 0.70, 0.02), (1.20, 0.95, 0.02),
     (2.40, 0.60, 0.02)],
    [(0.40, 3.05, 0.02), (0.55, 2.40, 0.03), (0.25, 1.70, 0.02), (0.60, 1.10, 0.02),
     (1.40, 0.80, 0.02)],
    [(-1.30, 3.02, 0.02), (-1.45, 2.40, 0.03), (-1.15, 1.75, 0.02), (-1.60, 1.15, 0.02),
     (-2.30, 0.90, 0.02)],
    [(2.60, 4.00, 0.02), (2.30, 3.20, 0.03), (2.55, 2.45, 0.02), (2.10, 1.60, 0.02)],
]
for i, pts in enumerate(cables):
    cable(f'cab_{i}', pts)


# --- плотность: передний и средний план -------------------------------------
# стойка с приборами у левой стены
box('rack_l', X0 + 0.15, X0 + 0.90, 2.85, 3.55, 0.0, 1.75, 'wall', 0.02)
box('rack_l_face', X0 + 0.90, X0 + 0.94, 2.92, 3.48, 0.55, 1.55, 'metal', 0.008)
for k in range(3):
    box(f'rack_l_scr_{k}', X0 + 0.945, X0 + 0.95, 2.98, 3.42,
        0.70 + k * 0.28, 0.92 + k * 0.28, 'screen', 0.003)
box('rack_l_panel', X0 + 0.20, X0 + 0.86, 2.80, 2.85, 0.30, 0.55, 'metal_d', 0.008)

# тележка с ящиками справа на переднем плане
box('cart', 1.95, 2.65, 1.05, 1.75, 0.0, 0.95, 'wall', 0.02)
for k in range(3):
    box(f'cart_drawer_{k}', 1.99, 2.61, 1.02, 1.06, 0.12 + k * 0.26, 0.34 + k * 0.26,
        'metal', 0.006)
    box(f'cart_handle_{k}', 2.18, 2.42, 1.00, 1.03, 0.20 + k * 0.26, 0.24 + k * 0.26,
        'metal_d', 0.004)
cyl('cart_wheel_1', 2.05, 1.15, 0.0, 0.10, 0.05, 'dark', verts=16, axis='Y')
cyl('cart_wheel_2', 2.55, 1.15, 0.0, 0.10, 0.05, 'dark', verts=16, axis='Y')

# короба под столом и у стены
box('under_1', -1.20, -0.60, 3.30, 3.85, 0.0, 0.34, 'wall', 0.012)
box('under_2', 0.30, 0.85, 3.35, 3.88, 0.0, 0.30, 'metal', 0.012)
box('under_3', 1.05, 1.55, 3.40, 3.90, 0.0, 0.26, 'metal_d', 0.010)

# баллоны у правой стены
cyl('tank_1', 2.95, 3.55, 0.0, 1.25, 0.14, 'metal', verts=24)
cyl('tank_2', 2.95, 3.20, 0.0, 1.05, 0.11, 'mid', verts=24)
cyl('tank_cap_1', 2.95, 3.55, 1.25, 1.38, 0.05, 'metal_d', verts=16)
pipe('tank_pipe', [(2.95, 3.55, 1.38), (2.95, 3.55, 2.10), (2.55, 3.55, 2.10),
                   (2.55, 3.55, 2.40)], 0.03)

# мелкие приборы на стене между экранами
for i, (x, z) in enumerate(((-2.45, 0.85), (-2.45, 1.10), (0.35, 1.05), (1.70, 0.80))):
    box(f'wall_dev_{i}', x, x + 0.26, Y1 - 0.12, Y1 - 0.04, z, z + 0.30, 'wall', 0.010)
    box(f'wall_dev_scr_{i}', x + 0.03, x + 0.23, Y1 - 0.125, Y1 - 0.12, z + 0.10,
        z + 0.26, 'screen', 0.003)
    cyl(f'wall_dev_led_{i}', x + 0.05, Y1 - 0.13, z + 0.03, z + 0.05, 0.012,
        ('pink', 'cyan', 'orange', 'cyan')[i], verts=12, axis='Y')

# кнопочные панели и бирки
for i, x in enumerate((-1.90, 0.75, 2.20)):
    box(f'tag_{i}', x, x + 0.18, Y1 - 0.06, Y1 - 0.05, 1.30, 1.36, 'orange', 0.002)

# --- камера -----------------------------------------------------------------
I.lights(sc)
cd = bpy.data.cameras.new('cam')
cd.lens = 18
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (-2.35, 0.45, 1.52)
from mathutils import Vector as _V
_aim = _V((0.75, 4.05, 1.20)) - _V(cam.location)
cam.rotation_euler = _aim.to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

I.render_setup(sc, res=(1680, 945), samples=32, exposure=-0.18, bloom=(1.9, 3))
I.ink(sc, thickness=1.9, crease=True, angle=150)
sc.render.filepath = os.path.join(OUT, 'ink_room.png')
bpy.ops.render.render(write_still=True)
print('RENDERED ink_room.png')
print('DONE')
