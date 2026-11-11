"""Standalone builder: sensory_light (SNS-LIGHT-04, «Управляемый свет»).

Потолочный регулируемый светильник: молочный корпус-диск с безелем,
утопленное поле с LED-матрицей (37 гексагональных ячеек в тёмной решётке),
молочные линзы-рассеиватели над каждой ячейкой, циановое свечение,
потолочная плита со шпильками, поворотная муфта на штанге, шарнир наклона
с двумя ушами и зажимной гайкой, кабель с разъёмом и гермовводом,
маркировка каналов на безеле и шильдик на корпусе. Без плиты,
без вращений, без анимации. Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_sensory_light.py

Выход:
  public/models/machine-modules/components/sensory_light.glb
  docs/plans/blockout/component-library/sensory_light/*.png

Геометрия (Blender Z-up, метры, светящаяся сторона = -Z, наклон головы
к переду -Y на 10°). Габарит по паспорту 0,20 x 0,20 x 0,10; после сборки
модель приводится к паспортному габариту и опускается на пол (z_min = 0).
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/sensory_light'
CID = 'sensory_light'
PREFIX = CID + '__'

PASSPORT = (0.200, 0.200, 0.100)     # X, Y, Z по component-catalog.json
CODE = 'SNS-LIGHT-04'

# --- параметры головы -----------------------------------------------------
R_HEAD = 0.0950            # радиус молочного диска
TH_TOP = 0.0155            # верхняя плоскость корпуса
TH_BOT = -0.0150           # нижняя плоскость корпуса
Z_FIELD = -0.0168          # передняя плоскость тёмного поля
R_FIELD = 0.0805
Z_TILE0, Z_TILE1 = -0.0212, -0.0170    # линза-рассеиватель (перед/зад)
Z_PAD0, Z_PAD1 = -0.0170, -0.0160      # LED-площадка
R_HEX = 0.0118             # радиус гекса ячейки по переду
R_HEX_BACK = 0.0106
HEX_GAP = 0.0015
RINGS = 3                  # 1 + 6 + 12 + 18 = 37 ячеек
BEZEL_IN = 0.0806
BEZEL_OUT = 0.0950
Z_BEZEL = -0.0218

BETA = math.radians(10.0)              # наклон головы к переду (-Y)
HEAD_C = Vector((0.0, -0.004, 0.034))
Mh = Matrix.Translation(HEAD_C) @ Matrix.Rotation(-BETA, 4, 'X')

# --- параметры кронштейна (мировые) --------------------------------------
PIVOT_L = Vector((0.0, 0.0500, 0.0220))          # центр шарнира в лок. головы
PIVOT = Mh @ PIVOT_L                            # мир
STEM_Y = PIVOT.y
STEM_Z0, STEM_Z1 = 0.0660, 0.0905
PLATE_Y, PLATE_Z0, PLATE_Z1 = 0.0380, 0.0900, 0.1000

PALETTE = {
    'milk': (0.930, 0.923, 0.905),
    'frost': (0.620, 0.860, 0.895),
    'graphite': (0.150, 0.158, 0.172),
    'dark': (0.032, 0.036, 0.044),
    'steel': (0.720, 0.726, 0.720),
    'cyan': (0.120, 0.640, 0.760),
}
EMIT_COLOR = {
    'frost': (0.270, 0.760, 0.845),
    'cyan': (0.120, 0.680, 0.800),
}
ROUGH = {'milk': 0.52, 'frost': 0.78, 'graphite': 0.54, 'dark': 0.30,
         'steel': 0.26, 'cyan': 0.34}
METAL = {'steel': 0.92, 'graphite': 0.45, 'dark': 0.20}
EMIT = {'cyan': 2.6, 'frost': 0.95}
MATS = {}


# --- helpers --------------------------------------------------------------
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
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
    if role in EMIT:
        bsdf.inputs['Emission Color'].default_value = (
            *EMIT_COLOR.get(role, color), 1.0)
        bsdf.inputs['Emission Strength'].default_value = EMIT[role]
    if role == 'frost':
        # просвечивающая молочная линза: ячейки матрицы читаются сквозь неё
        try:
            bsdf.inputs['Alpha'].default_value = 0.94
            m.surface_render_method = 'BLENDED'
        except Exception:
            try:
                bsdf.inputs['Alpha'].default_value = 0.94
                m.blend_method = 'BLEND'
            except Exception:
                pass
        try:
            m.show_transparent_back = True
        except Exception:
            pass
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


def bevel(obj, width=0.0012, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), smooth=False):
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


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=10, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    if rot is not None:
        obj.rotation_euler = rot
    elif axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, res=8):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 16
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


def lathe(name, profile, role, xf=None, seg=72, smooth=True, flat_angle=None):
    """Тело вращения вокруг локальной оси Z. profile = [(r, z), ...]."""
    xf = Matrix.Identity(4) if xf is None else xf
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r <= 1e-7:
            rings.append([bm.verts.new(xf @ Vector((0.0, 0.0, z)))])
        else:
            vs = []
            for i in range(seg):
                a = math.tau * i / seg
                vs.append(bm.verts.new(
                    xf @ Vector((math.cos(a) * r, math.sin(a) * r, z))))
            rings.append(vs)
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for i in range(seg):
                bm.faces.new((A[0], B[i], B[(i + 1) % seg]))
        elif len(B) == 1:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg], B[0]))
        else:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg],
                              B[(i + 1) % seg], B[i]))
    if len(rings[0]) > 1:
        bm.faces.new(tuple(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(tuple(rings[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if smooth and flat_angle:
        select_only(obj)
        try:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(flat_angle))
        except Exception:
            pass
    return obj


def hex_lattice(a, rings):
    d1 = Vector((math.cos(math.radians(30)), math.sin(math.radians(30))))
    d2 = Vector((0.0, 1.0))
    out = []
    for q in range(-rings, rings + 1):
        for r in range(-rings, rings + 1):
            if abs(q) + abs(r) + abs(q + r) > 2 * rings:
                continue
            p = d1 * (q * a) + d2 * (r * a)
            out.append((p.x, p.y))
    return out


def hex_prism(bm, center, r_front, r_back, z0, z1, xf):
    m = xf @ Matrix.Translation(Vector((center[0], center[1], (z0 + z1) * 0.5)))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6,
                          radius1=r_front, radius2=r_back, depth=abs(z1 - z0),
                          matrix=m)


def mesh_from_bm(name, bm, role, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


# --- сборка ---------------------------------------------------------------
def build():
    reset()
    made = []

    # ---- корпус-диск ---------------------------------------------------
    body_prof = [
        (0.0000, TH_TOP),
        (0.0560, TH_TOP),
        (0.0790, 0.0132),
        (0.0890, 0.0092),
        (0.0932, 0.0044),
        (R_HEAD, 0.0000),
        (0.0938, -0.0072),
        (0.0900, -0.0128),
        (0.0852, -0.0150),
        (0.0000, -0.0150),
    ]
    made.append(lathe(PREFIX + 'body', body_prof, 'milk', Mh, seg=84,
                      flat_angle=44))

    # ---- тёмное поле под матрицу ---------------------------------------
    made.append(lathe(PREFIX + 'field_plate',
                      [(0.0000, Z_FIELD), (R_FIELD, Z_FIELD),
                       (R_FIELD, -0.0146), (0.0000, -0.0146)],
                      'dark', Mh, seg=84))

    # ---- LED-матрица: 37 гексагональных ячеек --------------------------
    a = math.sqrt(3.0) * R_HEX + HEX_GAP
    cells = hex_lattice(a, RINGS)
    bm_pad = bmesh.new()
    bm_tile = bmesh.new()
    for c in cells:
        hex_prism(bm_pad, c, 0.0112, 0.0112, Z_PAD0, Z_PAD1, Mh)
        hex_prism(bm_tile, c, R_HEX, R_HEX, Z_TILE0, -0.0197, Mh)
        hex_prism(bm_tile, c, R_HEX, R_HEX_BACK, -0.0197, Z_TILE1, Mh)
    made.append(mesh_from_bm(PREFIX + 'led_cells', bm_pad, 'cyan', smooth=False))
    made.append(mesh_from_bm(PREFIX + 'diffuser_lenses', bm_tile, 'frost',
                             smooth=False))

    # ---- безель --------------------------------------------------------
    bez_prof = [
        (BEZEL_IN, -0.0150),
        (BEZEL_IN, -0.0194),
        (0.0818, Z_BEZEL),
        (0.0930, Z_BEZEL),
        (0.0946, -0.0196),
        (R_HEAD, -0.0142),
    ]
    made.append(lathe(PREFIX + 'bezel', bez_prof, 'graphite', Mh, seg=84,
                      flat_angle=40))

    # ---- винты безеля (4 шт.) ------------------------------------------
    bm_sc = bmesh.new()
    for k in range(4):
        ang = math.radians(45.0 + 90.0 * k)
        c = (math.cos(ang) * 0.0878, math.sin(ang) * 0.0878,
             Z_BEZEL - 0.0007)
        m = Mh @ Matrix.Translation(Vector(c))
        bmesh.ops.create_cone(bm_sc, cap_ends=True, cap_tris=False, segments=14,
                              radius1=0.0042, radius2=0.0040, depth=0.0024,
                              matrix=m)
    made.append(mesh_from_bm(PREFIX + 'bezel_screws', bm_sc, 'steel', smooth=True))

    bm_slot = bmesh.new()
    for k in range(4):
        ang = math.radians(45.0 + 90.0 * k)
        c = (math.cos(ang) * 0.0878, math.sin(ang) * 0.0878,
             Z_BEZEL - 0.0018)
        m = Mh @ Matrix.Translation(Vector(c))
        bmesh.ops.create_cube(bm_slot, size=1.0,
                              matrix=m @ Matrix.Diagonal((0.0056, 0.0013, 0.0009, 1.0)))
    made.append(mesh_from_bm(PREFIX + 'screw_slots', bm_slot, 'dark', smooth=False))

    # ---- маркировка каналов на безеле (3 cyan + 1 steel) ---------------
    bm_ch = bmesh.new()
    bm_ref = bmesh.new()
    for i in range(4):
        x = -0.0158 + i * 0.0105
        tgt = bm_ref if i == 3 else bm_ch
        m = Mh @ Matrix.Translation(Vector((x, -0.0905, Z_BEZEL - 0.0005)))
        bmesh.ops.create_cube(tgt, size=1.0,
                              matrix=m @ Matrix.Diagonal((0.0074, 0.0030, 0.0010, 1.0)))
    made.append(mesh_from_bm(PREFIX + 'channel_marks', bm_ch, 'cyan', smooth=False))
    made.append(mesh_from_bm(PREFIX + 'channel_mark_ref', bm_ref, 'steel',
                             smooth=False))
    made.append(torus(PREFIX + 'bezel_glow', Mh @ Vector((0.0, 0.0, -0.0186)),
                      0.0801, 0.0011, 'cyan', 'Z', segs=72, rings=6,
                      rot=(-BETA, 0.0, 0.0)))

    # ---- шильдик с индикаторами на борту -------------------------------
    plate_loc = Mh @ Vector((0.0934, 0.0000, 0.0010))
    made.append(cube(PREFIX + 'side_badge', plate_loc, (0.0030, 0.0262, 0.0112),
                     'graphite', r=0.0009))
    bm_pips = bmesh.new()
    for i, y in enumerate((-0.0074, 0.0000, 0.0074)):
        m = Mh @ Matrix.Translation(Vector((0.0950, y, 0.0010)))
        bmesh.ops.create_cube(bm_pips, size=1.0,
                              matrix=m @ Matrix.Diagonal((0.0012, 0.0050, 0.0034, 1.0)))
    made.append(mesh_from_bm(PREFIX + 'badge_pips', bm_pips, 'cyan', smooth=False))

    # ---- шарнир: барабан на голове --------------------------------------
    drum_a = Mh @ Vector((-0.0170, PIVOT_L.y, PIVOT_L.z))
    drum_b = Mh @ Vector((0.0170, PIVOT_L.y, PIVOT_L.z))
    made.append(cyl(PREFIX + 'head_drum', drum_a, drum_b, 0.0205, 'steel',
                    vertices=36, bev=0.0014))

    # ---- уши кронштейна + зажим ---------------------------------------
    for sx, tag in ((-1, 'l'), (1, 'r')):
        made.append(cube(PREFIX + f'yoke_ear_{tag}',
                         (sx * 0.0196, PIVOT.y, PIVOT.z + 0.0130),
                         (0.0056, 0.0300, 0.0290), 'graphite', r=0.0016))
    made.append(cube(PREFIX + 'yoke_cross', (0.0, PIVOT.y, PIVOT.z + 0.0262),
                     (0.0500, 0.0260, 0.0125), 'graphite', r=0.0018))
    made.append(cyl(PREFIX + 'pivot_bolt', (-0.0290, PIVOT.y, PIVOT.z),
                    (0.0326, PIVOT.y, PIVOT.z), 0.0052, 'steel', vertices=20))
    made.append(cyl(PREFIX + 'pivot_washer', (0.0226, PIVOT.y, PIVOT.z),
                    (0.0244, PIVOT.y, PIVOT.z), 0.0112, 'steel',
                    vertices=28, bev=0.0006))
    made.append(cyl(PREFIX + 'tilt_knob', (0.0244, PIVOT.y, PIVOT.z),
                    (0.0348, PIVOT.y, PIVOT.z), 0.0092, 'graphite',
                    vertices=20, bev=0.0012))

    # ---- штанга и поворотная муфта -------------------------------------
    made.append(cyl(PREFIX + 'stem', (0.0, STEM_Y, STEM_Z0),
                    (0.0, STEM_Y, STEM_Z1), 0.0135, 'milk',
                    vertices=32, bev=0.0012))
    made.append(cyl(PREFIX + 'swivel_collar', (0.0, STEM_Y, 0.0810),
                    (0.0, STEM_Y, 0.0918), 0.0205, 'graphite',
                    vertices=36, bev=0.0016))
    made.append(torus(PREFIX + 'swivel_ring', (0.0, STEM_Y, 0.0856),
                      0.0208, 0.0026, 'steel', 'Z', segs=48, rings=8))
    made.append(torus(PREFIX + 'stem_ferrule', (0.0, STEM_Y, 0.0898),
                      0.0143, 0.0024, 'steel', 'Z', segs=36, rings=8))

    # ---- потолочная плита ----------------------------------------------
    plate_xf = Matrix.Translation(Vector((0.0, PLATE_Y, 0.0)))
    made.append(lathe(PREFIX + 'ceiling_plate',
                      [(0.0000, PLATE_Z1), (0.0478, PLATE_Z1),
                       (0.0516, 0.0976), (0.0520, 0.0936),
                       (0.0498, PLATE_Z0), (0.0000, PLATE_Z0)],
                      'milk', plate_xf, seg=64, flat_angle=40))
    made.append(torus(PREFIX + 'plate_gasket', (0.0, PLATE_Y, 0.0966),
                      0.0522, 0.0022, 'dark', 'Z', segs=56, rings=8))

    bm_ps = bmesh.new()
    for k, (px, py) in enumerate(((0.0300, 0.0130), (-0.0300, 0.0130),
                                  (0.0000, -0.0330))):
        m = Matrix.Translation(Vector((px, PLATE_Y + py, 0.0895)))
        bmesh.ops.create_cone(bm_ps, cap_ends=True, cap_tris=False, segments=14,
                              radius1=0.0044, radius2=0.0042, depth=0.0026,
                              matrix=m)
    made.append(mesh_from_bm(PREFIX + 'plate_screws', bm_ps, 'steel', smooth=True))

    # ---- кабель ---------------------------------------------------------
    boss_a = Mh @ Vector((0.0, 0.0640, 0.0060))
    boss_b = Mh @ Vector((0.0, 0.0852, 0.0060))
    made.append(cyl(PREFIX + 'strain_boss', boss_a, boss_b, 0.0062, 'graphite',
                    vertices=20, bev=0.0012))
    cable_pts = [boss_b,
                 (0.0, boss_b.y + 0.0110, boss_b.z - 0.0075),
                 (0.0, 0.0930, 0.0270),
                 (0.0, 0.0800, 0.0560),
                 (0.0, 0.0620, 0.0790),
                 (0.0, STEM_Y + 0.0010, 0.0850)]
    made.append(curve_tube(PREFIX + 'cable', cable_pts, 0.0034, 'graphite'))
    made.append(cube(PREFIX + 'cable_connector', (0.0, 0.0902, 0.0338),
                     (0.0118, 0.0180, 0.0098), 'graphite', r=0.0018,
                     rot=(math.radians(-40), 0, 0)))
    made.append(cyl(PREFIX + 'cable_gland', (0.0, STEM_Y + 0.0010, 0.0806),
                    (0.0, STEM_Y + 0.0010, 0.0882), 0.0080, 'graphite',
                    vertices=20, bev=0.0012))

    # ---- приведение к паспорту и на пол ---------------------------------
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.context.view_layer.update()
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    s_fill = 0.995 * min(PASSPORT[i] / max(size[i], 1e-6) for i in range(3))
    s_fill = max(0.90, min(1.15, s_fill))
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
        o.matrix_world = Matrix.Scale(s_fill, 4) @ o.matrix_world
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()
    mn, mx = mesh_bbox(meshes)
    for o in meshes:
        o.data.transform(Matrix.Translation(Vector((0.0, 0.0, -mn.z))))
    bpy.context.view_layer.update()

    for o in meshes:
        o['part'] = o.name
        o['component'] = CID
        o['part_id'] = o.name[len(PREFIX):]
    made = [o for o in bpy.data.objects if o.type == 'MESH']
    return made


def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


# --- проверки -------------------------------------------------------------
def check():
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    verts = sum(len(o.data.vertices) for o in meshes)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    names = sorted(o.name for o in bpy.data.objects)
    bad = [n for n in names if not n.startswith(PREFIX)]

    rep = {
        'component': CID,
        'code': CODE,
        'class': 'SENSORY',
        'nodes': len(names),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(PASSPORT),
        'bbox_fill_pct': [round(size[i] / PASSPORT[i] * 100, 1) for i in range(3)],
        'bbox_ok': bool(all(size[i] <= PASSPORT[i] * 1.002 for i in range(3))),
        'on_floor': bool(abs(mn.z) < 1e-4),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'verts': verts,
        'tris': tris,
        'parts': names,
        'bad_names': bad,
    }
    rep['led_cells'] = len(hex_lattice(math.sqrt(3.0) * R_HEX + HEX_GAP, RINGS))
    return rep, meshes


# --- экспорт --------------------------------------------------------------
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


# --- рендеры --------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.15
    try:
        scene.eevee.taa_render_samples = 128
    except Exception:
        pass
    try:
        scene.eevee.use_raytracing = True
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.640, 0.648, 0.660, 1.0)
    bg.inputs['Strength'].default_value = 0.42

    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(mesh_objs)
    center = (mn + mx) * 0.5
    S = max((mx - mn).x, (mx - mn).y)

    # светильник потолочный: подложка-«потолок» сверху, камеры снизу
    bpy.ops.mesh.primitive_plane_add(size=S * 6.0,
                                     location=(center.x, center.y, mx.z + 0.0004))
    ceil = bpy.context.object
    ceil.name = 'render_ceiling'
    cm = bpy.data.materials.new('ceiling')
    cm.use_nodes = True
    nb = cm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.408, 0.406, 0.400, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    ceil.data.materials.append(cm)

    e_scale = (S / 2.0) ** 2
    for name, offset, energy, sz in (
            ('key', (0.62 * S, -0.78 * S, -0.62 * S), 78.0, 1.00 * S),
            ('fill', (-0.90 * S, -0.42 * S, -0.58 * S), 34.0, 1.30 * S),
            ('rim', (0.05 * S, 0.92 * S, -0.40 * S), 52.0, 1.00 * S)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy * e_scale
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(offset) + Vector((center.x, center.y, center.z))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    def fit_dist(direction, lens, corners, margin=1.10):
        right, up, back = cam_basis(direction)
        sensor = cam_data.sensor_width
        sx, sy = scene.render.resolution_x, scene.render.resolution_y
        sw = sensor if sx >= sy else sensor * sx / sy
        sh = sensor * sy / sx if sx >= sy else sensor
        th = sw * 0.5 / lens
        tv = sh * 0.5 / lens
        need = 0.0
        for p in corners:
            need = max(need,
                       abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    c_main = box_corners(mn - center, mx - center)
    close_t = Vector((-0.0250, -0.0560, 0.0120))
    close_w = 0.1180

    views = [
        ('3q', (-0.64, -0.62, -0.36), center, 58, 0.90, True, None),
        ('front', (0.03, -0.96, -0.32), center, 58, 0.93, True, None),
        ('side', (0.97, -0.10, -0.26), center, 58, 0.90, True, None),
        ('closeup', (-0.42, -0.62, -0.66), close_t, 78, 0.95, False, close_w),
    ]
    outs = []
    for tag, direction, target, lens, fill, fb, frame_w in views:
        cam_data.lens = lens
        if frame_w:
            fov = 2.0 * math.atan(cam_data.sensor_width * 0.5 / lens)
            dist = (frame_w * 0.5) / math.tan(fov * 0.5)
        else:
            dist = fit_dist(direction, lens, c_main, 1.10)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fb:
            for _ in range(6):
                got = max_ndc(fill)
                if abs(got - fill) < 0.015:
                    break
                dist *= got / fill
                cam.location = target + dirn * dist
                cam.rotation_euler = (target - cam.location).to_track_quat(
                    '-Z', 'Y').to_euler()
                bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def preview_300():
    outs = []
    for tag in ('3q', 'front', 'side', 'closeup'):
        src = RENDER_DIR / f'{CID}_{tag}.png'
        if not src.is_file():
            continue
        img = bpy.data.images.load(str(src))
        w, h = img.size
        nw = 300
        nh = max(1, round(h * nw / w))
        img.scale(nw, nh)
        dst = RENDER_DIR / f'{CID}_{tag}_300px.png'
        img.filepath_raw = str(dst)
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
        outs.append(str(dst.relative_to(PROJECT)))
    return outs


def main():
    build()
    rep, meshes = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    rep['previews_300px'] = preview_300()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['on_floor']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and not rep['bad_names']):
        raise SystemExit('checks failed')


if __name__ == '__main__':
    main()
