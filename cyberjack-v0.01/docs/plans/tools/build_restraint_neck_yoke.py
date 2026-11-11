"""Standalone builder: restraint_neck_yoke (RST-NK-05, «Шейный контур»).

Жёсткое шейное ярмо: молочная композитная U-дуга, лежащая на плечах вокруг
шеи (высокая на затылке, низкая у ключиц), с толстыми силиконовыми подушками
в утопленном ложе, регулировкой ширины на стальных ползунах, двумя
быстросъёмными замками-камами на передних концах, шарниром с фиксатором на
затылке, четырьмя стальными D-кольцами и маркировкой. Плиты-основания нет.

Не зависит от build_component_library.py / build_restraint_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_neck_yoke.py

Выход:
  public/models/machine-modules/components/restraint_neck_yoke.glb
  docs/plans/blockout/component-library/restraint_neck_yoke/*.png
  docs/plans/blockout/component-library/restraint_neck_yoke/report.json

Геометрия (Blender Z-up, метры):
  дуга лежит в плоскости XY, z=0 — нижняя плоскость (стоит на полу)
  центр эллипса дуги = (0, 0); ось шеи = Z, вход головы — со стороны +Y
  полярный угол a: 0° -> +Y (перед), 90° -> +X (правое плечо), 180° -> -Y
  дуга 42°..318° (через затылок), передний вырез 84° — горло свободно
  высота дуги 32 мм у концов -> 58 мм на затылке
  вращения нет (motion: none), анимационная пустышка не нужна.

Габарит по паспорту 0,30 x 0,25 x 0,08 м:
  X = ширина по плечам, Y = глубина (затылок -> замки), Z = высота дуги
  с D-кольцами.
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_neck_yoke'
CID = 'restraint_neck_yoke'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
A_OUT = 0.1290        # полуось эллипса дуги по X (наружная поверхность)
B_OUT = 0.1040        # полуось по Y (наружная поверхность, затылок)

H_TIP = 0.0320        # высота дуги у передних концов
H_BACK = 0.0580       # высота дуги на затылке
TH_TIP = 0.0165       # толщина дуги у концов
TH_BACK = 0.0245      # толщина дуги на затылке

A0 = math.radians(55.0)      # правый передний конец
A1 = math.radians(305.0)     # левый передний конец (через 180°)

# подушки: три сегмента в утопленном ложе (верх на 10 мм ниже короны)
PAD_HALF_T = 0.0055
PAD_SPANS = ((67.0, 132.0), (142.0, 218.0), (228.0, 293.0))
STOP_SPANS = ((56.5, 66.5), (293.5, 303.5))
PAD_TAGS = ('right', 'back', 'left')
PAD_Z0 = 0.0045

# передние концы: ползун ширины + замок-кам
STRAP_Z = 0.0175
STRAP_HALF_W = 0.0135        # высота ленты 27 мм
STRAP_T = 0.0042
STRAP_LEN = 0.0420
SLIDER_U = 0.0110
BUCKLE_U = STRAP_LEN + 0.0045
LEVER_LEN = 0.0300
LEVER_SPLAY = math.radians(13.0)

# затылочный шарнир
HINGE_OFF = 0.0090
HINGE_W = 0.0620

# D-кольца на короне плеч
DRING_ANGLES = (100.0, 260.0)
DRING_MAJOR = 0.0160
DRING_MINOR = 0.0038
DRING_LIFT = 0.0050

PALETTE = {
    'milk': (0.892, 0.878, 0.848),
    'cream': (0.962, 0.948, 0.910),
    'blush': (0.878, 0.596, 0.636),
    'graphite': (0.128, 0.134, 0.146),
    'steel': (0.620, 0.628, 0.645),
    'dark': (0.030, 0.032, 0.038),
    'red': (0.700, 0.085, 0.075),
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
        bsdf.inputs['Roughness'].default_value = 0.29
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.35
        bsdf.inputs['Roughness'].default_value = 0.42
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.74
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.44
    elif role == 'red':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.38
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.84
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


def bevel(obj, width=0.0010, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(35)
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


def ring_loop(name, center, normal, major, minor, role, segs=40, rings=10,
              scale_u=1.0, scale_v=1.0):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=center)
    obj = bpy.context.object
    obj.name = name
    q = Vector(normal).normalized().to_track_quat('Z', 'Y')
    obj.rotation_euler = q.to_euler()
    obj.scale = (scale_u, scale_v, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return apply(obj, role, True)


def rrect(ha, hb, r, seg=3):
    """Скруглённый прямоугольник в координатах (u, v), против часовой."""
    r = min(r, ha * 0.9, hb * 0.9)
    cs = [(ha - r, hb - r), (-(ha - r), hb - r),
          (-(ha - r), -(hb - r)), (ha - r, -(hb - r))]
    pts = []
    for (cx, cy), ang in zip(cs, (0, 90, 180, 270)):
        for i in range(seg + 1):
            th = math.radians(ang + 90.0 * i / seg)
            pts.append((cx + r * math.cos(th), cy + r * math.sin(th)))
    return pts


def prof(ha, hb, r, c_off, c_z, seg=3):
    return [(c_off + u, c_z + v) for (u, v) in rrect(ha, hb, r, seg)]


# --- геометрия эллиптической дуги вокруг оси Z ---------------------------
def _s(a):
    """0 у передних концов -> 1 на затылке (плавно)."""
    d = abs(math.degrees(a) - 180.0)
    x = max(0.0, min(1.0, 1.0 - d / 138.0))
    return x * x * (3.0 - 2.0 * x)


def h_of(a):
    return H_TIP + (H_BACK - H_TIP) * _s(a)


def th_of(a):
    return TH_TIP + (TH_BACK - TH_TIP) * _s(a)


def arc_pt(a, off=0.0, z=0.0):
    sa, ca = math.sin(a), math.cos(a)
    base = Vector((A_OUT * sa, B_OUT * ca, 0.0))
    n = Vector((B_OUT * sa, A_OUT * ca, 0.0)).normalized()
    return base + n * off + Vector((0.0, 0.0, z))


def arc_dirs(a):
    """T — касательная (рост a), N — наружная нормаль, обе в XY."""
    sa, ca = math.sin(a), math.cos(a)
    t = Vector((A_OUT * ca, -B_OUT * sa, 0.0)).normalized()
    n = Vector((B_OUT * sa, A_OUT * ca, 0.0)).normalized()
    return t, n


def sweep_arc(name, a0, a1, prof_fn, role, nseg=150, smooth=False):
    """Протяжка профиля (off, z) вдоль эллиптической дуги; профиль от угла."""
    bm = bmesh.new()
    rings = []
    for i in range(nseg + 1):
        a = a0 + (a1 - a0) * i / nseg
        rings.append([bm.verts.new(arc_pt(a, off, z)) for (off, z) in prof_fn(a)])
    m = len(rings[0])
    for i in range(nseg):
        r0, r1 = rings[i], rings[i + 1]
        for k in range(m):
            k2 = (k + 1) % m
            bm.faces.new((r0[k], r0[k2], r1[k2], r1[k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def rect_ring(name, center, u, v, w, su, sv, bar, thick, role, bev=0.0007):
    """Прямоугольная рамка: u,v — плоскость окна, w — ось толщины."""
    center = Vector(center)
    u, v, w = (Vector(x).normalized() for x in (u, v, w))
    bm = bmesh.new()
    lo, hi = [], []
    for sgn_w, store in ((-0.5, lo), (0.5, hi)):
        for layer in (0, 1):
            su2 = su * 0.5 if layer == 0 else su * 0.5 - bar
            sv2 = sv * 0.5 if layer == 0 else sv * 0.5 - bar
            quad = []
            for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
                p = (center + u * (sx * su2) + v * (sy * sv2)
                     + w * (sgn_w * thick))
                quad.append(bm.verts.new(p))
            store.append(quad)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[0][i], lo[0][j], lo[1][j], lo[1][i]))
        bm.faces.new((lo[0][i], hi[0][i], hi[0][j], lo[0][j]))
        bm.faces.new((lo[1][i], lo[1][j], hi[1][j], hi[1][i]))
        bm.faces.new((hi[0][i], hi[0][j], hi[1][j], hi[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, False)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


# --- профили дуги --------------------------------------------------------
def shell_prof(a):
    h, th = h_of(a), th_of(a)
    return prof(th * 0.5, h * 0.5, min(0.0060, th * 0.34), -th * 0.5, h * 0.5,
                seg=4)


def pipe_prof(a):
    h, th = h_of(a), th_of(a)
    return prof(0.0028, 0.0028, 0.0023, -th * 0.5, h - 0.0020, seg=3)


def foot_prof(a):
    th = th_of(a)
    return prof(0.0036, 0.0044, 0.0026, -th * 0.5, 0.0048, seg=3)


def rib_prof(a):
    h = h_of(a)
    return prof(0.0017, 0.0024, 0.0013, 0.0008, h * 0.56, seg=3)


def liner_prof(a):
    h, th = h_of(a), th_of(a)
    z1 = h - 0.0170
    return prof(0.0013, (z1 - 0.0030) * 0.5, 0.0010,
                -(th + 0.0011), (z1 + 0.0030) * 0.5, seg=2)


def brow_prof(a):
    """Молочная губа над подушками — подушка уходит в паз."""
    h, th = h_of(a), th_of(a)
    return prof(0.0042, 0.0032, 0.0024, -(th + 0.0042), h - 0.0124, seg=3)


def stop_prof(a):
    """Мягкий упор-ограничитель поворота: подушка, поднятая у концов."""
    h, th = h_of(a), th_of(a)
    z0, z1 = 0.0015, h + 0.0130
    return prof(0.0055, (z1 - z0) * 0.5, 0.0055, -(th + 0.0030),
                (z1 + z0) * 0.5, seg=3)


def pad_prof(a):
    h, th = h_of(a), th_of(a)
    z1 = h - 0.0148
    return prof(PAD_HALF_T, (z1 - PAD_Z0) * 0.5, 0.0056,
                -(th + PAD_HALF_T - 0.0014), (z1 + PAD_Z0) * 0.5, seg=4)


def pad_roll_prof(a):
    h, th = h_of(a), th_of(a)
    return prof(0.0020, 0.0020, 0.0016,
                -(th + 0.0024), h - 0.0174, seg=3)


# --- передний конец: ползун, лента, замок --------------------------------
def front_end(tag, a_end, sgn):
    """Концевой узел у переднего конца дуги (sgn: +1 право, -1 лево)."""
    parts = []
    t, n = arc_dirs(a_end)
    u = -t                                   # к центру выреза
    tip = arc_pt(a_end, -th_of(a_end) * 0.5, STRAP_Z)
    rot_z = math.atan2(u.y, u.x)

    # лента-продолжение дуги (молочный нейлон)
    sc = tip + u * (STRAP_LEN * 0.5 - 0.004)
    parts.append(cube(f'{PREFIX}strap_{tag}', sc,
                      (STRAP_LEN + 0.008, STRAP_T, 2 * STRAP_HALF_W), 'milk',
                      r=0.0012, rot=(0, 0, rot_z)))
    # тёмные швы по кромкам ленты — отделяют ленту от дуги
    for k, dz in (('a', STRAP_HALF_W - 0.0024), ('b', -STRAP_HALF_W + 0.0024)):
        parts.append(cube(f'{PREFIX}strap_seam_{tag}_{k}',
                          sc + n * (STRAP_T * 0.5 + 0.0002)
                          + Vector((0, 0, dz)),
                          (STRAP_LEN + 0.006, 0.0008, 0.0016), 'dark',
                          r=0.0002, rot=(0, 0, rot_z)))

    # шкала ширины на ленте (три тёмных деления)
    for i, du in enumerate((0.0150, 0.0218, 0.0286)):
        p = tip + u * du
        parts.append(cube(f'{PREFIX}width_tick_{tag}_{"abc"[i]}',
                          p + n * (STRAP_T * 0.5 + 0.0005),
                          (0.0020, 0.0010, 0.0110), 'graphite', r=0.0003,
                          rot=(0, 0, rot_z)))

    # стальной ползун ширины, обхватывающий конец дуги и ленту
    sp = tip + u * SLIDER_U
    parts.append(rect_ring(f'{PREFIX}width_slider_{tag}', sp, u, (0, 0, 1), n,
                           0.0180, 0.0310, 0.0044, 0.0064,
                           'steel', bev=0.0008))
    parts.append(cyl(f'{PREFIX}width_screw_{tag}',
                     sp + n * 0.0030, sp + n * 0.0090, 0.0021, 'steel',
                     vertices=14, bev=0.0004))
    parts.append(cyl(f'{PREFIX}width_knurl_{tag}',
                     sp + n * 0.0088, sp + n * 0.0112, 0.0032, 'graphite',
                     vertices=16, bev=0.0004))

    # рамка замка на конце ленты
    bc = tip + u * BUCKLE_U
    parts.append(rect_ring(f'{PREFIX}lock_frame_{tag}', bc, u, (0, 0, 1), n,
                           0.0290, 0.0345, 0.0050, 0.0062, 'steel',
                           bev=0.0009))
    # прижимной кулачок-валик по высоте окна
    cam = bc - u * 0.0052
    parts.append(cyl(f'{PREFIX}lock_cam_{tag}', cam + Vector((0, 0, -0.0118)),
                     cam + Vector((0, 0, 0.0118)), 0.0046, 'steel',
                     vertices=24, bev=0.0006))
    parts.append(cyl(f'{PREFIX}lock_cam_axle_{tag}',
                     cam + n * 0.0026 + Vector((0, 0, -0.0142)),
                     cam + n * 0.0026 + Vector((0, 0, 0.0142)), 0.0014,
                     'dark', vertices=10))

    # рычаг быстросъёма: пластина над окном, отведена наружу
    d = -sgn * LEVER_SPLAY
    ud = Vector((u.x * math.cos(d) - u.y * math.sin(d),
                 u.x * math.sin(d) + u.y * math.cos(d), 0.0))
    hinge = bc - u * 0.0118 + n * 0.0032
    lv = hinge + ud * (LEVER_LEN * 0.5 + 0.0015) + n * 0.0012
    parts.append(cube(f'{PREFIX}lock_lever_{tag}', lv,
                      (LEVER_LEN, 0.0042, 0.0205), 'dark', r=0.0016,
                      rot=(0, 0, math.atan2(ud.y, ud.x))))
    # красный язычок сброса на носке рычага
    parts.append(cube(f'{PREFIX}release_tab_{tag}',
                      hinge + ud * (LEVER_LEN + 0.0022) + n * 0.0016,
                      (0.0080, 0.0056, 0.0250), 'red', r=0.0016,
                      rot=(0, 0, math.atan2(ud.y, ud.x))))
    # фиксирующий штифт рычага
    parts.append(cyl(f'{PREFIX}lock_pin_{tag}',
                     hinge + n * 0.0044 + Vector((0, 0, -0.0140)),
                     hinge + n * 0.0044 + Vector((0, 0, 0.0140)), 0.0019,
                     'steel', vertices=12))

    # переднее D-кольцо-проушина за рамкой замка
    eye = bc + u * 0.0175
    parts.append(cube(f'{PREFIX}dring_front_pad_{tag}',
                      bc + u * 0.0140, (0.0095, 0.0130, 0.0165), 'graphite',
                      r=0.0018, rot=(0, 0, rot_z)))
    parts.append(ring_loop(f'{PREFIX}dring_front_{tag}', eye, n,
                           0.0108, 0.0029, 'steel', segs=36, rings=9))
    return parts


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    # ---- жёсткая композитная U-дуга ------------------------------------
    parts.append(sweep_arc(PREFIX + 'shell', A0, A1, shell_prof, 'milk',
                           nseg=180))
    # молочная окантовка короны по всей дуге
    parts.append(sweep_arc(PREFIX + 'shell_crown_pipe', A0 + 0.02, A1 - 0.02,
                           pipe_prof, 'cream', nseg=170))
    # нижняя полка-юбка: графитовая кромка опоры на плечи
    parts.append(sweep_arc(PREFIX + 'shell_foot', A0 + 0.010, A1 - 0.010,
                           foot_prof, 'graphite', nseg=170))
    # наружное ребро жёсткости по внешней стороне дуги
    parts.append(sweep_arc(PREFIX + 'shell_rib', A0 + 0.02, A1 - 0.02,
                           rib_prof, 'milk', nseg=170))
    # графитовая обкладка ложа подушек (тёмный канал между подушками)
    parts.append(sweep_arc(PREFIX + 'pad_liner', A0 + 0.012, A1 - 0.012,
                           liner_prof, 'graphite', nseg=170))
    # молочная губа, прикрывающая верхнюю кромку подушек
    parts.append(sweep_arc(PREFIX + 'pad_brow', A0 + 0.008, A1 - 0.008,
                           brow_prof, 'milk', nseg=170))

    # ---- три толстые силиконовые подушки -------------------------------
    for (d0, d1), tag in zip(PAD_SPANS, PAD_TAGS):
        parts.append(sweep_arc(f'{PREFIX}pad_{tag}',
                               math.radians(d0), math.radians(d1),
                               pad_prof, 'blush', nseg=60))
        parts.append(sweep_arc(f'{PREFIX}pad_roll_{tag}',
                               math.radians(d0 + 2.0), math.radians(d1 - 2.0),
                               pad_roll_prof, 'blush', nseg=52))
        # мягкий буртик по нижней кромке подушки
        for side, zz in (('a', PAD_Z0 + 0.0030),):
            def pz(a, zz=zz):
                th = th_of(a)
                return prof(0.0020, 0.0020, 0.0016, -(th + 0.0018), zz, seg=3)
            parts.append(sweep_arc(f'{PREFIX}pad_bead_{tag}',
                                   math.radians(d0 + 2.0), math.radians(d1 - 2.0),
                                   pz, 'blush', nseg=48))

    # ---- мягкие упоры-ограничители поворота у передних концов ---------
    for (d0, d1), tag in zip(STOP_SPANS, ('right', 'left')):
        parts.append(sweep_arc(f'{PREFIX}limiter_{tag}',
                               math.radians(d0), math.radians(d1),
                               stop_prof, 'blush', nseg=18))

    # ---- затылочный шарнир с фиксатором ---------------------------------
    a_b = math.pi
    hb_pt = arc_pt(a_b, HINGE_OFF, h_of(a_b) * 0.52)
    parts.append(cube(PREFIX + 'hinge_block', hb_pt,
                      (HINGE_W, 0.0170, 0.0270), 'graphite', r=0.0030))
    for tag, dx in (('a', -0.0225), ('b', 0.0225)):
        parts.append(cube(f'{PREFIX}hinge_ear_{tag}',
                          hb_pt + Vector((dx, -0.0016, 0.0)),
                          (0.0115, 0.0165, 0.0270), 'steel', r=0.0018))
    parts.append(cyl(PREFIX + 'hinge_pin',
                     hb_pt + Vector((0, -0.0032, -0.0170)),
                     hb_pt + Vector((0, -0.0032, 0.0175)), 0.0051, 'steel',
                     vertices=24, bev=0.0006))
    parts.append(cyl(PREFIX + 'hinge_pin_cap',
                     hb_pt + Vector((0, -0.0032, 0.0170)),
                     hb_pt + Vector((0, -0.0032, 0.0215)), 0.0066, 'steel',
                     vertices=20, bev=0.0006))
    # стяжной фиксатор шарнира: болт поперёк щёк + барашек
    parts.append(cyl(PREFIX + 'hinge_screw',
                     hb_pt + Vector((0.0045, -0.0042, 0.0)),
                     hb_pt + Vector((0.0255, -0.0042, 0.0)), 0.0034, 'steel',
                     vertices=18, bev=0.0005))
    parts.append(cyl(PREFIX + 'hinge_screw_knob',
                     hb_pt + Vector((0.0250, -0.0042, 0.0)),
                     hb_pt + Vector((0.0330, -0.0042, 0.0)), 0.0064, 'steel',
                     vertices=20, bev=0.0008))

    # ---- маркировка: плашка размера M ----------------------------------
    a_tag = math.radians(203.0)
    t_tag, n_tag = arc_dirs(a_tag)
    tag_th = math.atan2(t_tag.y, t_tag.x)
    tag_pt = arc_pt(a_tag, -th_of(a_tag) * 0.5, h_of(a_tag) - 0.0002)
    parts.append(cube(PREFIX + 'size_tag', tag_pt + Vector((0, 0, 0.0010)),
                      (0.0240, 0.0180, 0.0022), 'cream', r=0.0014,
                      rot=(0, 0, tag_th)))
    parts.append(cube(PREFIX + 'size_mark', tag_pt + Vector((0, 0, 0.0024)),
                      (0.0120, 0.0038, 0.0011), 'dark', r=0.0004,
                      rot=(0, 0, tag_th)))
    for tag, dv in (('a', 0.0062), ('b', -0.0062)):
        parts.append(cube(f'{PREFIX}size_tick_{tag}',
                          tag_pt + Vector((-t_tag.y, t_tag.x, 0)) * dv
                          + Vector((0, 0, 0.0024)),
                          (0.0086, 0.0020, 0.0011), 'dark', r=0.0004,
                          rot=(0, 0, tag_th)))
    # сервисные насечки на внешней стороне дуги
    a_srv = math.radians(161.0)
    t_s, n_s = arc_dirs(a_srv)
    s_th = math.atan2(t_s.y, t_s.x)
    for i, dv in enumerate((-0.0090, -0.0030, 0.0030)):
        p = arc_pt(a_srv, 0.0003, h_of(a_srv) * 0.5 + dv)
        parts.append(cube(f'{PREFIX}service_ticks_{"abc"[i]}', p,
                          (0.0020, 0.0020, 0.0065), 'graphite',
                          r=0.0004, rot=(0, 0, s_th)))

    # ---- два D-кольца на короне плеч -----------------------------------
    for i, deg in enumerate(DRING_ANGLES):
        tag = 'lr'[i]
        a = math.radians(deg)
        t, n = arc_dirs(a)
        th = math.atan2(t.y, t.x)
        crown = arc_pt(a, -th_of(a) * 0.5, h_of(a))
        parts.append(cube(f'{PREFIX}dring_loop_{tag}',
                          crown + Vector((0, 0, -0.0024)),
                          (0.0250, 0.0360, 0.0080), 'milk', r=0.0030,
                          rot=(0, 0, th)))
        parts.append(cube(f'{PREFIX}dring_bar_{tag}',
                          crown + Vector((0, 0, 0.0032)),
                          (0.0185, 0.0155, 0.0060), 'steel', r=0.0014,
                          rot=(0, 0, th)))
        parts.append(ring_loop(f'{PREFIX}dring_{tag}',
                               crown + Vector((0, 0, DRING_LIFT)), n,
                               DRING_MAJOR, DRING_MINOR, 'steel',
                               segs=44, rings=10))
        for j, dv in enumerate((0.0078, -0.0078)):
            parts.append(cyl(f'{PREFIX}dring_rivet_{tag}{"ab"[j]}',
                             crown + Vector((-t.y, t.x, 0)) * dv
                             + Vector((0, 0, 0.0010)),
                             crown + Vector((-t.y, t.x, 0)) * dv
                             + Vector((0, 0, 0.0082)), 0.0019, 'steel',
                             vertices=12))

    # ---- передние концевые узлы ----------------------------------------
    parts += front_end('right', A0, +1)
    parts += front_end('left', A1, -1)

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
    mats = sorted(m.name for m in bpy.data.materials if m.users)
    rep = {
        'component': CID,
        'code': 'RST-NK-05',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_mm': [round(v * 1000, 1) for v in size],
        'bbox_target_passport': [0.30, 0.25, 0.08],
        'bbox_ok': bool(size.x <= 0.305 and size.y <= 0.255
                        and size.z <= 0.085 and mn.z > -0.002),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'arc_deg': round(math.degrees(A1 - A0), 1),
        'front_gap_deg': round(math.degrees(2 * A0), 1),
        'band_height_mm': [round(H_TIP * 1000, 1), round(H_BACK * 1000, 1)],
        'band_thickness_mm': [round(TH_TIP * 1000, 1), round(TH_BACK * 1000, 1)],
        'neck_bore_mm': round(2 * (A_OUT - TH_BACK - 2 * PAD_HALF_T) * 1000, 1),
        'pads': len(PAD_SPANS),
        'limiters': len(STOP_SPANS),
        'drings': len(DRING_ANGLES) + 2,
        'locks': 2,
        'locking': '2x steel cam buckle + dark lever + red release tab',
        'shell': 'rigid composite U-arc, milk, tapered 32->58 mm',
        'hinge': 'back, vertical pin + knurled fixator',
        'width_adjust': 'steel sliders on front straps + scale',
        'materials': mats,
        'material_count': len(mats),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
        'plate': False,
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
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
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

    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(mesh_objs)
    size = mx - mn
    center = (mn + mx) * 0.5
    S = max(size)
    k = S / 0.085

    bpy.ops.mesh.primitive_plane_add(size=20.0 * S,
                                     location=(center.x, center.y,
                                               mn.z - 0.0002 * S))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.26, -0.30, 0.30), 1.55, 0.30),
            ('fill', (-0.30, -0.24, 0.16), 0.60, 0.42),
            ('rim', (0.06, 0.30, 0.28), 0.95, 0.34)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy * k * k
        ld.shape = 'DISK'
        ld.size = sz * k
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(loc) * k
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 80
    cam_data.clip_end = 200.0 * max(1.0, S)
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
    # крупный план: правый передний замок, ползун и D-кольцо
    close_t = Vector((0.050, 0.086, 0.020))
    c_close = box_corners(close_t + Vector((-0.052, -0.048, -0.032)) - close_t,
                          close_t + Vector((0.050, 0.042, 0.048)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.56, 0.92, 0.44), center, 100, c_main, 0.92, True),
        ('front', (0.04, 1.00, 0.30), center, 80, c_main, 0.95, True),
        ('side', (1.00, -0.03, 0.30), center, 80, c_main, 0.95, True),
        ('closeup', (0.55, 0.80, 0.52), close_t, 90, c_close, 0.95, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, refine in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4 if refine else 0):
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
        print(f'RENDERED {tag} fill={max_ndc(fill) if refine else fill:.3f} {fp}',
              flush=True)
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
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
