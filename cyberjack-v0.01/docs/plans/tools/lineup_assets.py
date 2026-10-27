"""Ряд всех машин vol-04 в новом .blend — без кита и без повторной нормализации.

GLB уже нормализованы на экспорте (высота 1.72 м, низ на полу, центр в нуле),
поэтому здесь только импорт, децимация и расстановка. Сцена сохраняется в
blockout/assets_lineup.blend, затем рендер assets_lineup.png.

Запуск: blender -b --factory-startup -noaudio --python tools/lineup_assets.py
"""
import bpy, os, math, glob
from mathutils import Vector, Matrix

ROOT = '/home/cyberkitty/Projects/cyberjack'
VOL04 = os.path.join(ROOT, 'assets/3d/converted/vol04')
OUT = os.path.join(ROOT, 'cyberjack-v0.01/docs/plans/blockout')
STEP = 2.6
PER_ROW = 12          # один ряд
ROW_GAP = 0.0
TARGET_TRIS = 5000

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

files = sorted(glob.glob(os.path.join(VOL04, '*.glb')))


def bbox(o):
    used = {i for p in o.data.polygons for i in p.vertices}
    ws = [o.matrix_world @ o.data.vertices[i].co for i in used]
    lo = Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws)))
    hi = Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws)))
    return lo, hi


for i, path in enumerate(files):
    key = os.path.basename(path)[:-4]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for o in new:
        if o.data.users > 1:
            o.data = o.data.copy()

    # объединяем в один объект
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    if len(new) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = key

    # децимация после объединения: до join деталей много и каждая мелкая
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > TARGET_TRIS:
        m = obj.modifiers.new('dec', 'DECIMATE')
        m.ratio = max(0.02, TARGET_TRIS / tris)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier='dec')

    # GLB приходит Y-up: разворачиваем так, чтобы высота была по Z
    lo, hi = bbox(obj)
    if (hi.y - lo.y) > (hi.z - lo.z):
        obj.matrix_world = Matrix.Rotation(math.radians(90), 4, 'X') @ obj.matrix_world

    # масштаб: доверяем ассету, правим только при заметном расхождении
    lo, hi = bbox(obj)
    h = hi.z - lo.z
    if h > 1e-6 and abs(h - 1.72) > 0.05:
        k = 1.72 / h
        obj.matrix_world = Matrix.Scale(k, 4) @ obj.matrix_world

    # постановка: 6 в ряд, шаг STEP, ряды по Y
    lo, hi = bbox(obj)
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    x = (i % PER_ROW - (PER_ROW - 1) / 2) * STEP
    y = 0.0 if i < PER_ROW else ROW_GAP
    obj.matrix_world = Matrix.Translation((x - cx, y - cy, -lo.z)) @ obj.matrix_world

    # белый инк-материал на все слоты
    mat = bpy.data.materials.get('lineup_white')
    if mat is None:
        mat = bpy.data.materials.new('lineup_white')
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (0.93, 0.94, 0.95, 1)
        bsdf.inputs['Roughness'].default_value = 0.75
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.data.polygons.foreach_set('use_smooth', [False] * len(obj.data.polygons))
    obj.data.update()

    # подпись
    cu = bpy.data.curves.new(f'lbl{i}', 'FONT')
    cu.body = key.split('-')[-1]
    cu.size = 0.22
    cu.align_x = 'CENTER'
    tob = bpy.data.objects.new(f'lbl{i}', cu)
    sc.collection.objects.link(tob)
    tob.location = (x, y - 1.05, 0.02)
    tob.rotation_euler = (math.radians(90), 0, 0)

    print('PLACED', key, 'h', round(hi.z - lo.z, 2), 'tris',
          sum(len(p.vertices) - 2 for p in obj.data.polygons))

# пол
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0.0, -0.002))
floor = bpy.context.object
fm = bpy.data.materials.new('floor')
fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.88, 0.89, 0.9, 1)
floor.data.materials.append(fm)

# свет
for name, vec, energy in (('key', (0.35, 0.8, -0.55), 1.5), ('fill', (-0.5, -0.7, -0.3), 0.6)):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    d.use_shadow = False
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)
w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.82, 0.84, 0.86, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7

# камера-орто
cd = bpy.data.cameras.new('cam')
cd.type = 'ORTHO'
cd.ortho_scale = (PER_ROW - 1) * STEP + 3.0
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (0, -16.0, 0.92)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 4200, 980
sc.eevee.taa_render_samples = 6
sc.view_settings.view_transform = 'Standard'

# контур только по силуэту: без рёбер, чтобы Freestyle не тонул в геометрии
r = sc.render
r.use_freestyle = True
r.line_thickness_mode = 'ABSOLUTE'
r.line_thickness = 1.3
vl = sc.view_layers[0]
vl.use_freestyle = True
fs = vl.freestyle_settings
ls = fs.linesets.new('silhouette')
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = False
ls.select_contour = False
ls.linestyle = bpy.data.linestyles.new('ln')
ls.linestyle.color = (0.22, 0.24, 0.29)
ls.linestyle.thickness = 1.3

blend = os.path.join(OUT, 'assets_lineup.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

sc.render.filepath = os.path.join(OUT, 'assets_lineup.png')
bpy.ops.render.render(write_still=True)
print('RENDERED assets_lineup.png')
