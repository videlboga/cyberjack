"""Standalone builder: work_air_jet (WRK-AIR-05, «Воздушная форсунка»).

Компактное механическое сопло на быстросъёме: короткий шланг с разъёмом,
быстросъёмный хомут, корпус из ivory/steel, маленький регулятор давления
с рисками и циановой меткой, латунное седло, силиконовый наконечник 0,8/1,2 мм
и полупрозрачный циановый конус потока у сопла.

Не зависит от build_component_library.py, ничего не читает из других
builder-скриптов — helpers продублированы намеренно.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_air_jet.py

Выход:
  public/models/machine-modules/components/work_air_jet.glb

Геометрия (Blender Z-up, метры):
  ось потока  = X (сопло смотрит в +X), линия y=0, z=Z0
  anim-пустышка = (TIP_X, 0, Z0) — срез сопла; вокруг него пульсирует поток
  дети anim: flow_cone, flow_core (полупрозрачные оболочки, alpha 0.13/0.21)
  статичны:  hose, hose_ferrule, hose_connector, qd_collar, qd_sleeve,
             qd_release, body, body_ring_rear, body_ring_front, seat,
             seat_nut, tip, tip_bore, tip_collar, reg_stem, reg_knob,
             reg_knurl, reg_ticks, reg_mark, clamp_band, clamp_ear,
             clamp_pin, clamp_lever, clamp_screw, led, led_bezel
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
CID = 'work_air_jet'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.0200                  # высота оси потока
BODY_R = 0.0112

X_HOSE_END = -0.0482         # задняя грань разъёма шланга
X_BODY0, X_BODY1 = -0.0218, 0.0118
X_SEAT0, X_SEAT1 = 0.0118, 0.0168
X_NUT0, X_NUT1 = 0.0168, 0.0204
X_TIP0, X_TIP1 = 0.0204, 0.0295
TIP_X = 0.0295               # срез сопла = центр anim-пустышки
X_FLOW1 = 0.0505             # конец конуса потока
X_FLOW_CORE1 = 0.0442

REG_X = -0.0065              # ось регулятора давления
PALETTE = {
    'ivory': (0.958, 0.950, 0.932),
    'steel': (0.720, 0.724, 0.716),
    'graphite': (0.300, 0.312, 0.330),
    'dark': (0.170, 0.178, 0.196),
    'brass': (0.760, 0.590, 0.235),
    'silicone': (0.972, 0.968, 0.958),
    'cyan': (0.330, 0.850, 0.900),
    'flow': (0.430, 0.870, 0.940),
    'flow_core': (0.620, 0.930, 0.965),
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
    rough = {'brass': 0.34, 'steel': 0.46, 'graphite': 0.58, 'dark': 0.55,
             'silicone': 0.86, 'ivory': 0.66, 'cyan': 0.40,
             'flow': 0.30, 'flow_core': 0.26}[role]
    metal = {'brass': 0.92, 'steel': 0.78, 'graphite': 0.25, 'dark': 0.30,
             'silicone': 0.0, 'ivory': 0.0, 'cyan': 0.0,
             'flow': 0.0, 'flow_core': 0.0}[role]
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    alpha = 1.0
    if role in ('flow', 'flow_core'):
        alpha = 0.13 if role == 'flow' else 0.21
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['IOR'].default_value = 1.0
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.22
        # полупрозрачность, но не «стеклянная деталь»
        m.blend_method = 'BLEND'
        m.surface_render_method = 'BLENDED'
        m.use_transparent_shadow = True
        m.show_transparent_back = True
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.2
    if role == 'silicone':
        bsdf.inputs['Base Color'].default_value = (*PALETTE['silicone'], 1.0)
    m.diffuse_color = (*color, alpha)
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


def cone_shell(name, a, b, r1, r2, role, segs=32, rings=4, flare=1.35):
    """Открытая оболочка конуса (без торцевых крышек) — читается как поток,
    а не как твёрдая стеклянная деталь."""
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bm = bmesh.new()
    loops = []
    for k in range(rings + 1):
        t = k / rings
        r = r1 + (r2 - r1) * (t ** flare)
        z = -d.length * 0.5 + d.length * t
        loop = [bm.verts.new(m @ Vector((math.cos(math.tau * i / segs) * r,
                                         math.sin(math.tau * i / segs) * r, z)))
                for i in range(segs)]
        loops.append(loop)
    for k in range(rings):
        p, q = loops[k], loops[k + 1]
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((p[i], p[j], q[j], q[i]))
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
    e.empty_display_size = 0.008
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


# --- сборка --------------------------------------------------------------
def build():
    reset()
    statics = []
    fx = []
    A = Vector((0.0, 0.0, Z0))

    # ---- задний узел: шланг с изгибом, латунная юбка, разъём --------------
    statics.append(curve_tube(
        PREFIX + 'hose',
        [(-0.0300, 0.0, Z0), (-0.0330, 0.0, Z0 - 0.0014),
         (-0.0372, 0.0, Z0 - 0.0048), (-0.0406, 0.0, Z0 - 0.0074)],
        0.0036, 'graphite'))
    statics.append(cyl(PREFIX + 'hose_ferrule', (-0.0424, 0, Z0 - 0.0084),
                       (-0.0396, 0, Z0 - 0.0074), 0.0050, 'brass',
                       vertices=20, bev=0.0008))
    statics.append(cube(PREFIX + 'hose_connector', (-0.0446, 0.0, Z0 - 0.0088),
                         (0.0086, 0.0105, 0.0090), 'graphite', r=0.0016))

    # ---- быстросъём: цанга + отжимная юбка + флажок ---------------------
    statics.append(cyl(PREFIX + 'qd_collar', (-0.0316, 0, Z0), (-0.0216, 0, Z0),
                       0.0104, 'steel', vertices=36, bev=0.0009))
    statics.append(cyl(PREFIX + 'qd_sleeve', (-0.0272, 0, Z0), (-0.0216, 0, Z0),
                       0.0111, 'steel', vertices=24, smooth=False))
    statics.append(cube(PREFIX + 'qd_release', (-0.0288, 0.0102, Z0),
                         (0.0072, 0.0060, 0.0038), 'graphite', r=0.0012,
                         rot=(0, 0, math.radians(-8))))

    # ---- корпус ---------------------------------------------------------
    statics.append(cyl(PREFIX + 'body', (X_BODY0, 0, Z0), (X_BODY1, 0, Z0),
                       BODY_R, 'ivory', vertices=12, smooth=False, bev=0.0014))
    statics.append(cyl(PREFIX + 'body_ring_rear', (-0.0206, 0, Z0), (-0.0186, 0, Z0),
                       0.0118, 'steel', vertices=36, bev=0.0006))
    statics.append(cyl(PREFIX + 'body_ring_front', (0.0082, 0, Z0), (0.0102, 0, Z0),
                       0.0118, 'steel', vertices=36, bev=0.0006))

    # ---- регулятор давления (сверху): гайка, рифлёный воротник, шкала ---
    statics.append(cyl(PREFIX + 'reg_base', (REG_X, 0, Z0 + 0.0086),
                       (REG_X, 0, Z0 + 0.0118), 0.0062, 'steel',
                       vertices=6, smooth=False, bev=0.0006))
    statics.append(cyl(PREFIX + 'reg_stem', (REG_X, 0, Z0 + 0.0118),
                       (REG_X, 0, Z0 + 0.0140), 0.0046, 'steel',
                       vertices=20, bev=0.0004))
    statics.append(cyl(PREFIX + 'reg_knob', (REG_X, 0, Z0 + 0.0140),
                       (REG_X, 0, Z0 + 0.0246), 0.0078, 'graphite',
                       vertices=24, smooth=False, bev=0.0008))
    statics.append(torus(PREFIX + 'reg_knurl', (REG_X, 0, Z0 + 0.0168),
                         0.0079, 0.0008, 'steel', 'Z', segs=32, rings=8))
    # риски по торцу + циановая метка-указатель давления
    bm = bmesh.new()
    for i in range(10):
        a = math.radians(-90.0 + i * 36.0)
        p = Vector((REG_X + math.cos(a) * 0.0054,
                    math.sin(a) * 0.0054,
                    Z0 + 0.0250))
        mtx = (Matrix.Translation(p)
               @ Matrix.Rotation(a, 4, 'Z')
               @ Matrix.Diagonal((0.0017, 0.0006, 0.0006, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=mtx)
    me = bpy.data.meshes.new(PREFIX + 'reg_ticks')
    bm.to_mesh(me)
    bm.free()
    ticks = bpy.data.objects.new(PREFIX + 'reg_ticks', me)
    bpy.context.scene.collection.objects.link(ticks)
    statics.append(apply(ticks, 'ivory', False))
    statics.append(cube(PREFIX + 'reg_mark', (REG_X, 0.0037, Z0 + 0.0251),
                         (0.0010, 0.0042, 0.0007), 'cyan', r=0.0002))

    # ---- сопло: латунное седло, стальная гайка, силикон ---------------
    statics.append(cyl(PREFIX + 'seat', (X_SEAT0, 0, Z0), (X_SEAT1, 0, Z0),
                       0.0074, 'brass', vertices=32, r2=0.0054, bev=0.0007))
    statics.append(cyl(PREFIX + 'seat_nut', (X_NUT0, 0, Z0), (X_NUT1, 0, Z0),
                       0.0064, 'steel', vertices=6, smooth=False, bev=0.0007))
    statics.append(cyl(PREFIX + 'tip', (X_TIP0, 0, Z0), (0.0268, 0, Z0),
                       0.0050, 'silicone', vertices=28, r2=0.0037))
    statics.append(cyl(PREFIX + 'tip_barrel', (0.0268, 0, Z0), (TIP_X, 0, Z0),
                       0.0037, 'silicone', vertices=28, bev=0.0005))
    statics.append(torus(PREFIX + 'tip_collar', (X_TIP0 + 0.0009, 0, Z0),
                         0.0049, 0.0006, 'dark', 'X', segs=28, rings=8))
    # отверстие 0,8/1,2 мм: тёмный торец с маленьким зевом
    statics.append(cyl(PREFIX + 'tip_bore', (TIP_X - 0.0006, 0, Z0),
                       (TIP_X + 0.0002, 0, Z0), 0.0013, 'dark', vertices=20))

    # ---- хомут быстросъёма снизу корпуса --------------------------------
    statics.append(cyl(PREFIX + 'clamp_band', (-0.0170, 0, Z0), (-0.0128, 0, Z0),
                       0.0119, 'steel', vertices=36, bev=0.0006))
    statics.append(cube(PREFIX + 'clamp_ear', (-0.0149, 0.0, Z0 - 0.0124),
                         (0.0062, 0.0128, 0.0060), 'graphite', r=0.0012))
    statics.append(cyl(PREFIX + 'clamp_pin', (-0.0149, -0.0072, Z0 - 0.0124),
                       (-0.0149, 0.0072, Z0 - 0.0124), 0.0017, 'steel',
                       vertices=14))
    statics.append(cube(PREFIX + 'clamp_lever', (-0.0196, 0.0, Z0 - 0.0136),
                         (0.0130, 0.0076, 0.0048), 'dark', r=0.0012,
                         rot=(0, math.radians(-22), 0)))
    statics.append(cyl(PREFIX + 'clamp_screw', (-0.0149, 0.0, Z0 - 0.0168),
                       (-0.0149, 0.0, Z0 - 0.0092), 0.0026, 'steel',
                       vertices=12, bev=0.0004))

    # ---- LED состояния ---------------------------------------------------
    statics.append(cyl(PREFIX + 'led_bezel', (-0.0133, -0.0088, Z0 + 0.0040),
                       (-0.0133, -0.0118, Z0 + 0.0040), 0.0032, 'steel',
                       vertices=20, bev=0.0004))
    statics.append(sphere(PREFIX + 'led', (-0.0133, -0.0112, Z0 + 0.0040),
                          0.0023, 'cyan', segs=18, rings=10))

    # ---- поток: полупрозрачные конусы, дети anim ------------------------
    fx.append(cone_shell(PREFIX + 'flow_cone', (TIP_X, 0, Z0), (X_FLOW1, 0, Z0),
                         0.0036, 0.0092, 'flow', segs=36, rings=5, flare=1.45))
    fx.append(cone_shell(PREFIX + 'flow_core', (TIP_X, 0, Z0), (X_FLOW_CORE1, 0, Z0),
                         0.0019, 0.0048, 'flow_core', segs=28, rings=3, flare=1.15))

    # ---- пустышка анимации в срезе сопла --------------------------------
    anim = empty(PREFIX + 'anim', (TIP_X, 0.0, Z0))
    bpy.context.view_layer.update()      # matrix_world детей до parent()
    for o in fx:
        parent(o, anim)
        o['fx'] = True
        o['static'] = False
    for o in statics:
        o['fx'] = False
        o['static'] = True
    anim['motion'] = 'pulse_x'
    anim['motion_hint'] = 'scale X 1.15, speed 2.0'

    bpy.context.view_layer.update()
    return anim, fx, statics


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


def check(anim, fx, statics):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    # scale-тест: bbox конуса потока до/после scale X 1.15 вокруг сопла
    cone = bpy.data.objects[PREFIX + 'flow_cone']
    c0_mn, c0_mx = mesh_bbox([cone])
    anim.scale = (1.15, 1.0, 1.0)
    bpy.context.view_layer.update()
    c1_mn, c1_mx = mesh_bbox([cone])
    anim.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()

    kids = sorted(o.name for o in anim.children)
    static_names = sorted(o.name for o in bpy.data.objects
                          if o.name.startswith(PREFIX) and o.type == 'MESH'
                          and o.name not in kids)

    report = {
        'component': CID,
        'objects': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'nodes_mesh': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 1) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.1000 and size.y <= 0.0600 and size.z <= 0.0600),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': kids,
        'anim_children_ok': bool(kids == sorted([PREFIX + 'flow_cone',
                                                 PREFIX + 'flow_core'])),
        'statics': static_names,
        'statics_count': len(static_names),
        'flow_cone_bbox_before': [[round(v, 5) for v in c0_mn],
                                  [round(v, 5) for v in c0_mx]],
        'flow_cone_bbox_after': [[round(v, 5) for v in c1_mn],
                                 [round(v, 5) for v in c1_mx]],
        'flow_cone_len_before': round((c0_mx - c0_mn).x, 5),
        'flow_cone_len_after': round((c1_mx - c1_mn).x, 5),
        'pivot_at_tip_ok': bool(abs(c1_mn.x - c0_mn.x) < 1e-5
                                and abs(c1_mx.x - c0_mx.x) > 0.002),
        'materials': sorted(m.name for m in bpy.data.materials),
        'alpha_materials': sorted(
            m.name for m in bpy.data.materials
            if m.node_tree and m.node_tree.nodes.get('Principled BSDF')
            and m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value < 0.999),
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
    if not path.is_file() or path.stat().st_size < 10 * 1024:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, fx, statics = build()
    rep = check(anim, fx, statics)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or not rep['anim_children_ok'] or not rep['pivot_at_tip_ok']:
        raise SystemExit('checks failed')


main()
