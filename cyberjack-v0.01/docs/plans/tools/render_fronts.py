"""Облёт моделей станков с 4 сторон: найти сторону с органами управления.

Для каждой модели рендерит 4 ортогональных вида (+X, −X, +Y, −Y) и собирает
контактный лист на 6 моделей. Нужен, чтобы вручную назначить «лицо» станка и
повернуть его к двери, а не только «чтобы влезло».

Запуск: blender -b --factory-startup -noaudio --python tools/render_fronts.py
Выход: /tmp/fronts/<sid>_{xp,xn,yp,yn}.png и blockout/model_fronts_<batch>.png
"""
import bpy, os, math, json
from mathutils import Vector, Matrix

PLAN = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/lab-floorplan.json'
_d = json.load(open(PLAN, encoding='utf-8'))
REF = {o['id'].split('_')[-1]: max(o['w'], o['d'], o['h'])
       for o in _d['objects'] if o['kind'] == 'machine'}

MODELS = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03/prepared-2026-10-16/models'
MODELS_FIXED = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout/models_fixed'
OUT = '/tmp/fronts'
SHEETS = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
os.makedirs(OUT, exist_ok=True)

IDS = [f'{n:03d}' for n in range(65, 89)]


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def bbox(meshes):
    xs, ys, zs = [], [], []
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


for sid in IDS:
    fixed = os.path.join(MODELS_FIXED, f'SexMachineModel-{sid}.glb')
    path = fixed if os.path.exists(fixed) else os.path.join(MODELS, f'SexMachineModel-{sid}.glb')
    clear()
    bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.polygons) > 0]
    # отсев фона/прута: объекты крупнее станка в 2 раза
    ref = REF.get(sid, 2.0)
    keep = []
    for o in meshes:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        ext = max(max(q.x for q in bb) - min(q.x for q in bb),
                  max(q.y for q in bb) - min(q.y for q in bb),
                  max(q.z for q in bb) - min(q.z for q in bb))
        if ext > ref * 2.0:
            o.hide_render = True
            o.hide_viewport = True
        else:
            keep.append(o)
    meshes = keep
    if not meshes:
        print(f'SKIP {sid}: пусто')
        continue
    # нормализация: центр XY в 0, низ на 0
    x0, x1, y0, y1, z0, z1 = bbox(meshes)
    dx = -(x0 + x1) / 2
    dy = -(y0 + y1) / 2
    # двигать надо КОРНИ сцены (меши вложены в пустышки GLB), иначе ничего не сдвинется
    for o in [ob for ob in bpy.data.objects if ob.parent is None]:
        o.matrix_world = Matrix.Translation((dx, dy, -z0)) @ o.matrix_world
    bpy.context.view_layer.update()
    x0, x1, y0, y1, z0, z1 = bbox(meshes)
    cx, cy = 0.0, 0.0
    size = max(x1 - x0, y1 - y0, z1 - z0)
    dist = size * 1.9 + 1.2
    mid_z = (z0 + z1) / 2

    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    try:
        sc.display.shading.show_shadows = True
    except Exception:
        pass
    # тёмный фон: белые модели иначе не видны на белом
    sc.display.shading.background_type = 'VIEWPORT'
    sc.display.shading.background_color = (0.16, 0.18, 0.20)
    sc.render.resolution_x = sc.render.resolution_y = 420
    cd = bpy.data.cameras.new('C')
    cd.type = 'ORTHO'
    cd.ortho_scale = size * 1.05
    cam = bpy.data.objects.new('C', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam

    views = {
        'xp': (dist, 0, mid_z),      # смотрим с +X в сторону -X
        'xn': (-dist, 0, mid_z),
        'yp': (0, dist, mid_z),
        'yn': (0, -dist, mid_z),
    }
    for name, loc in views.items():
        cam.location = loc
        d = Vector((cx, cy, mid_z)) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(OUT, f'{sid}_{name}.png')
        bpy.ops.render.render(write_still=True)
    print(f'DONE {sid} size={size:.2f} dist={dist:.2f}')
print('ALL DONE')
