"""Ремонт модели 083: из полного экспорта glb/ берём только размещённый станок.

В glb/SexMachineModel-083.glb три слоя:
  1) библиотечная копия геометрии у начала координат (0, 0),
  2) размещённый станок в точке (≈2.5, ≈3.7),
  3) служебные плоскости фона 6.4×3.6 и монтажный прут 2.45 м, фигура 1.stl.

Скрипт оставляет только станок (без фигуры, фона и прута), ставит его
центром в (0,0), низом на z=0 и сохраняет как чистый GLB.

Запуск: blender -b --factory-startup -noaudio --python tools/fix_model_083.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

SRC = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03/glb/SexMachineModel-083.glb'
DST = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout/models_fixed/SexMachineModel-083.glb'
os.makedirs(os.path.dirname(DST), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
bpy.context.view_layer.update()

meshes = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.polygons) > 0]


def wbb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (min(p.x for p in pts), max(p.x for p in pts),
            min(p.y for p in pts), max(p.y for p in pts),
            min(p.z for p in pts), max(p.z for p in pts))


# центр размещённой сборки: самый плотный кластер (исключаем область начала координат)
centers = []
for o in meshes:
    x0, x1, y0, y1, z0, z1 = wbb(o)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if abs(cx) < 1.2 and abs(cy) < 1.2:
        continue
    centers.append((cx, cy))
assert centers, 'размещённая сборка не найдена'
mx = sorted(c[0] for c in centers)[len(centers) // 2]
my = sorted(c[1] for c in centers)[len(centers) // 2]
print(f'cluster center ≈ ({mx:.2f}, {my:.2f}), кандидатов {len(centers)}')

keep, dropped = [], []
for o in meshes:
    x0, x1, y0, y1, z0, z1 = wbb(o)
    dims = (x1 - x0, y1 - y0, z1 - z0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    reason = None
    if max(dims) > 5.0 or o.name.startswith('Group647'):
        reason = f'фон/служебное (макс {max(dims):.2f} м)'
    elif 'stl' in o.data.name.lower() or 'stl' in o.name.lower():
        reason = 'фигура 1.stl'
    elif math.hypot(cx - mx, cy - my) > 1.6:
        reason = 'вне сборки (библиотека/фон)'
    if reason:
        dropped.append((o.name, dims, reason))
    else:
        keep.append(o)

print(f'keep {len(keep)} meshes, drop {len(dropped)}')
for n, d, r in dropped[:15]:
    print(f'  drop {n[:30]:32} {d[0]:.2f}x{d[1]:.2f}x{d[2]:.2f} — {r}')

# удаляем всё лишнее
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

# пересчёт bbox и нормализация: центр XY в 0, низ на z=0
xs, ys, zs = [], [], []
for o in keep:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        xs.append(w.x); ys.append(w.y); zs.append(w.z)
cx0, cy0, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
for o in keep:
    if o.parent is None:
        o.matrix_world = Matrix.Translation((-cx0, -cy0, -z0)) @ o.matrix_world
bpy.context.view_layer.update()

xs, ys, zs = [], [], []
for o in keep:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        xs.append(w.x); ys.append(w.y); zs.append(w.z)
print(f'RESULT bbox {max(xs)-min(xs):.2f} x {max(ys)-min(ys):.2f} x {max(zs)-min(zs):.2f} м, '
      f'z0 {min(zs):+.2f}, трис {sum(len(o.data.polygons) for o in keep)}')

# рендер-контроль с эталоном 1.70 м
bpy.ops.mesh.primitive_cube_add(size=1, location=(max(xs) - min(xs) / 2 + 0.9, 0, 0.85))
ref = bpy.context.object
ref.scale = (0.45, 0.25, 1.70)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 1200, 900
cd = bpy.data.cameras.new('C'); cd.lens = 40
cam = bpy.data.objects.new('C', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (2.6, -3.4, 2.2)
d = Vector((0, 0, 0.9)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = os.path.join(os.path.dirname(DST), 'check_083.png')
bpy.ops.render.render(write_still=True)

bpy.data.objects.remove(ref, do_unlink=True)   # эталон в экспорт не идёт

bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB', export_apply=True,
                          use_selection=False)
print('saved', DST, os.path.getsize(DST) // 1024, 'KB')
