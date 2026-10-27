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
import bpy, os, json, time, statistics, sys
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


def keep_machine(pls, max_part=2.2, cell=0.40, radius=1.20, keep_figures=False):
    """Отбор машины: плотнейшее скопление деталей, без плоских листов-стен."""
    cand = []
    for p in pls:
        if 'lines' in p['name']:
            continue
        if keep_figures and '.stl' in p['name'].lower():
            cand.append(p)
            continue
        d = p['dim']
        big = max(d)
        small_dim = min(d)
        # плоские крупные листы (стены/шторы/подиум) — мимо
        if big > 0.6 and small_dim < 0.03:
            continue
        if big > max_part:
            continue
        cand.append(p)
    if not cand:
        return [], pls

    # плотнейшая ячейка сетки по числу деталей (вес — трисы)
    cells = {}
    for p in cand:
        pos = p['mat'].translation
        key = (round(pos.x / cell), round(pos.y / cell), round(pos.z / cell))
        w = cells.setdefault(key, [0, 0])
        w[0] += 1
        w[1] += p['tris']
    best = max(cells.items(), key=lambda kv: (kv[1][0], kv[1][1]))[0]
    centre = Vector((best[0] * cell, best[1] * cell, best[2] * cell))

    keep = []
    for p in cand:
        if (p['mat'].translation - centre).length <= radius:
            keep.append(p)
    if not keep:
        keep = cand
    dropped = [p for p in pls if p not in keep]
    return keep, dropped


def union(pls):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for p in pls:
        lo = Vector((min(lo.x, p['lo'].x), min(lo.y, p['lo'].y), min(lo.z, p['lo'].z)))
        hi = Vector((max(hi.x, p['hi'].x), max(hi.y, p['hi'].y), max(hi.z, p['hi'].z)))
    return lo, hi


only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
files = sorted(f for f in os.listdir(BASE) if f.endswith('.skp'))
if only:
    files = [f for f in files if any(o in f for o in only)]
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

    # антропоморфные меши ОСТАВЛЯЕМ: они нужны для сверки поз

    pls = placements()
    # фигуры (а также их группы) не должны выкидываться отбором: держим всё,
    # что рядом с машиной, включая антропоморфные меши
    keep, drop = keep_machine(pls, keep_figures=True)
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