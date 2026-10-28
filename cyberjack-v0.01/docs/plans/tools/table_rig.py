"""Стол-фиксатор (拘束台) как риггованный ассет для Cyberjack.

Собран по трём ракурсам из CLIP STUDIO MODELER (blockout/ref_table_*.png):
плита → колонна с гидравликой → люлька → подушка стола, по краям подвижные
подлокотники и подножки. Всё на скелете: стол наклоняется, подлокотники
раздвигаются и поворачиваются, подножки едут по длине, колонна меняет высоту.

Запуск: blender -b --factory-startup -noaudio --python tools/table_rig.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'


def mat(name, color, rough=0.6, metal=0.0):
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

M_WHITE = mat('tab_white', (0.90, 0.91, 0.92), 0.45)
M_METAL = mat('tab_metal', (0.35, 0.37, 0.40), 0.35, 0.75)
M_DARK = mat('tab_dark', (0.13, 0.14, 0.16), 0.55)
M_PAD = mat('tab_pad', (0.30, 0.33, 0.36), 0.85)
M_ACC = mat('tab_accent', (0.16, 0.62, 0.58), 0.4)

parts = []          # (object, bone)


def box(name, size, loc, bone, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = Vector(size) / 2
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(material)
    parts.append((o, bone))
    return o


def cyl(name, r, h, loc, bone, material, axis='Z', seg=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=loc)
    o = bpy.context.object
    o.name = name
    if axis == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(material)
    parts.append((o, bone))
    return o


# --- основание ---------------------------------------------------------------
box('base_plate', (0.86, 0.86, 0.07), (0, 0, 0.035), 'base', M_METAL)
box('base_skirt', (0.62, 0.62, 0.10), (0, 0, 0.10), 'base', M_WHITE)
for sx in (-1, 1):
    for sy in (-1, 1):
        box(f'foot_{sx}_{sy}', (0.10, 0.10, 0.03), (sx * 0.36, sy * 0.36, 0.015), 'base', M_DARK)

# --- колонна с гидравликой ---------------------------------------------------
cyl('column_lower', 0.11, 0.42, (0, 0, 0.31), 'column', M_METAL, seg=8)
cyl('column_sleeve', 0.085, 0.40, (0, 0, 0.62), 'column_ext', M_WHITE, seg=8)
cyl('column_ring', 0.10, 0.04, (0, 0, 0.44), 'column', M_ACC, seg=16)
box('column_rib', (0.05, 0.05, 0.30), (0, -0.11, 0.30), 'column', M_METAL)

# --- люлька и узел наклона ---------------------------------------------------
cyl('tilt_axle', 0.05, 0.30, (0, 0, 0.86), 'table', M_METAL, axis='X', seg=16)
for sx in (-1, 1):
    box(f'yoke_{sx}', (0.05, 0.16, 0.14), (sx * 0.14, 0, 0.86), 'table', M_WHITE)

# --- стол --------------------------------------------------------------------
box('table_frame', (1.62, 0.68, 0.09), (0, 0, 0.93), 'table', M_METAL)
box('table_mattress', (1.56, 0.62, 0.10), (0, 0, 1.02), 'table', M_PAD)
box('head_rest', (0.34, 0.50, 0.07), (-0.86, 0, 1.03), 'table', M_PAD, rot=(0, math.radians(-14), 0))
box('head_pad', (0.26, 0.40, 0.06), (-0.92, 0, 1.07), 'table', M_WHITE, rot=(0, math.radians(-14), 0))

# рельсы под столом, по которым едут крепления
for sy in (-1, 1):
    box(f'rail_{sy}', (1.50, 0.05, 0.05), (0, sy * 0.30, 0.87), 'table', M_METAL)

# --- подлокотники у изголовья (регулируются по Y и поворачиваются) ----------
for sy, bone in ((-1, 'arm_L'), (1, 'arm_R')):
    cyl(f'arm_post_{bone}', 0.028, 0.20, (-0.74, sy * 0.26, 1.02), bone, M_METAL, seg=12)
    box(f'arm_pad_{bone}', (0.26, 0.17, 0.06), (-0.74, sy * 0.26, 1.14), bone, M_PAD)
    box(f'arm_strap_{bone}', (0.22, 0.03, 0.05), (-0.74, sy * 0.26, 1.18), bone, M_DARK)
    cyl(f'arm_knob_{bone}', 0.025, 0.05, (-0.74, sy * 0.36, 1.03), bone, M_ACC, seg=12)

# --- ремни поперёк стола -----------------------------------------------------
for i, x in enumerate((-0.30, 0.30)):
    box(f'strap_{i}', (0.05, 0.66, 0.02), (x, 0, 1.075), 'table', M_DARK)

# --- поручень у ножного конца ------------------------------------------------
box('handle_bar', (0.05, 0.62, 0.05), (0.78, 0, 1.10), 'table', M_METAL)
for sy in (-1, 1):
    cyl(f'handle_post_{sy}', 0.022, 0.14, (0.78, sy * 0.30, 1.04), 'table', M_METAL, seg=10)

# --- подножки на нижней направляющей ----------------------------------------
for sy, bone in ((-1, 'leg_L'), (1, 'leg_R')):
    cyl(f'leg_rod_{bone}', 0.022, 0.26, (0.30, sy * 0.24, 0.86), bone, M_METAL, seg=10)
    box(f'leg_cuff_{bone}', (0.12, 0.12, 0.09), (0.30, sy * 0.24, 0.73), bone, M_DARK)
    box(f'leg_pad_{bone}', (0.09, 0.15, 0.04), (0.30, sy * 0.24, 0.69), bone, M_PAD)

# --- маркер крепления персонажа ---------------------------------------------
cyl('anchor_mark', 0.05, 0.02, (-0.1, 0, 1.08), 'anchor', M_ACC, seg=16)

# --- скелет (или статичная сборка, если NORIG=1) -----------------------------
import os as _os
NORIG = _os.environ.get('NORIG') == '1'

_rig_block_start = True
arm_data = bpy.data.armatures.new('table_rig')
arm = bpy.data.objects.new('table_rig', arm_data)
sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')

eb = arm_data.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head = Vector(head)
    b.tail = Vector(tail)
    if parent:
        b.parent = eb[parent]
    return b


bone('root', (0, 0, 0), (0, 0, 0.18))
bone('base', (0, 0, 0.05), (0, 0, 0.2), 'root')
bone('column', (0, 0, 0.2), (0, 0, 0.46), 'root')
bone('column_ext', (0, 0, 0.46), (0, 0, 0.86), 'column')
bone('table', (0, 0, 0.86), (0, 0, 1.02), 'column_ext')
bone('arm_L', (-0.72, 0.22, 1.0), (-0.72, 0.22, 1.16), 'table')
bone('arm_R', (0.72, 0.22, 1.0), (0.72, 0.22, 1.16), 'table')
bone('leg_L', (0.62, -0.20, 0.80), (0.62, -0.20, 0.60), 'table')
bone('leg_R', (0.62, 0.20, 0.80), (0.62, 0.20, 0.60), 'table')
bone('anchor', (-0.1, 0, 1.08), (-0.1, 0, 1.24), 'table')

bpy.ops.object.mode_set(mode='OBJECT')

# --- скин: жёсткие веса по костям -------------------------------------------
bpy.context.view_layer.update()
if NORIG:
    bpy.ops.object.select_all(action='DESELECT')
    for o, _ in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0][0]
    bpy.ops.object.join()
    _body = bpy.context.object
    _body.name = 'restraint_table'
else:
    for o, bname in parts:
        vg = o.vertex_groups.new(name=bname)
        vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')

if not NORIG:
    bpy.ops.object.select_all(action='DESELECT')
    for o, _ in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0][0]
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = 'restraint_table'

    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    body.parent = arm
else:
    body = _body

# --- свет, камера, материалы уже на местах -----------------------------------
for name, vec, energy in (('key', (0.4, 0.7, -0.6), 3.0), ('fill', (-0.5, -0.6, -0.3), 1.1)):
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
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.57, 0.60, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = 'floor'
floor.data.materials.append(mat('tab_floor', (0.45, 0.47, 0.50), 0.9))

cd = bpy.data.cameras.new('cam')
cd.lens = 50
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1500, 1100
sc.eevee.taa_render_samples = 32
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'


def shoot(name, pose):
    """pose: dict bone -> (loc, rot_euler_deg)"""
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
    for bname, (loc, rot) in pose.items():
        pb = arm.pose.bones.get(bname)
        if not pb:
            continue
        pb.location = loc
        pb.rotation_euler = tuple(math.radians(a) for a in rot)
    bpy.context.view_layer.update()
    cam.location = (2.6, -3.0, 1.75)
    aim = Vector((0, 0, 0.95))
    cam.rotation_euler = (aim - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)


shoot('table_pose_a.png', {
    'table': ((0, 0, 0), (0, 0, 0)),
    'arm_L': ((-0.12, 0, 0), (0, 0, 12)),
    'arm_R': ((0.12, 0, 0), (0, 0, -12)),
    'leg_L': ((0, -0.06, 0.06), (0, 0, 0)),
    'leg_R': ((0, 0.06, 0.06), (0, 0, 0)),
})

shoot('table_pose_b.png', {
    'table': ((0, 0, 0), (-22, 0, 0)),
    'column_ext': ((0, 0, 0.12), (0, 0, 0)),
    'arm_L': ((0.18, 0, 0.05), (0, 0, -8)),
    'arm_R': ((-0.18, 0, 0.05), (0, 0, 8)),
    'leg_L': ((0, 0.10, -0.10), (0, 0, 0)),
    'leg_R': ((0, -0.10, -0.10), (0, 0, 0)),
})

blend = os.path.join(OUT, 'table_rig.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

glb = os.path.join(OUT, 'table_rig.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=False)
print('EXPORTED', glb)