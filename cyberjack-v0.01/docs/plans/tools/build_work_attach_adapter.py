"""Standalone builder: work_attach_adapter (WRK-ATT-12, «Переходник»).

Короткий ступенчатый переходник Ø20–30 × 40 мм, ось X, лежит на полу.
Два разных посадочных диаметра (Ø20 сзади, Ø25 спереди), буртик Ø30,
шестигранник под ключ 24 мм в середине, два силиконовых уплотнительных
кольца в проточках, два разрезных быстросъёмных кольца (цangи) с лепестками
на концах, сквозной внутренний канал Ø8.4, циановая метка размера и
установочный штифт. Плиты нет, всё статично (motion: none).

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_adapter.py

Выход:
  public/models/machine-modules/components/work_attach_adapter.glb

Геометрия (Blender Z-up, метры):
  ось          = X, линия y=0, z=Z0
  X = -0.020 (задний торец, посадка Ø20) … +0.020 (передний торец, посадка Ø25)
  все меши статичны, anim-пустышки нет
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
CID = 'work_attach_adapter'
PREFIX = CID + '__'

MM = 0.001

# --- ключевые размеры ----------------------------------------------------
X_REAR = -0.0200          # задний торец (посадка Ø20)
X_FRONT = 0.0200          # передний торец (посадка Ø25) -> длина 40 мм
Z0 = 0.0152               # ось над полом (буртик Ø30 лежит на полу)
SEG = 72                  # сегментов вращения

R_BORE = 4.2 * MM         # сквозной канал Ø8.4
R_REAR_SEAT = 10.0 * MM   # посадка Ø20
R_FRONT_SEAT = 12.5 * MM  # посадка Ø25
R_MID = 11.0 * MM         # тело под шестигранником Ø22
R_FLANGE = 15.0 * MM      # буртик Ø30
HEX_AF = 24.0 * MM        # шестигранник под ключ 24 мм
HEX_X0, HEX_X1 = -5.5 * MM, 1.0 * MM

PALETTE = {
    'steel': (0.780, 0.790, 0.785),
    'chrome': (0.880, 0.895, 0.905),
    'graphite': (0.300, 0.312, 0.330),
    'blush': (0.880, 0.590, 0.610),
    'cyan': (0.290, 0.720, 0.820),
    'dark': (0.140, 0.150, 0.170),
}
PBR = {
    'steel': dict(metallic=0.90, rough=0.28),
    'chrome': dict(metallic=1.00, rough=0.14),
    'graphite': dict(metallic=0.55, rough=0.42),
    'blush': dict(metallic=0.00, rough=0.55),
    'cyan': dict(metallic=0.00, rough=0.35),
    'dark': dict(metallic=0.30, rough=0.62),
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
    p = PBR[role]
    bsdf.inputs['Metallic'].default_value = p['metallic']
    bsdf.inputs['Roughness'].default_value = p['rough']
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.28
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
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0004, rot=(0, 0, 0), smooth=False):
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
    obj.data.name = name
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def torus(name, loc, major, minor, role, axis='X', segs=56, rings=14):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def revolve_closed(name, prof, role, bore_role, segments=SEG, cz=Z0):
    """Тело вращения вокруг оси X по замкнутому профилю [(x, r), ...].

    Первая точка — на стенке канала у заднего торца, дальше наружный контур
    вперёд, затем точка на стенке канала у переднего торца; замыкание
    последней точки на первую даёт внутреннюю стенку сквозного канала
    (получает материал bore_role).
    """
    bm = bmesh.new()
    rings = []
    for x, r in prof:
        ring = []
        for i in range(segments):
            a = math.tau * i / segments
            ring.append(bm.verts.new((x, math.sin(a) * r, cz + math.cos(a) * r)))
        rings.append(ring)

    n = len(rings)
    for k in range(n):
        a_, b_ = rings[k], rings[(k + 1) % n]
        is_bore = (k == n - 1)          # замыкающая перемычка = стенка канала
        for i in range(segments):
            j = (i + 1) % segments
            f = bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
            f.material_index = 1 if is_bore else 0

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat(role))
    obj.data.materials.append(mat(bore_role))
    select_only(obj)
    bpy.ops.object.shade_smooth()
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32))
    except Exception:
        pass
    return obj


CANG_GAP = 34.0


def cang_ring(name, xc, major, minor, gap_deg, role_ring, cz=Z0,
              seg=56, tube=12):
    """Разрезное быстросъёмное кольцо (цangа), разрез со стороны -Y."""
    bm = bmesh.new()
    gap = math.radians(gap_deg)
    a0 = -math.pi / 4 + gap * 0.5      # разрез в верхне-ближнем квадранте
    a1 = a0 + math.tau - gap

    rings = []
    for k in range(seg + 1):
        a = a0 + (a1 - a0) * k / seg
        radial = Vector((0.0, math.sin(a), math.cos(a)))
        tangent = Vector((0.0, math.cos(a), -math.sin(a)))
        center = Vector((xc, 0.0, cz)) + radial * major
        ring = []
        for t in range(tube):
            b = math.tau * t / tube
            p = center + radial * (minor * math.cos(b)) + Vector((1.0, 0, 0)) * (minor * math.sin(b))
            ring.append(bm.verts.new(p))
        rings.append(ring)

    for k in range(seg):
        a_, b_ = rings[k], rings[k + 1]
        for i in range(tube):
            j = (i + 1) % tube
            bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat(role_ring))
    select_only(obj)
    bpy.ops.object.shade_smooth()
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
    except Exception:
        pass
    return obj


def cang_tab(name, xc, major, angle, role, cz=Z0, length=2.8 * MM,
             thick=1.5 * MM, height=2.6 * MM):
    """Лепесток-упор на конце разреза кольца."""
    radial = Vector((0.0, math.sin(angle), math.cos(angle)))
    center = Vector((xc, 0.0, cz)) + radial * (major + height * 0.5 - 0.9 * MM)
    return cube(name, center, (length, thick, height), role, r=0.00035,
                rot=(-angle, 0.0, 0.0))


def text_mesh(name, body, size, loc, role, extrude=0.00018):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    if not obj.data.materials:
        obj.data.materials.append(mat(role))
    return obj


def max_z(obj):
    bpy.context.view_layer.update()
    return max((obj.matrix_world @ v.co).z for v in obj.data.vertices)


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # профиль корпуса, мм -> м; наружный контур + стенка канала
    prof_mm = [
        (-20.0, 4.20),          # стенка канала, задний торец
        (-20.0, 9.40),          # задний торец
        (-19.40, 10.00),        # фаска входа в посадку Ø20
        (-19.00, 10.00),
        (-18.90, 9.10),         # проточка под цангу
        (-16.70, 9.10),
        (-16.60, 10.00),
        (-15.60, 10.00),
        (-15.50, 9.00),         # проточка под уплотнение
        (-13.90, 9.00),
        (-13.80, 10.00),
        (-12.60, 10.00),
        (-11.40, 11.00),        # ступенчатый переход на Ø22
        (-11.40, 11.00),
        (1.40, 11.00),
        (1.90, 11.30),
        (2.00, 14.40),          # буртик Ø30
        (2.60, 15.00),
        (6.40, 15.00),
        (7.00, 14.40),
        (7.00, 12.50),          # плечо буртика -> посадка Ø25
        (9.20, 12.50),
        (9.40, 11.60),          # проточка под цангу
        (11.80, 11.60),
        (12.00, 12.50),
        (13.60, 12.50),
        (13.80, 11.50),         # проточка под уплотнение
        (15.40, 11.50),
        (15.60, 12.50),
        (18.70, 12.50),
        (19.40, 12.40),
        (20.00, 11.85),         # фаска переднего торца
        (20.00, 4.20),          # стенка канала, передний торец
    ]
    prof = [(x * MM, r * MM) for (x, r) in prof_mm]
    body = revolve_closed(PREFIX + 'body', prof, 'steel', 'dark')
    body['role'] = 'adapter_body'

    # шестигранник под ключ 24 мм, плоская грань вверх
    r_hex = HEX_AF / math.sqrt(3.0)
    hex_nut = cyl(PREFIX + 'hex_nut', (HEX_X0, 0, Z0), (HEX_X1, 0, Z0), r_hex,
                  'graphite', vertices=6, smooth=False, bev=0.00035)
    best = None
    for deg in (0.0, 30.0):
        hex_nut.rotation_euler = (math.radians(deg), 0, 0)
        z = max_z(hex_nut)
        if best is None or z < best[1] - 1e-7:
            best = (deg, z)
    hex_nut.rotation_euler = (math.radians(best[0]), 0, 0)
    select_only(hex_nut)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.context.view_layer.update()
    hex_top = max_z(hex_nut)

    # два уплотнительных кольца в проточках (силикон, выступают над посадкой)
    torus(PREFIX + 'oring_rear', (-0.01470, 0, Z0), 9.55 * MM, 0.85 * MM,
          'blush', 'X')
    torus(PREFIX + 'oring_front', (0.01460, 0, Z0), 12.05 * MM, 0.85 * MM,
          'blush', 'X')

    # быстросъёмные разрезные кольца с лепестками, с двух сторон
    R_CANG_REAR, R_CANG_FRONT = 9.55 * MM, 12.05 * MM
    X_CANG_REAR, X_CANG_FRONT = -0.01780, 0.01060
    cang_ring(PREFIX + 'cang_rear', X_CANG_REAR, R_CANG_REAR, 0.95 * MM,
              CANG_GAP, 'graphite')
    cang_ring(PREFIX + 'cang_front', X_CANG_FRONT, R_CANG_FRONT, 0.95 * MM,
              CANG_GAP, 'graphite')
    gap = math.radians(CANG_GAP)
    for tag, xc, rmaj in (('rear', X_CANG_REAR, R_CANG_REAR),
                          ('front', X_CANG_FRONT, R_CANG_FRONT)):
        cang_tab(PREFIX + f'cang_{tag}_tab', xc, rmaj,
                 -math.pi / 4 + gap * 0.5, 'dark')

    # метка размера: циановая полоса на теле + гравировка "25" на грани
    band = cyl(PREFIX + 'size_band', (-0.01110, 0, Z0), (-0.00990, 0, Z0),
               11.15 * MM, 'cyan', vertices=48, bev=0.00025)
    band['role'] = 'size_mark'
    # гравировка типоразмера на переднем торце (читается в осевом виде)
    ext = 0.00015
    mark = text_mesh(PREFIX + 'size_mark', '25', 4.20 * MM,
                     (0.02002 - ext, 0.0, Z0 + 7.80 * MM), 'cyan',
                     extrude=ext)
    mark.rotation_euler = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_euler()
    select_only(mark)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.context.view_layer.update()
    hex_top = max_z(hex_nut)

    # установочный штифт на плече буртика
    pin_r = 13.60 * MM
    cyl(PREFIX + 'index_pin', (0.00700, 0.0, Z0 + pin_r),
        (0.00920, 0.0, Z0 + pin_r), 0.80 * MM, 'graphite',
        vertices=20, bev=0.0002)

    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH':
            o['static'] = True
    bpy.context.view_layer.update()
    return body


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
    center = (mn + mx) * 0.5

    body = bpy.data.objects[PREFIX + 'body']
    b_mn, b_mx = mesh_bbox([body])
    dia_rear = 2 * R_REAR_SEAT
    dia_front = 2 * R_FRONT_SEAT

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_nodes': len(all_mesh),
        'object_names': sorted(o.name for o in bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 2) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(0.0395 <= size.x <= 0.0405
                        and size.y <= 0.0302 and size.z <= 0.0302),
        'body_bbox_size_mm': [round(v * 1000, 2) for v in (b_mx - b_mn)],
        'length_mm': round((b_mx - b_mn).x * 1000, 2),
        'seat_diameters_mm': [round(dia_rear * 1000, 1),
                              round(dia_front * 1000, 1)],
        'flange_diameter_mm': round(2 * R_FLANGE * 1000, 1),
        'hex_across_flats_mm': round(HEX_AF * 1000, 1),
        'bore_diameter_mm': round(2 * R_BORE * 1000, 1),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'polys': sum(len(o.data.polygons) for o in all_mesh),
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
    if not path.is_file() or path.stat().st_size < 10240:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or rep['bad_names'] or rep['material_count'] < 4:
        raise SystemExit('checks failed')


main()
