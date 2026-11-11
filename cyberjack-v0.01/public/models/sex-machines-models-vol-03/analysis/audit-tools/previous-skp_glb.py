import bpy, json, time, sys, os

BASE = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03'
OUT = BASE + '/glb'
STATS = BASE + '/analysis/glb_stats.jsonl'
os.makedirs(OUT, exist_ok=True)

nums = [int(a) for a in sys.argv[sys.argv.index('--')+1:] if a.lstrip('-').isdigit()]
start, end = nums[0], nums[1]
files = sorted([f for f in os.listdir(BASE) if f.endswith('.skp')])[start:end+1]

def cleanup():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    bpy.data.orphans_purge(do_recursive=True)

def convert(fname):
    t0 = time.time()
    res = {'file': fname, 'status': 'ok'}
    try:
        bpy.ops.wm.read_homefile(use_empty=True)
        path = os.path.join(BASE, fname)
        bpy.ops.import_scene.openskp(filepath=path)
        res['meshes'] = len([o for o in bpy.data.objects if o.type == 'MESH'])
        res['objects'] = len(bpy.data.objects)
        stem = os.path.splitext(fname)[0]
        out = os.path.join(OUT, stem + '.glb')
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
        res['glb_bytes'] = os.path.getsize(out)
    except Exception as e:
        res['status'] = 'ERROR'
        res['error'] = f'{type(e).__name__}: {e}'[:250]
    res['sec'] = round(time.time() - t0, 1)
    cleanup()
    with open(STATS, 'a') as fh:
        fh.write(json.dumps(res) + '\n')
    print('GLB_DONE', fname, res['status'], res.get('glb_bytes'), res['sec'], flush=True)
    return res['status'] == 'ok'

for f in files:
    try:
        convert(f)
    except Exception as e:
        print('FATAL', f, str(e)[:150], flush=True)
        try: cleanup()
        except Exception: pass
print('GLB_CHUNK_DONE', start, end, flush=True)