"""Быстрый превью машин vol-04: что реально попало в GLB (без децимации).

Импортирует выбранные модели как есть, раскладывает в ряд, рендерит один кадр.
Нужен, чтобы глазами проверить отбор «машина без бута».

Запуск: blender -b --factory-startup -noaudio --python tools/ink_machine_preview.py
"""
import bpy, sys, os, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from ink_lib import Ink   # noqa: E402

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
VOL04 = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04'
MODELS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [
    'SexMachineModel-089', 'SexMachineModel-092', 'SexMachineModel-097']

bpy.ops.wm.read_factory_settings(use_empty=True)
I = Ink()
I.build()
sc = bpy.context.scene

x = 0.0
for mid in MODELS:
    path = os.path.join(VOL04, mid + '.glb')
    if not os.path.exists(path):
        print('MISS', mid)
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
    if not new:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    if len(new) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bb = [Vector(c) for c in o.bound_box]
    size = Vector((max(v.x for v in bb) - min(v.x for v in bb),
                   max(v.y for v in bb) - min(v.y for v in bb),
                   max(v.z for v in bb) - min(v.z for v in bb)))
    k = 1.75 / max(size.z, 1e-6)
    o.scale = (k, k, k)
    bpy.ops.object.transform_apply(scale=True)
    bb = [Vector(c) for c in o.bound_box]
    cx = (max(v.x for v in bb) + min(v.x for v in bb)) / 2
    cy = (max(v.y for v in bb) + min(v.y for v in bb)) / 2
    z0 = min(v.z for v in bb)
    o.location = (x - cx, -cy, -z0)
    bpy.ops.object.transform_apply(location=True)
    for slot in o.material_slots:
        slot.material = I.M['wall']
    x += 2.2
    print('OK', mid, 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons))

bpy.ops.mesh.primitive_plane_add(size=30, location=(x / 2, 0, -0.002))
I.apply(bpy.context.object, 'floor')

I.lights(sc)
cd = bpy.data.cameras.new('cam')
cd.lens = 35
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (x / 2, -9.5, 2.0)
d = Vector((x / 2, 0.0, 0.9)) - Vector(cam.location)
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

I.render_setup(sc, res=(2000, 900), samples=24, exposure=-0.05, bloom=(2.2, 2))
I.ink(sc, thickness=1.3, crease=True, angle=150)
sc.render.filepath = os.path.join(OUT, 'machines_preview.png')
bpy.ops.render.render(write_still=True)
print('RENDERED machines_preview.png')
