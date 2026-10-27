"""Витрина машин vol-04: по одному кадру на модель, чтобы смотреть глазами.

Для каждой модели: импорт GLB как есть (без децимации и перекраски, чтобы видеть
родные материалы и фигуру внутри), камера 3/4 по габаритам, рендер
blockout/machines/<id>.png. Затем отдельным шагом можно собрать лист.

Запуск:
  blender -b --factory-startup -noaudio --python tools/ink_machines_sheet.py -- 089 090
  blender -b --factory-startup -noaudio --python tools/ink_machines_sheet.py      # все
"""
import bpy, sys, os, json, math
from mathutils import Vector

OUTDIR = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout/machines'
VOL04 = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04'
META = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04_meta.json'
os.makedirs(OUTDIR, exist_ok=True)

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
meta = json.load(open(META)) if os.path.exists(META) else {}
keys = [k for k in sorted(meta) if not args or any(a in k for a in args)]

sc = bpy.context.scene


def setup_render():
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 1100, 900
    sc.eevee.taa_render_samples = 24
    sc.eevee.use_raytracing = True
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0


def lights():
    for name, vec, energy, color in (('key', (0.4, 0.8, -0.6), 1.3, (1.0, 0.98, 0.95)),
                                     ('fill', (-0.5, -0.7, -0.25), 0.5, (0.85, 0.9, 1.0))):
        d = bpy.data.lights.new(name, 'SUN')
        d.energy, d.color = energy, color
        d.use_shadow = False
        o = bpy.data.objects.new(name, d)
        o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(o)
    w = sc.world or bpy.data.worlds.new('W')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.80, 0.82, 0.84, 1)
    bg.inputs['Strength'].default_value = 0.6


for key in keys:
    path = os.path.join(VOL04, key + '.glb')
    if not os.path.exists(path):
        print('MISS', key)
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    setup_render()
    lights()

    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        print('NOMESH', key)
        continue

    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    tris = 0
    boxes = []
    for o in meshes:
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        lo_o = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
        hi_o = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
        boxes.append((lo_o, hi_o, (lo_o + hi_o) / 2, max(hi_o - lo_o)))

    # кадрируем по основной массе деталей: медианный центр, отсев дальних
    cx = sorted(b[2].x for b in boxes)[len(boxes) // 2]
    cy = sorted(b[2].y for b in boxes)[len(boxes) // 2]
    cz = sorted(b[2].z for b in boxes)[len(boxes) // 2]
    mid = Vector((cx, cy, cz))
    for lo_o, hi_o, c_o, span in boxes:
        if span > 2.5 or (c_o - mid).length > 1.5:
            continue
        for w in (lo_o, hi_o):
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    size = hi - lo
    centre = (lo + hi) / 2
    radius = max(size) / 2

    # пол
    bpy.ops.mesh.primitive_plane_add(size=max(radius * 12, 4), location=(centre.x, centre.y, lo.z - 0.002))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.86, 0.87, 0.88, 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.35
    floor.data.materials.append(m)

    cd = bpy.data.cameras.new('cam')
    cd.lens = 50
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    d = Vector((0.75, -1.0, 0.45)).normalized()
    cam.location = centre + d * (radius * 3.4 + 0.9)
    aim = Vector((centre.x, centre.y, lo.z + size.z * 0.45))
    cam.rotation_euler = (aim - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam

    sc.render.filepath = os.path.join(OUTDIR, key + '.png')
    bpy.ops.render.render(write_still=True)
    print('SHOT', key, 'tris', tris, 'size', [round(v, 2) for v in size])

print('SHEET_DONE', len(keys))
