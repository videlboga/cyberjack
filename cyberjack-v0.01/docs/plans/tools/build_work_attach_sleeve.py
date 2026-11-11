"""Standalone builder: work_attach_sleeve (WRK-ATT-11, «Мягкий чехол»).

Тонкостенный силиконовый чехол-рукав, открытый с двух концов: натяжная
манжета посадки у заднего торца, закатанный мягкий воротник на обоих торцах
(видна толщина стенки), 8 внутренних продольных рёбер, литая продольная
складка-шов, шильдик с меткой размера и цветной индикатор.
Без плиты, без мотора — чехол надевается на насадку.

Не зависит от build_component_library.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_work_attach_sleeve.py

Выход:
  public/models/machine-modules/components/work_attach_sleeve.glb
  docs/plans/blockout/component-library/work_attach_sleeve/*.png
  docs/plans/blockout/component-library/work_attach_sleeve/report.json

Геометрия (Blender Z-up, метры):
  ось рукава    = X (лежит на полу, z=0 — точка контакта)
  габарит       = Ø0,049 x 0,153  (паспорт Ø0,020-0,060 x 0,100-0,220)
  стенка        = 1,5 мм в теле, 2,0 мм у торцов; отверстия торцов Ø38,8
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_attach_sleeve'
CID = 'work_attach_sleeve'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
LEN_HALF = 0.0750            # полу-длина тела 0,150
R_BODY = 0.0214              # Ø 42,8 в теле
BARREL = 0.0010              # мягкая бочка по середине
WALL_MID = 0.0015            # стенка в теле (1,5 мм)
WALL_END = 0.0020            # стенка у торцов (2,0 мм) — верх паспорта
HEM_MINOR = 0.0014           # закатанный воротник-валик
RIBS = 8                     # внутренние продольные рёбра
RIB_W, RIB_H = 0.0028, 0.0014
RIB_X0, RIB_X1 = -0.0718, 0.0718
CUFF_X0, CUFF_X1 = -0.0625, -0.0355
SEG = 96                     # сегментов по окружности
PROF_N = 48                  # сэмплов по длине
Z0 = 0.0                     # ось рукава по высоте (низ на z=0)

PALETTE = {
    'silicone': (0.828, 0.520, 0.560),    # розовый силикон, наружная поверхность
    'lining': (0.880, 0.652, 0.690),      # внутренняя подкладка, теплее и светлее
    'cuff': (0.680, 0.300, 0.366),        # манжета посадки, плотнее и темнее
    'graphite': (0.196, 0.196, 0.212),    # маркировка
    'cyan': (0.520, 0.880, 0.900),        # индикатор размера
    'ivory': (0.952, 0.944, 0.930),       # шильдик
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
    slick = role in ('silicone', 'lining', 'cuff')
    bsdf.inputs['Roughness'].default_value = 0.46 if slick else 0.62
    bsdf.inputs['Metallic'].default_value = 0.0
    if slick:
        for key, val in (('Subsurface Weight', 0.16), ('Sheen Weight', 0.30),
                         ('Coat Weight', 0.10)):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = val
        if 'Subsurface Radius' in bsdf.inputs:
            bsdf.inputs['Subsurface Radius'].default_value = (0.9, 0.45, 0.42)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.35
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


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    select_only(obj)
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


def torus(name, loc, major, minor, role, axis='Z', segs=72, rings=12):
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


# --- профиль и lathe -----------------------------------------------------
def profile(t_lo=WALL_MID, t_hi=WALL_END):
    """(x, r_out) по длине: мягкая бочка + утолщение стенки к торцам."""
    pts = []
    for i in range(PROF_N + 1):
        u = i / PROF_N
        x = -LEN_HALF + 2.0 * LEN_HALF * u
        edge = min(u, 1.0 - u) / 0.16          # 0..1 в пределах 24 мм от торца
        edge = min(edge, 1.0)
        r = R_BODY + BARREL * math.sin(math.pi * u)
        r += 0.00035 * math.sin(math.pi * u * 3.0)   # лёгкая мягкая волна
        pts.append((x, r, t_lo + (t_hi - t_lo) * (1.0 - edge) ** 2))
    return pts


def lathe_shell(name, prof, seg=SEG, role_out='silicone', role_in='lining'):
    """Тонкостенная оболочка вращения вокруг оси X, открытая с двух торцов."""
    bm = bmesh.new()
    n = len(prof)
    outer, inner = [], []
    for x, ro, t in prof:
        ri = max(ro - t, 0.0006)
        ro_ring, ri_ring = [], []
        for k in range(seg):
            a = math.tau * k / seg
            sy, cz = math.sin(a), math.cos(a)
            ro_ring.append(bm.verts.new((x, sy * ro, Z0 + cz * ro)))
            ri_ring.append(bm.verts.new((x, sy * ri, Z0 + cz * ri)))
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
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    slots = [mat(role_out), mat(role_in), mat(role_out)]
    for f in f_out:
        f.material_index = 0
    for f in f_in:
        f.material_index = 1
    for f in f_rim:
        f.material_index = 2

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for m in slots:
        obj.data.materials.append(m)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def arc_patch(name, x0, x1, r_in, r_out, a_c, a_span, seg, role):
    """Криволинейная накладка по наружной поверхности (сектор вокруг оси X)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a_c - a_span * 0.5 + a_span * i / seg
        dy, dz = math.sin(a), math.cos(a)
        ring = []
        for x in (x0, x1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((x, dy * r, Z0 + dz * r)))
        rings.append(ring)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


def poly_bead(name, pts, radius, role, sides=8):
    """Жгут по полилинии (мягкий литой шов, повторяет кривизну поверхности)."""
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
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


def r_at(x, prof):
    """r_out профиля в точке x (линейная интерполяция)."""
    for i in range(len(prof) - 1):
        x0, r0, _ = prof[i]
        x1, r1, _ = prof[i + 1]
        if x0 <= x <= x1:
            f = 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
            return r0 + (r1 - r0) * f
    return prof[-1][1]


def rib_strips(name, prof, n=RIBS):
    """Внутренние продольные рёбра: лофт-полосы, концы плавно утоплены в стенку."""
    stations = 33
    bm = bmesh.new()
    for i in range(n):
        a = math.tau * i / n + math.radians(22.5)
        rings = []
        for k in range(stations):
            u = k / (stations - 1)
            x = RIB_X0 + (RIB_X1 - RIB_X0) * u
            # высота ребра: 0,2 мм у торцов -> полная в средней части
            fade = min(1.0, min(u, 1.0 - u) / 0.16)
            fade = fade * fade * (3.0 - 2.0 * fade)
            h = 0.0002 + (RIB_H - 0.0002) * fade
            ro, t = prof[-1][1], prof[-1][2]
            for j in range(len(prof) - 1):
                if prof[j][0] <= x <= prof[j + 1][0]:
                    f = (x - prof[j][0]) / (prof[j + 1][0] - prof[j][0])
                    ro = prof[j][1] + (prof[j + 1][1] - prof[j][1]) * f
                    t = prof[j][2] + (prof[j + 1][2] - prof[j][2]) * f
                    break
            ri = ro - t
            r_bot = ri - 0.0008
            r_top = ri + h
            da = RIB_W / max(ri, 0.005)
            ring = []
            for aa, rr in ((a - da * 0.5, r_bot), (a + da * 0.5, r_bot),
                           (a + da * 0.5, r_top), (a - da * 0.5, r_top)):
                ring.append(bm.verts.new((x, math.sin(aa) * rr,
                                          Z0 + math.cos(aa) * rr)))
            rings.append(ring)
        for k in range(stations - 1):
            for e in range(4):
                e2 = (e + 1) % 4
                bm.faces.new((rings[k][e], rings[k][e2],
                              rings[k + 1][e2], rings[k + 1][e]))
        bm.faces.new(tuple(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, 'lining', True)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    prof = profile()
    r_end = prof[0][1]
    t_end = prof[0][2]

    # ---- корпус чехла: тонкая стенка, оба торца открыты ----------------
    shell = lathe_shell(PREFIX + 'shell', prof)

    # ---- закатанный воротник на обоих торцах ---------------------------
    for tag, x in (('rear', -LEN_HALF), ('front', LEN_HALF)):
        rr = r_at(x, prof)
        torus(PREFIX + f'hem_{tag}', (x, 0.0, Z0),
              rr - t_end * 0.5, HEM_MINOR, 'silicone', 'X', segs=72, rings=14)

    # ---- внутренние продольные рёбра (концы утоплены в стенку) ---------
    ribs = rib_strips(PREFIX + 'ribs', prof)

    # ---- манжета посадки у заднего торца -------------------------------
    def cuff_off(u):
        # толще у открытого торца, тоньше к середине: натяжная посадка
        return 0.0009 + 0.0011 * (1.0 - u)

    cuff_prof = []
    for i in range(15):
        u = i / 14.0
        x = CUFF_X0 + (CUFF_X1 - CUFF_X0) * u
        cuff_prof.append((x, r_at(x, prof) + cuff_off(u), 0.0022))
    lathe_shell(PREFIX + 'cuff', cuff_prof, role_out='cuff', role_in='cuff')
    for i, u in enumerate((0.10, 0.40, 0.72)):
        x = CUFF_X0 + (CUFF_X1 - CUFF_X0) * u
        torus(PREFIX + f'cuff_ridge_{i}', (x, 0.0, Z0),
              r_at(x, prof) + cuff_off(u) + 0.0001, 0.00055, 'cuff', 'X',
              segs=64, rings=8)

    # язычок манжеты: потянуть за него, чтобы снять чехол
    arc_patch(PREFIX + 'pull_tab', -0.0362, -0.0206,
              r_at(-0.028, prof) + 0.0001, r_at(-0.028, prof) + 0.0018,
              0.0, math.radians(34.0), 14, 'cuff')

    # ---- литая продольная складка-шов (концы уходят в тело) -----------
    a_seam = math.radians(-118.0)
    seam_pts = []
    n_seam = 41
    for i in range(n_seam):
        x = -0.0680 + 0.1360 * i / (n_seam - 1)
        u = i / (n_seam - 1)
        fade = min(1.0, min(u, 1.0 - u) / 0.075)
        fade = fade * fade * (3.0 - 2.0 * fade)
        lift = 0.00005 - 0.0010 * (1.0 - fade)
        rr = r_at(x, prof) + lift
        seam_pts.append((x, math.sin(a_seam) * rr, Z0 + math.cos(a_seam) * rr))
    poly_bead(PREFIX + 'seam', seam_pts, 0.00040, 'silicone', sides=8)

    # ---- шильдик с меткой размера --------------------------------------
    lb_x0, lb_x1 = 0.0130, 0.0465
    arc_patch(PREFIX + 'size_patch', lb_x0, lb_x1,
              r_at(0.030, prof) - 0.0002, r_at(0.030, prof) + 0.0009,
              0.0, math.radians(52.0), 18, 'ivory')

    # код размера: три насечки-штриха и цветной индикатор
    r_mark = r_at(0.030, prof) + 0.0010
    for i, (x, w) in enumerate(((0.0225, 0.0020), (0.0285, 0.0032), (0.0345, 0.0024))):
        cube(PREFIX + f'size_mark_{i}', (x, 0.0, Z0 + r_mark),
             (w, 0.0110, 0.0012), 'graphite', r=0.0003)
    cyl(PREFIX + 'size_pip', (0.0410, 0.0, Z0 + r_mark),
        (0.0410, 0.0, Z0 + r_mark + 0.0009), 0.0021, 'cyan', vertices=18, bev=0.0003)

    # ---- посадка на пол: bbox min z = 0 --------------------------------
    bpy.context.view_layer.update()
    mn_pts, _ = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX):
            o.location.z -= mn_pts.z
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


def open_ends(prof, seg=SEG):
    """Диаметры отверстий и толщина стенки на обоих торцах."""
    out = []
    for x, ro, t in (prof[0], prof[-1]):
        out.append({'x': round(x, 5), 'hole_mm': round((ro - t) * 2 * 1000, 2),
                    'wall_mm': round(t * 1000, 2),
                    'rim_outer_mm': round(ro * 2 * 1000, 2)})
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

    report = {
        'component': CID,
        'code': 'WRK-ATT-11',
        'passport': 'Ø0,020-0,060 x 0,100-0,220 м; стенка 0,5-2 мм',
        'motion': 'none',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_count': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'outer_diameter_mm': round(dia * 1000, 2),
        'length_mm': round(size.x * 1000, 2),
        'bbox_ok': bool(0.020 <= dia <= 0.060 and 0.100 <= size.x <= 0.220),
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0008),
        'open_ends': ends,
        'ends_open_ok': bool(all(e['hole_mm'] > 30.0 for e in ends)),
        'wall_thickness_mm': [e['wall_mm'] for e in ends],
        'wall_ok': bool(all(0.5 <= e['wall_mm'] <= 2.0 for e in ends)),
        'ribs': RIBS,
        'shell_nonmanifold_edges': nonman,
        'shell_boundary_edges': holes,
        'shell_tris': tris,
        'shell_closed_ok': bool(nonman == 0 and holes == 0),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
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
    scene.view_settings.exposure = -0.10
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.775, 0.768, 0.760, 1.0)
    bg.inputs['Strength'].default_value = 0.48

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=2.2,
                                     location=(center.x, center.y, mn.z - 0.0005))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.652, 0.646, 0.636, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.26, -0.30, 0.36), 1.15, 0.40),
            ('fill', (-0.34, -0.26, 0.16), 0.42, 0.55),
            ('rim', (0.06, 0.32, 0.26), 0.85, 0.35),
            ('low', (-0.10, -0.34, 0.03), 0.22, 0.30),
            ('cav', (-0.11, -0.03, 0.045), 0.30, 0.10)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.30))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()
    # подсветка внутрь рукава со стороны заднего торца
    bpy.data.objects['cav'].rotation_euler = (
        Vector((0.12, 0.0, 0.020)) - bpy.data.objects['cav'].location
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
    close_t = Vector((-0.0555, 0.0, 0.0225))
    c_close = box_corners(Vector((-0.0790, -0.0265, 0.0)) - close_t,
                          Vector((-0.0200, 0.0265, 0.0455)) - close_t)

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
        ('3q', (-0.86, -0.62, 0.40), center + Vector((0, 0, 0.001)), 85, c_main, 0.90, True),
        ('front', (-0.10, -1.00, 0.17), center + Vector((0, 0, 0.001)), 85, c_main, 0.90, True),
        ('side', (1.00, -0.30, 0.22), center + Vector((0, 0, 0.001)), 85, c_main, 0.90, True),
        ('closeup', (-0.62, -0.72, 0.32), close_t, 105, c_close, 0.94, False),
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


def main():
    prof = build()
    rep = check(prof)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['ends_open_ok']
            and rep['wall_ok']
            and rep['shell_closed_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000 and not rep['bad_names']
            and not rep['has_anim_empty']):
        raise SystemExit('checks failed')


main()
