"""Прокси стола-фиксатора «拘束台 SKGMB01» по 8 ракурсам из MODELER.

Конструкция с натуры (blockout/ref + /tmp/csm_views):
  широкая тонкая плита на полу → сужающийся пьедестал с газлифтом →
  вилка-люлька → стол с матрасом → трубчатая рама по периметру с
  приподнятыми «крыльями» на торцах → П-образная скоба у изголовья →
  плоская площадка у ножного конца.

Запуск: blender -b --factory-startup -noaudio --python tools/table_proxy.py
"""
import bpy, os, math
from mathutils import Vector

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
M_DARK = mat('tp_dark', (0.16, 0.17, 0.19), 0.5, 0.2)
M_METAL = mat('tp_metal', (0.55, 0.57, 0.60), 0.3, 0.85)
M_WHITE = mat('tp_white', (0.90, 0.91, 0.93), 0.4, 0.1)
M_PAD = mat('tp_pad', (0.22, 0.23, 0.25), 0.8)

parts = []


def box(name, size, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = Vector(size) / 2
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(material)
    parts.append(o)
    return o


def tube(name, r, h, loc, material, rot=(0, 0, 0), seg=16):
    # локацию НЕ запекаем: иначе bar() повернёт деталь вокруг мирового нуля
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg,
                                        location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    o.data.materials.append(material)
    parts.append(o)
    return o


def cone(name, r1, r2, h, loc, material, seg=20):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=h, vertices=seg, location=loc)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(material)
    parts.append(o)
    return o


def bar(name, p1, p2, r, material):
    """труба между двумя точками: поворот вокруг нуля, потом сдвиг в середину"""
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    o = tube(name, r, d.length, (0, 0, 0), material)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(rotation=True)
    o.location = (p1 + p2) / 2
    return o


# --- основание ---------------------------------------------------------------
box('base_plate', (0.92, 0.46, 0.04), (0, 0, 0.02), M_WHITE)
box('base_top', (0.44, 0.30, 0.06), (0, 0, 0.06), M_DARK)
for sy in (-1, 1):
    box(f'base_foot_{sy}', (0.16, 0.10, 0.035), (0, sy * 0.20, 0.017), M_DARK)

# --- пьедестал с газлифтом ---------------------------------------------------
cone('pedestal', 0.17, 0.11, 0.66, (0, 0, 0.37), M_DARK)
box('pedestal_yoke', (0.24, 0.18, 0.16), (0, 0, 0.78), M_DARK)
box('pedestal_slot', (0.06, 0.10, 0.34), (0, -0.10, 0.34), M_WHITE)
tube('gas_spring', 0.035, 0.42, (0, -0.055, 0.42), M_METAL, seg=14)
tube('gas_rod', 0.018, 0.20, (0, -0.055, 0.70), M_METAL, seg=12)

# --- вилка-люлька ------------------------------------------------------------
for sy in (-1, 1):
    bar(f'yoke_{sy}', (0, sy * 0.13, 0.66), (0, sy * 0.16, 0.90), 0.035, M_DARK)
tube('tilt_axle', 0.045, 0.34, (0, 0, 0.90), M_METAL, rot=(0, math.radians(90), 0))

# --- стол --------------------------------------------------------------------
box('table_frame', (1.60, 0.60, 0.08), (0, 0, 0.95), M_DARK)
box('table_mattress', (1.56, 0.56, 0.10), (0, 0, 1.02), M_PAD)
box('foot_plate', (0.40, 0.40, 0.04), (0.94, 0, 1.02), M_WHITE)
box('head_plate', (0.20, 0.38, 0.04), (-0.88, 0, 1.02), M_WHITE)

# --- трубчатая рама по периметру --------------------------------------------
RX, RY, RZ = 0.83, 0.34, 1.09
corn = [(-RX, -RY), (-RX, RY), (RX, RY), (RX, -RY)]
for i in range(4):
    a = corn[i]; b = corn[(i + 1) % 4]
    bar(f'frame_{i}', (a[0], a[1], RZ), (b[0], b[1], RZ), 0.026, M_WHITE)
for i, (x, y) in enumerate(corn):
    tube(f'frame_post_{i}', 0.022, 0.13, (x, y, RZ - 0.075), M_WHITE, seg=12)

# «крылья» — приподнятые концы рамы на торцах (упоры под руки/ноги)
for sx in (-1, 1):
    for sy in (-1, 1):
        bar(f'wing_{sx}_{sy}', (sx * RX, sy * RY, RZ),
            (sx * (RX + 0.07), sy * (RY + 0.03), RZ + 0.07), 0.020, M_WHITE)

# --- П-образная скоба у изголовья -------------------------------------------
bar('loop_l', (-0.90, -0.10, RZ - 0.02), (-0.90, -0.10, RZ + 0.16), 0.020, M_WHITE)
bar('loop_r', (-0.90, 0.10, RZ - 0.02), (-0.90, 0.10, RZ + 0.16), 0.020, M_WHITE)
bar('loop_top', (-0.90, -0.10, RZ + 0.16), (-0.90, 0.10, RZ + 0.16), 0.020, M_WHITE)

# --- мелкие кронштейны под столом -------------------------------------------
for x in (-0.55, -0.1, 0.35, 0.70):
    for sy in (-1, 1):
        bar(f'brk_{x}_{sy}', (x, sy * 0.27, 0.91), (x, sy * 0.33, RZ - 0.02), 0.016, M_WHITE)

# --- сборка -----------------------------------------------------------------
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'restraint_table'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

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
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.64, 0.67, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = 'floor'
floor.data.materials.append(mat('tp_floor', (0.50, 0.52, 0.55), 0.9))

cd = bpy.data.cameras.new('cam')
cd.lens = 55
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1200, 900
sc.eevee.taa_render_samples = 24
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'


def shot(name, loc, aim=(0, 0, 0.95), lens=55):
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


shot('tp_34.png', (2.3, -2.6, 1.6), lens=50)
shot('tp_front.png', (0.0, -3.2, 1.0), lens=50)
shot('tp_side.png', (3.6, 0.0, 1.05), lens=50)
shot('tp_top.png', (0.0, -0.6, 3.4), lens=45)

blend = os.path.join(OUT, 'table_proxy.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

glb = os.path.join(OUT, 'table_proxy.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=False)
print('EXPORTED', glb)
