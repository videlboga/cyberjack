"""Shared helpers for the hard-mount restraint variants (batch A).

Conventions
-----------
All hard geometry is authored in **glTF/three.js space (Y-up)**, exactly as
`docs/plans/checks/restraint-hard-mount-spec.json` gives it, then rotated by
Rx(+90 deg) at the end of the build so it lands on the imported GLB
(b = (gx, -gz, gy)).

The original soft part is imported from the existing GLB (never rebuilt), the
`hide_nodes` of the spec are *deleted* (not just hidden), and the hard parts are
added with the `<cid>__hard_*` names from `add_nodes`.

Only used by build_restraint_hard_batch_a.py.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
COMP = PROJECT / 'public/models/machine-modules/components'
LIB = PROJECT / 'docs/plans/blockout/component-library'

PALETTE = {
    'hardsteel': (0.700, 0.712, 0.722),
    'cfrp': (0.062, 0.066, 0.074),
    'bronze': (0.720, 0.530, 0.300),
    'black': (0.130, 0.135, 0.145),
    'red': (0.620, 0.055, 0.060),
}
_MATS = {}


# ---------------------------------------------------------------- materials --
def mat(role):
    if role in _MATS:
        return _MATS[role]
    existing = bpy.data.materials.get(f'CJ_{role}_100')
    if existing is not None:
        _MATS[role] = existing
        return existing
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    metal, rough = {
        'hardsteel': (1.0, 0.24),
        'cfrp': (0.0, 0.30),
        'bronze': (1.0, 0.38),
        'black': (0.9, 0.40),
        'red': (0.0, 0.48),
    }[role]
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*color, 1.0)
    _MATS[role] = m
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


def bevel(obj, width=0.0008, segments=2, angle=35.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


# -------------------------------------------------------------- primitives --
def cube(name, center, size, role, r=0.0006, smooth=False):
    """Axis-aligned box in glTF space; `center`/`size` are (x, y, z) tuples."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, verts=24, r2=None, smooth=True, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-7:
        raise ValueError(name)
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius,
                                            depth=d.length,
                                            location=(a + b) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius,
                                        radius2=r2, depth=d.length,
                                        location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def tube(name, center, axis, r_out, r_in, length, role, verts=28):
    """Hollow cylinder (bushing) along `axis`."""
    axis = Vector(axis).normalized()
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r_out,
                                        depth=length,
                                        location=Vector(center) + axis * (length * 0.5))
    outer = bpy.context.object
    outer.name = name
    outer.rotation_euler = axis.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r_in,
                                        depth=length * 1.6,
                                        location=Vector(center) + axis * (length * 0.5))
    inner = bpy.context.object
    inner.rotation_euler = axis.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    select_only(outer)
    mod = outer.modifiers.new('bore', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = inner
    mod.solver = 'EXACT'
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(inner, do_unlink=True)
    bevel(outer, 0.0004, 2)
    return apply(outer, role, True)


def frame_matrix(o, u, w, p):
    m = Matrix.Identity(4)
    for i in range(3):
        m[i][0] = u[i]
        m[i][1] = w[i]
        m[i][2] = p[i]
    m.translation = Vector(o)
    return m


def framed_bar(name, o, u, w, p, size, role, r=0.0006):
    """Box in the local frame: size = (along u, along w, along p), origin at o."""
    L, W, T = size
    o, u, w, p = Vector(o), Vector(u).normalized(), Vector(w).normalized(), Vector(p).normalized()
    verts = []
    for du in (0.0, L):
        for dw in (-W * 0.5, W * 0.5):
            for dp in (-T * 0.5, T * 0.5):
                verts.append(o + u * du + w * dw + p * dp)
    faces = [(0, 1, 3, 2), (6, 7, 5, 4), (0, 2, 6, 4), (1, 5, 7, 3),
             (0, 4, 5, 1), (2, 3, 7, 6)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    if r > 0:
        bevel(obj, r)
    return apply(obj, role)


def arc_shell(name, center, r_in, r_out, a0_deg, a1_deg, z0, z1, role,
              nseg=None, smooth=True):
    """Sector of a tube: radial r_in..r_out, angular a0..a1 (deg, glTF XY
    plane from +X), axial z0..z1."""
    cx, cy = center
    span = math.radians(a1_deg - a0_deg)
    if nseg is None:
        nseg = max(6, int(abs(span) / math.radians(4.0)) + 1)
    rings = []
    for i in range(nseg + 1):
        a = math.radians(a0_deg) + span * i / nseg
        ca, sa = math.cos(a), math.sin(a)
        rings.append([
            (cx + r_in * ca, cy + r_in * sa, z0),
            (cx + r_out * ca, cy + r_out * sa, z0),
            (cx + r_out * ca, cy + r_out * sa, z1),
            (cx + r_in * ca, cy + r_in * sa, z1),
        ])
    verts = [v for ring in rings for v in ring]
    faces = []
    for i in range(nseg):
        b = i * 4
        c = (i + 1) * 4
        for k in range(4):
            k2 = (k + 1) % 4
            faces.append((b + k, b + k2, c + k2, c + k))
    faces.append((0, 1, 2, 3))
    last = nseg * 4
    faces.append((last + 3, last + 2, last + 1, last + 0))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return apply(obj, role, smooth)


def oval_shell(name, center, a_in, b_in, a_out, b_out, th0_deg, th1_deg,
               y0, y1, role, steps=44, smooth=True):
    """Sector of an elliptical ring standing in the XZ plane, extruded along Y.

    `center` = (cx, cz); theta is measured from +X toward +Z. Used for the
    thigh clamp, whose cheeks are elliptical cylinders (a=0.062, b=0.0445).
    """
    cx, cz = center
    span = math.radians(th1_deg - th0_deg)
    rings = []
    for i in range(steps + 1):
        th = math.radians(th0_deg) + span * i / steps
        ct, st = math.cos(th), math.sin(th)
        rings.append([
            (cx + a_in * ct, y0, cz + b_in * st),
            (cx + a_out * ct, y0, cz + b_out * st),
            (cx + a_out * ct, y1, cz + b_out * st),
            (cx + a_in * ct, y1, cz + b_in * st),
        ])
    verts = [v for ring in rings for v in ring]
    faces = []
    for i in range(steps):
        b = i * 4
        c = (i + 1) * 4
        for k in range(4):
            k2 = (k + 1) % 4
            faces.append((b + k, b + k2, c + k2, c + k))
    faces.append((0, 1, 2, 3))
    last = steps * 4
    faces.append((last + 3, last + 2, last + 1, last + 0))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return apply(obj, role, smooth)


def tri_prism(name, pts, axis, thick, role, bev=0.0006):
    """Gusset: three points extruded +-thick/2 along `axis`."""
    axis = Vector(axis).normalized()
    half = axis * thick * 0.5
    lo = [Vector(p) - half for p in pts]
    hi = [Vector(p) + half for p in pts]
    verts = lo + hi
    faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role)


def subtract(obj, cutter):
    select_only(obj)
    mod = obj.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    mod.solver = 'EXACT'
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return obj


def join(names, new_name):
    objs = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
    if not objs:
        raise ValueError(new_name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = new_name
    return obj


def bolt(name, seat, axis, d=0.005, head_d=0.0092, head_h=0.0032,
         shank=0.007, role='black', nut=None):
    """Socket-head cap screw. `seat` is the bearing surface, `axis` the drive
    direction: the head grows backwards from `seat`, the shank goes along +axis.
    `nut` = length of a hex nut to add at the shank's end."""
    axis = Vector(axis).normalized()
    seat = Vector(seat)
    head = cyl(name, seat - axis * head_h, seat, head_d * 0.5, role, verts=20)
    end = seat + axis * shank
    shank_obj = cyl(name + '_shank', seat, end, d * 0.5, role, verts=16)
    parts = [head.name, shank_obj.name]
    if nut:
        nut_obj = cyl(name + '_nut', end, end + axis * nut, head_d * 0.62, role,
                      verts=6)
        parts.append(nut_obj.name)
    return join(parts, name)


# ------------------------------------------------------------ part import ---
def tongue(name, base, u, w, p, width, thick, length, hole_u, role='hardsteel'):
    """Tongue CJ-LATCH-30/44: round nose (r = width/2) centred on the hole.

    base = middle of the root face, u = out of the fixture, w = across,
    p = pin axis (the plate's thickness). The hole is bored Ø16 for the bush.
    """
    base, u, w, p = (Vector(base), Vector(u).normalized(),
                     Vector(w).normalized(), Vector(p).normalized())
    r = width * 0.5
    l_eff = min(length, hole_u + r)
    phi_max = math.asin(max(-1.0, min(1.0, (l_eff - hole_u) / r)))
    n = 22
    right, left = [], []
    for i in range(n + 1):
        phi = phi_max * i / n
        right.append((hole_u + r * math.sin(phi), r * math.cos(phi)))
        left.append((hole_u + r * math.sin(phi), -r * math.cos(phi)))
    loop = [(0.0, -r), (0.0, r)] + right + list(reversed(left))
    verts = []
    for s, aa in loop:
        verts.append(tuple(base + u * s + w * aa - p * (thick * 0.5)))
    for s, aa in loop:
        verts.append(tuple(base + u * s + w * aa + p * (thick * 0.5)))
    nl = len(loop)
    faces = [tuple(range(nl - 1, -1, -1)), tuple(range(nl, 2 * nl))]
    for i in range(nl):
        j = (i + 1) % nl
        faces.append((i, j, nl + j, nl + i))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    apply(obj, role)
    hole = base + u * hole_u
    cutter = cyl('cut_bore', hole - p * (thick * 2), hole + p * (thick * 2),
                 0.0080, 'black', verts=28)
    subtract(obj, cutter)
    bevel(obj, 0.0005, 2)
    return obj, hole


def add_tongue(cid, tag, base, u, w, p, width, thick, length, hole_u,
               bush_len=0.0062, bush_node=True, pin_names=('a', 'b')):
    """Tongue + bronze bush + 2 anti-rotation pins; returns the hole centre.

    `bush_node=False` joins the bush into the tongue (specs that do not list a
    separate bush node); `pin_names` sets the suffix of the two pin nodes.
    """
    prefix = f'{cid}__hard_tongue' + (f'_{tag}' if tag else '')
    base = Vector(base)
    u, w, p = Vector(u).normalized(), Vector(w).normalized(), Vector(p).normalized()
    body, hole = tongue(prefix, base, u, w, p, width, thick, length, hole_u)
    bush = tube(f'{prefix}_bush', hole - p * (bush_len * 0.5), p, 0.0080, 0.0061,
                bush_len, 'bronze')
    if not bush_node:
        join([body.name, bush.name], prefix)
    for idx, name in zip((0, 1), pin_names):
        c = base + u * (hole_u * 0.45) + w * (0.013 * (1 if idx == 0 else -1))
        cyl(f'{cid}__hard_antirot_pin_{name}', c - p * 0.0045, c + p * 0.0045,
            0.0025, 'hardsteel', verts=14)
    return hole


# ------------------------------------------------------- contact checking ---
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
    return BVHTree.FromPolygons(verts, polys, all_triangles=False) if polys else None


def gap_to(bvh, obj, samples=260):
    """Smallest distance from any vertex of `obj` to the BVH surface (m)."""
    if bvh is None:
        return 1.0
    mw = obj.matrix_world
    verts = obj.data.vertices
    if not verts:
        return 1.0
    step = max(1, len(verts) // samples)
    best = 1e9
    for i in range(0, len(verts), step):
        hit = bvh.find_nearest(mw @ verts[i].co)
        if hit and hit[3] is not None:
            best = min(best, hit[3])
    return best


def contact_map(hard_objs, body_objs, tol=0.0008):
    """Per hard node: gap to the soft body and 'attached' closure.

    A part counts as attached only if it touches the body or a part that is
    already attached (so a chain of floating parts is not read as contact).
    """
    bvh_body = bvh_of(body_objs)
    bvh_hard = {o.name: bvh_of([o]) for o in hard_objs}
    gap_body = {o.name: gap_to(bvh_body, o) for o in hard_objs}
    touch_body = {o.name: (bvh_body is not None
                           and bool(bvh_body.overlap(bvh_hard[o.name])))
                  for o in hard_objs}
    attach = {o.name: (touch_body[o.name] or gap_body[o.name] <= tol)
              for o in hard_objs}
    hard_gap = {o.name: {} for o in hard_objs}
    for o in hard_objs:
        for q in hard_objs:
            if q is o:
                continue
            ov = bool(bvh_hard[o.name].overlap(bvh_hard[q.name]))
            g = 0.0 if ov else gap_to(bvh_hard[q.name], o, samples=120)
            hard_gap[o.name][q.name] = g
    changed = True
    while changed:
        changed = False
        for o in hard_objs:
            if attach[o.name]:
                continue
            for q, g in hard_gap[o.name].items():
                if attach[q] and g <= tol:
                    attach[o.name] = True
                    changed = True
                    break
    out = {}
    for o in hard_objs:
        nearest = min(hard_gap[o.name].items(), key=lambda kv: kv[1],
                      default=(None, 1e9))
        out[o.name.split('__')[-1]] = {
            'gap_body_mm': round(gap_body[o.name] * 1000.0, 2),
            'overlaps_body': touch_body[o.name],
            'nearest_hard': (nearest[0].split('__')[-1] if nearest[0] else None),
            'nearest_hard_mm': round(nearest[1] * 1000.0, 2),
            'attached': bool(attach[o.name]),
        }
    return out


# ------------------------------------------------------------ part import ---
def import_soft(cid):
    path = COMP / f'{cid}.glb'
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    return path


def drop_nodes(cid, names):
    removed, absent = [], []
    for short in names:
        name = f'{cid}__{short}'
        obj = bpy.data.objects.get(name)
        if obj is None:
            absent.append(short)
            continue
        bpy.data.objects.remove(obj, do_unlink=True)
        removed.append(short)
    return removed, absent


def hide_nodes(cid, names):
    """Soft-hide (used for decals that the new shell covers); not exported."""
    out = []
    for short in names:
        obj = bpy.data.objects.get(f'{cid}__{short}')
        if obj is None:
            continue
        obj.hide_render = True
        obj.hide_viewport = True
        out.append(short)
    return out


# ------------------------------------------------------------------- frame --
GL_TO_BL = Matrix.Rotation(math.radians(90.0), 4, 'X')
BL_TO_GL = Matrix.Rotation(math.radians(-90.0), 4, 'X')


def to_blender_space(names):
    """Rotate authored (glTF-space) objects onto the imported GLB.

    Uses matrix_world so primitives created with a non-zero object origin
    (cyl/cube/bolt) rotate about the component origin, not about themselves.
    """
    sel = []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != 'MESH':
            continue
        obj.matrix_world = GL_TO_BL @ obj.matrix_world
        sel.append(obj)
    if not sel:
        return
    bpy.ops.object.select_all(action='DESELECT')
    for obj in sel:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def bbox_blender(objs=None, skip=('Plane',)):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in (objs or bpy.context.scene.objects):
        if o.type != 'MESH' or o.name in skip:
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def bl_to_gl_vec(v):
    return Vector((v.x, v.z, -v.y))


# ------------------------------------------------------------------ export --
def export_glb(path):
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
    return path


# ------------------------------------------------------------------ render --
def scene_setup(floor_z=-0.0016, bg=(0.955, 0.950, 0.938), with_floor=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bgn = sc.world.node_tree.nodes['Background']
    bgn.inputs['Color'].default_value = (*bg, 1)
    bgn.inputs['Strength'].default_value = 0.55

    if not with_floor:
        return sc

    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, floor_z))
    floor = bpy.context.object
    floor.name = 'Plane'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.845, 0.835, 0.815, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.15, 1.5), 2.6),
        ('fill', (-1.2, -0.75, 0.55), 0.9),
        ('rim', (0.15, 1.15, 0.95), 1.4),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()
    return sc


def shot(name, path, direction, target, ortho_scale=None, dist=None, lens=85,
         res=(1100, 900), width=None):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    cam = bpy.data.objects.get('cam')
    if cam is None:
        cd = bpy.data.cameras.new('cam')
        cam = bpy.data.objects.new('cam', cd)
        sc.collection.objects.link(cam)
    sc.camera = cam
    d = Vector(direction).normalized()
    if ortho_scale:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho_scale
        cam.location = Vector(target) + d * 1.5
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        if width is not None:
            dist = width * lens / 36.0
        cam.location = Vector(target) + d * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print('RENDER', path, flush=True)
    return Path(path)


# -------------------------------------------------------------- inspection --
def glb_nodes(path):
    import struct
    data = Path(path).read_bytes()
    ln = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + ln])
    return [n.get('name') for n in j['nodes']]


def glb_bbox(path):
    """bbox in glTF space, from the exported file (vertices + node translation)."""
    import struct
    data = Path(path).read_bytes()
    ln = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + ln])
    off = 20 + ln
    blen = struct.unpack('<I', data[off:off + 4])[0]
    buf = data[off + 8:off + 8 + blen]
    mn = [1e9] * 3
    mx = [-1e9] * 3
    for n in j['nodes']:
        if 'mesh' not in n:
            continue
        t = n.get('translation') or (0.0, 0.0, 0.0)
        for pr in j['meshes'][n['mesh']]['primitives']:
            acc = j['accessors'][pr['attributes']['POSITION']]
            for i in range(3):
                mn[i] = min(mn[i], acc['min'][i] + t[i])
                mx[i] = max(mx[i], acc['max'][i] + t[i])
    return mn, mx
