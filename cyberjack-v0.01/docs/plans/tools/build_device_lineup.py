"""Базовые устройства из имеющихся ассетов: сборка «набора», нормализация, рендер.

Берём объекты из .blend-паков и одного GLB, приводим к целевым габаритам из
`core-rooms-devices.md`, раскладываем сеткой с подписями.

Запуск: blender -b --factory-startup -noaudio --python tools/build_device_lineup.py
Выход: blockout/devices_lineup.png, blockout/devices_lineup.blend
"""
import bpy, os, math
from mathutils import Vector, Matrix

ROOT = '/home/cyberkitty/Projects/cyberjack/assets/3d'
OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'

C_METAL = (0.62, 0.65, 0.68, 1)
C_DARK = (0.14, 0.16, 0.18, 1)
C_PAINT = (0.30, 0.35, 0.38, 1)
C_GLASS = (0.55, 0.75, 0.78, 1)
C_ACCENT = (0.18, 0.50, 0.46, 1)
C_SOFT = (0.32, 0.27, 0.29, 1)


def color_for(name, idx):
    n = name.lower()
    if 'glass' in n or 'window' in n:
        return C_GLASS
    if any(k in n for k in ('trim', 'frame', 'pipe', 'pole', 'rod', 'metal', 'cage',
                            'lock', 'wheel', 'legs', 'support', 'beam')):
        return C_METAL
    if any(k in n for k in ('base', 'engine', 'motor', 'sybian', 'tank', 'platform')):
        return C_PAINT
    if any(k in n for k in ('leather', 'cushion', 'pad', 'seat', 'back', 'belt')):
        return C_SOFT
    if any(k in n for k in ('button', 'key', 'panel', 'controller', 'screen', 'label')):
        return C_ACCENT
    return C_DARK if idx % 2 else C_PAINT


def append_objects(path, names):
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in names]
    added = [o for o in dst.objects if o]
    for o in added:
        if o.name not in sc.collection.objects:
            try:
                sc.collection.objects.link(o)
            except RuntimeError:
                pass
    bpy.context.view_layer.update()
    for o in added:                       # отцепляем от армтур, иначе масштаб не берётся
        if o.parent is not None:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    bpy.context.view_layer.update()
    return added


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    added = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    # скины GLB держат габарит через армтуру: без снятия модификаторов масштаб не берётся
    for o in added:
        for m in list(o.modifiers):
            o.modifiers.remove(m)
        if o.parent is not None:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    for o in [x for x in bpy.data.objects if x.type in ('ARMATURE', 'EMPTY') and x not in before]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    return [o for o in added if o.name in bpy.data.objects]


def bbox(objs):
    # bound_box кэшируется и врёт после правки mesh.data — считаем по вершинам
    pts = []
    for o in objs:
        if o.type != 'MESH' or not o.data.vertices:
            continue
        M = o.matrix_world
        pts += [M @ v.co for v in o.data.vertices]
    if not pts:
        return None
    return (min(p.x for p in pts), max(p.x for p in pts),
            min(p.y for p in pts), max(p.y for p in pts),
            min(p.z for p in pts), max(p.z for p in pts))


def bake_world(objs):
    """Запекает мировую матрицу в вершины: дальше масштаб считается арифметикой."""
    for o in objs:
        if o.type != 'MESH':
            continue
        if o.data.users > 1:
            o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()


def normalize(objs, target, at):
    bake_world(objs)
    bb = bbox(objs)
    if not bb:
        return None
    size = (bb[1] - bb[0], bb[3] - bb[2], bb[5] - bb[4])
    k = min(target[i] / size[i] for i in range(3) if size[i] > 1e-6)
    cx, cy = (bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2
    for o in objs:
        if o.type != 'MESH':
            continue
        o.data.transform(Matrix.Scale(k, 4))
        o.data.transform(Matrix.Translation((-cx * k + at[0], -cy * k + at[1], -bb[4] * k)))
    bpy.context.view_layer.update()
    bb = bbox(objs)
    return dict(size=(bb[1] - bb[0], bb[3] - bb[2], bb[5] - bb[4]), k=k, h=bb[5])


def label(text, x, y, h):
    cu = bpy.data.curves.new(type='FONT', name='lbl')
    cu.body = text
    cu.size = 0.13
    cu.align_x = 'CENTER'
    o = bpy.data.objects.new('lbl_' + text[:10], cu)
    o.location = (x, y - 1.05, 0.02)   # подпись лежит на полу перед устройством
    sc.collection.objects.link(o)
    return o


def build_device(title, sources, target, at, rot_x=0.0):
    objs = []
    for kind, fname, names in sources:
        path = os.path.join(ROOT, fname)
        if not os.path.exists(path):
            print('MISS', fname)
            continue
        objs += import_glb(path) if kind == 'glb' else append_objects(path, names)
    if not objs:
        print('EMPTY', title)
        return None
    if rot_x:
        bake_world(objs)
        for o in objs:
            if o.type == 'MESH':
                o.data.transform(Matrix.Rotation(math.radians(rot_x), 4, 'X'))
    info = normalize(objs, target, at)
    for i, o in enumerate(objs):
        o.color = color_for(o.name, i)
    if info:
        report.append((title, [round(v, 2) for v in info['size']], round(info['k'], 3),
                       len(objs), sum(len(o.data.polygons) for o in objs)))
        label(title, at[0], at[1], info['h'])
    return objs


# (подпись, источники, целевые габариты Ш×Г×В)
DEVICES = [
    ('Стол диагностический', [('blend', 'sex_toys.blend', ['Table'])], (2.00, 0.80, 0.90), 0),
    ('Стойка телеметрии', [
        ('blend', 'Prop_Pack_4/Enema IV Drip.blend', ['enema_iv_drip']),
    ], (0.40, 0.40, 1.90), 0),
    ('Панель музыки/света', [
        ('blend', 'fukonaMachine.blend', ['controlPanelScreen']),
    ], (0.30, 0.06, 0.20), 90),
    ('Капсула восстановления', [
        ('blend', 'Prop_Pack_1/Creature Tank.blend', ['Tank_Base', 'Tank_Top', 'Glass']),
    ], (1.10, 1.10, 2.10), 0),
    ('Кресло коррекции', [
        ('blend', 'Prop_Pack_4/Bondage Chair Slim.blend', ['Bondage_Chair_Slim']),
    ], (1.10, 1.00, 1.75), 0),
    ('Модуль A · вагинальный', [('blend', 'Sex_Machine.blend', ['BarbellSybian_V2'])],
     (1.60, 1.30, 1.15), 0),
    ('Модуль B · анальный', [
        ('blend', 'dildo_chair_all_joined.blend', ['engine1', 'here goes the dildo']),
    ], (1.60, 1.30, 1.15), 0),
    ('Модуль C · щекотка', [
        ('glb', 'converted/tickle_chair_v1.glb', []),
    ], (1.60, 1.30, 1.40), 0),
    ('Модуль D · ротационный', [
        ('blend', 'GordProps.blend', ['Wheel', 'Legs', 'Support']),
    ], (1.60, 1.30, 1.55), 0),
]

report = []
# один ряд: подписи не наезжают, габариты сравнимы в одном масштабе
x = 0.0
for title, sources, target, rot in DEVICES:
    before = len(report)
    build_device(title, sources, target, (x, 0.0), rot)
    width = report[-1][1][0] if len(report) > before else target[0]
    x += width + 0.75

print('=== LINEUP ===')
for r in report:
    print('DEV', r)

w = x
bpy.ops.mesh.primitive_plane_add(size=w + 8, location=(w / 2, 0.8, -0.005))
bpy.context.object.color = (0.33, 0.34, 0.35, 1)

sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'
sh.studio_light = 'paint.sl'
sh.color_type = 'OBJECT'
sh.show_shadows = True
sh.shadow_intensity = 0.3
sh.show_cavity = True
sh.cavity_type = 'BOTH'
sh.curvature_ridge_factor = 1.0
sh.curvature_valley_factor = 0.8
sh.background_type = 'VIEWPORT'
sh.background_color = (0.13, 0.15, 0.17)
sc.render.resolution_x, sc.render.resolution_y = 2600, 760

cd = bpy.data.cameras.new('C')
cd.type = 'ORTHO'
cd.ortho_scale = w + 2.0
cam = bpy.data.objects.new('C', cd)
sc.collection.objects.link(cam)
sc.camera = cam
target_pt = Vector((w / 2, 0, 0.85))
cam.location = target_pt + Vector((-1.6, -11.0, 5.6))
cam.rotation_euler = (target_pt - cam.location).to_track_quat('-Z', 'Y').to_euler()

sc.render.filepath = os.path.join(OUT, 'devices_lineup.png')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'devices_lineup.blend'))
print('SAVED')
