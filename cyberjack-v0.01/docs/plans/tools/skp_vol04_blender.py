"""vol-04: SKP -> GLB только с машиной (без фото-бута и фигуры).

В архиве каждая .skp — это сцена-стенд: фон 13×11 м, шторы, подиум и собственно
машина. Для кита нужна только машина, поэтому:
  1. считаем bbox каждого размещения через depsgraph;
  2. выкидываем крупные панели (> 2.6 м), линии-контуры и всё, что далеко от
     центра скопления;
  3. удалённое скрываем (hide_render) и экспортируем сцену с use_visible=True;
  4. пишем габариты оставшейся машины в vol04_meta.json.

Запуск: blender -b --factory-startup -noaudio --python tools/skp_vol04_blender.py
"""
import bpy, os, json, time, statistics
from mathutils import Vector

BASE = ('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/'
        'sex-machines-models-vol-04/sex-machines-models-vol-04')
OUT = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04'
META = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04_meta.json'
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(META)) if os.path.exists(META) else {}


def placements():
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for inst in dg.object_instances:
        ob = inst.instance_object or inst.object
        if ob.type != 'MESH':
            continue
        lo = Vector((1e9, 1e9, 1e9))
        hi = Vector((-1e9, -1e9, -1e9))
        for c in ob.bound_box:
            w = inst.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
        out.append({'obj': inst.object, 'mat': inst.matrix_world.copy(),
                    'lo': lo, 'hi': hi, 'dim': hi - lo,
                    'name': ob.data.name, 'tris': sum(len(p.vertices) - 2
                                                      for p in ob.data.polygons)})
    return out


def keep_machine(pls, max_part=2.6, radius=1.6):
    """Отбор: машина = плотное скопление мелких деталей рядом с центром."""
    small = [p for p in pls if max(p['dim']) <= max_part and 'lines' not in p['name']]
    if not small:
        return [], pls
    cx = statistics.median([p['mat'].translation.x for p in small])
    cy = statistics.median([p['mat'].translation.y for p in small])
    cz = statistics.median([p['mat'].translation.z for p in small])
    c = Vector((cx, cy, cz))
    keep, drop = [], []
    for p in small:
        pos = p['mat'].translation
        if (pos - c).length <= radius:
            keep.append(p)
        else:
            drop.append(p)
    dropped = [p for p in pls if p not in keep]
    return keep, dropped


def union(pls):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for p in pls:
        lo = Vector((min(lo.x, p['lo'].x), min(lo.y, p['lo'].y), min(lo.z, p['lo'].z)))
        hi = Vector((max(hi.x, p['hi'].x), max(hi.y, p['hi'].y), max(hi.z, p['hi'].z)))
    return lo, hi


files = sorted(f for f in os.listdir(BASE) if f.endswith('.skp'))
for fn in files:
    key = os.path.splitext(fn)[0]
    out_path = os.path.join(OUT, key + '.glb')
    if key in meta and os.path.exists(out_path):
        print('SKIP', fn, flush=True)
        continue
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.preferences.addon_enable(module='bl_ext.user_default.openskp_import_export')
    try:
        bpy.ops.import_scene.openskp(filepath=os.path.join(BASE, fn))
    except Exception as e:
        print('IMPORT_ERROR', fn, type(e).__name__, str(e)[:150], flush=True)
        continue

    # фигура (STL) — убираем сразу
    for o in [o for o in list(bpy.data.objects)
              if o.type == 'MESH' and '.stl' in (o.name.lower() + o.data.name.lower())]:
        bpy.data.objects.remove(o, do_unlink=True)

    pls = placements()
    keep, drop = keep_machine(pls)
    if not keep:
        print('NO_KEEP', fn, flush=True)
        continue
    for p in drop:
        if p['obj']:
            p['obj'].hide_render = True
            p['obj'].hide_viewport = True
    lo, hi = union(keep)
    size = [round(v, 3) for v in (hi - lo)]
    tris = sum(p['tris'] for p in keep)

    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB',
                              use_selection=False, use_visible=True,
                              export_apply=True, export_yup=True)
    meta[key] = {'file': fn, 'glb': os.path.relpath(out_path, '/home/cyberkitty/Projects/cyberjack'),
                 'bytes': os.path.getsize(out_path), 'size_m': size, 'tris': int(tris),
                 'kept_parts': len(keep), 'dropped_parts': len(drop),
                 'sec': round(time.time() - t0, 1)}
    json.dump(meta, open(META, 'w'), indent=1, ensure_ascii=False)
    print('DONE', fn, 'parts', len(keep), 'dropped', len(drop), 'tris', int(tris),
          'size', size, 'mb', round(meta[key]['bytes'] / 1e6, 1), flush=True)

print('ALL_DONE', len(meta), flush=True)
