"""Standalone builder: utility_data (UTL-DATA-02, «Данные»).

Компактный промышленный коммутатор данных в лотке/на DIN-рейке:
графитовый корпус, 16 × RJ45 (2 ряда по 8) с металлической обоймой и LED,
SFP-порт, 2 × USB-C, 3-контактная клемма питания, DIN-рейка 35 мм,
вентиляционные прорези, маркировка портов и кабель. Без плиты.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_utility_data.py

Выход:
  public/models/machine-modules/components/utility_data.glb

Раскладка (Blender Z-up, метры, низ корпуса на z=0):
  X = ширина 0.190, порты смотрят в -Y, DIN-рейка на +Y, кабель уходит назад.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
CID = 'utility_data'
PREFIX = CID + '__'

# --- габариты / ключевые размеры (м) --------------------------------------
BW, BD, BH = 0.186, 0.088, 0.056       # chassis
BZ0, BZ1 = 0.006, 0.062
YF, YB = -0.046, 0.042                 # передняя/задняя плоскость корпуса
BEZEL_Y = -0.048                       # центр передней панели (толщина 0.004)
BEZEL_Z0, BEZEL_Z1 = 0.010, 0.058

COLS = 8
PITCH = 0.0156
ROW_Z = (0.0426, 0.0243)               # центры рядов RJ45 (верхний, нижний)
PORT_W, PORT_H = 0.0140, 0.0126        # обойма порта
CAGE_FRONT, CAGE_BACK = -0.0525, -0.0490
CAV_FRONT = -0.0504                    # тёмная плоскость внутри обоймы
LABEL_Z = (0.0517, 0.0334)             # маркировка рядов

PALETTE = {
    'graphite': (0.185, 0.196, 0.212),
    'carbon': (0.105, 0.112, 0.124),
    'steel': (0.700, 0.712, 0.720),
    'nickel': (0.520, 0.535, 0.548),
    'dark': (0.048, 0.052, 0.058),
    'port_dark': (0.042, 0.072, 0.082),
    'ivory': (0.905, 0.902, 0.882),
    'cyan': (0.290, 0.800, 0.930),
    'amber': (0.960, 0.560, 0.130),
    'green': (0.320, 0.880, 0.420),
    'copper': (0.760, 0.545, 0.255),
}
EMISSIVE = ('cyan', 'amber', 'green')
METAL = {'steel': (0.88, 0.36), 'nickel': (0.85, 0.42), 'copper': (0.88, 0.32),
         'port_dark': (0.10, 0.50),
         'graphite': (0.25, 0.55), 'carbon': (0.15, 0.62)}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    metallic, rough = METAL.get(role, (0.0, 0.60))
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    if role in EMISSIVE:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.85
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.0015, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def curve_tube(name, points, radius, role, res=8):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 12
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def box_bm(bm, center, size):
    m = Matrix.Translation(Vector(center)) @ Matrix.Diagonal(
        Vector((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def mesh_from_bm(name, bm, role, smooth=False, bev=0.0, seg=2):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if bev > 0:
        bevel(obj, bev, seg, 30.0)
    return obj


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---------- корпус ---------------------------------------------------
    cube(PREFIX + 'chassis', (0, -0.002, 0.034), (BW, BD, BH), 'graphite', r=0.0035)
    cube(PREFIX + 'top_cover', (0, -0.002, 0.0645), (0.190, 0.092, 0.005),
         'carbon', r=0.0018)
    cube(PREFIX + 'bezel', (0, BEZEL_Y, 0.034), (0.181, 0.004, 0.048),
         'carbon', r=0.0012)

    # ножки
    bm = bmesh.new()
    for sx in (-1, 1):
        for y in (-0.036, 0.030):
            box_bm(bm, (sx * 0.082, y, 0.003), (0.014, 0.011, 0.006))
    mesh_from_bm(PREFIX + 'feet', bm, 'dark', bev=0.0012)

    # винты крышки
    bm = bmesh.new()
    for sx in (-1, 1):
        for y in (-0.0410, 0.0370):
            box_bm(bm, (sx * 0.0870, y, 0.0682), (0.0056, 0.0056, 0.0016))
    mesh_from_bm(PREFIX + 'case_screws', bm, 'steel', bev=0.0005)

    # верхняя вентиляционная решётка: тёмное поле + стальные рёбра
    cube(PREFIX + 'top_vent_recess', (0, 0.0154, 0.0668),
         (0.064, 0.0270, 0.0012), 'dark', r=0)
    bm = bmesh.new()
    for i in range(7):
        y = 0.0040 + i * 0.0038
        box_bm(bm, (0, y, 0.0673), (0.060, 0.0016, 0.0024))
    mesh_from_bm(PREFIX + 'top_vent', bm, 'steel', bev=0.0004)

    # боковые прорези
    bm = bmesh.new()
    for sx in (-1, 1):
        for i in range(6):
            y = -0.030 + i * 0.0090
            box_bm(bm, (sx * 0.0932, y, 0.036), (0.0012, 0.0042, 0.030))
    mesh_from_bm(PREFIX + 'side_vents', bm, 'dark')

    # ---------- 16 × RJ45 ------------------------------------------------
    bm_frame = bmesh.new()
    bm_cav = bmesh.new()
    bm_pins = bmesh.new()
    bm_led = bmesh.new()
    bm_lab = bmesh.new()
    bm_tick = bmesh.new()

    xs = [(-(COLS - 1) * 0.5 + i) * PITCH for i in range(COLS)]
    y_frame = (CAGE_FRONT + CAGE_BACK) * 0.5
    frame_d = CAGE_BACK - CAGE_FRONT

    for z in ROW_Z:
        for x in xs:
            # обойма: 4 стойки (реальный металлический cage)
            box_bm(bm_frame, (x, y_frame, z + 0.00565), (PORT_W, frame_d, 0.0013))
            box_bm(bm_frame, (x, y_frame, z - 0.00530), (PORT_W, frame_d, 0.0020))
            for sx in (-1, 1):
                box_bm(bm_frame, (x + sx * (PORT_W * 0.5 - 0.00065), y_frame,
                                  z + 0.00035), (0.0013, frame_d, 0.0093))
            # тёмная плоскость внутри обоймы
            box_bm(bm_cav, (x, CAV_FRONT + 0.0004, z + 0.00035),
                   (0.0114, 0.0008, 0.0094))
            # 8 контактов + язычок фиксатора
            for k in range(8):
                px = x + (-3.5 + k) * 0.00127
                box_bm(bm_pins, (px, CAV_FRONT - 0.00025, z + 0.00225),
                       (0.00080, 0.0005, 0.0022))
            box_bm(bm_pins, (x, CAV_FRONT - 0.00025, z - 0.00210),
                   (0.0026, 0.0005, 0.0012))
            # link/act LED внутри гнезда
            box_bm(bm_led, (x - 0.00405, CAV_FRONT - 0.00030, z - 0.00335),
                   (0.0019, 0.0006, 0.0016))

    mesh_from_bm(PREFIX + 'port_frames', bm_frame, 'nickel', bev=0.00028)
    mesh_from_bm(PREFIX + 'port_cavities', bm_cav, 'port_dark')
    mesh_from_bm(PREFIX + 'port_pins', bm_pins, 'copper')
    mesh_from_bm(PREFIX + 'port_leds', bm_led, 'cyan')

    # маркировка: таблички рядов + риски между портами
    for z in LABEL_Z:
        for x in xs:
            box_bm(bm_lab, (x, -0.0503, z), (0.0122, 0.0010, 0.0026))
        for i in range(COLS - 1):
            xm = (xs[i] + xs[i + 1]) * 0.5
            box_bm(bm_tick, (xm, -0.0502, z), (0.0011, 0.0008, 0.0022))
    mesh_from_bm(PREFIX + 'port_labels', bm_lab, 'ivory')
    mesh_from_bm(PREFIX + 'port_label_ticks', bm_tick, 'carbon')

    # нижняя вентиляционная решётка на панели
    bm = bmesh.new()
    for i in range(16):
        x = -0.0345 + i * 0.0046
        box_bm(bm, (x, -0.0502, 0.0137), (0.0024, 0.0010, 0.0036))
    mesh_from_bm(PREFIX + 'front_grille', bm, 'dark')

    # ---------- SFP -------------------------------------------------------
    sfp_x = 0.0788
    bm = bmesh.new()
    box_bm(bm, (sfp_x, -0.05125, 0.04945), (0.0160, 0.0035, 0.0013))
    box_bm(bm, (sfp_x, -0.05125, 0.03925), (0.0160, 0.0035, 0.0018))
    for sx in (-1, 1):
        box_bm(bm, (sfp_x + sx * 0.00735, -0.05125, 0.04435),
               (0.0013, 0.0035, 0.0102))
    mesh_from_bm(PREFIX + 'sfp_cage', bm, 'nickel', bev=0.0003)
    cube(PREFIX + 'sfp_cavity', (sfp_x, CAV_FRONT + 0.0004, 0.04435),
         (0.0132, 0.0008, 0.0080), 'port_dark', r=0)
    cube(PREFIX + 'sfp_contacts', (sfp_x, CAV_FRONT - 0.0002, 0.04135),
         (0.0110, 0.0005, 0.0009), 'copper', r=0)
    cube(PREFIX + 'sfp_latch', (sfp_x, -0.0528, 0.03775),
         (0.0092, 0.0026, 0.0018), 'carbon', r=0.0004)
    cube(PREFIX + 'sfp_label', (sfp_x, -0.0503, 0.0334),
         (0.0150, 0.0010, 0.0026), 'ivory', r=0)

    # ---------- 2 × USB-C -------------------------------------------------
    bm_shell = bmesh.new()
    bm_cav = bmesh.new()
    for ux in (0.0726, 0.0850):
        box_bm(bm_shell, (ux, -0.04985, 0.0262), (0.0094, 0.0032, 0.0038))
        box_bm(bm_cav, (ux, -0.05155, 0.0262), (0.0078, 0.0012, 0.0026))
    mesh_from_bm(PREFIX + 'usbc_shells', bm_shell, 'steel', bev=0.0004)
    mesh_from_bm(PREFIX + 'usbc_cavities', bm_cav, 'port_dark')
    cube(PREFIX + 'usbc_label', (0.0788, -0.0503, 0.0182),
         (0.0170, 0.0010, 0.0024), 'ivory', r=0)

    # ---------- клемма питания 3-pin --------------------------------------
    cube(PREFIX + 'power_terminal', (-0.0788, -0.0485, 0.0435),
         (0.0205, 0.0072, 0.0112), 'carbon', r=0.0010)
    for px in (-0.0850, -0.0788, -0.0726):
        cyl(PREFIX + f'power_screw_{round(px * 1000)}',
            (px, -0.0520, 0.0448), (px, -0.0538, 0.0448),
            0.0025, 'steel', vertices=16)
    bm = bmesh.new()
    for px in (-0.0850, -0.0788, -0.0726):
        box_bm(bm, (px, -0.0526, 0.0400), (0.0026, 0.0016, 0.0030))
    mesh_from_bm(PREFIX + 'power_contacts', bm, 'copper')
    cube(PREFIX + 'power_label', (-0.0788, -0.0503, 0.0352),
         (0.0195, 0.0010, 0.0024), 'ivory', r=0)

    # reset-пин
    cyl(PREFIX + 'reset_bezel', (-0.0788, -0.0499, 0.0272),
        (-0.0788, -0.0512, 0.0272), 0.0030, 'steel', vertices=18)
    cyl(PREFIX + 'reset_hole', (-0.0788, -0.0510, 0.0272),
        (-0.0788, -0.0519, 0.0272), 0.0015, 'dark', vertices=14)

    # ---------- статусные LED + шильдик -----------------------------------
    for name, x, role in (('pwr', -0.0878, 'green'),
                          ('link', -0.0816, 'cyan'),
                          ('alarm', -0.0754, 'amber')):
        cube(PREFIX + f'led_{name}_bezel', (x, -0.0503, 0.0560),
             (0.0036, 0.0010, 0.0036), 'carbon', r=0.0004)
        cube(PREFIX + f'led_{name}', (x, -0.0508, 0.0560),
             (0.0022, 0.0010, 0.0022), role, r=0.0005)

    cube(PREFIX + 'brand_plate', (0.008, -0.0503, 0.0560),
         (0.070, 0.0010, 0.0028), 'ivory', r=0)
    bm = bmesh.new()
    for i in range(9):
        box_bm(bm, (-0.020 + i * 0.0052, -0.0509, 0.0559),
               (0.0026, 0.0006, 0.0012))
    mesh_from_bm(PREFIX + 'brand_marks', bm, 'carbon')

    cube(PREFIX + 'top_label', (-0.004, -0.024, 0.0672),
         (0.052, 0.016, 0.0012), 'ivory', r=0)
    bm = bmesh.new()
    for i in range(5):
        box_bm(bm, (-0.020 + i * 0.0080, -0.024, 0.0679),
               (0.0040, 0.0090, 0.0006))
    mesh_from_bm(PREFIX + 'top_label_marks', bm, 'carbon')

    # ---------- DIN-рейка 35 мм ------------------------------------------
    cube(PREFIX + 'din_plate', (0, 0.0431, 0.0370),
         (0.042, 0.0026, 0.0460), 'graphite', r=0.0006)
    cube(PREFIX + 'din_hook_riser', (0, 0.0457, 0.0550),
         (0.038, 0.0026, 0.0100), 'steel', r=0.0005)
    cube(PREFIX + 'din_hook_top', (0, 0.0510, 0.0586),
         (0.038, 0.0092, 0.0026), 'steel', r=0.0006)
    cube(PREFIX + 'din_latch_leaf', (0, 0.0478, 0.0249),
         (0.038, 0.0024, 0.0163), 'steel', r=0.0005)
    cube(PREFIX + 'din_latch', (0, 0.0510, 0.0154),
         (0.038, 0.0092, 0.0026), 'steel', r=0.0006)
    cube(PREFIX + 'din_release', (0.0165, 0.0485, 0.0128),
         (0.0100, 0.0060, 0.0030), 'graphite', r=0.0006)

    # ---------- кабель ----------------------------------------------------
    cyl(PREFIX + 'cable_gland', (0.070, 0.0405, 0.0495),
        (0.070, 0.0468, 0.0495), 0.0052, 'steel', vertices=20, bev=0.0006)
    cyl(PREFIX + 'cable_boot', (0.070, 0.0460, 0.0495),
        (0.070, 0.0525, 0.0492), 0.0044, 'graphite', vertices=18)
    curve_tube(PREFIX + 'cable',
               [(0.0700, 0.0510, 0.0492),
                (0.0755, 0.0570, 0.0470),
                (0.0800, 0.0700, 0.0370),
                (0.0785, 0.0810, 0.0225),
                (0.0700, 0.0855, 0.0100),
                (0.0570, 0.0882, 0.0050),
                (0.0430, 0.0880, 0.0038)], 0.0034, 'graphite')
    cyl(PREFIX + 'cable_end', (0.0432, 0.0880, 0.0038),
        (0.0392, 0.0880, 0.0038), 0.0036, 'dark', vertices=16)

    bpy.context.view_layer.update()


# --- проверки ------------------------------------------------------------
def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def check():
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    tris = sum(len(o.data.loop_triangles) if o.data.loop_triangles else 0
               for o in all_mesh)
    for o in all_mesh:
        o.data.calc_loop_triangles()
    tris = sum(len(o.data.loop_triangles) for o in all_mesh)
    rep = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_spec': [0.20, 0.15, 0.08],
        'bbox_ok': bool(size.x <= 0.2005 and size.y <= 0.1505 and size.z <= 0.0805),
        'triangles': tris,
        'rj45_ports': COLS * len(ROW_Z),
        'usbc_ports': 2,
        'sfp_ports': 1,
        'materials': sorted(m.name for m in bpy.data.materials),
        'mat_count': len(bpy.data.materials),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or rep['mat_count'] < 4 or rep['bad_names']:
        raise SystemExit('checks failed')


main()
