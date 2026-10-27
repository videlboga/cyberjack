"""Ряд всех машин vol-04 в новом .blend — без кита и без ink-перекраски.

GLB уже нормализованы на экспорте (высота 1.72 м, низ на полу, центр в нуле,
Y-up), импортёр сам переводит в Z-up.

Важно: фигуры (*.stl) НЕ объединяем с корпусом и почти не режем —
collapse-децимация рвёт их на куски, отсюда «сетка» и дыры.

Запуск: blender -b --factory-startup -noaudio --python tools/lineup_assets.py
"""
import bpy, os, math, glob
from mathutils import Vector, Matrix

ROOT = '/home/cyberkitty/Projects/cyberjack'
VOL04 = os.path.join(ROOT, 'assets/3d/converted/vol04')
OUT = os.path.join(ROOT, 'cyberjack-v0.01/docs/plans/blockout')
STEP = 3.2
PER_ROW = 12
BODY_TRIS = 15000       # только корпус
FIG_TRIS = 60000        # фигура — мягко

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
files = sorted(glob.glob(os.path.join(VOL04, '*.glb')))


def bbox(objs):
    lo = Vector((1e18, 1e18, 1e18))
    hi = -lo.copy()
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    return lo, hi


def decimate(o, target):
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris <= target:
        return
    m = o.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = max(0.05, target / tris)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='dec')


for i, path in enumerate(files):
    key = os.path.basename(path)[:-4]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for o in new:
        if o.data.users > 1:
            o.data = o.data.copy()
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw

    figs = [o for o in new if '.stl' in (o.name + o.data.name).lower()]
    body = [o for o in new if o not in figs]
    for o in body:
        decimate(o, BODY_TRIS)
    for o in figs:
        decimate(o, FIG_TRIS)

    lo, hi = bbox(new)
    x = (i % PER_ROW - (PER_ROW - 1) / 2) * STEP
    T = Matrix.Translation((x - (lo.x + hi.x) / 2, - (lo.y + hi.y) / 2, -lo.z))
    for o in new:
        o.matrix_world = T @ o.matrix_world

    cu = bpy.data.curves.new(f'lbl{i}', 'FONT')
    cu.body = key.split('-')[-1]
    cu.size = 0.24
    cu.align_x = 'CENTER'
    tob = bpy.data.objects.new(f'lbl{i}', cu)
    sc.collection.objects.link(tob)
    tob.location = (x, -1.2, 0.02)
    tob.rotation_euler = (math.radians(90), 0, 0)

    print('PLACED', key, 'objs', len(new), 'figs', len(figs),
          'h', round(hi.z - lo.z, 2),
          'tris', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in new))

# пол
bpy.ops.mesh.primitive_plane_add(size=70, location=(0, 0.0, -0.002))
floor = bpy.context.object
floor.name = 'Plane'
fm = bpy.data.materials.new('floor')
fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.62, 0.63, 0.65, 1)
floor.data.materials.append(fm)

# свет
for name, vec, energy, shadow in (('key', (0.35, 0.8, -0.55), 1.6, True),
                                  ('fill', (-0.5, -0.7, -0.3), 0.5, False)):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    d.use_shadow = shadow
    d.angle = math.radians(6)
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)

w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.57, 0.60, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55

cd = bpy.data.cameras.new('cam')
cd.type = 'PERSP'
cd.lens = 26
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (0.0, -26.0, 6.0)
aim = Vector((0, 0, 0.78))
cam.rotation_euler = (aim - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 3200, 1150
sc.eevee.taa_render_samples = 32
sc.eevee.use_raytracing = True
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'
sc.view_settings.exposure = -0.3
sc.render.use_freestyle = False

blend = os.path.join(OUT, 'assets_lineup_plain.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('SAVED', blend)

sc.render.filepath = os.path.join(OUT, 'assets_lineup_plain.png')
bpy.ops.render.render(write_still=True)
print('RENDERED assets_lineup_plain.png')
