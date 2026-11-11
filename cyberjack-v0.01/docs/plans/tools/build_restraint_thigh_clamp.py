"""Standalone builder: restraint_thigh_clamp (RST-TH-03, «Бёдерный зажим»).

Жёсткий регулируемый зажим бедра: две анатомические щёки-полуобечайки из
молочного композита на общей вертикальной оси шарнира, силиконовые подушки
с поперечными валиками, трещотка-храповик с зубчатой рейкой и рычагом,
кнопка быстросъёма, D-полукольцо на клёпаной планке, ограничитель раскрытия
(стальная планка с клёпкой и держателем-скобой), маркировка размера S/M/L
и рельсовый захват-док на контрфланце. Плиты-основания нет: зажим целиком
висит на собственных щёках.

Не зависит от build_component_library.py / build_component_library / build_work_*.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_thigh_clamp.py

Выход:
  public/models/machine-modules/components/restraint_thigh_clamp.glb
  docs/plans/blockout/component-library/restraint_thigh_clamp/*.png
  docs/plans/blockout/component-library/restraint_thigh_clamp/report.json

Геометрия (Blender Z-up, метры):
  ось бедра = Z, центр кольца в (0, 0, CZ)
  зазор-замок (+Y) = трещотка и рычаг; шарнир на -Y
  D-ring на +X, рельсовый захват на -X
  z_bottom = 0 -> нижняя кромка щёк стоит на полу
  вращения нет (motion: none), анимационная пустышка не нужна.

Габарит по паспорту 0,18 x 0,12 x 0,08 м (оси паспорта: ширина с шарниром
и рычагом, глубина с D-ring, высота щеки вдоль бедра).
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_thigh_clamp'
CID = 'restraint_thigh_clamp'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
R_OUT = 0.0620          # наружный радиус щеки по X (габарит 136 мм)
AY = 0.720              # сжатие по Y -> анатомический овал (глубина 89 мм)
WALL = 0.0080           # толщина композитной щеки
R_IN = R_OUT - WALL
PAD_OUT = R_IN + 0.0002
PAD_IN = 0.0508         # силикон 3 мм внутрь
RIB_IN = 0.0488         # поперечные валики подушки

HALF_H = 0.0400         # половина высоты щеки -> высота 80 мм (паспорт)
CZ = HALF_H             # нижняя кромка на z = 0

A_FRONT = math.radians(13.0)      # передний зазор: -13°..+13° (26°)
A_BACK = math.radians(179.4)      # щека заканчивается у шарнира

HINGE_Y = -0.0530       # ось шарнира на -Y
R_BARREL = 0.0090       # радиус проушины
R_PIN = 0.0036

R_STRAP0, R_STRAP1 = R_OUT + 0.0025, R_OUT + 0.0050   # рейка трещотки
A_STRAP0 = math.radians(12.0)     # корень рейки на щеке A
A_STRAP1 = math.radians(-34.0)    # конец рейки у корпуса собачки
Z_STRAP0, Z_STRAP1 = 0.0145, 0.0300

A_HOUSING = math.radians(-27.0)   # корпус собачки / рычаг / быстросъём

PALETTE = {
    'milk': (0.880, 0.866, 0.836),
    'cream': (0.945, 0.930, 0.895),
    'blush': (0.870, 0.560, 0.600),
    'steel': (0.600, 0.610, 0.625),
    'graphite': (0.082, 0.086, 0.096),
    'dark': (0.028, 0.030, 0.036),
    'red': (0.620, 0.160, 0.140),
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
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.26
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.30
        bsdf.inputs['Roughness'].default_value = 0.40
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.72
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'red':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.50
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.70
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


def bevel(obj, width=0.0010, segments=2, angle=True, limit=35.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(limit)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def cube(name, loc, size, role, r=0.0008, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def obox(name, center, u, v, w, size, role, bev=0.0008, smooth=False):
    """Короб в собственном базисе (u,v,w) — для повёрнутых деталей."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    basis = Matrix((Vector(u).normalized(), Vector(v).normalized(),
                    Vector(w).normalized())).transposed().to_4x4()
    obj.matrix_world = (Matrix.Translation(Vector(center)) @ basis
                        @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bev > 0:
        bevel(obj, bev)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=24, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                            depth=d.length,
                                            location=(a + b) * 0.5)
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


def ring_loop(name, center, normal, major, minor, role, segs=40, rings=10):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=center)
    obj = bpy.context.object
    obj.name = name
    q = Vector(normal).normalized().to_track_quat('Z', 'Y')
    obj.rotation_euler = q.to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, res=6, caps=True):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
    cu.use_fill_caps = caps
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


# --- геометрия овального кольца вокруг оси Z ----------------------------
def ep(a, r, z):
    """Точка на овале: a=0 -> +Y (замок), a=90° -> +X."""
    return Vector((math.sin(a) * r, math.cos(a) * r * AY, z))


def e_rad(a):
    return Vector((math.sin(a), math.cos(a) * AY, 0.0)).normalized()


def e_tan(a):
    return Vector((math.cos(a), -math.sin(a) * AY, 0.0)).normalized()


def hf(a):
    """Профиль высоты щеки по углу: полная в середине, сужается к концам."""
    t = abs(math.degrees(a))
    f = 1.0
    if t > 138.0:
        f -= 0.20 * ((t - 138.0) / 42.0) ** 1.3
    if t < 34.0:
        f -= 0.10 * ((34.0 - t) / 18.0) ** 1.5
    return f


def arc_shell(name, r_in, r_out, a0, a1, seg, role, ztop, zbot, bevw=0.0,
              smooth=True, phase=0.0):
    """Сектор овальной обечайки с профилем высоты (ztop/zbot: float|callable)."""
    zt = ztop if callable(ztop) else (lambda _a, c=ztop: c)
    zb = zbot if callable(zbot) else (lambda _a, c=zbot: c)
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        t, b = zt(a), zb(a)
        ring = [bm.verts.new(ep(a, r_in, b)), bm.verts.new(ep(a, r_out, b)),
                bm.verts.new(ep(a, r_out, t)), bm.verts.new(ep(a, r_in, t))]
        rings.append(ring)
    for i in range(seg):
        A, B = rings[i], rings[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if bevw > 0:
        bevel(obj, bevw, 2, limit=40.0)
    return obj


def band(name, r_in, r_out, a0, a1, z0, z1, seg, role, bevw=0.0, smooth=True):
    return arc_shell(name, r_in, r_out, a0, a1, seg, role, z1, z0, bevw, smooth)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def ztop(a):
        return CZ + HALF_H * hf(a)

    def zbot(a):
        return CZ - HALF_H * hf(a)

    def ptop(a):
        return CZ + (HALF_H * hf(a) - 0.0016)

    def pbot(a):
        return CZ - (HALF_H * hf(a) - 0.0016)

    # ================= ЩЕКА A (+X, правая) =============================
    parts.append(arc_shell(PREFIX + 'jaw_a_shell', R_IN, R_OUT, A_FRONT, A_BACK,
                           96, 'milk', ztop, zbot, bevw=0.0014))
    # мягкий слой: подушка + валики + открытая кромка на торцах
    parts.append(arc_shell(PREFIX + 'jaw_a_pad', PAD_IN, PAD_OUT, A_FRONT + 0.010,
                           A_BACK - 0.010, 92, 'blush', ptop, pbot, bevw=0.0010))
    for i, dz in enumerate((-0.0215, 0.0, 0.0215)):
        parts.append(band(PREFIX + f'jaw_a_pad_rib_{"abc"[i]}', RIB_IN, PAD_IN + 0.0004,
                          A_FRONT + 0.075, A_BACK - 0.040, CZ + dz - 0.0032,
                          CZ + dz + 0.0032, 90, 'blush'))
    parts.append(arc_shell(PREFIX + 'jaw_a_pad_rim_top', PAD_IN, PAD_OUT,
                           A_FRONT + 0.010, A_BACK - 0.010, 92, 'blush',
                           lambda a: ztop(a) + 0.0004, ptop, bevw=0.0005))
    parts.append(arc_shell(PREFIX + 'jaw_a_pad_rim_bot', PAD_IN, PAD_OUT,
                           A_FRONT + 0.010, A_BACK - 0.010, 92, 'blush',
                           pbot, lambda a: zbot(a) - 0.0004, bevw=0.0005))
    # ребро жёсткости + тёмная канавка по наружной щеке
    parts.append(arc_shell(PREFIX + 'jaw_a_spine', R_OUT - 0.0005, R_OUT + 0.0024,
                           A_FRONT + 0.055, A_BACK - 0.055, 84, 'milk',
                           CZ + 0.0125, CZ - 0.0125, bevw=0.0010))
    parts.append(arc_shell(PREFIX + 'jaw_a_spine_groove', R_OUT + 0.0024,
                           R_OUT + 0.0028, A_FRONT + 0.080, A_BACK - 0.080, 80,
                           'graphite', CZ + 0.0018, CZ - 0.0018))
    # окантовка торцов (валик утоплен в кромку, не выходит за габарит)
    for tag, zf, dz in (('top', ztop, -0.0020), ('bot', zbot, 0.0020)):
        pts = []
        for i in range(27):
            a = A_FRONT + 0.012 + (A_BACK - A_FRONT - 0.024) * i / 26.0
            pts.append(ep(a, R_OUT + 0.0006, zf(a) + dz))
        parts.append(curve_tube(PREFIX + f'jaw_a_edge_{tag}', pts, 0.0020, 'cream'))

    # ================= ЩЕКА B (-X, левая) ==============================
    parts.append(arc_shell(PREFIX + 'jaw_b_shell', R_IN, R_OUT, -A_FRONT, -A_BACK,
                           96, 'milk', ztop, zbot, bevw=0.0014))
    parts.append(arc_shell(PREFIX + 'jaw_b_pad', PAD_IN, PAD_OUT, -A_FRONT - 0.010,
                           -A_BACK + 0.010, 92, 'blush', ptop, pbot, bevw=0.0010))
    for i, dz in enumerate((-0.0215, 0.0, 0.0215)):
        parts.append(band(PREFIX + f'jaw_b_pad_rib_{"abc"[i]}', RIB_IN, PAD_IN + 0.0004,
                          -A_FRONT - 0.075, -A_BACK + 0.040, CZ + dz - 0.0032,
                          CZ + dz + 0.0032, 90, 'blush'))
    parts.append(arc_shell(PREFIX + 'jaw_b_pad_rim_top', PAD_IN, PAD_OUT,
                           -A_FRONT - 0.010, -A_BACK + 0.010, 92, 'blush',
                           lambda a: ztop(a) + 0.0004, ptop, bevw=0.0005))
    parts.append(arc_shell(PREFIX + 'jaw_b_pad_rim_bot', PAD_IN, PAD_OUT,
                           -A_FRONT - 0.010, -A_BACK + 0.010, 92, 'blush',
                           pbot, lambda a: zbot(a) - 0.0004, bevw=0.0005))
    parts.append(arc_shell(PREFIX + 'jaw_b_spine', R_OUT - 0.0005, R_OUT + 0.0024,
                           -A_FRONT - 0.055, -A_BACK + 0.055, 84, 'milk',
                           CZ + 0.0125, CZ - 0.0125, bevw=0.0010))
    parts.append(arc_shell(PREFIX + 'jaw_b_spine_groove', R_OUT + 0.0024,
                           R_OUT + 0.0028, -A_FRONT - 0.080, -A_BACK + 0.080, 80,
                           'graphite', CZ + 0.0018, CZ - 0.0018))
    for tag, zf, dz in (('top', ztop, -0.0020), ('bot', zbot, 0.0020)):
        pts = []
        for i in range(27):
            a = -A_FRONT - 0.012 - (A_BACK - A_FRONT - 0.024) * i / 26.0
            pts.append(ep(a, R_OUT + 0.0006, zf(a) + dz))
        parts.append(curve_tube(PREFIX + f'jaw_b_edge_{tag}', pts, 0.0020, 'cream'))

    # ================= ШАРНИР (-Y) ======================================
    n_kn, k_h, k_gap = 5, 0.0122, 0.0006
    span = n_kn * k_h + (n_kn - 1) * k_gap
    k0 = CZ - span * 0.5
    for i in range(n_kn):
        z0 = k0 + i * (k_h + k_gap)
        owner = 'a' if i % 2 == 0 else 'b'
        parts.append(cyl(PREFIX + f'hinge_knuckle_{owner}_{i + 1}',
                         (0, HINGE_Y, z0), (0, HINGE_Y, z0 + k_h),
                         R_BARREL + (0.0004 if owner == 'a' else 0.0),
                         'milk' if owner == 'a' else 'graphite',
                         vertices=28, bev=0.0008))
    # проушины-косынки от щёк к цапфе
    for tag, dz in (('top', 0.0295), ('bot', -0.0295)):
        parts.append(cube(PREFIX + f'hinge_web_{tag}',
                          (0.0, HINGE_Y + 0.0045, CZ + dz),
                          (0.0210, 0.0160, 0.0075), 'milk', r=0.0012))
    parts.append(cyl(PREFIX + 'hinge_pin', (0, HINGE_Y, 0.0030), (0, HINGE_Y, 0.0770),
                     R_PIN, 'steel', vertices=16))
    parts.append(cyl(PREFIX + 'hinge_pin_head_bot', (0, HINGE_Y, 0.0006),
                     (0, HINGE_Y, 0.0050), 0.0062, 'graphite', vertices=20, bev=0.0006))
    parts.append(cyl(PREFIX + 'hinge_pin_head_top', (0, HINGE_Y, 0.0750),
                     (0, HINGE_Y, 0.0794), 0.0062, 'graphite', vertices=20, bev=0.0006))

    # ================= ТРЕЩОТКА (+Y, зазор) ============================
    parts.append(arc_shell(PREFIX + 'ratchet_strap', R_STRAP0, R_STRAP1,
                           A_STRAP0, A_STRAP1, 40, 'steel',
                           Z_STRAP1, Z_STRAP0, bevw=0.0006))
    # зубчатая рейка: зубья наружу, шаг ~4,2 мм
    for i in range(7):
        a = math.radians(-8.0 - i * 3.4)
        r_mid = R_STRAP1 + 0.0014
        parts.append(obox(PREFIX + f'ratchet_tooth_{i + 1}',
                           ep(a, r_mid, (Z_STRAP0 + Z_STRAP1) * 0.5),
                           e_tan(a), Vector((0, 0, 1)), e_rad(a),
                           (0.0030, 0.0110, 0.0028), 'steel', bev=0.0003))
    # корень рейки на щеке A
    parts.append(obox(PREFIX + 'ratchet_root',
                       ep(A_STRAP0 - math.radians(1.5), R_OUT + 0.0010,
                          (Z_STRAP0 + Z_STRAP1) * 0.5),
                       e_tan(A_STRAP0), Vector((0, 0, 1)), e_rad(A_STRAP0),
                       (0.0100, 0.0182, 0.0090), 'graphite', bev=0.0012))

    # корпус собачки на щеке B
    parts.append(arc_shell(PREFIX + 'pawl_housing', R_OUT + 0.0045, R_OUT + 0.0185,
                           A_HOUSING + 0.075, A_HOUSING - 0.075, 16, 'graphite',
                           Z_STRAP1 + 0.0075, Z_STRAP0 - 0.0065, bevw=0.0014))

    # рычаг трещотки: плоская пластина наружу-вперёд с насечкой
    lev_dir = Vector((-0.975, 0.180, 0.090)).normalized()
    lev_side = lev_dir.cross(Vector((0, 0, 1))).normalized()
    lev_up = lev_side.cross(lev_dir).normalized()
    lev_root = ep(A_HOUSING, R_OUT + 0.0140, 0.0265)
    # ось рычага: бобышка-палец, торцы видны по бокам пластины
    piv = lev_root + lev_dir * 0.0060
    parts.append(cyl(PREFIX + 'pawl_pivot_boss', piv - lev_side * 0.0100,
                     piv + lev_side * 0.0100, 0.0046, 'steel', vertices=18,
                     bev=0.0005))
    parts.append(cyl(PREFIX + 'pawl_pin', piv - lev_side * 0.0112,
                     piv + lev_side * 0.0112, 0.0022, 'steel', vertices=12))
    parts.append(obox(PREFIX + 'pawl_lever', lev_root + lev_dir * 0.0180,
                       lev_dir, lev_side, lev_up,
                       (0.0340, 0.0138, 0.0072), 'dark', bev=0.0012))
    parts.append(obox(PREFIX + 'pawl_lever_tip', lev_root + lev_dir * 0.0332,
                       lev_dir, lev_side, lev_up,
                       (0.0098, 0.0122, 0.0062), 'graphite', bev=0.0010))
    for i in range(3):
        parts.append(obox(PREFIX + f'pawl_lever_grip_{"abc"[i]}',
                           lev_root + lev_dir * (0.0272 + i * 0.0034)
                           + lev_up * 0.0028,
                           lev_dir, lev_side, lev_up,
                           (0.0014, 0.0122, 0.0022), 'steel', bev=0.0002))

    # быстросъём: красная кнопка-сброс собачки на верхней грани корпуса
    btn = ep(A_HOUSING + 0.075, R_OUT + 0.0090, 0.0330)
    parts.append(cyl(PREFIX + 'qr_button_ring', btn, btn + Vector((0, 0, 0.0032)),
                     0.0056, 'graphite', vertices=20, bev=0.0005))
    parts.append(cyl(PREFIX + 'qr_button', btn + Vector((0, 0, 0.0026)),
                     btn + Vector((0, 0, 0.0078)), 0.0040, 'red',
                     vertices=18, bev=0.0008))

    # ================= ОГРАНИЧИТЕЛЬ РАСКРЫТИЯ ===========================
    parts.append(arc_shell(PREFIX + 'open_stop', R_OUT + 0.0012, R_OUT + 0.0040,
                           math.radians(12.0), math.radians(-11.5), 18, 'steel',
                           CZ + 0.0335, CZ + 0.0255, bevw=0.0005))
    a_riv = math.radians(9.5)
    parts.append(cyl(PREFIX + 'open_stop_rivet',
                     ep(a_riv, R_OUT - 0.0010, CZ + 0.0295),
                     ep(a_riv, R_OUT + 0.0050, CZ + 0.0295),
                     0.0020, 'steel', vertices=12))
    parts.append(arc_shell(PREFIX + 'open_stop_keeper', R_OUT + 0.0038, R_OUT + 0.0060,
                           math.radians(-6.5), math.radians(-11.0), 6, 'graphite',
                           CZ + 0.0345, CZ + 0.0245, bevw=0.0006))

    # ================= D-RING (+X) =====================================
    a_d = math.radians(90.0)
    # основание повторяет овал щеки, а не висит плитой
    parts.append(arc_shell(PREFIX + 'dring_plate', R_OUT - 0.0015, R_OUT + 0.0038,
                           a_d - 0.155, a_d + 0.155, 14, 'steel',
                           CZ + 0.0175, CZ - 0.0175, bevw=0.0008))
    for i, dz in enumerate((0.0105, -0.0105)):
        parts.append(cyl(PREFIX + f'dring_rivet_{"ab"[i]}',
                         ep(a_d, R_OUT - 0.0060, CZ + dz),
                         ep(a_d, R_OUT + 0.0052, CZ + dz),
                         0.0022, 'steel', vertices=12))
    parts.append(ring_loop(PREFIX + 'dring', ep(a_d, R_OUT + 0.0155, CZ),
                            Vector((0, 1, 0)), 0.0112, 0.0024, 'steel',
                            segs=44, rings=10))

    # ================= РЕЛЬСОВЫЙ ЗАХВАТ (-X) ============================
    a_m = math.radians(-90.0)
    parts.append(arc_shell(PREFIX + 'rail_boss', R_OUT - 0.0015, R_OUT + 0.0130,
                           a_m - 0.290, a_m + 0.290, 22, 'graphite',
                           CZ + 0.0162, CZ - 0.0162, bevw=0.0016))
    for i, dy in enumerate((0.0122, -0.0122)):
        parts.append(obox(PREFIX + f'rail_claw_{"ab"[i]}',
                           ep(a_m, R_OUT + 0.0162, CZ) + e_tan(a_m) * dy,
                           e_rad(a_m), e_tan(a_m), Vector((0, 0, 1)),
                           (0.0068, 0.0104, 0.0262), 'steel', bev=0.0008))
    parts.append(cyl(PREFIX + 'rail_lock_screw',
                     ep(a_m, R_OUT + 0.0120, CZ - 0.0020),
                     ep(a_m, R_OUT + 0.0205, CZ - 0.0020),
                     0.0034, 'steel', vertices=16, bev=0.0005))
    parts.append(cyl(PREFIX + 'rail_lock_knob',
                     ep(a_m, R_OUT + 0.0205, CZ - 0.0020),
                     ep(a_m, R_OUT + 0.0255, CZ - 0.0020),
                     0.0052, 'dark', vertices=20, bev=0.0008))

    # ================= МАРКИРОВКА РАЗМЕРА ===============================
    a_t = math.radians(52.0)
    parts.append(obox(PREFIX + 'size_tag', ep(a_t, R_OUT + 0.0030, CZ + 0.0130),
                       e_rad(a_t), e_tan(a_t), Vector((0, 0, 1)),
                       (0.0016, 0.0130, 0.0134), 'cream', bev=0.0004))
    for i, dphi in enumerate((-0.075, 0.0, 0.075)):
        aa = a_t + dphi
        parts.append(obox(PREFIX + f'size_tick_{"abc"[i]}',
                           ep(aa, R_OUT + 0.0042, CZ + 0.0130),
                           e_rad(aa), e_tan(aa), Vector((0, 0, 1)),
                           (0.0008, 0.0018, 0.0080), 'graphite', bev=0.0002))

    bpy.context.view_layer.update()
    return parts


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


def check(parts):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    rep = {
        'component': CID,
        'code': 'RST-TH-03',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_target_passport': [0.180, 0.120, 0.080],
        'bbox_ok': bool(size.x <= 0.190 and size.y <= 0.135 and size.z <= 0.086),
        'floor_contact_ok': bool(abs(mn.z) < 0.0020),
        'bore_axis': 'Z',
        'bore_axis_z': round(CZ, 5),
        'bore_clear_mm': [round(2 * PAD_IN * 1000, 1),
                          round(2 * PAD_IN * AY * 1000, 1)],
        'band_height_mm': round(2 * HALF_H * 1000, 1),
        'front_gap_deg': round(2 * math.degrees(A_FRONT), 1),
        'pad_depth_mm': round((PAD_OUT - PAD_IN) * 1000, 1),
        'ratchet_teeth': 7,
        'materials': sorted(m.name for m in bpy.data.materials if m.users),
        'material_count': len([m for m in bpy.data.materials if m.users]),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
    }
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
        o['motion'] = 'none'
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]
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


# --- рендеры -------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.0
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.45

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=4,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.30, -0.34, 0.30), 1.60, 0.32),
            ('fill', (-0.34, -0.26, 0.18), 0.62, 0.44),
            ('rim', (0.08, 0.34, 0.26), 0.98, 0.36)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.85))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()

    def fit_dist(direction, lens, corners, margin=1.12):
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

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    # крупный план: рейка, корпус собачки, рычаг и кнопка сброса
    ct = Vector((-0.0320, 0.0470, 0.0245))
    c_close = box_corners(Vector((-0.0800, 0.0210, 0.0055)) - ct,
                          Vector((0.0080, 0.0700, 0.0470)) - ct)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    # fit='ndc' — вписываем весь компонент с контролем по NDC,
    # fit='box' — кадрируем только выбранную зону (крупный план)
    views = [
        ('3q', (0.72, 0.60, 0.42), center, 70, c_main, 0.90, 'ndc'),
        ('front', (0.10, 0.98, 0.20), center, 70, c_main, 0.90, 'ndc'),
        ('side', (1.00, 0.10, 0.14), center, 70, c_main, 0.90, 'ndc'),
        ('closeup', (0.62, 0.64, 0.44), ct, 85, c_close, 0.94, 'box'),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, mode in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners, margin=1.14 if mode == 'box' else 1.12)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if mode == 'ndc':
            for _ in range(4):
                got = max_ndc(fill)
                if abs(got - fill) < 0.02:
                    break
                dist *= got / fill
                cam.location = target + dirn * dist
                cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
                bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} dist={dist:.3f} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
