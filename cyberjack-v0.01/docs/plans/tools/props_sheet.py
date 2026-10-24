"""Реквизит из CC0-набора: импорт, обмер и контактный лист.

Читает assets/cc0/models_manifest.json, импортирует gltf, снимает габариты и
полигонаж, ставит в два ряда и рендерит лист. Печатает таблицу для документа.

Запуск: blender -b --factory-startup -noaudio --python tools/props_sheet.py
"""
import bpy, sys, os, json, math

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from style_lib import Style, area   # noqa: E402

CC0 = '/home/cyberkitty/Projects/cyberjack/assets/cc0'
OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
S = Style()
S.world(sc)


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in set(bpy.data.objects) - before]


def measure(objs):
    xs, ys, zs, tris = [], [], [], 0
    for o in objs:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            w = mw @ v.co
            xs.append(w.x), ys.append(w.y), zs.append(w.z)
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    if not xs:
        return (0, 0, 0), 0
    return ((max(xs) - min(xs)), (max(ys) - min(ys)), (max(zs) - min(zs))), tris


def move(objs, dx, dy, dz):
    for o in objs:
        if o.parent is None:
            o.location.x += dx
            o.location.y += dy
            o.location.z += dz


def normalize(objs, max_h=2.2, max_w=2.2):
    """gltf иногда приходит в чужом масштабе — приводим к габариту мебели."""
    (dx, dy, dz), _ = measure(objs)
    f = min(1.0, max_h / max(dz, 1e-6), max_w / max(dx, dy, 1e-6))
    if f < 1.0:
        for o in objs:
            if o.parent is None:
                o.scale = [s * f for s in o.scale]
        bpy.context.view_layer.update()
    return f


manifest = json.load(open(os.path.join(CC0, 'models_manifest.json')))
rows = []
ROW_Y = (-1.15, 1.15)
x = 0.0
row_w = 0.0
for i, item in enumerate(manifest['models']):
    path = os.path.join(CC0, item['file'])
    objs = import_gltf(path)
    f = normalize(objs)
    (dx, dy, dz), tris = measure(objs)
    rows.append((item['id'], dx, dy, dz, tris, f))
    y = ROW_Y[0] if i < 7 else ROW_Y[1]
    move(objs, -min((o.matrix_world.translation.x for o in objs), default=0) + x, y, 0)
    if i == 6:
        x = 0.0
    x += max(dx, 0.25) + 0.45
    row_w = max(row_w, x)

print('=== PROPS ===')
for r in rows:
    print(f"{r[0]:26} {r[1]:.2f} x {r[2]:.2f} x {r[3]:.2f}  {r[4]:6d} tris  scale {r[5]:.2f}")

# пол и подложка
bpy.ops.mesh.primitive_plane_add(size=row_w + 3, location=(row_w / 2, 0, 0))
floor = bpy.context.object
S.apply(floor, 'floor')

cam_d = bpy.data.cameras.new('cam')
cam_d.type = 'ORTHO'
cam_d.ortho_scale = row_w + 1.2
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
cam.location = (row_w / 2, -12.0, 1.9)
cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam

area(sc, 'key', (row_w / 2, -2.0, 3.6), (6.0, 3.0), 420, (math.radians(50), 0, 0))
area(sc, 'fill', (row_w / 2 - 2.5, -1.0, 1.8), (3.0, 2.0), 90,
     (math.radians(72), 0, math.radians(-40)))

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 2600, 1500
sc.eevee.taa_render_samples = 48
sc.eevee.use_raytracing = True
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = -0.2
sc.render.filepath = os.path.join(OUT, 'props_cc0.png')
bpy.ops.render.render(write_still=True)
print('PROPS SHEET OK', round(row_w, 2))
