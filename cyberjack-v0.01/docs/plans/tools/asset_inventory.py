"""Инвентарь .blend-ассетов: объекты, полигоны, габариты. Без рендера.

Запуск: blender -b --factory-startup -noaudio --python tools/asset_inventory.py -- <path> [<path> ...]
Печать — по строке на ассет: JSON с именами и размерами верхнеуровневых объектов.
"""
import bpy, sys, json, os
from mathutils import Vector

paths = sys.argv[sys.argv.index('--') + 1:]


def dump(path):
    bpy.ops.wm.open_mainfile(filepath=path)
    data = []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        dims = [round(max(p[i] for p in pts) - min(p[i] for p in pts), 2) for i in range(3)]
        data.append(dict(name=o.name, tris=len(o.data.polygons), dims=dims,
                         parent=o.parent.name if o.parent else None))
    total = [round(max((d['dims'][i] for d in data), default=0), 2) for i in range(3)]
    print('ASSET ' + json.dumps(dict(
        file=os.path.basename(path), meshes=len(data),
        tris=sum(d['tris'] for d in data), bbox_max=total,
        objects=sorted(data, key=lambda d: -d['tris'])[:14]), ensure_ascii=False))


for p in paths:
    try:
        dump(p)
    except Exception as exc:
        print('FAIL ' + os.path.basename(p) + ': ' + str(exc)[:120])
