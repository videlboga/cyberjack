"""Standalone builder: control_console (CTL-CON-01, «Пульт», настольный).

Настольный пульт 0,40 × 0,30 × 0,15 м: наклонная панель (~12,8°), экран с
графитовой рамкой и светящейся поверхностью, E-stop грибок, джойстик,
6 кнопок + 2 тумблера, ручка-скоба, кабельный ввод, шильдик, LED статуса.
Анимации нет: движение — material pulse на узле `display_face`.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_control_console.py

Выход:
  public/models/machine-modules/components/control_console.glb

Система координат (Blender Z-up, метры):
  X — ширина (-0.200..0.200), Y — глубина (перед -0.150, зад +0.150),
  Z — высота (0..0.147). Перед пульта смотрит в -Y.
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
CID = 'control_console'
PREFIX = CID + '__'

# --- габарит и наклон панели (м) -----------------------------------------
X_W = 0.200            # половина ширины корпуса
Y_FRONT = -0.150       # передняя кромка панели (= bbox Y min)
Y_BACK = 0.150         # кончик кабельного ввода (= bbox Y max)
Y_BODY_F = -0.144      # передняя стенка корпуса
Y_BODY_B = 0.138       # задняя стенка корпуса
K = 0.2276             # уклон верхней плоскости (dz/dy) -> 12,82°
TH = math.atan(K)
COS, SIN = math.cos(TH), math.sin(TH)
ZB0 = 0.0575           # z верхней поверхности панели на y = Y_FRONT
PANEL_T = 0.011        # толщина панели (по нормали)
Z_BASE = 0.008         # верх резиновой накладки / низ корпуса
D = (Y_BODY_B - Y_FRONT) / COS     # длина панели вдоль уклона

P0 = Vector((0.0, Y_FRONT + (D * 0.5) * COS, ZB0 + (D * 0.5) * SIN))
PMAT = Matrix.Translation(P0) @ Matrix.Rotation(TH, 4, 'X')
PN = Vector((0.0, -SIN, COS))       # нормаль панели


def P(u, c, h=0.0):
    """Точка в системе панели: u — вдоль X, c — вверх по уклону, h — по нормали."""
    return PMAT @ Vector((u, c, h))


def pmat(u, c, h, sx=1.0, sy=1.0, sz=1.0):
    return PMAT @ Matrix.Translation((u, c, h)) @ Matrix.Diagonal((sx, sy, sz, 1.0))


PALETTE = {
    'body': (0.930, 0.922, 0.902),
    'ivory': (0.968, 0.962, 0.948),
    'graphite': (0.245, 0.256, 0.270),
    'dark': (0.098, 0.104, 0.116),
    'steel': (0.710, 0.716, 0.706),
    'screen': (0.028, 0.062, 0.072),
    'cyan': (0.130, 0.660, 0.780),
    'teal': (0.170, 0.430, 0.470),
    'red': (0.720, 0.075, 0.060),
    'yellow': (0.880, 0.700, 0.140),
}
SPEC = {  # metallic, roughness, emission
    'body': (0.0, 0.55, 0.0),
    'ivory': (0.0, 0.52, 0.0),
    'graphite': (0.28, 0.50, 0.0),
    'dark': (0.05, 0.72, 0.0),
    'steel': (0.85, 0.30, 0.0),
    'screen': (0.0, 0.72, 2.10),
    'cyan': (0.0, 0.24, 0.85),
    'teal': (0.0, 0.36, 0.40),
    'red': (0.0, 0.38, 0.0),
    'yellow': (0.0, 0.44, 0.06),
}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    metallic, rough, emit = SPEC[role]
    m = bpy.data.materials.new('CJ_%s_100' % role)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    if emit > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    obj['component'] = CID
    obj['role'] = role
    return obj


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


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
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def pcyl(name, u, c, h0, h1, radius, role, **kw):
    return cyl(name, P(u, c, h0), P(u, c, h1), radius, role, **kw)


def sphere(name, loc, radius, role, segs=24, rings=14, squash=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    if squash != 1.0:
        obj.scale = (1.0, 1.0, squash)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=40, rings=10):
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
    return apply(obj, role, True)


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


def bmesh_cone(bm, base, direction, length, r1, r2, segments=16):
    d = Vector(direction).normalized()
    m = (Matrix.Translation(Vector(base) + d * (length * 0.5))
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=length, matrix=m)


def bmesh_sphere(bm, loc, radius, segs=14, rings=8, squash=1.0):
    m = Matrix.Translation(Vector(loc)) @ Matrix.Diagonal((1.0, 1.0, squash, 1.0))
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings,
                              radius=radius, matrix=m)


def bmesh_box(bm, matrix):
    bmesh.ops.create_cube(bm, size=1.0, matrix=matrix)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def pbox(name, u, c, h, sx, sy, sz, role, r=0.0012, smooth=False):
    """Плитка в системе панели (u, c по плоскости, h — по нормали)."""
    loc = P(u, c, h)
    return cube(name, loc, (sx, sy, sz), role, r=r, rot=(TH, 0, 0), smooth=smooth)


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---- корпус-клин ---------------------------------------------------
    z_body_f = ZB0 + (Y_BODY_F - Y_FRONT) * K - PANEL_T / COS
    z_body_b = ZB0 + (Y_BODY_B - Y_FRONT) * K - PANEL_T / COS
    bm = bmesh.new()
    b = [bm.verts.new(v) for v in (
        (-X_W, Y_BODY_F, Z_BASE), (X_W, Y_BODY_F, Z_BASE),
        (X_W, Y_BODY_B, Z_BASE), (-X_W, Y_BODY_B, Z_BASE))]
    t = [bm.verts.new(v) for v in (
        (-0.197, Y_BODY_F, z_body_f), (0.197, Y_BODY_F, z_body_f),
        (0.197, Y_BODY_B, z_body_b), (-0.197, Y_BODY_B, z_body_b))]
    bm.faces.new((b[0], b[3], b[2], b[1]))     # низ
    bm.faces.new((b[0], b[1], t[1], t[0]))     # перед
    bm.faces.new((b[1], b[2], t[2], t[1]))     # правый бок
    bm.faces.new((b[2], b[3], t[3], t[2]))     # зад
    bm.faces.new((b[3], b[0], t[0], t[3]))     # левый бок
    bm.faces.new((t[0], t[1], t[2], t[3]))     # верх (постель панели)
    mesh_from_bm(PREFIX + 'chassis', bm, 'body', smooth=False)
    select_only(bpy.data.objects[PREFIX + 'chassis'])
    bevel(bpy.data.objects[PREFIX + 'chassis'], 0.0035, 2)

    # резиновая накладка-дно
    cube(PREFIX + 'base_pad', (0.0, -0.003, Z_BASE * 0.5),
         (0.376, 0.278, Z_BASE), 'dark', r=0.002)

    # ---- наклонная панель ---------------------------------------------
    pbox(PREFIX + 'panel', 0.0, 0.0, -PANEL_T * 0.5, 0.386, D, PANEL_T,
         'ivory', r=0.003)
    # графитовый шов по передней кромке панели
    pbox(PREFIX + 'panel_trim', 0.0, -D * 0.5 + 0.008, 0.0007, 0.386, 0.012,
         0.0016, 'graphite', r=0.0006)

    # ---- экран ---------------------------------------------------------
    pbox(PREFIX + 'display_bezel', -0.058, 0.040, 0.0036, 0.224, 0.147, 0.0072,
         'graphite', r=0.0022)
    face = pbox(PREFIX + 'display_face', -0.058, 0.040, 0.0076, 0.198, 0.121,
                0.0022, 'screen', r=0.0)
    face['motion'] = 'pulse'
    face['motion_part'] = 'display_face'

    # содержимое экрана: шапка + строка статуса (яркая) и 4 строки (приглушённые)
    bm = bmesh.new()
    bmesh_box(bm, pmat(-0.058, 0.087, 0.0090, 0.170, 0.0078, 0.0012))
    bmesh_box(bm, pmat(-0.106, -0.008, 0.0090, 0.062, 0.0030, 0.0012))
    bmesh_box(bm, pmat(0.016, -0.008, 0.0090, 0.030, 0.0030, 0.0012))
    mesh_from_bm(PREFIX + 'display_ui', bm, 'cyan', smooth=False)

    bm = bmesh.new()
    for i, (w, c) in enumerate(((0.150, 0.064), (0.132, 0.048),
                                (0.144, 0.032), (0.104, 0.016))):
        bmesh_box(bm, pmat(-0.112 + w * 0.5, c, 0.0090, w, 0.0034, 0.0012))
    mesh_from_bm(PREFIX + 'display_ui_rows', bm, 'teal', smooth=False)

    # ---- E-stop --------------------------------------------------------
    eu, ec = 0.148, -0.098
    pcyl(PREFIX + 'estop_ring', eu, ec, 0.0, 0.0035, 0.034, 'yellow',
         vertices=40, bev=0.0011)
    pcyl(PREFIX + 'estop_collar', eu, ec, 0.0035, 0.0125, 0.0245, 'graphite',
         vertices=32)
    bm = bmesh.new()
    bmesh_cone(bm, P(eu, ec, 0.0110), PN, 0.0125, 0.0165, 0.0285, 36)
    bmesh_sphere(bm, P(eu, ec, 0.0235), 0.0285, 36, 16, squash=0.45)
    mesh_from_bm(PREFIX + 'estop_button', bm, 'red', smooth=True)

    # ---- джойстик ------------------------------------------------------
    ju, jc = 0.148, 0.030
    pcyl(PREFIX + 'joystick_ring', ju, jc, 0.0, 0.0025, 0.0230, 'graphite',
         vertices=36, bev=0.0008)
    pcyl(PREFIX + 'joystick_boot', ju, jc, 0.0010, 0.0155, 0.0200, 'dark',
         vertices=36, r2=0.0100)
    pcyl(PREFIX + 'joystick_shaft', ju, jc, 0.0110, 0.0270, 0.0044, 'steel',
         vertices=18)
    sphere(PREFIX + 'joystick_knob', P(ju, jc, 0.0315), 0.0125,
           'graphite', squash=0.82)

    # ---- кнопки: 6 шт, 3 × 2 ------------------------------------------
    btn_u = (-0.168, -0.118, -0.068)
    btn_c = (-0.082, -0.118)
    bm = bmesh.new()
    for c in btn_c:
        for u in btn_u:
            bmesh_cone(bm, P(u, c, 0.0), PN, 0.0026, 0.0126, 0.0126, 28)
    mesh_from_bm(PREFIX + 'button_rings', bm, 'graphite', smooth=True)
    letters = 'abcdef'
    k = 0
    for c in btn_c:
        for u in btn_u:
            pcyl(PREFIX + 'btn_' + letters[k], u, c, 0.0018, 0.0072, 0.0100,
                 'ivory', vertices=28)
            k += 1

    # ---- тумблеры: 2 шт -------------------------------------------------
    tg = ((0.040, -0.104, 0.42), (0.092, -0.104, -0.42))
    bm = bmesh.new()
    for u, c, _ in tg:
        bmesh_cone(bm, P(u, c, 0.0), PN, 0.0046, 0.0118, 0.0118, 26)
    mesh_from_bm(PREFIX + 'toggle_base', bm, 'graphite', smooth=True)

    r3 = PMAT.to_3x3()
    bm = bmesh.new()
    for u, c, tilt in tg:
        d = (r3 @ Vector((0.0, tilt, 1.0))).normalized()
        base = P(u, c, 0.0040)
        bmesh_cone(bm, base, d, 0.0165, 0.0044, 0.0026, 12)
        bmesh_sphere(bm, base + d * 0.0170, 0.0048, 14, 8)
    mesh_from_bm(PREFIX + 'toggle_lever', bm, 'steel', smooth=True)

    # ---- ручка-скоба ----------------------------------------------------
    hy = 0.1128
    curve_tube(PREFIX + 'handle_bail',
               [(-0.150, hy, 0.1150), (-0.150, hy, 0.1300),
                (-0.134, hy, 0.1382), (-0.075, hy, 0.1398),
                (0.0, hy, 0.1400), (0.075, hy, 0.1398),
                (0.134, hy, 0.1382), (0.150, hy, 0.1300),
                (0.150, hy, 0.1150)], 0.0060, 'steel')
    cyl(PREFIX + 'handle_grip', (-0.080, hy, 0.1400), (0.080, hy, 0.1400),
        0.0084, 'graphite', vertices=24, bev=0.0012)

    # ---- кабельный ввод + хвост кабеля ----------------------------------
    cyl(PREFIX + 'cable_gland', (0.120, 0.1290, 0.0420), (0.120, 0.1495, 0.0420),
        0.0115, 'graphite', vertices=24, bev=0.0014)
    curve_tube(PREFIX + 'cable',
               [(0.120, 0.1410, 0.0420), (0.1225, 0.1420, 0.0300),
                (0.1300, 0.1400, 0.0160), (0.1430, 0.1330, 0.0075)],
               0.0060, 'dark')

    # ---- шильдик на передней стенке -------------------------------------
    cube(PREFIX + 'nameplate', (-0.070, -0.1443, 0.0265),
         (0.082, 0.0040, 0.0220), 'graphite', r=0.0012)
    bm = bmesh.new()
    for dz, w in ((0.0320, 0.060), (0.0265, 0.046), (0.0210, 0.054)):
        bmesh_box(bm, Matrix.Translation(Vector((-0.070, -0.1467, dz)))
                  @ Matrix.Diagonal((w, 0.0016, 0.0022, 1.0)))
    mesh_from_bm(PREFIX + 'nameplate_lines', bm, 'ivory', smooth=False)

    # ---- LED статуса ----------------------------------------------------
    pcyl(PREFIX + 'led_status', -0.160, 0.128, 0.0, 0.0032, 0.0048, 'cyan',
         vertices=20)
    pcyl(PREFIX + 'led_power', -0.140, 0.128, 0.0, 0.0028, 0.0038, 'teal',
         vertices=20)

    # ---- винты панели ---------------------------------------------------
    bm = bmesh.new()
    for u in (-0.187, 0.187):
        for c in (-0.142, 0.142):
            bmesh_cone(bm, P(u, c, 0.0), PN, 0.0018, 0.0024, 0.0024, 14)
    mesh_from_bm(PREFIX + 'bezel_screws', bm, 'steel', smooth=True)

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
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    short = {o.name[len(PREFIX):] for o in meshes if o.name.startswith(PREFIX)}

    face = bpy.data.objects.get(PREFIX + 'display_face')
    face_emissive = False
    if face is not None:
        for m in face.data.materials:
            if m and m.use_nodes:
                b = m.node_tree.nodes.get('Principled BSDF')
                if b and b.inputs['Emission Strength'].default_value > 0:
                    face_emissive = True

    tol = 0.03
    rep = {
        'component': CID,
        'nodes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_target': [0.400, 0.300, 0.150],
        'bbox_ok': bool(all(abs(size[i] - t) <= t * tol
                            for i, t in enumerate((0.400, 0.300, 0.150)))),
        'floor_ok': bool(abs(mn.z) < 0.001),
        'display_face': bool(face is not None),
        'display_face_emissive': bool(face_emissive),
        'screen_w_m': 0.198,
        'estop_d_m': 0.058,
        'joystick_d_m': 0.027,
        'buttons': sorted(n for n in short if n.startswith('btn_')),
        'toggles': sorted(n for n in short if n.startswith('toggle_')),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'node_names': sorted(short),
    }
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = OUT / (CID + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError('export too small: %s' % path)
    return path


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_ok'] and rep['display_face']
            and rep['display_face_emissive'] and rep['material_count'] >= 4
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
