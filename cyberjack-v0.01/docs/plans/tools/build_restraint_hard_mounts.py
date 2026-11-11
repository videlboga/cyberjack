"""Hard-mount variants for 5 restraint fixtures (batch B).

Импорт существующего GLB -> удаление D-ring/кольца -> жёсткий кронштейн +
язык под CJ-LATCH-30 (вилка/палец/собачка/рычаг/антипроворот) -> 4 рендера
-> новый GLB `<id>_hard.glb`. Исходные GLB не перезаписываются.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_hard_mounts.py -- \
      [--cids restraint_stirrup,restraint_spreader]

Спецификация: docs/plans/checks/restraint-hard-mount-spec.json
Выход:
  public/models/machine-modules/components/<id>_hard.glb
  docs/plans/blockout/component-library/<id>_hard/*.png + report.json

Координаты спецификации — glTF Y-up; переход в Blender: b = (gx, -gz, gy).
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
LIB = PROJECT / 'docs/plans/blockout/component-library'
SPEC_PATH = PROJECT / 'docs/plans/checks/restraint-hard-mount-spec.json'
SPEC = json.loads(SPEC_PATH.read_text(encoding='utf-8'))
COMP = {c['id']: c for c in SPEC['components']}
TONGUES = {t['id']: t for t in SPEC['standards']['CJ-LATCH-30']['tongues']}


def hole_offset(cls):
    raw = TONGUES[cls]['hole_mm']
    return float(raw.split('на')[1].split('мм')[0].replace(',', '.')) / 1000.0


MATS = {}


# --- утилиты -------------------------------------------------------------
def g2b(v):
    """glTF (Y-up) -> Blender (Z-up): b = (gx, -gz, gy)."""
    return Vector((v[0], -v[2], v[1]))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(name, color=(0.6, 0.6, 0.6), metal=0.0, rough=0.5):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (*color, 1.0)
        b.inputs['Metallic'].default_value = metal
        b.inputs['Roughness'].default_value = rough
        m.diffuse_color = (*color, 1.0)
    MATS[name] = m
    return m


def steel():
    return mat('CJ_steel_100', (0.600, 0.610, 0.625), 1.0, 0.28)


def graphite():
    return mat('CJ_graphite_100', (0.080, 0.084, 0.094), 0.15, 0.58)


def red():
    return mat('CJ_red_100', (0.680, 0.055, 0.075), 0.0, 0.42)


def brass():
    return mat('CJ_brass_100', (0.640, 0.470, 0.230), 1.0, 0.34)


def apply_m(obj, material, smooth=False):
    obj.data.materials.append(material)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.0008, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(38)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def cut(obj, cutter):
    mod = obj.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    mod.solver = 'EXACT'
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)
    drop(cutter)


def drop(obj):
    me = obj.data
    bpy.ops.object.select_all(action='DESELECT')
    bpy.data.objects.remove(obj, do_unlink=True)
    if me is not None and me.users == 0:
        bpy.data.meshes.remove(me)


def basis(u, p):
    """Ортонормированный базис узла: u (наружу), p (ось пальца), a = u x p."""
    u = Vector(u).normalized()
    p = Vector(p)
    p = (p - u * p.dot(u)).normalized()
    a = u.cross(p).normalized()
    return u, p, a


def block(name, centre, u, p, a, lu, lp, la, material, bev=0.0008):
    """Блок по центру, ориентированный базисом (lu — вдоль u и т.д.)."""
    c = Vector(centre)
    M = Matrix((
        (a.x, p.x, u.x, c.x),
        (a.y, p.y, u.y, c.y),
        (a.z, p.z, u.z, c.z),
        (0.0, 0.0, 0.0, 1.0),
    )) @ Matrix.Diagonal((la, lp, lu, 1.0))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.matrix_world = M
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bev > 0:
        bevel(obj, min(bev, min(lu, lp, la) * 0.30), 2)
    return apply_m(obj, material)


def cyl(name, a_pt, b_pt, r, material, verts=24, r2=None, smooth=True):
    a_pt, b_pt = Vector(a_pt), Vector(b_pt)
    d = b_pt - a_pt
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r,
                                            depth=d.length,
                                            location=(a_pt + b_pt) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2,
                                        depth=d.length,
                                        location=(a_pt + b_pt) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply_m(obj, material, smooth)


def tri_prism(name, pts, axis, thickness, material, bev=0.0006):
    """Косынка: три точки, выдавленные по axis на толщину."""
    axis = Vector(axis).normalized()
    bm = bmesh.new()
    half = axis * thickness * 0.5
    lo = [bm.verts.new(Vector(p) - half) for p in pts]
    hi = [bm.verts.new(Vector(p) + half) for p in pts]
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply_m(obj, material)


def shell_arc(name, centre, r_in, r_out, th0, th1, width, material, steps=30):
    """Дуга в плоскости XZ вокруг оси Y (centre). th: 0 = +Z, 90 = +X."""
    c = Vector(centre)
    y0, y1 = c.y - width * 0.5, c.y + width * 0.5
    bm = bmesh.new()
    rings = []
    for i in range(steps + 1):
        th = math.radians(th0 + (th1 - th0) * i / steps)
        sx, cz = math.sin(th), math.cos(th)
        ring = [bm.verts.new((c.x + r * sx, y, c.z + r * cz))
                for y in (y0, y1) for r in (r_in, r_out)]
        rings.append(ring)          # [y0in, y0out, y1in, y1out]
    for i in range(steps):
        A, B = rings[i], rings[i + 1]
        bm.faces.new((A[1], B[1], B[3], A[3]))
        bm.faces.new((A[2], A[0], B[0], B[2]))
        bm.faces.new((A[0], A[1], B[1], B[0]))
        bm.faces.new((A[2], B[2], B[3], A[3]))
    bm.faces.new((rings[0][0], rings[0][2], rings[0][3], rings[0][1]))
    bm.faces.new((rings[-1][0], rings[-1][1], rings[-1][3], rings[-1][2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    return apply_m(obj, material)


def sweep_strip(name, path, width_z, thick, outward, material):
    """Полоса по ломаной (x, y, z): сечение thick (наружу) x width_z (по Z)."""
    bm = bmesh.new()
    rings = []
    for i, pt in enumerate(path):
        o = Vector(outward[i]).normalized()
        c = Vector(pt)
        rings.append([
            bm.verts.new(c + Vector((0, 0, -width_z / 2)) - o * thick * 0.3),
            bm.verts.new(c + Vector((0, 0, -width_z / 2)) + o * thick * 0.7),
            bm.verts.new(c + Vector((0, 0, width_z / 2)) + o * thick * 0.7),
            bm.verts.new(c + Vector((0, 0, width_z / 2)) - o * thick * 0.3),
        ])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new((A[k], A[j], B[j], B[k]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply_m(obj, material)


def tongue(name, base, u, p, a, cls, material):
    """Язык CJ-LATCH-30 по классу: (w x t x l), отверстие под втулку Ø16
    (втулка даёт Ø12,2). base — середина торца у кронштейна."""
    t = TONGUES[cls]
    w = t['w_mm'] / 1000.0
    th = t['t_mm'] / 1000.0
    l = t['l_mm'] / 1000.0
    hs = hole_offset(cls)
    r = w * 0.5
    l_eff = min(l, hs + r)
    base = Vector(base)
    phi_max = math.asin(min(1.0, (l_eff - hs) / r))
    n = 22
    right, left = [], []
    for i in range(n + 1):
        phi = phi_max * i / n
        s = hs + r * math.sin(phi)
        aa = r * math.cos(phi)
        right.append((s, aa))
        left.append((s, -aa))
    loop = [(0.0, -r)] + [(0.0, r)] + right + list(reversed(left))
    bm = bmesh.new()
    lo = [bm.verts.new(base + u * s + a * aa - p * (th / 2)) for s, aa in loop]
    hi = [bm.verts.new(base + u * s + a * aa + p * (th / 2)) for s, aa in loop]
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    for i in range(len(loop)):
        j = (i + 1) % len(loop)
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    hole_c = base + u * hs
    cut(obj, cyl(name + '_cut', hole_c - p * th, hole_c + p * th, 0.0080,
                 steel(), verts=32))
    bevel(obj, 0.0005, 2)
    return apply_m(obj, material)


def bush(name, centre, p, material):
    c = Vector(centre)
    return cyl(name, c - p * 0.0031, c + p * 0.0031, 0.0080, material, verts=28)


def screw(name, head_pt, u, d, head_d, material, length=0.012):
    """Винт: головка в head_pt, стержень уходит по -u в тело."""
    h = Vector(head_pt)
    u = Vector(u).normalized()
    cyl(name + '_shank', h - u * length, h + u * 0.0002, d * 0.5, material,
        verts=14)
    cap = cyl(name + '_head', h - u * 0.0002, h + u * (head_d * 0.30),
              head_d * 0.5, material, verts=18)
    cyl(name + '_sock', h + u * (head_d * 0.30), h + u * (head_d * 0.33),
        head_d * 0.19, graphite(), verts=6)
    parts = [o for o in bpy.data.objects if o.name.startswith(name + '_')]
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def dowel(name, start, u, offset, length, material, r=0.0025):
    s = Vector(start) + Vector(offset)
    u = Vector(u).normalized()
    return cyl(name, s - u * 0.003, s + u * length, r, material, verts=18)


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


# --- импорт / чистка ------------------------------------------------------
ORIG_BBOX = {}


def import_glb(cid):
    bpy.ops.import_scene.gltf(filepath=str(OUT / f'{cid}.glb'))
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    ORIG_BBOX[cid] = bbox_world(objs)
    for o in objs:
        select_only(o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return {o.name.split('__')[-1]: o for o in objs}


def strip_nodes(objs, names):
    removed, absent = [], []
    for short in names:
        o = objs.pop(short, None)
        if o is None:
            absent.append(short)
        else:
            removed.append(short)
            drop(o)
    return removed, absent


# --- проверки -------------------------------------------------------------
def bbox_world(objs):
    mn = Vector((1e9,) * 3)
    mx = Vector((-1e9,) * 3)
    for o in objs:
        mw = o.matrix_world
        for c in o.bound_box:
            p = mw @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def bvh_of(objs):
    from mathutils.bvhtree import BVHTree
    verts, polys = [], []
    for o in objs:
        mw = o.matrix_world
        base = len(verts)
        for v in o.data.vertices:
            verts.append(mw @ v.co)
        for poly in o.data.polygons:
            polys.append([base + i for i in poly.vertices])
    return BVHTree.FromPolygons(verts, polys, all_triangles=False)


def gap_to(bvh, obj, samples=300):
    mw = obj.matrix_world
    verts = obj.data.vertices
    step = max(1, len(verts) // samples)
    best = 1e9
    for i in range(0, len(verts), step):
        hit = bvh.find_nearest(mw @ verts[i].co)
        if hit and hit[3] is not None:
            best = min(best, hit[3])
    return best


def glb_nodes(path):
    import struct
    d = path.read_bytes()
    ln = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + ln].decode('utf-8'))
    return [n.get('name', '') for n in j.get('nodes', [])], j


# --- рендер ---------------------------------------------------------------
def render_views(cid, objs, views):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
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

    mn, mx = bbox_world(objs)
    centre = (mn + mx) * 0.5
    size = max((mx - mn).x, (mx - mn).y, (mx - mn).z, 0.06)

    bpy.ops.mesh.primitive_plane_add(size=size * 16,
                                     location=(centre.x, centre.y,
                                               mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for nm, off, k, sz in (('key', (1.0, -1.05, 1.0), 46.0, 1.15),
                           ('fill', (-1.05, -0.85, 0.50), 17.0, 1.45),
                           ('rim', (0.20, 1.10, 0.95), 28.0, 1.25)):
        ld = bpy.data.lights.new(nm, 'AREA')
        ld.energy = k * size ** 2
        ld.shape = 'DISK'
        ld.size = sz * size * 2.4
        lo = bpy.data.objects.new(nm, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(off).normalized() * size * 2.4 + Vector(
            (centre.x, centre.y, centre.z))
        lo.rotation_euler = (centre - lo.location).to_track_quat(
            '-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    rdir = LIB / f'{cid}_hard'
    rdir.mkdir(parents=True, exist_ok=True)

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
            need = max(need, abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill):
        worst = 0.0
        for o in objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    outs = []
    for tag, direction, target, lens, corners, fill in views:
        target = Vector(target)
        cam_data.lens = lens
        dirn = Vector(direction).normalized()
        dist = fit_dist(direction, lens, corners)
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat(
            '-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
            got = max_ndc(fill)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat(
                '-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = rdir / f'{cid}_hard_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {cid} {tag} ndc={max_ndc(fill):.3f}', flush=True)
    return outs


# --- компоненты -----------------------------------------------------------
def build_neck_yoke(cid):
    spec = COMP[cid]
    prefix = cid + '__'
    objs = import_glb(cid)
    removed, absent = strip_nodes(objs, spec['hide_nodes'])
    uL, pL, aL = basis(g2b(spec['anchor']['normal_u']),
                       g2b(spec['anchor']['pin_axis_p']))
    uR = Vector((-uL.x, uL.y, uL.z))
    pR = Vector((-pL.x, pL.y, pL.z))
    aR = uR.cross(pR).normalized()
    A_L = g2b(spec['anchor']['position_m'])
    hole_L = g2b(spec['tongue']['hole_pos_m'])
    A_R = Vector((-A_L.x, A_L.y, A_L.z))
    hole_R = Vector((-hole_L.x, hole_L.y, hole_L.z))
    hoff = hole_offset('T-30')
    nodes = {}
    for side, A, u, p, a, hole in (('left', A_L, uL, pL, aL, hole_L),
                                   ('right', A_R, uR, pR, aR, hole_R)):
        # кронштейн: седло по борту дуги (40 x 30 x 3)
        nodes[f'hard_bracket_{side}'] = block(
            prefix + f'hard_bracket_{side}', A - u * 0.0010, u, p, a,
            0.0030, 0.0300, 0.0400, steel())
        front = A + u * 0.0005
        p_bot = p * (-0.0060)
        nodes[f'hard_bracket_web_{side}'] = tri_prism(
            prefix + f'hard_bracket_web_{side}',
            [front + p_bot, front + p_bot + u * 0.0210,
             front + p_bot + u * 0.0035 + p * (-0.0180)],
            a, 0.0025, steel())
        base = hole - u * hoff
        nodes[f'hard_tongue_{side}'] = tongue(
            prefix + f'hard_tongue_{side}', base, u, p, a, 'T-30', steel())
        nodes[f'hard_tongue_bush_{side}'] = bush(
            prefix + f'hard_tongue_bush_{side}', hole, p, brass())
        for tag, sgn in (('a', -1), ('b', 1)):
            nodes[f'hard_antirot_pin_{side}_{tag}'] = dowel(
                prefix + f'hard_antirot_pin_{side}_{tag}', base + u * 0.002,
                u, a * (sgn * 0.013), 0.014, steel())
        for tag, (oa, op) in (('a', (-0.0145, 0.0105)),
                              ('b', (0.0145, 0.0105))):
            nodes[f'hard_screw_{side}_{tag}'] = screw(
                prefix + f'hard_screw_{side}_{tag}',
                A + a * oa + p * op + u * 0.0005, u, 0.005, 0.0085, steel())
    # ребро жёсткости: лента, лежащая на верхней поверхности обода и
    # связывающая оба кронштейна (профиль обода снимается с сетки shell)
    sh = objs['shell']
    mw = sh.matrix_world
    bins = {}
    for v in sh.data.vertices:
        q = mw @ v.co
        if q.z >= 0.050 and q.y <= -0.010:
            k = round(q.x, 3)
            rec = bins.get(k)
            if rec is None or q.z > rec[0]:
                bins[k] = (q.z, q.y)
    keys = sorted(k for k in bins if 0.030 <= abs(k) <= 0.126)
    if len(keys) < 10:
        raise RuntimeError('stiffener contour not found')
    zs = [bins[k][0] for k in keys]
    ys = [bins[k][1] for k in keys]
    win = 5
    sm_z = [sum(zs[max(0, i - win):i + win + 1]) / len(zs[max(0, i - win):i + win + 1])
            for i in range(len(keys))]
    sm_y = [sum(ys[max(0, i - win):i + win + 1]) / len(ys[max(0, i - win):i + win + 1])
            for i in range(len(keys))]
    step = max(1, len(keys) // 24)
    idx = list(range(0, len(keys), step))
    if idx[-1] != len(keys) - 1:
        idx.append(len(keys) - 1)
    bm = bmesh.new()
    half_w = 0.011
    lo_y = half_w * 0.85
    quads = []
    for i in (idx):
        x, y, z = keys[i], sm_y[i], sm_z[i] - 0.0012
        p1 = bm.verts.new((x, y - lo_y, z))
        p2 = bm.verts.new((x, y + lo_y, z))
        p3 = bm.verts.new((x, y + lo_y, z + 0.0030))
        p4 = bm.verts.new((x, y - lo_y, z + 0.0030))
        quads.append((p1, p2, p3, p4))
    for i in range(len(quads) - 1):
        A, B = quads[i], quads[i + 1]
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new((A[k], A[j], B[j], B[k]))
    bm.faces.new(quads[0])
    bm.faces.new(list(reversed(quads[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(prefix + 'hard_yoke_stiffener')
    bm.to_mesh(me)
    bm.free()
    stiff = bpy.data.objects.new(prefix + 'hard_yoke_stiffener', me)
    bpy.context.scene.collection.objects.link(stiff)
    nodes['hard_yoke_stiffener'] = apply_m(stiff, steel())
    return spec, objs, nodes, removed, absent


def build_head_frame(cid):
    spec = COMP[cid]
    prefix = cid + '__'
    objs = import_glb(cid)
    removed, absent = strip_nodes(objs, spec['hide_nodes'])
    u, p, a = basis(g2b(spec['anchor']['normal_u']),
                    g2b(spec['anchor']['pin_axis_p']))
    A = g2b(spec['anchor']['position_m'])
    hole = g2b(spec['tongue']['hole_pos_m'])
    hoff = hole_offset('T-26')
    z0 = 0.1300                     # верх отбортовки затылочной плиты
    yc = -0.1075                    # центр кронштейна (плита 34 x 30 на отбортовке)
    nodes = {}
    plate = block(prefix + 'hard_bracket', Vector((0.0, yc, z0 + 0.0015)),
                  u, p, a, 0.0030, 0.0300, 0.0340, steel())
    riser = block(prefix + 'hard_bracket_riser',
                  Vector((0.0, yc, z0 + 0.0030 + 0.00435)),
                  u, p, a, 0.0087, 0.0100, 0.0260, steel())
    nodes['hard_bracket'] = join([plate, riser], prefix + 'hard_bracket')
    for tag, sgn in (('a', -1), ('b', 1)):
        nodes[f'hard_bracket_rib_{tag}'] = tri_prism(
            prefix + f'hard_bracket_rib_{tag}',
            [Vector((sgn * 0.0130, yc - 0.0050, z0 + 0.0030)),
             Vector((sgn * 0.0130, yc - 0.0050, z0 + 0.0117)),
             Vector((sgn * 0.0130, yc - 0.0150, z0 + 0.0030))],
            a, 0.0025, steel())
    base = hole - u * hoff
    nodes['hard_tongue'] = tongue(prefix + 'hard_tongue', base, u, p, a, 'T-26',
                                  steel())
    nodes['hard_tongue_bush'] = bush(prefix + 'hard_tongue_bush', hole, p,
                                     brass())
    for tag, sgn in (('a', -1), ('b', 1)):
        nodes[f'hard_antirot_pin_{tag}'] = dowel(
            prefix + f'hard_antirot_pin_{tag}', base + u * 0.002, u,
            a * (sgn * 0.013), 0.014, steel())
    for tag, (dx, dy, d, hd) in (('a', (-0.0140, -0.0080, 0.005, 0.0085)),
                                 ('b', (0.0140, -0.0080, 0.005, 0.0085)),
                                 ('c', (-0.0140, 0.0080, 0.004, 0.0070)),
                                 ('d', (0.0140, 0.0080, 0.004, 0.0070))):
        nodes[f'hard_screw_{tag}'] = screw(
            prefix + f'hard_screw_{tag}', Vector((dx, yc + dy, z0 + 0.0030)),
            u, d, hd, steel())
    # обоймы доков (усиление узлов наушников)
    for side, sgn in (('left', -1), ('right', 1)):
        cx = sgn * 0.0855
        parts = []
        for (dx, dy, sx, sy) in ((-0.0122, 0.0, 0.0026, 0.0300),
                                 (0.0122, 0.0, 0.0026, 0.0300),
                                 (0.0, -0.0130, 0.0270, 0.0026),
                                 (0.0, 0.0130, 0.0270, 0.0026)):
            parts.append(block(
                prefix + f'hard_dock_sleeve_{side}_p{len(parts)}',
                Vector((cx + dx, 0.0545 + dy, 0.0935)), u, p, a,
                0.0090, sy, sx, steel(), bev=0.0005))
        nodes[f'hard_dock_sleeve_{side}'] = join(
            parts, prefix + f'hard_dock_sleeve_{side}')
    return spec, objs, nodes, removed, absent


def build_stirrup(cid):
    spec = COMP[cid]
    prefix = cid + '__'
    objs = import_glb(cid)
    removed, absent = strip_nodes(objs, spec['hide_nodes'])
    u, p, a = basis(g2b(spec['anchor']['normal_u']),
                    g2b(spec['anchor']['pin_axis_p']))
    hole = g2b(spec['tongue']['hole_pos_m'])
    hoff = hole_offset('T-30')
    xb = -0.0410                     # передняя плоскость зажимного блока
    nodes = {}
    zc = 0.0890
    nodes['hard_base_plate'] = block(
        prefix + 'hard_base_plate', Vector((xb - 0.00125, 0.0, 0.0880)),
        u, p, a, 0.0025, 0.0200, 0.0400, steel())
    xf = xb - 0.0025
    nodes['hard_bracket'] = block(
        prefix + 'hard_bracket', Vector((xf - 0.0015, 0.0, zc)), u, p, a,
        0.0030, 0.0210, 0.0380, steel())
    xff = xf - 0.0030
    # лапа-косынка на дугу (контакт с телом стремени)
    nodes['hard_bracket_web'] = tri_prism(
        prefix + 'hard_bracket_web',
        [Vector((xff, 0.0, zc - 0.0105)), Vector((xff + 0.0180, 0.0, 0.0855)),
         Vector((xff, 0.0, zc + 0.0105))],
        a, 0.0030, steel())
    base = hole - u * hoff
    nodes['hard_tongue'] = tongue(prefix + 'hard_tongue', base, u, p, a, 'T-30',
                                  steel())
    nodes['hard_tongue_bush'] = bush(prefix + 'hard_tongue_bush', hole, p,
                                     brass())
    for tag, sgn in (('a', -1), ('b', 1)):
        nodes[f'hard_antirot_pin_{tag}'] = dowel(
            prefix + f'hard_antirot_pin_{tag}', base + u * 0.002, u,
            a * (sgn * 0.013), 0.014, steel())
    for tag, (dy, dz, d, hd) in (('a', (0.0145, 0.0960, 0.005, 0.0085)),
                                 ('b', (-0.0145, 0.0960, 0.005, 0.0085)),
                                 ('c', (0.0145, 0.0835, 0.004, 0.0070)),
                                 ('d', (-0.0145, 0.0835, 0.004, 0.0070))):
        nodes[f'hard_screw_{tag}'] = screw(
            prefix + f'hard_screw_{tag}', Vector((xff, dy, dz)), u, d, hd,
            steel())
    return spec, objs, nodes, removed, absent


def build_spreader(cid):
    spec = COMP[cid]
    prefix = cid + '__'
    objs = import_glb(cid)
    removed, absent = strip_nodes(objs, spec['hide_nodes'])
    p = g2b(spec['anchor']['pin_axis_p'])          # (0,0,1) — вертикаль
    hole_L = g2b(spec['tongue']['hole_pos_m'])
    hoff = hole_offset('T-30')
    nodes = {}
    for side, sgn in (('l', -1), ('r', 1)):
        out = Vector((-1.0 if sgn < 0 else 1.0, 0.0, 0.0))   # наружу от чашки
        u0, p0, a0 = basis(out, p)
        face = Vector((-0.4050 if sgn < 0 else 0.4050, 0.0, hole_L.z))
        hole = Vector((hole_L.x * -sgn * -1, hole_L.y, hole_L.z))
        hole = Vector((hole_L.x if sgn < 0 else -hole_L.x, hole_L.y, hole_L.z))
        base = hole - u0 * hoff
        nodes[f'hard_bracket_{side}'] = block(
            prefix + f'hard_bracket_{side}', face - u0 * 0.0015, u0, p0, a0,
            0.0030, 0.0300, 0.0400, steel())
        nodes[f'hard_tongue_{side}'] = tongue(
            prefix + f'hard_tongue_{side}', base, u0, p0, a0, 'T-30', steel())
        nodes[f'hard_tongue_bush_{side}'] = bush(
            prefix + f'hard_tongue_bush_{side}', hole, p0, brass())
        for tag, s2 in (('a', -1), ('b', 1)):
            nodes[f'hard_antirot_pin_{side}{tag}'] = dowel(
                prefix + f'hard_antirot_pin_{side}{tag}', base + u0 * 0.002,
                u0, a0 * (s2 * 0.013), 0.014, steel())
        front = face - u0 * 0.0030
        for tag, dy in ((1, 0.0145), (2, -0.0145)):
            nodes[f'hard_screw_{side}{tag}'] = screw(
                prefix + f'hard_screw_{side}{tag}',
                front + a0 * dy + p0 * 0.0080, u0, 0.005, 0.0085, steel())
        # косынка под языком
        nodes[f'hard_bracket_web_{side}'] = tri_prism(
            prefix + f'hard_bracket_web_{side}',
            [front + Vector((0, 0, -0.0030)),
             front + u0 * 0.0200 + Vector((0, 0, -0.0030)),
             front + u0 * 0.0030 + Vector((0, 0, -0.0150))],
            a0, 0.0030, steel())
        # полуоболочка чашки (CJ-SHELL-140 x2, CFRP 3 мм)
        cup = Vector((-0.3655 if sgn < 0 else 0.3655, 0.0, 0.0389))
        th0, th1 = (250.0, 400.0) if sgn < 0 else (320.0, 470.0)
        nodes[f'hard_shell_{side}'] = shell_arc(
            prefix + f'hard_shell_{side}', cup, 0.0397, 0.0427, th0, th1,
            0.0580, graphite(), steps=32)
        mid = (th0 + th1) * 0.5
        nodes[f'hard_shell_rib_{side}'] = shell_arc(
            prefix + f'hard_shell_rib_{side}', cup, 0.0412, 0.0447,
            mid - 8.0, mid + 8.0, 0.0480, graphite(), steps=10)
    return spec, objs, nodes, removed, absent


def build_quick_release(cid):
    """Модуль становится телом замка CJ-LATCH-30: корпус по housing, вилка
    (основание + две стойки + верхняя щека) с зевом под язык T-26, палец
    Ø12, собачка с осью Ø6 и пружиной, рычаг сброса с красной накладкой и
    защитной скобой, антипроворот 2 x Ø5."""
    spec = COMP[cid]
    prefix = cid + '__'
    objs = import_glb(cid)
    removed, absent = strip_nodes(objs, spec['hide_nodes'])
    u, p, a = basis(g2b(spec['anchor']['normal_u']),
                    g2b(spec['anchor']['pin_axis_p']))
    hole = g2b(spec['tongue']['hole_pos_m'])
    hoff = hole_offset('T-26')
    nodes = {}
    # корпус вокруг housing (гнездо socket_in остаётся открытым сверху и с +Y/-Y)
    nodes['hard_body'] = block(prefix + 'hard_body',
                               Vector((-0.0055, 0.0, 0.0106)), u, p, a,
                               0.0170, 0.0212, 0.0310, steel(), bev=0.0012)
    # нижняя щека = усиленное основание вилки, продолжается под гнездом
    low = block(prefix + 'hard_body_cheek_b',
                Vector((0.03125, 0.0, 0.00225)), u, p, a,
                0.0225, 0.0045, 0.0250, steel(), bev=0.0008)
    rails = []
    for i, sgn in enumerate((-1, 1)):
        rails.append(block(prefix + f'hard_body_foot_{i}',
                           Vector((0.01150, sgn * 0.01455, 0.00275)),
                           u, p, a, 0.0170, 0.0055, 0.0030, steel(),
                           bev=0.0004))
    nodes['hard_body_cheek_b'] = join([low] + rails, prefix + 'hard_body_cheek_b')
    # верхняя щека + две задние стойки вилки (зев открыт вперёд)
    upper = block(prefix + 'hard_body_cheek_a',
                  Vector((0.03325, 0.0, 0.01810)), u, p, a,
                  0.0185, 0.0056, 0.0250, steel(), bev=0.0008)
    posts = []
    for i, sgn in enumerate((-1, 1)):
        posts.append(block(prefix + f'hard_body_post_{i}',
                           Vector((0.02575, sgn * 0.01515, 0.01265)),
                           u, p, a, 0.0035, 0.0167, 0.0034, steel(),
                           bev=0.0005))
    nodes['hard_body_cheek_a'] = join([upper] + posts, prefix + 'hard_body_cheek_a')
    pin_c = Vector((0.0340, 0.0, 0.0))
    nodes['hard_pin'] = cyl(prefix + 'hard_pin',
                            pin_c + Vector((0, 0, 0.0002)),
                            pin_c + Vector((0, 0, 0.0208)), 0.0060, steel(),
                            verts=28)
    cyl(prefix + 'hard_pin_head', pin_c + Vector((0, 0, 0.0208)),
        pin_c + Vector((0, 0, 0.0240)), 0.0085, steel(), verts=28)
    cyl(prefix + 'hard_pin_groove', pin_c + Vector((0, 0, 0.0170)),
        pin_c + Vector((0, 0, 0.0186)), 0.0052, graphite(), verts=28)
    # собачка на оси Ø6 сверху верхней щеки
    pawl = block(prefix + 'hard_paw_arm', Vector((0.0345, 0.0, 0.0227)),
                 u, p, a, 0.0150, 0.0038, 0.0120, steel())
    nose = block(prefix + 'hard_paw_nose', Vector((0.0340, 0.0, 0.0216)),
                 u, p, a, 0.0050, 0.0050, 0.0090, steel(), bev=0.0005)
    nodes['hard_paw'] = join([pawl, nose], prefix + 'hard_paw')
    nodes['hard_paw_axle'] = cyl(
        prefix + 'hard_paw_axle', Vector((0.0290, -0.0105, 0.0227)),
        Vector((0.0290, 0.0105, 0.0227)), 0.0030, steel(), verts=18)
    pts, turns, seg = [], 4, 10
    for i in range(turns * seg + 1):
        t = i / (turns * seg)
        ang = t * turns * 2 * math.pi
        pts.append(Vector((0.0415 + 0.0035 * math.cos(ang),
                           -0.0045 + 0.0090 * t,
                           0.0240 + 0.0035 * math.sin(ang))))
    spring = [cyl(prefix + f'hard_paw_spring_p{i}', pts[i], pts[i + 1],
                  0.0009, steel(), verts=8) for i in range(len(pts) - 1)]
    nodes['hard_paw_spring'] = join(spring, prefix + 'hard_paw_spring')
    # рычаг сброса (штатные 70 мм не влезают в габарит 60x46x40 -> 29 мм)
    arm = block(prefix + 'hard_lever_arm', Vector((0.0150, 0.0, 0.0230)),
                u, p, a, 0.0290, 0.0042, 0.0130, steel())
    pad = block(prefix + 'hard_lever_pad', Vector((0.0062, 0.0, 0.0261)),
                u, p, a, 0.0112, 0.0030, 0.0164, red(), bev=0.0006)
    nodes['hard_lever'] = join([arm, pad], prefix + 'hard_lever')
    guard = []
    for i, dx in enumerate((0.0012, 0.0112)):
        guard.append(block(prefix + f'hard_lever_guard_p{i}',
                           Vector((dx, 0.0, 0.0282)), u, p, a,
                           0.0016, 0.0042, 0.0196, graphite(), bev=0.0004))
    guard.append(block(prefix + 'hard_lever_guard_bar',
                       Vector((0.0062, 0.0, 0.0303)), u, p, a,
                       0.0116, 0.0020, 0.0200, graphite(), bev=0.0004))
    nodes['hard_lever_guard'] = join(guard, prefix + 'hard_lever_guard')
    base = hole - u * hoff
    nodes['hard_tongue'] = tongue(prefix + 'hard_tongue', base, u, p, a, 'T-26',
                                  steel())
    nodes['hard_tongue_bush'] = bush(prefix + 'hard_tongue_bush', hole, p,
                                     brass())
    for tag, sgn in (('a', -1), ('b', 1)):
        nodes[f'hard_antirot_pin_{tag}'] = dowel(
            prefix + f'hard_antirot_pin_{tag}', Vector((0.0292, 0.0, 0.0118)),
            u, a * (sgn * 0.0155), 0.011, steel())
    for tag, dy in (('a', 0.0100), ('b', -0.0100)):
        nodes[f'hard_screw_{tag}'] = screw(
            prefix + f'hard_screw_{tag}', Vector((-0.0140, dy, 0.0106)), -u,
            0.004, 0.0070, steel())
    return spec, objs, nodes, removed, absent


BUILDERS = {
    'restraint_neck_yoke': build_neck_yoke,
    'restraint_head_frame': build_head_frame,
    'restraint_stirrup': build_stirrup,
    'restraint_spreader': build_spreader,
    'restraint_quick_release': build_quick_release,
}

DIRS = {
    'restraint_stirrup': dict(tq=(-1.05, -0.72, 0.50), fr=(-1.0, 0.12, 0.30),
                              sd=(0.06, 1.0, 0.16), cu=(-0.55, -0.80, 0.42)),
    'restraint_spreader': dict(tq=(-1.0, -0.78, 0.55), fr=(-1.0, 0.10, 0.28),
                               sd=(0.04, 1.0, 0.14), cu=(-0.62, -0.74, 0.40)),
    'restraint_neck_yoke': dict(tq=(1.02, -0.76, 0.55), fr=(1.0, 0.08, 0.26),
                                sd=(0.05, 1.0, 0.14), cu=(0.58, -0.78, 0.42)),
    'restraint_head_frame': dict(tq=(0.95, -0.78, 0.62), fr=(0.10, -1.0, 0.34),
                                 sd=(1.0, 0.05, 0.22), cu=(0.48, -0.82, 0.55)),
    'restraint_quick_release': dict(tq=(1.02, -0.78, 0.48), fr=(1.0, 0.10, 0.24),
                                    sd=(0.04, 1.0, 0.22), cu=(0.80, -0.62, 0.38)),
}


def views_for(cid, body_objs, nodes):
    objs = list(body_objs.values()) + list(nodes.values())
    mn, mx = bbox_world(objs)
    ctr = (mn + mx) * 0.5
    corners = [Vector((x, y, z)) - ctr for x in (mn.x, mx.x)
               for y in (mn.y, mx.y) for z in (mn.z, mx.z)]
    hmn, hmx = bbox_world(list(nodes.values()))
    tgt = (hmn + hmx) * 0.5
    cc = [Vector((x, y, z)) - tgt for x in (hmn.x, hmx.x)
          for y in (hmn.y, hmx.y) for z in (hmn.z, hmx.z)]
    d = DIRS[cid]
    return [
        ('3q', Vector(d['tq']), ctr, 68, corners, 0.90),
        ('front', Vector(d['fr']), ctr, 68, corners, 0.90),
        ('side', Vector(d['sd']), ctr, 68, corners, 0.90),
        ('closeup', Vector(d['cu']), tgt, 82, cc, 0.92),
    ]


# --- проверка и выгрузка --------------------------------------------------
def check_and_export(cid, spec, body_objs, nodes, removed, absent, views):
    prefix = cid + '__'
    hard = list(nodes.values())
    for o in hard:
        if not o.name.startswith(prefix + 'hard_'):
            raise RuntimeError(f'bad hard node name {o.name}')
    body = list(body_objs.values())
    mn, mx = bbox_world(body + hard)
    mn0, mx0 = bbox_world(body)
    size, size0 = mx - mn, mx0 - mn0
    size_g = [size.x, size.z, size.y]

    bvh_body = bvh_of(body)
    bvh_hard = {o.name: bvh_of([o]) for o in hard}
    gap_body, attach, contact = {}, {}, {}
    for o in hard:
        gap_body[o.name] = gap_to(bvh_body, o)
        overlaps_body = bool(bvh_body.overlap(bvh_hard[o.name]))
        attach[o.name] = overlaps_body or gap_body[o.name] <= 0.0008
    # замыкание: деталь крепится, только если цепляется за тело или за уже
    # прикреплённую деталь (иначе цепочка висящих деталей считалась бы нормой)
    changed = True
    while changed:
        changed = False
        for o in hard:
            if attach[o.name]:
                continue
            for q in hard:
                if q is o or not attach[q.name]:
                    continue
                if (bvh_hard[o.name].overlap(bvh_hard[q.name])
                        or gap_to(bvh_hard[q.name], o) <= 0.0008):
                    attach[o.name] = True
                    changed = True
                    break
    for o in hard:
        contact[o.name.split('__')[-1]] = {
            'gap_body_mm': round(gap_body[o.name] * 1000, 2),
            'attached': attach[o.name],
        }

    cls = spec['tongue']['class'].split(' ')[0]
    t = TONGUES[cls]
    hole = g2b(spec['tongue']['hole_pos_m'])
    tongues = [o for n, o in nodes.items() if 'tongue' in n and 'bush' not in n]
    t_mn, t_mx = bbox_world(tongues)
    pins = [o for o in hard if 'antirot' in o.name]
    spacing = None
    if len(pins) >= 2:
        cs = [(bbox_world([o])[0] + bbox_world([o])[1]) * 0.5 for o in pins]
        spacing = round(min((x - y).length for i, x in enumerate(cs)
                            for y in cs[i + 1:]) * 1000, 1)

    env_new = sorted(spec['envelope_new'])
    got = sorted(size)
    d_new = [round((g - e) * 1000, 1) for g, e in zip(got, env_new)]
    om = ORIG_BBOX.get(cid)
    growth = ([round((g - o) * 1000, 1)
               for g, o in zip(got, sorted(om[1] - om[0]))]
              if om else [0.0, 0.0, 0.0])

    rep = {
        'component': cid,
        'code': spec['code'],
        'variant': 'hard',
        'standard': 'CJ-LATCH-30',
        'nodes': len(body) + len(hard),
        'nodes_source': len(body) + len(removed),
        'added_nodes': sorted(nodes),
        'added_nodes_missing_vs_spec': sorted(
            set(spec['add_nodes']) - set(nodes)),
        'added_nodes_extra_vs_spec': sorted(
            set(nodes) - set(spec['add_nodes'])),
        'removed_nodes': sorted(removed),
        'hide_nodes_absent_in_source': absent,
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_source': [round(v, 5) for v in size0],
        'bbox_size_gltf': [round(v, 5) for v in size_g],
        'spec': 'docs/plans/checks/restraint-hard-mount-spec.json',
        'format': 'cj-restraint-hard/1',
        'load_n': spec['load_n'],
        'envelope_new': spec['envelope_new'],
        'envelope_old': spec['envelope_old'],
        'envelope_fits': bool(all(g <= e + 1e-4 for g, e in
                                  zip(sorted(size_g),
                                      sorted(spec['envelope_new'])))),
        'envelope_new_spec': spec['envelope_new'],
        'envelope_old_spec': spec['envelope_old'],
        'envelope_delta_mm_sorted': d_new,
        'envelope_delta_max_mm': round(max(abs(d) for d in d_new), 1),
        'growth_vs_source_mm_sorted': growth,
        'bbox_ok': bool(all(-1.5 <= g <= 40.0 for g in growth)),
        'floor_ok': bool(-0.0008 <= mn.z <= 0.0008),
        'tongue': {
            'class': cls, 'w_mm': t['w_mm'], 't_mm': t['t_mm'],
            'l_mm': t['l_mm'], 'hole_d_mm': 12.2,
            'hole_pos_spec': spec['tongue']['hole_pos_m'],
            'hole_pos_used': [round(v, 5) for v in hole],
            'tongue_bbox_mm': [round(v * 1000, 1) for v in (t_mx - t_mn)],
            'bush': 'Ø16/Ø12,2 x 6,2 бронза, гнездо Ø16 в языке',
        },
        'antirot_pins': len(pins),
        'antirot_spacing_mm': spacing,
        'antirot_spacing_spec_mm': 26.0,
        'contact': contact,
        'contact_ok': bool(all(v['attached'] for v in contact.values())),
        'material_count': len({m.name for o in body + hard
                               for m in o.data.materials if m}),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if o.type == 'MESH' and not o.name.startswith(prefix)),
    }

    for o in body + hard:
        o['component'] = cid
        o['variant'] = 'hard'
    bpy.ops.object.select_all(action='DESELECT')
    for o in body + hard:
        o.select_set(True)
    bpy.context.view_layer.objects.active = hard[0]
    path = OUT / f'{cid}_hard.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False)
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    names, _ = glb_nodes(path)
    short = {n.split('__')[-1] for n in names}
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['glb_nodes'] = len(names)
    rep['glb_hidden_present'] = sorted(set(removed) & short)
    rep['glb_added_missing'] = sorted(set(nodes) - short)
    rep['glb_prefix_ok'] = all(n.startswith(prefix) for n in names)
    rep['glb_ok'] = bool(not rep['glb_hidden_present']
                         and not rep['glb_added_missing']
                         and rep['glb_prefix_ok'])

    # кольцевые узлы мягкого варианта не должны переживать hard-сборку
    residual = sorted(n for n in short if n.startswith('dring'))
    rep['residual_ring_nodes'] = residual
    rep['checks'] = {
        'dring_nodes_removed': not residual,
        'no_ring_node_in_export': not residual,
        'all_add_nodes_present': not rep['glb_added_missing'],
        'hidden_dring_not_visible': not rep['glb_hidden_present'],
        'all_hard_parts_attached': rep['contact_ok'],
    }
    # точка latch_out каталога = центр отверстия языка в glTF-координатах
    bushes = [o for n, o in nodes.items() if 'tongue_bush' in n]
    if bushes:
        cs = []
        for o in bushes:
            bmn, bmx = bbox_world([o])
            c = (bmn + bmx) * 0.5
            cs.append(Vector((c.x, c.z, -c.y)))       # blender -> glTF
        hole_gltf = max(cs, key=lambda v: v.x)
        want = Vector(spec['mate_added']['position_m'])
        rep['latch_out'] = {
            'position_gltf': [round(v, 5) for v in hole_gltf],
            'spec_gltf': spec['mate_added']['position_m'],
            'delta_mm': round((hole_gltf - want).length * 1000, 2),
            'within_0_5_mm': (hole_gltf - want).length <= 0.0005,
            'node': 'hard_tongue_bush (центр отверстия Ø12,2)',
        }

    rep['renders'] = render_views(cid, body + hard, views)
    (LIB / f'{cid}_hard' / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('CHECK ' + json.dumps({k: rep[k] for k in (
        'component', 'nodes', 'bbox_size_gltf', 'envelope_delta_mm_sorted',
        'growth_vs_source_mm_sorted',
        'bbox_ok', 'floor_ok', 'contact_ok', 'glb_ok', 'antirot_spacing_mm',
        'added_nodes_missing_vs_spec')}, ensure_ascii=False), flush=True)
    return rep


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only = None
    for i, a in enumerate(argv):
        if a == '--cids':
            only = argv[i + 1].split(',')
    results = []
    for cid in BUILDERS:
        if only and cid not in only:
            continue
        print(f'=== BUILD {cid}', flush=True)
        reset()
        spec, objs, nodes, removed, absent = BUILDERS[cid](cid)
        rep = check_and_export(cid, spec, objs, nodes, removed, absent,
                               views_for(cid, objs, nodes))
        results.append(rep)
    (LIB / '_hard_batch_b.json').write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    bad = [r['component'] for r in results
           if not (r['bbox_ok'] and r['floor_ok'] and r['contact_ok']
                   and r['glb_ok'])]
    print('BATCH ' + json.dumps({'built': [r['component'] for r in results],
                                 'failed': bad}, ensure_ascii=False),
          flush=True)


main()
