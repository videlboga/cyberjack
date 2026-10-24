"""Аниме-уголок станции на toon-пайплайне: cel + инк + иллюминатор с космосом.

Проверяет весь стек целиком: плоские материалы (2–3 тона), сине-фиолетовые тени,
светящиеся акценты, контур Freestyle, звёздное поле в иллюминаторе.
Если Freestyle в сборке не работает — падать не должен, рисует hull-контуром.

Запуск: blender -b --factory-startup -noaudio --python tools/anime_corner.py
"""
import bpy, sys, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from toon_lib import Toon   # noqa: E402

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
T = Toon()
T.build()
M = T.M


def box(name, x0, x1, y0, y1, z0, z1, role, bevel=0.02, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    bpy.ops.object.transform_apply(scale=True)
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    bpy.ops.object.transform_apply(location=True)
    T.apply(o, role)
    if bevel > 0:
        m = o.modifiers.new('b', 'BEVEL')
        m.width, m.segments, m.limit_method = bevel, segs, 'ANGLE'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    return o


def cyl(name, cx, cy, z0, z1, r, role, verts=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(z1 - z0), vertices=verts,
                                        location=(cx, cy, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    T.apply(o, role)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    if bevel > 0:
        m = o.modifiers.new('b', 'BEVEL')
        m.width, m.segments, m.limit_method = bevel, 2, 'ANGLE'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def torus(name, cx, cy, z, R, r, role, segs=64, ring=16, rot=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=segs, minor_segments=ring,
                                     location=(cx, cy, z), rotation=rot)
    o = bpy.context.object
    o.name = name
    T.apply(o, role)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.data.update()
    return o


def space_material():
    """Космос за стеклом: тёмный фон + звёзды точками + голубая дымка."""
    m = bpy.data.materials.new('space_stars')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.feature = 'F1'
    vor.inputs['Scale'].default_value = 34.0
    tc = nt.nodes.new('ShaderNodeTexCoord')      # у ngon нет UV — берём Generated
    nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    # звезда = МАЛОЕ расстояние до центра ячейки: 0..0.045 ярко, дальше — космос
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.85, 0.95, 1.0, 1)
    ramp.color_ramp.elements[1].position = 0.05
    ramp.color_ramp.elements[1].color = (0.02, 0.03, 0.09, 1)
    nt.links.new(vor.outputs['Distance'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.6
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


# --- оболочка ---------------------------------------------------------------
box('floor', -3.4, 3.4, -0.4, 4.6, -0.12, 0.0, 'floor', 0.03)
box('floor_inlay_l', -2.55, -2.40, -0.4, 4.6, 0.0, 0.006, 'teal')
box('floor_inlay_r', 2.40, 2.55, -0.4, 4.6, 0.0, 0.006, 'teal')
box('floor_band', -3.4, 3.4, 3.30, 3.45, 0.0, 0.004, 'metal_d')

box('wall_back', -3.4, 3.4, 4.6, 4.9, 0.0, 2.95, 'wall', 0.04)
box('wall_l', -3.7, -3.4, -0.4, 4.9, 0.0, 2.95, 'wall_c', 0.04)
box('wall_r', 3.4, 3.7, -0.4, 4.9, 0.0, 2.95, 'wall_c', 0.04)
box('ceiling', -3.7, 3.7, -0.4, 4.9, 2.95, 3.05, 'wall_c', 0.03)

# панельная развёртка задней стены: панели и шпангоуты
for i, x in enumerate((-2.4, -0.8, 1.0, 2.6)):
    box(f'panel_{i}', x, x + 1.4, 4.55, 4.60, 0.12, 2.85, 'wall', 0.02)
for i, x in enumerate((-3.05, -1.55, 0.15, 1.85, 3.05)):
    box(f'rib_{i}', x - 0.06, x + 0.06, 4.50, 4.60, 0.0, 2.95, 'metal', 0.015)
box('skirting', -3.4, 3.4, 4.50, 4.60, 0.0, 0.16, 'metal_d', 0.01)

# иллюминатор: рама, стекло, космос, подоконник, аварийные метки
CX, CZ, R = -0.75, 1.62, 0.72
torus('win_ring_out', CX, 4.50, CZ, R + 0.10, 0.075, 'metal', rot=(math.pi / 2, 0, 0))
torus('win_ring_in', CX, 4.47, CZ, R - 0.04, 0.045, 'metal_d', rot=(math.pi / 2, 0, 0))
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=R - 0.03, fill_type='NGON',
                                  location=(CX, 4.53, CZ),
                                  rotation=(math.pi / 2, 0, 0))
g = bpy.context.object
g.name = 'win_space_disc'
g.data.materials.append(space_material())
box('win_sill', CX - R - 0.16, CX + R + 0.16, 4.44, 4.58, CZ - R - 0.22, CZ - R - 0.14,
    'metal', 0.02)
box('win_mark_l', CX - R - 0.12, CX - R - 0.02, 4.52, 4.56, CZ + R - 0.10, CZ + R + 0.10,
    'amber', 0.005)
box('win_mark_r', CX + R + 0.02, CX + R + 0.12, 4.52, 4.56, CZ + R - 0.10, CZ + R + 0.10,
    'amber', 0.005)

# потолок: световые полосы в рамках и трубы
for i, (x0, x1) in enumerate(((-2.6, -0.9), (-0.2, 1.5), (2.0, 3.0))):
    box(f'light_{i}', x0, x1, 1.2, 1.9, 2.93, 2.945, 'teal', 0.0)
    box(f'light_lip_a_{i}', x0 - 0.06, x0, 1.14, 1.96, 2.90, 2.95, 'metal', 0.01)
    box(f'light_lip_b_{i}', x1, x1 + 0.06, 1.14, 1.96, 2.90, 2.95, 'metal', 0.01)
for i, y in enumerate((0.4, 3.1)):
    o = cyl(f'pipe_{i}', 0, y, 2.72, 2.86, 0.085, 'metal', verts=28)
    o.rotation_euler = (0, math.pi / 2, 0)
    o.location = (0, y, 2.79)
    o.scale = (1, 1, 26)
    for j, x in enumerate((-2.6, -0.6, 1.4, 2.8)):
        box(f'clamp_{i}_{j}', x - 0.05, x + 0.05, y - 0.13, y + 0.13, 2.70, 2.90, 'metal_d', 0.008)

# капсула справа
CAPX, CAPY = 2.15, 3.55
cyl('cap_base', CAPX, CAPY, 0.0, 0.22, 0.66, 'metal', bevel=0.03)
cyl('cap_body', CAPX, CAPY, 0.22, 2.34, 0.58, 'glass')
cyl('cap_inner', CAPX, CAPY, 0.24, 2.32, 0.50, 'dark')
cyl('cap_ring_lo', CAPX, CAPY, 1.05, 1.20, 0.60, 'metal')
cyl('cap_ring_hi', CAPX, CAPY, 1.92, 2.04, 0.60, 'metal')
cyl('cap_top', CAPX, CAPY, 2.34, 2.52, 0.66, 'metal', bevel=0.03)
box('cap_stand', CAPX - 0.30, CAPX + 0.30, CAPY - 0.95, CAPY - 0.55, 0.0, 1.55, 'wall_c', 0.03)
box('cap_stand_scr', CAPX - 0.20, CAPX + 0.20, CAPY - 0.98, CAPY - 0.95, 0.85, 1.25, 'teal')

# пульт слева и скамья
box('console_body', -3.32, -2.95, 2.20, 2.90, 0.0, 1.10, 'wall', 0.04)
box('console_top', -3.36, -2.92, 2.16, 2.94, 1.10, 1.18, 'metal', 0.02)
box('console_scr', -3.30, -2.98, 2.24, 2.86, 1.18, 1.52, 'teal', 0.01)
box('console_scr2', -3.30, -2.98, 2.24, 2.86, 1.55, 1.62, 'amber', 0.006)
box('bench_seat', -1.85, -0.30, 0.55, 1.05, 0.42, 0.52, 'soft', 0.05)
box('bench_leg_l', -1.80, -1.68, 0.62, 0.98, 0.0, 0.42, 'metal_d', 0.02)
box('bench_leg_r', -0.47, -0.35, 0.62, 0.98, 0.0, 0.42, 'metal_d', 0.02)
box('hazard', -3.05, -2.60, 4.52, 4.56, 0.0, 0.06, 'amber', 0.004)


# --- детализация: швы, вентиляция, горбыли, кабели, разметка -----------------
# горизонтальный шов панелей и линия стыка
box('seam_h', -3.4, 3.4, 4.52, 4.56, 1.34, 1.38, 'metal_d', 0.004)
box('seam_h2', -3.4, 3.4, 4.52, 4.56, 2.28, 2.32, 'metal_d', 0.004)
# швы пола
for i in range(1, 5):
    box(f'floor_seam_{i}', -3.4, 3.4, -0.4 + i * 0.95, -0.4 + i * 0.95 + 0.012,
        0.0, 0.002, 'metal_d')
# вентиляционные решётки в панелях
for i, x in enumerate((-2.9, 1.55)):
    for j in range(5):
        box(f'vent_{i}_{j}', x, x + 0.42, 4.52, 4.55,
            0.55 + j * 0.06, 0.55 + j * 0.06 + 0.028, 'dark')
# горбыли у пола: узлы, коробки, патрубки
grebles = [(-3.30, 0.10, 0.55, 0.34), (-2.10, 0.08, 0.30, 0.22), (1.95, 0.12, 0.62, 0.30),
           (2.70, 0.10, 0.36, 0.26), (-1.30, 0.09, 0.24, 0.42)]
for i, (x, d, w, h) in enumerate(grebles):
    box(f'greeble_{i}', x, x + w, 4.60 - d, 4.60, 0.16, 0.16 + h, 'metal_d', 0.01)
    box(f'greeble_led_{i}', x + 0.04, x + 0.10, 4.60 - d - 0.01, 4.60 - d, 0.16 + h - 0.10,
        0.16 + h - 0.05, 'teal', 0.002)
# кабельный канал по стене с хомутами
box('cable_duct', -3.15, 3.15, 4.50, 4.56, 2.42, 2.52, 'metal_d', 0.008)
for i, x in enumerate((-2.6, -1.4, -0.2, 1.0, 2.2)):
    box(f'duct_clip_{i}', x - 0.03, x + 0.03, 4.49, 4.56, 2.40, 2.54, 'metal', 0.005)
# разметка: жёлтая полоса у проёма и предупреждающий треугольник
box('hazard_strip', -3.05, -2.60, 4.52, 4.56, 0.16, 0.22, 'amber', 0.004)
# малый терминал на стене справа
box('term_body', 2.55, 3.05, 4.42, 4.52, 1.05, 1.55, 'wall', 0.02)
box('term_scr', 2.60, 3.00, 4.41, 4.42, 1.15, 1.45, 'teal', 0.004)
for j in range(3):
    box(f'term_btn_{j}', 2.62 + j * 0.12, 2.70 + j * 0.12, 4.40, 4.41, 0.96, 1.02,
        'metal', 0.004)
# ящик и инструментальный кейс на полу
box('crate', -2.95, -2.35, 0.15, 0.75, 0.0, 0.52, 'metal_d', 0.02)
box('crate_lid', -2.97, -2.33, 0.13, 0.77, 0.52, 0.58, 'metal', 0.012)
box('crate_latch', -2.72, -2.58, 0.73, 0.77, 0.30, 0.40, 'teal', 0.006)
box('case', 1.95, 2.45, 1.10, 1.45, 0.0, 0.30, 'dark', 0.02)
box('case_handle', 2.10, 2.30, 1.06, 1.10, 0.22, 0.28, 'metal', 0.006)
# потолочные мелочи: датчики, спринклеры
for i, x in enumerate((-2.2, 0.2, 2.2)):
    cyl(f'sensor_{i}', x, 1.4, 2.90, 2.95, 0.05, 'metal_d', verts=16)

# --- свет, камера, рендер ----------------------------------------------------
T.lights(sc, key=1.10, fill=0.36, ambient=0.40)
cd = bpy.data.cameras.new('cam')
cd.lens = 24
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (-0.85, -3.55, 1.48)
cam.rotation_euler = (math.radians(88), 0, math.radians(3))
sc.camera = cam

T.render_setup(sc, res=(1680, 940), samples=32, exposure=-0.02, bloom=(1.2, 4))
T.freestyle(sc, thickness=1.2)
sc.render.filepath = os.path.join(OUT, 'anime_corner_fs.png')
bpy.ops.render.render(write_still=True)
print('RENDERED anime_corner_fs.png')

# вариант «cel-lite»: инк тоньше, тёмный пол, контраст по крупным плоскостям
for o in list(sc.objects):
    if o.type == 'MESH' and o.name in ('floor', 'floor_band'):
        T.apply(o, 'floor_d')
sc.view_settings.exposure = -0.10
T.freestyle(sc, thickness=0.8)
sc.render.filepath = os.path.join(OUT, 'anime_corner_lite.png')
bpy.ops.render.render(write_still=True)
print('RENDERED anime_corner_lite.png')
print('DONE')
