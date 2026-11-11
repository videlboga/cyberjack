"""Standalone builder: work_tickle_firm (WRK-TIC-02, «Жёсткая щётка»).

Компактная быстросъёмная щёточная кассета с плотным жёстким барабаном
на горизонтальной оси X. Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_tickle_firm.py

Выход:
  public/models/machine-modules/components/work_tickle_firm.glb

Геометрия (Blender Z-up, метры):
  ось барабана  = X, линия y=0, z=Z0
  anim-пустышка  = (0, 0, Z0) — центр оси барабана
  вращаются: drum, bristles, bristle_tips, shaft, washer_rear,
             washer_front, end_cap
  статичны:  motor, motor_cap, cap_ring, strain_relief, cable, connector,
             clamp_band, clamp_tab, clamp_bracket, guard, guard_spine,
             bearing_boss, yoke, led, stiffness_marks
"""
from pathlib import Path
import json
import math
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
CID = 'work_tickle_firm'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.045                 # высота оси барабана
DRUM_X0, DRUM_X1 = -0.0525, 0.0525   # длина барабана 0.105
DRUM_R = 0.0275
BRISTLE_R0 = 0.0245        # основание утоплено в тело барабана
BRISTLE_LEN = 0.0095       # 6.5 мм выступает над барабаном
BRISTLE_RB = 0.0026
BRISTLE_RT = 0.0017
TIP_R0 = 0.0332
TIP_R1 = 0.0346
TIP_RB = 0.0018
TIP_RT = 0.0014
ROWS = 12                  # колец по длине, со сдвигом -> плотное поле
PER_ROW = 24

MOTOR_X0, MOTOR_X1 = -0.0760, -0.0585   # корпус мотора
MOTOR_R = 0.0300
GUARD_X0, GUARD_X1 = -0.0540, 0.0560
GUARD_RI, GUARD_RO = 0.0392, 0.0426
# дуга: от -30° (перед-верх) через верх к +145° (зад-низ);
# открыта спереди-снизу — со стороны контакта щетины
GUARD_A0, GUARD_A1 = math.radians(-30.0), math.radians(145.0)

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.204, 0.212, 0.231),
    'blush': (0.910, 0.725, 0.749),
    'pale': (0.949, 0.843, 0.851),
    'cyan': (0.750, 0.900, 0.920),
    'red': (0.720, 0.070, 0.060),
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
    bsdf.inputs['Roughness'].default_value = 0.62
    bsdf.inputs['Metallic'].default_value = 0.28 if role in ('steel', 'graphite') else 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.45
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
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
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
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


def arc_shell(name, x0, x1, r_in, r_out, a0, a1, seg, role, cy=0.0, cz=Z0):
    """Тонкий кожух-сектор: дуга от +Z в сторону +Y, открыт снизу."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        dy, dz = math.sin(a), math.cos(a)
        ring = []
        for x in (x0, x1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((x, cy + dy * r, cz + dz * r)))
        rings.append(ring)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))   # inner
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))   # outer
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))   # x0 cap
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))   # x1 cap
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def bmesh_cone(bm, base, direction, length, r1, r2, segments=8):
    d = Vector(direction).normalized()
    m = (Matrix.Translation(Vector(base) + d * (length * 0.5))
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=length, matrix=m)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []
    C = Vector((0.0, 0.0, Z0))

    # ---- вращающийся барабан -------------------------------------------
    drum = cyl(PREFIX + 'drum', (DRUM_X0, 0, Z0), (DRUM_X1, 0, Z0), DRUM_R,
               'graphite', vertices=48, bev=0.0025)
    band_a = cyl(PREFIX + 'drum_band_rear', (-0.0490, 0, Z0), (-0.0420, 0, Z0),
                 0.0288, 'blush', vertices=44, bev=0.0018)
    band_b = cyl(PREFIX + 'drum_band_front', (0.0420, 0, Z0), (0.0490, 0, Z0),
                 0.0288, 'blush', vertices=44, bev=0.0018)
    rotating += [drum, band_a, band_b]

    # плотная жёсткая щетина: 8 колец по 22 пучка со сдвигом (176 пучков)
    bm = bmesh.new()
    tip_bm = bmesh.new()
    span = 0.80 * (DRUM_X1 - DRUM_X0)
    row_x = [-span * 0.5 + i * span / (ROWS - 1) for i in range(ROWS)]
    for ri, x in enumerate(row_x):
        phase = (math.tau / PER_ROW) * (0.5 if ri % 2 else 0.0)
        for k in range(PER_ROW):
            d = radial(phase + k * math.tau / PER_ROW)
            base = C + Vector((x, 0, 0)) + d * BRISTLE_R0
            bmesh_cone(bm, base, d, BRISTLE_LEN, BRISTLE_RB, BRISTLE_RT, 6)
            tip_base = C + Vector((x, 0, 0)) + d * TIP_R0
            bmesh_cone(tip_bm, tip_base, d, TIP_R1 - TIP_R0, TIP_RB, TIP_RT, 6)
    bristles = mesh_from_bm(PREFIX + 'bristles', bm, 'pale')
    tips = mesh_from_bm(PREFIX + 'bristle_tips', tip_bm, 'graphite')
    rotating += [bristles, tips]

    # вал по оси барабана
    shaft = cyl(PREFIX + 'shaft', (-0.0745, 0, Z0), (0.0660, 0, Z0), 0.0055,
                'steel', vertices=20)
    rotating.append(shaft)

    # концевые шайбы + концевая гайка
    washer_rear = cyl(PREFIX + 'washer_rear', (-0.0565, 0, Z0), (DRUM_X0, 0, Z0),
                       0.0285, 'steel', vertices=40, bev=0.0012)
    washer_front = cyl(PREFIX + 'washer_front', (DRUM_X1, 0, Z0), (0.0565, 0, Z0),
                        0.0285, 'steel', vertices=40, bev=0.0012)
    end_cap = cyl(PREFIX + 'end_cap', (0.0565, 0, Z0), (0.0610, 0, Z0),
                  0.0125, 'graphite', vertices=24, bev=0.0012)
    rotating += [washer_rear, washer_front, end_cap]

    # ---- моторный корпус (статичен) ------------------------------------
    cyl(PREFIX + 'motor', (MOTOR_X0, 0, Z0), (MOTOR_X1, 0, Z0), MOTOR_R,
        'blush', vertices=48, bev=0.0040)
    cyl(PREFIX + 'motor_cap', (-0.0805, 0, Z0), (MOTOR_X0, 0, Z0), 0.0285,
        'graphite', vertices=40, bev=0.0025)
    torus(PREFIX + 'cap_ring', (-0.0762, 0, Z0), 0.0287, 0.0016, 'graphite', 'X')
    cyl(PREFIX + 'strain_relief', (-0.0840, 0.014, Z0 + 0.001),
        (-0.0805, 0.014, Z0 + 0.001), 0.0072, 'graphite', vertices=20, bev=0.0012)

    # кабель: назад-вниз, короткий хвост с разъёмом
    curve_tube(PREFIX + 'cable',
               [(-0.0838, 0.014, Z0 + 0.001),
                (-0.0843, 0.020, Z0 - 0.012),
                (-0.0815, 0.027, Z0 - 0.023),
                (-0.0745, 0.0285, Z0 - 0.027)], 0.0034, 'graphite')
    cube(PREFIX + 'connector', (-0.0695, 0.0285, Z0 - 0.0275),
         (0.011, 0.008, 0.0075), 'graphite', r=0.0018)

    # ---- быстросъёмный хомут на шве кассеты ----------------------------
    cyl(PREFIX + 'clamp_band', (-0.0625, 0, Z0), (-0.0565, 0, Z0), 0.0315,
        'steel', vertices=48, bev=0.0018)
    cube(PREFIX + 'clamp_tab', (-0.0595, 0.0, Z0 + 0.0315),
         (0.0075, 0.021, 0.0085), 'steel', r=0.0015)
    cyl(PREFIX + 'clamp_screw', (-0.0595, 0.0, Z0 + 0.0290),
        (-0.0595, 0.0, Z0 + 0.0378), 0.0032, 'graphite', vertices=14)

    # ---- кожух (статичен, открыт снизу со стороны контакта) ------------
    arc_shell(PREFIX + 'guard', GUARD_X0, GUARD_X1, GUARD_RI, GUARD_RO,
              GUARD_A0, GUARD_A1, 28, 'ivory')
    for tag, a in (('front', GUARD_A0), ('rear', GUARD_A1)):
        r_mid = (GUARD_RI + GUARD_RO) * 0.5
        d = radial(a)
        cyl(PREFIX + f'guard_lip_{tag}',
            (GUARD_X0, d.y * r_mid, Z0 + d.z * r_mid),
            (GUARD_X1, d.y * r_mid, Z0 + d.z * r_mid),
            (GUARD_RO - GUARD_RI) * 0.5 + 0.0008, 'ivory', vertices=14)
    cube(PREFIX + 'clamp_bracket', (-0.0545, 0.0, Z0 + 0.0362),
         (0.0110, 0.0130, 0.0126), 'graphite', r=0.0016)

    # ---- стальная опора / подшипник напротив мотора --------------------
    cyl(PREFIX + 'bearing_boss', (0.0610, 0, Z0), (0.0695, 0, Z0), 0.0165,
        'graphite', vertices=28, bev=0.0018)
    cube(PREFIX + 'yoke', (0.0652, 0.0, Z0 + 0.0191),
         (0.0080, 0.0130, 0.0470), 'steel', r=0.0018)
    # передний кронштейн: связывает кожух с опорой-вилкой
    cube(PREFIX + 'guard_bracket', (0.0575, 0.0, Z0 + 0.0345),
         (0.0140, 0.0130, 0.0110), 'graphite', r=0.0015)

    # ---- маркировка, LED ----------------------------------------------
    bm = bmesh.new()
    for i in range(3):
        x = -0.0665 - i * 0.0043
        bmesh_cone(bm, (x, -0.0272, Z0 - 0.0095), (0, -1, 0), 0.0042,
                   0.0023, 0.0021, 12)
    mesh_from_bm(PREFIX + 'stiffness_marks', bm, 'graphite')
    sphere(PREFIX + 'led', (-0.0645, -0.0288, Z0 + 0.0085), 0.0032, 'cyan')

    # ---- анимационная пустышка в центре оси барабана -------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()   # иначе matrix_world ещё identity и дети съедут
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False

    bpy.context.view_layer.update()
    return anim, rotating


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


def check(anim, rotating):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    # ось: bbox-центр группы детей anim до/после поворота на 90° вокруг X
    kids = [o for o in anim.children]
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    drum = bpy.data.objects[PREFIX + 'drum']
    d_mn, d_mx = mesh_bbox([drum])
    drum_len = (d_mx - d_mn).x
    brush_r = max((mx.z - mn.z) * 0.5, 0.0001)

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.160 and size.y <= 0.120 and size.z <= 0.120),
        'drum_length': round(drum_len, 5),
        'drum_length_ok': bool(0.100 <= drum_len <= 0.120),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name for o in kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.001),
        'bristle_tufts': ROWS * PER_ROW,
        'materials': sorted(m.name for m in bpy.data.materials),
        'non_children_static': sorted(o.name for o in bpy.data.objects
                                      if o.name.startswith(PREFIX)
                                      and o.type == 'MESH' and o not in kids),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
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
    if not path.is_file() or path.stat().st_size < 20000:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or not rep['pivot_ok'] or not rep['drum_length_ok']:
        raise SystemExit('checks failed')


main()
