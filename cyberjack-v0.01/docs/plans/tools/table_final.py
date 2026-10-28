"""Стол-фиксатор «拘束台 SKGMB01»: полная форма по референсу + риг.

Форма снята с 8 ракурсов MODELER (/tmp/csm_views) и трёх превью:
тонкая плита на полу → сужающийся пьедестал с прорезью и двумя газлифтами →
вилка-люлька с осью → стол (рама, матрас с бортом, площадки на торцах) →
трубчатая рама по периметру с плоскими «крыльями» → П-скоба у изголовья.

Риг: высота колонны, наклон стола, четыре «крыла» (упоры рук/ног),
площадка у ножного конца, скоба, маркер персонажа.

Запуск: blender -b --factory-startup -noaudio --python tools/table_final.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'


def mat(name, color, rough=0.55, metal=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
M_DARK = mat('tf_dark', (0.15, 0.16, 0.18), 0.5, 0.25)
M_METAL = mat('tf_metal', (0.62, 0.64, 0.67), 0.28, 0.9)
M_WHITE = mat('tf_white', (0.91, 0.92, 0.94), 0.4, 0.15)
M_PAD = mat('tf_pad', (0.20, 0.21, 0.23), 0.85)

parts = []          # (object, bone)


def _finish(o, material, bone):
    o.data.materials.append(material)
    parts.append((o, bone))
    return o


def box(name, size, loc, material, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = Vector(size) / 2
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return _finish(o, material, bone)


def cyl(name, r, h, loc, material, bone, rot=(0, 0, 0), seg=20):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg,
                                        location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return _finish(o, material, bone)


def cone(name, r1, r2, h, loc, material, bone, seg=24):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=h, vertices=seg, location=loc)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return _finish(o, material, bone)


def bar(name, p1, p2, r, material, bone, seg=14):
    """труба между точками: поворот вокруг нуля, затем сдвиг в середину"""
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=seg, location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    o.location = (p1 + p2) / 2
    bpy.ops.object.transform_apply(location=True)
    return _finish(o, material, bone)


def arc(name, center, r_tube, r_path, a0, a1, material, bone, z):
    """дуга (скругление рамы) в плоскости XY"""
    bpy.ops.mesh.primitive_torus_add(major_radius=r_path, minor_radius=r_tube,
                                     major_segments=18, minor_segments=10,
                                     location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(rotation=True)
    # обрезаем до нужного сектора: проще повернуть и оставить как есть — визуально дуга
    o.rotation_euler = (0, 0, math.radians(a0))
    bpy.ops.object.transform_apply(rotation=True)
    o.location = (center[0], center[1], z)
    bpy.ops.object.transform_apply(location=True)
    return _finish(o, material, bone)


# --- основание ---------------------------------------------------------------
box('base_plate', (1.00, 0.50, 0.035), (0, 0, 0.018), M_WHITE, 'base')
box('base_pad', (0.42, 0.30, 0.05), (0, 0, 0.055), M_DARK, 'base')
for sy in (-1, 1):
    box(f'base_foot_{sy}', (0.14, 0.08, 0.03), (-0.30, sy * 0.14, 0.015), M_DARK, 'base')

# --- пьедестал с прорезью и газлифтами --------------------------------------
cone('pedestal', 0.135, 0.100, 0.62, (0, 0, 0.37), M_DARK, 'column')
box('pedestal_slot', (0.070, 0.055, 0.36), (0, -0.095, 0.36), M_WHITE, 'column')
box('pedestal_slot_in', (0.040, 0.030, 0.30), (0, -0.115, 0.36), M_DARK, 'column')
for sx in (-1, 1):
    cyl(f'gas_body_{sx}', 0.030, 0.30, (sx * 0.075, 0.075, 0.30), M_METAL, 'column', seg=16)
    cyl(f'gas_rod_{sx}', 0.015, 0.34, (sx * 0.075, 0.075, 0.60), M_METAL, 'column_ext', seg=12)
cyl('column_collar', 0.115, 0.045, (0, 0, 0.68), M_WHITE, 'column_ext', seg=24)
cyl('column_tube', 0.085, 0.16, (0, 0, 0.78), M_DARK, 'column_ext', seg=20)

# --- вилка-люлька ------------------------------------------------------------
for sy in (-1, 1):
    box(f'yoke_{sy}', (0.055, 0.05, 0.16), (0, sy * 0.115, 0.88), M_DARK, 'tilt')
cyl('tilt_axle', 0.040, 0.30, (0, 0, 0.945), M_METAL, 'tilt', rot=(math.radians(90), 0, 0))

# --- стол --------------------------------------------------------------------
box('table_frame', (1.58, 0.58, 0.055), (0, 0, 0.96), M_DARK, 'table')
for sy in (-1, 1):
    box(f'table_rail_{sy}', (1.54, 0.05, 0.05), (0, sy * 0.25, 0.915), M_WHITE, 'table')
box('table_mattress', (1.50, 0.52, 0.120), (0, 0, 1.030), M_PAD, 'table')
# борт матраса
for sy in (-1, 1):
    box(f'rim_side_{sy}', (1.52, 0.030, 0.030), (0, sy * 0.265, 1.095), M_WHITE, 'table')
for sx in (-1, 1):
    box(f'rim_end_{sx}', (0.030, 0.52, 0.030), (sx * 0.76, 0, 1.095), M_WHITE, 'table')
box('head_plate', (0.18, 0.36, 0.03), (-0.88, 0, 1.075), M_WHITE, 'table')
box('foot_plate', (0.34, 0.42, 0.03), (0.96, 0, 1.075), M_WHITE, 'foot_plate')
box('foot_tongue', (0.20, 0.26, 0.03), (1.22, 0, 1.075), M_WHITE, 'foot_plate')

# --- трубчатая рама по периметру --------------------------------------------
FZ = 1.10
RX, RY, RC = 0.72, 0.26, 0.085
for sy in (-1, 1):
    bar(f'frame_long_{sy}', (-RX + RC, sy * RY, FZ), (RX - RC, sy * RY, FZ), 0.032, M_WHITE, 'table')
for sx in (-1, 1):
    bar(f'frame_short_{sx}', (sx * RX, -RY + RC, FZ), (sx * RX, RY - RC, FZ), 0.032, M_WHITE, 'table')
def arc_corner(name, cx, cy, a0, a1, steps=6):
    """скругление рамы: цепочка коротких труб по четверти окружности"""
    pts = []
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        pts.append((cx + RC * math.cos(a), cy + RC * math.sin(a), FZ))
    for k in range(steps):
        bar(f'{name}_{k}', pts[k], pts[k + 1], 0.032, M_WHITE, 'table')


arc_corner('c_fl', -RX + RC, -RY + RC, 180, 270)
arc_corner('c_fr', RX - RC, -RY + RC, 270, 360)
arc_corner('c_br', RX - RC, RY - RC, 0, 90)
arc_corner('c_bl', -RX + RC, RY - RC, 90, 180)
# стойки рамы к столу
for x in (-0.62, -0.2, 0.2, 0.62):
    for sy in (-1, 1):
        bar(f'post_{x}_{sy}', (x, sy * RY, FZ), (x, sy * 0.27, 0.985), 0.020, M_WHITE, 'table')

# --- «крылья»: плоские лопатки на торцах рамы -------------------------------
for sx in (-1, 1):
    for sy in (-1, 1):
        bone = ('wing_H' if sx < 0 else 'wing_F') + ('L' if sy < 0 else 'R')
        box(f'wing_{bone}', (0.16, 0.10, 0.014),
            (sx * (RX + 0.04), sy * (RY + 0.01), FZ + 0.05),
            M_WHITE, bone, rot=(math.radians(16 * sy), math.radians(-30 * sx), 0))

# --- ручки-скобы на столе ----------------------------------------------------
for i, hx in enumerate((-0.42, 0.02)):
    bar(f'hnd_{i}_l', (hx, -0.14, 1.10), (hx, -0.14, 1.24), 0.016, M_WHITE, 'table')
    bar(f'hnd_{i}_r', (hx, 0.14, 1.10), (hx, 0.14, 1.24), 0.016, M_WHITE, 'table')
    bar(f'hnd_{i}_t', (hx, -0.14, 1.24), (hx, 0.14, 1.24), 0.016, M_WHITE, 'table')

# --- П-скоба у изголовья -----------------------------------------------------
bar('loop_l', (-0.96, -0.10, 1.08), (-0.96, -0.10, 1.24), 0.016, M_WHITE, 'loop')
bar('loop_r', (-0.96, 0.10, 1.08), (-0.96, 0.10, 1.24), 0.016, M_WHITE, 'loop')
bar('loop_top', (-0.96, -0.10, 1.24), (-0.96, 0.10, 1.24), 0.016, M_WHITE, 'loop')

# --- скелет ------------------------------------------------------------------
ad = bpy.data.armatures.new('table_rig')
arm = bpy.data.objects.new('table_rig', ad)
sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = ad.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    if parent:
        b.parent = eb[parent]
    return b


bone('root', (0, 0, 0), (0, 0, 0.10))
bone('base', (0, 0, 0.04), (0, 0, 0.12), 'root')
bone('column', (0, 0, 0.12), (0, 0, 0.62), 'base')
bone('column_ext', (0, 0, 0.62), (0, 0, 0.86), 'column')
bone('tilt', (0, 0, 0.90), (0, 0, 1.0), 'column_ext')
bone('table', (0, 0, 1.0), (0, 0, 1.10), 'tilt')
bone('wing_HL', (-0.86, -0.28, FZ), (-0.92, -0.30, FZ + 0.10), 'table')
bone('wing_HR', (-0.86, 0.28, FZ), (-0.92, 0.30, FZ + 0.10), 'table')
bone('wing_FL', (0.86, -0.28, FZ), (0.92, -0.30, FZ + 0.10), 'table')
bone('wing_FR', (0.86, 0.28, FZ), (0.92, 0.30, FZ + 0.10), 'table')
bone('foot_plate', (0.96, 0, 1.045), (1.06, 0, 1.045), 'table')
bone('loop', (-0.88, 0, 1.10), (-0.88, 0, 1.26), 'table')
bone('anchor', (0, 0, 1.12), (0, 0, 1.28), 'table')
bpy.ops.object.mode_set(mode='OBJECT')

# --- веса и скин -------------------------------------------------------------
bpy.context.view_layer.update()
for o, bname in parts:
    vg = o.vertex_groups.new(name=bname)
    vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')

bpy.ops.object.select_all(action='DESELECT')
for o, _ in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'restraint_table'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
body.parent = arm

# --- сцена -------------------------------------------------------------------
for name, vec, energy in (('key', (0.45, 0.7, -0.55), 3.0), ('fill', (-0.5, -0.6, -0.3), 1.1),
                          ('rim', (-0.2, 0.8, 0.4), 1.0)):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    d.use_shadow = (name == 'key')
    d.angle = math.radians(8)
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)

w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.60, 0.62, 0.65, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = 'floor'
floor.data.materials.append(mat('tf_floor', (0.50, 0.52, 0.55), 0.9))

cd = bpy.data.cameras.new('cam')
cd.lens = 50
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1200, 900
sc.eevee.taa_render_samples = 24
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'


def reset_pose():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()


def pose(d):
    reset_pose()
    for bname, (loc, rot) in d.items():
        pb = arm.pose.bones.get(bname)
        if not pb:
            continue
        pb.location = loc
        pb.rotation_euler = tuple(math.radians(a) for a in rot)
    bpy.context.view_layer.update()


def shot(name, loc=(2.3, -2.6, 1.55), aim=(0, 0, 0.95), lens=50):
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


reset_pose()
shot('tf_neutral_34.png')
shot('tf_neutral_side.png', loc=(3.4, 0.05, 1.05), lens=55)
shot('tf_neutral_front.png', loc=(0.0, -3.2, 1.05), lens=55)

pose({
    'tilt': ((0, 0, 0), (-20, 0, 0)),
    'column_ext': ((0, 0, 0.10), (0, 0, 0)),
    'wing_HL': ((0, 0, 0), (0, 0, 18)),
    'wing_HR': ((0, 0, 0), (0, 0, -18)),
    'wing_FL': ((0, 0, 0), (0, 0, -14)),
    'wing_FR': ((0, 0, 0), (0, 0, 14)),
    'foot_plate': ((0.10, 0, 0), (0, 0, 0)),
    'loop': ((0, 0, 0.05), (0, 0, 0)),
})
shot('tf_pose_34.png')
shot('tf_pose_side.png', loc=(3.4, 0.05, 1.05), lens=55)

reset_pose()
blend = os.path.join(OUT, 'table_final.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

glb = os.path.join(OUT, 'table_final.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=False)
print('EXPORTED', glb)