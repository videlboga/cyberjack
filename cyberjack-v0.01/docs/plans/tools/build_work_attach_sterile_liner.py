"""Standalone builder: work_attach_sterile_liner (WRK-ATT-13, «Стерильная гильза»).

Тонкая одноразовая полиуретановая гильза-плёночка: стенка 0,046 мм в теле и
0,050 мм у торцов (паспорт 0,03-0,05 мм), оба торца открыты и закатаны в
валик-кромку, продольный сварной шов, язычок снятия на переднем торце,
перфорация/насечка для разрыва, матовая печатная полоса с меткой размера и
розовым индикатором, маленький штамп стерильности.
Без плиты, без мотора — гильза надевается на насадку.

Не зависит от build_component_library.py, build_work_tickle_firm.py не
редактируется.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_work_attach_sterile_liner.py

Выход:
  public/models/machine-modules/components/work_attach_sterile_liner.glb
  docs/plans/blockout/component-library/work_attach_sterile_liner/*.png
  docs/plans/blockout/component-library/work_attach_sterile_liner/report.json

Геометрия (Blender Z-up, метры):
  ось гильзы    = X, гильза лежит на полу: нижняя точка z = 0
  габарит       = Ø0,042 x 0,201 (паспорт Ø0,020-0,060 x 0,100-0,220)
  тело          = x ∈ [-0,0825, +0,0825]  (165 мм), R_out 20,5 мм
  стенка        = 0,046 мм в теле, 0,050 мм у торцов, отверстия торцов Ø40,9
  anim          = нет (motion: none) — все меши статичны
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_attach_sterile_liner'
CID = 'work_attach_sterile_liner'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
L_HALF = 0.0825              # полу-длина тела 0,165
R_OUT = 0.0205               # Ø 41 в теле
BARREL = 0.00030             # мягкая бочка по середине (натяг на насадку)
WALL_MID = 0.000046          # стенка в теле (0,046 мм)
WALL_END = 0.000050          # стенка у торцов (0,050 мм) — верх паспорта
HEM_MINOR = 0.00075          # закатанная кромка: валик Ø1,5 мм
SEG = 96                     # сегментов по окружности
PROF_N = 44                  # сэмплов по длине
Z_AX = R_OUT                 # ось по высоте: низ гильзы на z = 0

A_SEAM = math.radians(-45.0)     # продольный шов + язычок: верхне-передняя грань
A_TAB = A_SEAM
TAB_X0 = L_HALF + 0.0004         # корень язычка — сразу за кромкой
TAB_LEN = 0.0132
TAB_W0, TAB_W1 = 0.0062, 0.0043  # полуширина у корня / у конца
TAB_THICK = 0.00015
TAB_LIFT = 0.0016                # отгиб кончика вверх-наружу

# печать и метка размера — в задней трети, подальше от перфорации
BAND_X0, BAND_X1 = -0.0620, -0.0545
STAMP_X0, STAMP_X1 = -0.0700, -0.0640
PERF_X = L_HALF - 0.0105            # перфорация: 10,5 мм от переднего торца
PERF_DASHES = 11
PERF_SPAN = math.radians(118.0)
PERF_DASH_L, PERF_DASH_W = 0.0024, 0.00080

PALETTE = {
    # role: (color, alpha, roughness, metallic, emit)
    'film_out': ((0.858, 0.902, 0.916), 0.34, 0.31, 0.0, 0.0),
    'film_in': ((0.930, 0.952, 0.960), 0.20, 0.36, 0.0, 0.0),
    'roll': ((0.948, 0.962, 0.968), 0.80, 0.44, 0.0, 0.0),
    'seam': ((0.870, 0.905, 0.918), 0.76, 0.30, 0.0, 0.0),
    'print': ((0.946, 0.944, 0.912), 0.97, 0.64, 0.0, 0.0),
    'mark': ((0.845, 0.300, 0.386), 1.00, 0.52, 0.0, 0.14),
    'perf': ((0.290, 0.305, 0.335), 0.94, 0.60, 0.0, 0.0),
    'tab': ((0.808, 0.860, 0.888), 0.36, 0.42, 0.0, 0.0),
}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color, alpha, rough, metal, emit = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_{int(round(alpha * 100)):02d}')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Alpha'].default_value = alpha
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.62
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = 1.49
    if emit > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
    if alpha < 1.0:
        m.blend_method = 'BLEND'
        try:
            m.surface_render_method = 'DITHERED'
        except Exception:
            pass
    m.use_backface_culling = False
    try:
        m.show_transparent_back = True
    except Exception:
        pass
    m.diffuse_color = (*color, alpha)
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


def torus(name, loc, major, minor, role, axis='X', segs=96, rings=16):
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


def new_obj(name, bm, slots, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for s in slots:
        obj.data.materials.append(s)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z (верх), a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


# --- профиль и латексная оболочка ---------------------------------------
def profile():
    """(x, r_out, wall) по длине: мягкая бочка + утолщение к торцам."""
    pts = []
    for i in range(PROF_N + 1):
        u = i / PROF_N
        x = -L_HALF + 2.0 * L_HALF * u
        edge = min(min(u, 1.0 - u) / 0.15, 1.0)
        r = R_OUT + BARREL * math.sin(math.pi * u)
        r += 0.00016 * math.sin(math.pi * u * 4.0)     # мягкая волна плёнки
        r += 0.00010 * math.sin(math.pi * u * 9.0 + 0.7)
        t = WALL_MID + (WALL_END - WALL_MID) * (1.0 - edge) ** 2
        pts.append((x, r, t))
    return pts


def lathe_shell(name, prof, seg=SEG, role_out='film_out', role_in='film_in'):
    """Тонкостенная оболочка вращения вокруг X, оба торца открыты."""
    bm = bmesh.new()
    n = len(prof)
    outer, inner = [], []
    for x, ro, t in prof:
        ri = max(ro - t, 0.00001)
        ro_ring, ri_ring = [], []
        for k in range(seg):
            a = math.tau * k / seg
            sy, cz = math.sin(a), math.cos(a)
            ro_ring.append(bm.verts.new((x, sy * ro, Z_AX + cz * ro)))
            ri_ring.append(bm.verts.new((x, sy * ri, Z_AX + cz * ri)))
        outer.append(ro_ring)
        inner.append(ri_ring)

    f_out, f_in, f_rim = [], [], []
    for i in range(n - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            f_out.append(bm.faces.new((outer[i][k], outer[i][k2],
                                       outer[i + 1][k2], outer[i + 1][k])))
            f_in.append(bm.faces.new((inner[i][k], inner[i + 1][k],
                                      inner[i + 1][k2], inner[i][k2])))
    for k in range(seg):
        k2 = (k + 1) % seg
        f_rim.append(bm.faces.new((outer[0][k], inner[0][k],
                                   inner[0][k2], outer[0][k2])))
        f_rim.append(bm.faces.new((inner[-1][k], outer[-1][k],
                                   outer[-1][k2], inner[-1][k2])))

    slots = [role_out, role_in, role_out]
    for f in f_out:
        f.material_index = 0
    for f in f_in:
        f.material_index = 1
    for f in f_rim:
        f.material_index = 2
    return new_obj(name, bm, [mat(r) for r in slots])


def r_at(x, prof):
    for i in range(len(prof) - 1):
        x0, r0, _ = prof[i]
        x1, r1, _ = prof[i + 1]
        if x0 <= x <= x1:
            f = 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
            return r0 + (r1 - r0) * f
    return prof[-1][1]


def poly_bead(name, pts, radius, role, sides=8):
    """Жгут по полилинии: сварной шов, повторяющий поверхность гильзы."""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        a = Vector(pts[max(i - 1, 0)])
        b = Vector(pts[min(i + 1, len(pts) - 1)])
        q = (b - a).normalized().to_track_quat('Z', 'Y')
        ring = []
        for k in range(sides):
            ang = math.tau * k / sides
            off = q @ Vector((math.cos(ang) * radius, math.sin(ang) * radius, 0.0))
            ring.append(bm.verts.new(Vector(p) + off))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            bm.faces.new((rings[i][k], rings[i][k2],
                          rings[i + 1][k2], rings[i + 1][k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return new_obj(name, bm, [mat(role)])


def bm_patch(bm, x0, x1, a_c, a_half, r, nu=1, nv=6):
    """Плоская криволинейная наклейка на наружной поверхности."""
    grid = []
    for i in range(nu + 1):
        x = x0 + (x1 - x0) * i / nu
        row = []
        for j in range(nv + 1):
            a = a_c - a_half + 2.0 * a_half * j / nv
            row.append(bm.verts.new((x, math.sin(a) * r, Z_AX + math.cos(a) * r)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i][j + 1],
                          grid[i + 1][j + 1], grid[i + 1][j]))


def patch_obj(name, x0, x1, a_c, a_half, r, role, nu=1, nv=6):
    bm = bmesh.new()
    bm_patch(bm, x0, x1, a_c, a_half, r, nu, nv)
    return new_obj(name, bm, [mat(role)])


def peel_tab(name, a_c, x0, length, w0, w1, lift, thick, role,
             uN=20, vN=10):
    """Язычок снятия: плёночная лента, отходящая от кромки и отгибающаяся."""
    bm = bmesh.new()
    top, bot = [], []
    for i in range(uN + 1):
        u = i / uN
        x = x0 + length * u
        # отгиб: почти лежит у корня, поднимается к кончику
        lf = 0.00012 + lift * (u ** 1.55)
        w = w0 + (w1 - w0) * u
        if u > 0.80:                      # скругление кончика
            w *= 1.0 - 0.46 * ((u - 0.80) / 0.20) ** 1.4
        rt, rb = [], []
        for j in range(vN + 1):
            f = -1.0 + 2.0 * j / vN
            a = a_c + (f * w) / R_OUT
            curl = 0.00055 * (f * f) * min(1.0, u * 1.6)   # лёгкая волнистость
            r_b = R_OUT + lf + curl
            r_t = r_b + thick
            rb.append(bm.verts.new((x, math.sin(a) * r_b, Z_AX + math.cos(a) * r_b)))
            rt.append(bm.verts.new((x, math.sin(a) * r_t, Z_AX + math.cos(a) * r_t)))
        bot.append(rb)
        top.append(rt)
    for i in range(uN):
        for j in range(vN):
            bm.faces.new((bot[i][j], bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j]))
            bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]))
    for i in range(uN):                    # боковые кромки
        bm.faces.new((bot[i][0], bot[i + 1][0], top[i + 1][0], top[i][0]))
        bm.faces.new((bot[i][-1], top[i][-1], top[i + 1][-1], bot[i + 1][-1]))
    for j in range(vN):                    # корень и кончик
        bm.faces.new((bot[0][j], top[0][j], top[0][j + 1], bot[0][j + 1]))
        bm.faces.new((bot[-1][j], bot[-1][j + 1], top[-1][j + 1], top[-1][j]))
    return new_obj(name, bm, [mat(role)])


# --- сборка --------------------------------------------------------------
def build():
    reset()
    prof = profile()
    r_end = prof[0][1]
    t_end = prof[0][2]

    # ---- тело: плёнка 0,046-0,050 мм, оба торца открыты ----------------
    lathe_shell(PREFIX + 'shell', prof)

    # ---- закатанный край-валик на обоих торцах -------------------------
    for tag, x in (('rear', -L_HALF), ('front', L_HALF)):
        torus(PREFIX + f'rim_{tag}', (x, 0.0, Z_AX),
              r_end - t_end * 0.5, HEM_MINOR, 'roll', 'X', segs=96, rings=16)

    # ---- продольный сварной шов (концы уходят в плёнку) ----------------
    pts = []
    n = 49
    for i in range(n):
        u = i / (n - 1)
        x = -(L_HALF - 0.0022) + 2.0 * (L_HALF - 0.0022) * u
        fade = min(1.0, min(u, 1.0 - u) / 0.05)
        fade = fade * fade * (3.0 - 2.0 * fade)
        lift = -0.00018 + 0.00030 * fade
        rr = r_at(x, prof) + lift
        d = radial(A_SEAM)
        pts.append((x, d.y * rr, Z_AX + d.z * rr))
    poly_bead(PREFIX + 'seam', pts, 0.00034, 'seam', sides=10)

    # ---- язычок снятия на передней кромке ------------------------------
    peel_tab(PREFIX + 'tear_tab', A_TAB, TAB_X0, TAB_LEN, TAB_W0, TAB_W1,
             TAB_LIFT, TAB_THICK, 'tab')

    # ---- перфорация для разрыва: пунктир по окружности -----------------
    bm = bmesh.new()
    a_half_dash = (PERF_DASH_W * 0.5) / R_OUT
    step = (2.0 * PERF_SPAN) / (PERF_DASHES - 1)
    for i in range(PERF_DASHES):
        a_c = A_TAB - PERF_SPAN + step * i
        bm_patch(bm, PERF_X - PERF_DASH_L * 0.5, PERF_X + PERF_DASH_L * 0.5,
                 a_c, a_half_dash, r_at(PERF_X, prof) + 0.00009, nu=1, nv=4)
    # насечка-надрез у самой кромки, под корнем язычка
    bm_patch(bm, L_HALF - 0.0052, L_HALF + 0.0002, A_TAB,
             (0.0016) / R_OUT, r_at(L_HALF - 0.004, prof) + 0.00009, nu=2, nv=4)
    perf = new_obj(PREFIX + 'perforation', bm, [mat('perf')])

    # ---- печатная полоса (матовая, стерильная печать) ------------------
    band_prof = [(BAND_X0, R_OUT + 0.00009, 0.00007),
                 (BAND_X1, R_OUT + 0.00009, 0.00007)]
    band = lathe_shell(PREFIX + 'size_band', band_prof, seg=SEG,
                       role_out='print', role_in='print')

    # ---- метка размера: три штриха "L" + розовый индикатор -------------
    bm = bmesh.new()
    x_mid = (BAND_X0 + BAND_X1) * 0.5
    for i in range(3):
        a = A_TAB + math.radians(30.0 + i * 8.0)
        bm_patch(bm, x_mid - 0.0026, x_mid + 0.0026, a,
                 (0.00050) / R_OUT, R_OUT + 0.00016, nu=1, nv=3)
    new_obj(PREFIX + 'size_marks', bm, [mat('perf')])
    patch_obj(PREFIX + 'size_pip', x_mid - 0.0026, x_mid + 0.0026,
              A_TAB + math.radians(56.0), (0.0026) / R_OUT,
              R_OUT + 0.00016, 'mark', nu=6, nv=8)

    # ---- штамп стерильности: рамка + два штриха ------------------------
    bm = bmesh.new()
    a_st = A_TAB - math.radians(34.0)
    sx0, sx1 = STAMP_X0, STAMP_X1
    bm_patch(bm, sx0, sx1, a_st, (0.00034) / R_OUT,
             R_OUT + 0.00016, nu=1, nv=2)
    bm_patch(bm, sx0, sx1, a_st + math.radians(1.35),
             (0.00034) / R_OUT, R_OUT + 0.00016, nu=1, nv=2)
    bm_patch(bm, sx0 + 0.0005, sx0 + 0.0012, a_st + math.radians(0.68),
             (0.00095) / R_OUT, R_OUT + 0.00016, nu=1, nv=3)
    bm_patch(bm, sx1 - 0.0012, sx1 - 0.0005, a_st + math.radians(0.68),
             (0.00095) / R_OUT, R_OUT + 0.00016, nu=1, nv=3)
    bm_patch(bm, sx0 + 0.0018, sx1 - 0.0018, a_st + math.radians(0.68),
             (0.00080) / R_OUT, R_OUT + 0.00016, nu=2, nv=3)
    new_obj(PREFIX + 'sterile_stamp', bm, [mat('mark')])

    # ---- посадка на пол: bbox min z = 0 --------------------------------
    bpy.context.view_layer.update()
    mn, _ = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX):
            o.location.z -= mn.z
    bpy.context.view_layer.update()
    return prof


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


def open_ends(prof):
    out = []
    for tag, (x, ro, t) in (('rear', prof[0]), ('front', prof[-1])):
        out.append({'end': tag, 'x': round(x, 5),
                    'hole_diameter_mm': round((ro - t) * 2 * 1000, 2),
                    'rim_outer_mm': round(ro * 2 * 1000, 2),
                    'wall_mm': round(t * 1000, 3)})
    return out


def manifold_stats(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    nonman = sum(1 for e in bm.edges if not e.is_manifold)
    holes = sum(1 for e in bm.edges if e.is_boundary)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    bm.free()
    return nonman, holes, tris


def check(prof):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    dia = max(size.y, size.z)

    shell = bpy.data.objects[PREFIX + 'shell']
    nonman, holes, tris = manifold_stats(shell)
    ends = open_ends(prof)

    transparent = sorted(m.name for m in bpy.data.materials
                         if m.node_tree.nodes.get('Principled BSDF')
                         and m.node_tree.nodes['Principled BSDF']
                         .inputs['Alpha'].default_value < 0.999)

    report = {
        'component': CID,
        'code': 'WRK-ATT-13',
        'passport': 'Ø0,020-0,060 x 0,100-0,220 м; стенка 0,03-0,05 мм',
        'motion': 'none',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_count': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'outer_diameter_mm': round(dia * 1000, 2),
        'body_length_mm': round(size.x * 1000, 2),
        'bbox_ok': bool(0.020 <= dia <= 0.060 and 0.100 <= size.x <= 0.220),
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0008),
        'open_ends': ends,
        'ends_open_ok': bool(all(e['hole_diameter_mm'] > 30.0 for e in ends)),
        'wall_thickness_mm': [e['wall_mm'] for e in ends],
        'wall_ok': bool(all(0.030 <= e['wall_mm'] <= 0.0501 for e in ends)),
        'rim_roll_diameter_mm': round(HEM_MINOR * 2 * 1000, 2),
        'seam_angle_deg': round(math.degrees(A_SEAM), 1),
        'perforation_dashes': PERF_DASHES,
        'tab_length_mm': round((TAB_X0 + TAB_LEN - L_HALF) * 1000, 2),
        'shell_nonmanifold_edges': nonman,
        'shell_boundary_edges': holes,
        'shell_tris': tris,
        'shell_closed_ok': bool(nonman == 0 and holes == 0),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'transparent_materials': transparent,
        'parts': sorted(o.name for o in bpy.data.objects),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if o.type == 'MESH' and not o.name.startswith(PREFIX)),
        'has_anim_empty': bool([o for o in bpy.data.objects if o.type == 'EMPTY']),
    }
    return report


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


# --- рендеры -------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - High Contrast'
    scene.view_settings.exposure = -0.28
    try:
        scene.eevee.taa_render_samples = 128
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.430, 0.470, 0.510, 1.0)
    bg.inputs['Strength'].default_value = 0.62

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=2.2,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.360, 0.385, 0.408, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.26, -0.30, 0.34), 1.05, 0.40),
            ('fill', (-0.34, -0.24, 0.15), 0.40, 0.55),
            ('rim', (0.02, 0.32, 0.26), 0.78, 0.35),
            ('low', (-0.10, -0.34, 0.03), 0.20, 0.30),
            ('cav', (0.10, -0.03, 0.045), 0.30, 0.10)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.30))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()
    # подсветка внутрь гильзы со стороны переднего торца
    bpy.data.objects['cav'].rotation_euler = (
        Vector((0.15, 0.0, 0.020)) - bpy.data.objects['cav'].location
    ).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 85
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

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

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    close_t = Vector((L_HALF - 0.016, 0.0, Z_AX - 0.001))
    c_close = box_corners(Vector((L_HALF - 0.078, -0.026, Z_AX - 0.024)) - close_t,
                          Vector((L_HALF + 0.020, 0.026, Z_AX + 0.024)) - close_t)

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

    views = [
        ('3q', (-0.72, -0.78, 0.42), center + Vector((0, 0, 0.001)), 85, c_main, 0.90, True),
        ('front', (1.00, -0.26, 0.15), center + Vector((0, 0, 0.001)), 85, c_main, 0.90, True),
        ('side', (0.10, -1.00, 0.13), center + Vector((0, 0, 0.001)), 85, c_main, 0.90, True),
        ('closeup', (0.30, -0.92, 0.26), close_t, 100, c_close, 0.94, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fit_all in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fit_all:
            for _ in range(6):
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
        print(f'RENDERED {tag} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def verify_glb(path):
    """Импорт обратно в пустую сцену: bbox, узлы, материалы, alphaMode."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    objs = [o for o in bpy.context.scene.objects]
    mesh = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(mesh)
    import json as _json
    import struct as _struct
    raw = path.read_bytes()
    jlen = _struct.unpack('<I', raw[12:16])[0]
    gj = _json.loads(raw[20:20 + jlen])
    return {
        'nodes_in_glb': len(gj['nodes']),
        'meshes_in_glb': len(gj.get('meshes', [])),
        'node_names': sorted(n.get('name', '?') for n in gj['nodes']),
        'materials': sorted(m.get('name', '?') for m in gj.get('materials', [])),
        'alpha_modes': sorted({m.get('alphaMode', 'OPAQUE')
                               for m in gj.get('materials', [])}),
        'double_sided_all': all(m.get('doubleSided', False)
                                for m in gj.get('materials', [])),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in (mx - mn)],
    }


def main():
    prof = build()
    rep = check(prof)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    rep['glb_verify'] = verify_glb(path)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    v = rep['glb_verify']
    ok = (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['ends_open_ok']
          and rep['wall_ok'] and rep['shell_closed_ok']
          and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
          and not rep['bad_names'] and not rep['has_anim_empty']
          and v['nodes_in_glb'] == rep['nodes']
          and abs(v['bbox_size'][0] - rep['bbox_size'][0]) < 0.0005)
    if not ok:
        raise SystemExit('checks failed')


main()
