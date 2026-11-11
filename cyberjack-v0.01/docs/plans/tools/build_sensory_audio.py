"""Standalone builder: sensory_audio (SNS-AUD-03, «Направленный звук»).

Закрытые наушники (over-ear) в сборе, без плиты, без вращений и анимации:
  молочно-графитовый корпус чашек, мягкие амбушюры, оголовье с
  регулируемыми ползунами, динамики за решётками, кабель с разъёмом 3,5 мм,
  LED статуса, маркировка каналов L/R.

Ориентация (Blender Z-up, метры):
  чашки — тела вращения вокруг X, центры (±X_CUP, 0, Z_C)
  оголовье — дуга в плоскости XZ над чашками
  «перед» наушников — сторона −Y
  модель стоит на чашках, низ bbox ≈ 0

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_sensory_audio.py

Выход:
  public/models/machine-modules/components/sensory_audio.glb
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
CID = 'sensory_audio'
PREFIX = CID + '__'

# --- ключевые размеры (м) -------------------------------------------------
Z_C = 0.0470                    # высота центра чашки
R_CUP = 0.0430                  # радиус чашки (86 мм)
X_SHELL_IN = 0.0595             # внутренняя плоскость корпуса чашки
X_SHELL_OUT = 0.0865            # наружная плоскость (до купола)
X_DOME_OUT = 0.0918             # плоскость купола (r = 0.030)
R_DOME = 0.0300
X_BADGE = 0.0930                # молочный шильдик канала
R_BADGE = 0.0175

PAD_X = 0.0575                  # плоскость амбушюры
PAD_MAJOR, PAD_MINOR = 0.0340, 0.0095
PAD_FLAT = 0.78                 # приплюснутость профиля амбушюры по X
GRILLE_X = 0.0578               # решётка — ближайшая к уху плоскость
R_GRILLE = 0.0240
R_PAD_OPEN = PAD_MAJOR - PAD_MINOR       # 0.0245 — просвет амбушюры

YOKE_Y = 0.0452                 # плечи вилки (по бокам чашки)
YOKE_X0, YOKE_X1 = 0.0862, 0.0932
YOKE_Z0, YOKE_Z1 = 0.0330, 0.0980
PIVOT_R = 0.0048

YOKE_TOP_Z = 0.1008             # перекладина вилки
SLIDER_X = 0.0875
SLIDER_Z0, SLIDER_Z1 = 0.1045, 0.1385
HOUSING_Z = 0.1400              # корпус ползуна (низ оголовья)

BAND_RX, BAND_RZ, BAND_ZC = 0.0855, 0.0500, 0.1400
BAND_T_IN, BAND_T_OUT = -0.0050, 0.0055
BAND_DEPTH = 0.0230
BAND_A0, BAND_A1 = math.radians(-102.0), math.radians(102.0)
BAND_SEG = 44

PALETTE = {
    'graphite': (0.238, 0.247, 0.263),
    'body': (0.941, 0.933, 0.914),
    'blush': (0.898, 0.712, 0.741),
    'pale': (0.957, 0.859, 0.867),
    'steel': (0.706, 0.714, 0.722),
    'dark': (0.152, 0.159, 0.173),
    'ivory': (0.980, 0.973, 0.957),
    'cyan': (0.700, 0.898, 0.925),
}
ROUGH = {'graphite': 0.50, 'body': 0.52, 'blush': 0.94, 'pale': 0.90,
         'steel': 0.36, 'dark': 0.72, 'ivory': 0.62, 'cyan': 0.35}
METAL = {'graphite': 0.22, 'steel': 0.86, 'dark': 0.10}
MATS = {}
BUILT = []


# --- helpers --------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    BUILT.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.90
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    BUILT.append(obj)
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.0015, segments=2, angle=40.0):
    select_only(obj)
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(angle)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                            depth=d.length, location=(a + b) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
                                        radius2=r2, depth=d.length,
                                        location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def cone_x(name, s, x0, x1, r0, r1, role, vertices=48, bev=0.0, smooth=True):
    """Конус вдоль оси X с учётом стороны (s = ±1)."""
    return cyl(name, (s * x0, 0, Z_C), (s * x1, 0, Z_C), r0, role,
               vertices=vertices, smooth=smooth, r2=r1, bev=bev)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=44, rings=10,
          squash=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if squash:
        obj.scale = squash
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, res=6):
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def boxes(name, specs, role, smooth=False):
    """Несколько прямоугольных брусков одним мешем: specs = [(loc, size), ...]."""
    bm = bmesh.new()
    for loc, size in specs:
        m = Matrix.Translation(Vector(loc)) @ Matrix.Diagonal(
            Vector(size).to_4d())
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role, smooth)


def arc_band(name, rx, rz, zc, a0, a1, off_in, off_out, depth, role,
             seg=BAND_SEG, smooth=True, bev=0.0):
    """Дуга-полоса в плоскости XZ: эллипс (rx, rz) с центром (0, zc)."""
    bm = bmesh.new()
    h = depth * 0.5
    st = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        sx, cz = math.sin(a), math.cos(a)
        x_in, z_in = (rx + off_in) * sx, zc + (rz + off_in) * cz
        x_out, z_out = (rx + off_out) * sx, zc + (rz + off_out) * cz
        st.append([bm.verts.new((x_in, h, z_in)),
                   bm.verts.new((x_in, -h, z_in)),
                   bm.verts.new((x_out, -h, z_out)),
                   bm.verts.new((x_out, h, z_out))])
    for i in range(seg):
        A, B = st[i], st[i + 1]
        for j, k in ((0, 1), (1, 2), (2, 3), (3, 0)):
            bm.faces.new((A[j], A[k], B[k], B[j]))
    bm.faces.new(tuple(reversed(st[0])))
    bm.faces.new(st[-1])
    obj = mesh_from_bm(name, bm, role, smooth)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def channel_mark(name, s, letter, x_face, role):
    """Маркировка канала L/R: бруски на молочном шильдике."""
    zc = Z_C
    hw, hh, t = 0.0020, 0.0056, 0.0011
    y0 = -0.0048                                  # левый край стойки
    span = 0.0072                                 # длина горизонталей
    specs = [((s * x_face, y0 + hw * 0.5, zc), (t, hw, 2 * hh))]
    if letter == 'L':
        specs.append(((s * x_face, y0 + span * 0.5, zc - hh + hw * 0.55),
                      (t, span, hw * 1.25)))
    else:                                   # R: дуга, средник, стойка, нога
        specs.append(((s * x_face, y0 + span * 0.5, zc + hh - hw * 0.55),
                      (t, span, hw * 1.25)))
        specs.append(((s * x_face, y0 + span * 0.5, zc + 0.0010),
                      (t, span, hw * 1.25)))
        specs.append(((s * x_face, y0 + span - hw * 0.5, zc + hh * 0.55),
                      (t, hw, hh * 0.90)))
        specs.append(((s * x_face, y0 + span - hw * 0.9, zc - hh * 0.62),
                      (t, hw * 1.8, hh * 0.80)))
    return boxes(name, specs, role)


# --- сборка ---------------------------------------------------------------
def build_side(s):
    """Одна чашка в сборе. s = -1 (левый, с кабелем) / +1 (правый)."""
    tag = 'l' if s < 0 else 'r'

    # корпус чашки: закрытая (closed-back) чашка, сужение к куполу
    cone_x(PREFIX + f'cup_shell_{tag}', s, X_SHELL_IN, X_SHELL_OUT,
           R_CUP, 0.0405, 'graphite', vertices=56, bev=0.0035)
    cone_x(PREFIX + f'cup_dome_{tag}', s, X_SHELL_OUT, X_DOME_OUT,
           0.0405, R_DOME, 'graphite', vertices=56, bev=0.0025)

    # молочное кольцо по стыку корпуса и амбушюры
    torus(PREFIX + f'cup_ring_{tag}', (s * 0.0608, 0, Z_C), 0.0422, 0.0028,
          'body', 'X', segs=48)

    # мягкая амбушюра (приплюснутый профиль) + палевая мембрана за решёткой
    torus(PREFIX + f'pad_{tag}', (s * PAD_X, 0, Z_C), PAD_MAJOR, PAD_MINOR,
          'blush', 'X', segs=56, rings=12,
          squash=(PAD_FLAT, 1.0, 1.0))
    torus(PREFIX + f'pad_liner_{tag}', (s * 0.0600, 0, Z_C), 0.0244, 0.0016,
          'pale', 'X', segs=44, rings=6)

    # динамик: тёмная пластина + стальные концентрические рёбра решётки
    cyl(PREFIX + f'grille_{tag}', (s * (GRILLE_X - 0.0010), 0, Z_C),
        (s * (GRILLE_X + 0.0010), 0, Z_C), R_GRILLE, 'dark',
        vertices=44, bev=0.0006)
    for i, rr in enumerate((0.0082, 0.0152, 0.0214)):
        torus(PREFIX + f'grille_ring_{tag}_{i}', (s * (GRILLE_X - 0.0012), 0, Z_C),
              rr, 0.0009, 'steel', 'X', segs=40, rings=6)
    cyl(PREFIX + f'grille_boss_{tag}', (s * (GRILLE_X - 0.0026), 0, Z_C),
        (s * (GRILLE_X - 0.0010), 0, Z_C), 0.0048, 'steel',
        vertices=22, bev=0.0006)
    torus(PREFIX + f'driver_mount_{tag}', (s * 0.0658, 0, Z_C), 0.0256, 0.0022,
          'graphite', 'X', segs=40, rings=6)

    # молочный шильдик канала + маркировка L/R
    cyl(PREFIX + f'cup_badge_{tag}', (s * X_DOME_OUT, 0, Z_C),
        (s * X_BADGE, 0, Z_C), R_BADGE, 'body', vertices=48, bev=0.0010)
    channel_mark(PREFIX + f'cup_mark_{tag}', s, 'L' if s < 0 else 'R',
                 X_BADGE + 0.00045, 'graphite')

    # LED статуса на ободе купола (низ-перед)
    ly, lz = -0.0198, Z_C - 0.0198
    sphere(PREFIX + f'led_{tag}', (s * 0.0924, ly, lz), 0.0030, 'cyan', 16, 10)
    torus(PREFIX + f'led_ring_{tag}', (s * 0.0926, ly, lz), 0.0042, 0.0008,
          'steel', 'X', segs=24, rings=6)

    # вилка (yoke): два плеча по бокам чашки + перекладина сверху
    for side, yy in (('f', YOKE_Y), ('b', -YOKE_Y)):
        cube(PREFIX + f'yoke_arm_{tag}_{side}',
             (s * (YOKE_X0 + YOKE_X1) * 0.5, yy, (YOKE_Z0 + YOKE_Z1) * 0.5),
             (YOKE_X1 - YOKE_X0, 0.0072, YOKE_Z1 - YOKE_Z0), 'steel', r=0.0022)
        cyl(PREFIX + f'pivot_{tag}_{side}',
            (s * 0.0840, yy, Z_C), (s * 0.0940, yy, Z_C), PIVOT_R, 'steel',
            vertices=20)
        cyl(PREFIX + f'pivot_cap_{tag}_{side}',
            (s * 0.0940, yy, Z_C), (s * 0.0962, yy, Z_C), 0.0058, 'graphite',
            vertices=20, bev=0.0008)
    cube(PREFIX + f'yoke_top_{tag}', (s * (YOKE_X0 + YOKE_X1) * 0.5, 0, YOKE_TOP_Z),
         (YOKE_X1 - YOKE_X0, 0.0972, 0.0095), 'steel', r=0.0022)

    # ползун регулировки + корпус ползуна у оголовья
    cube(PREFIX + f'slider_{tag}', (s * SLIDER_X, 0, (SLIDER_Z0 + SLIDER_Z1) * 0.5),
         (0.0050, 0.0140, SLIDER_Z1 - SLIDER_Z0), 'steel', r=0.0012)
    boxes(PREFIX + f'slider_notch_{tag}',
          [((s * SLIDER_X, -0.0071, z), (0.0044, 0.0014, 0.0011))
           for z in (0.1105, 0.1145, 0.1185)], 'graphite')
    cube(PREFIX + f'band_housing_{tag}', (s * 0.0855, 0, HOUSING_Z),
         (0.0130, 0.0230, 0.0220), 'graphite', r=0.0026)
    cyl(PREFIX + f'housing_screw_{tag}', (s * 0.0855, 0, HOUSING_Z + 0.0110),
        (s * 0.0855, 0, HOUSING_Z + 0.0142), 0.0026, 'steel', vertices=14)


def build_cable():
    """Односторонний кабель из левой чашки: петля по полу вперёд, штекер 3,5 мм."""
    cyl(PREFIX + 'strain_relief', (-0.0695, 0.0100, 0.0140),
        (-0.0695, 0.0140, 0.0022), 0.0062, 'graphite', vertices=20, bev=0.0012)
    curve_tube(PREFIX + 'cable',
               [(-0.0695, 0.0140, 0.0022),
                (-0.0728, 0.0252, 0.0024),
                (-0.0600, 0.0348, 0.0028),
                (-0.0400, 0.0322, 0.0031),
                (-0.0258, 0.0180, 0.0034),
                (-0.0206, 0.0024, 0.0038)], 0.0028, 'graphite')
    cyl(PREFIX + 'jack_body', (-0.0206, 0.0024, 0.0038),
        (-0.0206, -0.0106, 0.0040), 0.0040, 'graphite', vertices=24, bev=0.0008)
    torus(PREFIX + 'jack_ring', (-0.0206, -0.0116, 0.0040), 0.0041, 0.0009,
          'steel', 'Y', segs=24, rings=6)
    cyl(PREFIX + 'jack_barrel', (-0.0206, -0.0110, 0.0040),
        (-0.0206, -0.0240, 0.0040), 0.0028, 'steel', vertices=20)
    cyl(PREFIX + 'jack_tip', (-0.0206, -0.0240, 0.0040),
        (-0.0206, -0.0294, 0.0040), 0.0016, 'steel', vertices=16, r2=0.0007)


def build():
    reset()

    # оголовье: молочная полоса-трим поверх графитового каркаса + амбушюра
    arc_band(PREFIX + 'headband', BAND_RX, BAND_RZ, BAND_ZC,
             BAND_A0, BAND_A1, BAND_T_IN, BAND_T_OUT, BAND_DEPTH,
             'graphite', bev=0.0012)
    arc_band(PREFIX + 'headband_trim', BAND_RX, BAND_RZ, BAND_ZC,
             math.radians(-96.0), math.radians(96.0),
             0.0042, 0.0068, 0.0150, 'body', bev=0.0009)
    arc_band(PREFIX + 'headband_cushion', BAND_RX, BAND_RZ, BAND_ZC,
             math.radians(-76.0), math.radians(76.0),
             -0.0108, -0.0042, 0.0158, 'blush', bev=0.0012)

    for s in (-1.0, 1.0):
        build_side(s)
    build_cable()

    bpy.context.view_layer.update()
    return BUILT


# --- проверки -------------------------------------------------------------
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
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    cup_l = bpy.data.objects[PREFIX + 'cup_shell_l']
    c_mn, c_mx = mesh_bbox([cup_l])
    pad = bpy.data.objects[PREFIX + 'pad_r']
    p_mn, p_mx = mesh_bbox([pad])
    band = bpy.data.objects[PREFIX + 'headband']
    b_mn, b_mx = mesh_bbox([band])

    names = sorted(o.name for o in objs)
    roles = sorted({m.name.split('_')[1] for m in bpy.data.materials})

    report = {
        'component': CID,
        'nodes': len(objs),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.200 and size.y <= 0.120 and size.z <= 0.205),
        'stands_on_floor': bool(abs(mn.z) <= 0.0035),
        'symmetry_dx': round(abs(mn.x + mx.x), 6),
        'symmetry_ok': bool(abs(mn.x + mx.x) < 0.0015),
        'cup_diameter': round((c_mx - c_mn).y, 5),
        'cup_ok': bool(0.080 <= (c_mx - c_mn).y <= 0.095),
        'pad_od': round((p_mx - p_mn).y, 5),
        'band_top': round(b_mx.z, 5),
        'band_above_cups': round(b_mx.z - (Z_C + R_CUP), 5),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_roles': roles,
        'materials_ok': bool(len(bpy.data.materials) >= 4),
        'has_pads': bool({'pad_l', 'pad_r'} <= {o.name[len(PREFIX):] for o in objs}),
        'has_grille': bool('grille_l' in {o.name[len(PREFIX):] for o in objs}),
        'has_cable': bool('cable' in {o.name[len(PREFIX):] for o in objs}),
        'has_led': bool({'led_l', 'led_r'} <= {o.name[len(PREFIX):] for o in objs}),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'plate_like': sorted(o.name for o in objs if 'plate' in o.name.lower()),
        'names': names,
    }
    return report


def export():
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
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
    if not (rep['bbox_ok'] and rep['materials_ok'] and rep['has_pads']
            and rep['has_grille'] and rep['has_cable'] and rep['has_led']
            and rep['cup_ok'] and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
