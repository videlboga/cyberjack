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
    before = set(bpy.data.objects)
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
    # append тянет служебные меши (smd_bone_vis 4x4) — они висят в центре сцены
    for o in [x for x in bpy.data.objects if x not in before and x not in added]:
        bpy.data.objects.remove(o, do_unlink=True)
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
    return dict(size=(bb[1] - bb[0], bb[3] - bb[2], bb[5] - bb[4]), k=k, h=bb[5], bb=bb)


def add_box(bb, size, color, name, mode='top', z=0.0, dx=0.0, dy=0.0):
    """Примитив-довесок: ложемент, сиденье, корпус панели, ремни."""
    cx = (bb[0] + bb[1]) / 2 + dx
    cy = (bb[2] + bb[3]) / 2 + dy
    if mode == 'top':
        cz = bb[5] - size[2] / 2
    elif mode == 'center':
        cz = (bb[4] + bb[5]) / 2
    else:
        cz = z
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    o = bpy.context.object
    o.name = name
    o.scale = size
    o.color = color
    return o


def stretch_x(objs, bb, target_w):
    """Растягивает по X до целевой ширины относительно центра (стол длиннее рамы)."""
    s = target_w / (bb[1] - bb[0])
    cx = (bb[0] + bb[1]) / 2
    M = Matrix.Translation((cx, 0, 0)) @ Matrix.Diagonal((s, 1, 1, 1)) @ Matrix.Translation((-cx, 0, 0))
    for o in objs:
        if o.type == 'MESH':
            o.data.transform(M)
    return bbox(objs)


def decimate(objs, limit):
    """Срезает полигонаж до limit суммарно (модуль D — 110k на колесо)."""
    tris = sum(len(o.data.polygons) for o in objs)
    if tris <= limit:
        return tris
    for _ in range(4):                      # модификатор не всегда берёт заявленное ratio
        tris = sum(len(o.data.polygons) for o in objs)
        if tris <= limit:
            break
        ratio = max(0.05, limit / tris)
        for o in objs:
            if o.type != 'MESH':
                continue
            m = o.modifiers.new('dec', 'DECIMATE')
            m.ratio = ratio
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
    return sum(len(o.data.polygons) for o in objs)


def label(text, x, y, h):
    cu = bpy.data.curves.new(type='FONT', name='lbl')
    cu.body = text
    cu.size = 0.13
    cu.align_x = 'CENTER'
    o = bpy.data.objects.new('lbl_' + text[:10], cu)
    o.location = (x, y - 1.05, 0.02)   # подпись лежит на полу перед устройством
    sc.collection.objects.link(o)
    return o


def build_device(spec, at):
    objs = []
    for kind, fname, names in spec['sources']:
        path = os.path.join(ROOT, fname)
        if not os.path.exists(path):
            print('MISS', fname)
            continue
        objs += import_glb(path) if kind == 'glb' else append_objects(path, names)
    if not objs:
        print('EMPTY', spec['title'])
        return None
    if spec.get('rot_x'):
        bake_world(objs)
        for o in objs:
            if o.type == 'MESH':
                o.data.transform(Matrix.Rotation(math.radians(spec['rot_x']), 4, 'X'))
    info = normalize(objs, spec['target'], at)
    bb = info['bb']
    if spec.get('stretch_x'):
        bb = stretch_x(objs, bb, spec['stretch_x'])
        info['size'] = (bb[1] - bb[0], bb[3] - bb[2], bb[5] - bb[4])
        info['h'] = bb[5]
    for i, o in enumerate(objs):
        o.color = color_for(o.name, i)
    for part in spec.get('parts', []):
        add_box(bb, part['size'], part.get('color', C_DARK), part.get('name', 'part'),
                part.get('mode', 'top'), part.get('z', 0.0), part.get('dx', 0.0), part.get('dy', 0.0))
    tris = decimate(objs, spec['decimate_to']) if spec.get('decimate_to') else \
        sum(len(o.data.polygons) for o in objs)
    report.append((spec['title'], [round(v, 2) for v in info['size']], round(info['k'], 3),
                   len(objs), tris))
    label(spec['title'], at[0], at[1], info['h'])
    return objs


# набор: источники + целевые габариты + довески-примитивы
DEVICES = [
    dict(title='Стол диагностический', sources=[('blend', 'sex_toys.blend', ['Table'])],
         target=(2.00, 0.80, 0.90), stretch_x=2.00, parts=[
             dict(name='ложемент', size=(1.82, 0.66, 0.10), color=C_SOFT),
             dict(name='ремень_грудь', size=(0.10, 0.72, 0.03), color=C_DARK, mode='abs', z=0.93, dx=-0.45),
             dict(name='ремень_таз', size=(0.10, 0.72, 0.03), color=C_DARK, mode='abs', z=0.93, dx=0.45),
         ]),
    dict(title='Стойка телеметрии', sources=[
        ('blend', 'Prop_Pack_4/Enema IV Drip.blend', ['enema_iv_drip'])],
        target=(0.40, 0.40, 1.90), parts=[
            dict(name='экран_стойки', size=(0.26, 0.04, 0.18), color=C_ACCENT, mode='abs', z=1.45),
        ]),
    dict(title='Панель музыки/света', sources=[
        ('blend', 'fukonaMachine.blend', ['controlPanelScreen'])],
        target=(0.30, 0.06, 0.20), rot_x=90, parts=[
            dict(name='корпус_панели', size=(0.34, 0.08, 0.26), color=C_PAINT, mode='center'),
            dict(name='рамка_панели', size=(0.30, 0.02, 0.22), color=C_ACCENT, mode='center', dy=-0.05),
        ]),
    dict(title='Капсула восстановления', sources=[
        ('blend', 'Prop_Pack_1/Creature Tank.blend', ['Tank_Base', 'Tank_Top', 'Glass'])],
        target=(1.10, 1.10, 2.10), parts=[
            dict(name='пульт_капсулы', size=(0.20, 0.10, 0.14), color=C_ACCENT, mode='abs', z=1.05, dx=0.52),
        ]),
    dict(title='Кресло коррекции', sources=[
        ('blend', 'Prop_Pack_4/Bondage Chair Slim.blend', ['Bondage_Chair_Slim'])],
        target=(1.10, 1.00, 1.75), parts=[
            dict(name='база_кресла', size=(0.72, 0.62, 0.14), color=C_PAINT, mode='abs', z=0.07),
            dict(name='сиденье', size=(0.52, 0.48, 0.10), color=C_SOFT, mode='abs', z=0.46),
            dict(name='спинка', size=(0.50, 0.09, 0.44), color=C_SOFT, mode='abs', z=0.84, dy=0.20),
            dict(name='подлокотник_Л', size=(0.09, 0.40, 0.06), color=C_METAL, mode='abs', z=0.68, dx=-0.28),
            dict(name='подлокотник_П', size=(0.09, 0.40, 0.06), color=C_METAL, mode='abs', z=0.68, dx=0.28),
            dict(name='стойка_визора', size=(0.08, 0.08, 1.45), color=C_METAL, mode='abs', z=0.73, dy=0.26),
            dict(name='визор', size=(0.30, 0.07, 0.13), color=C_ACCENT, mode='abs', z=1.16, dy=0.10),
            dict(name='пульт_кресла', size=(0.10, 0.16, 0.05), color=C_DARK, mode='abs', z=0.72, dx=0.30),
        ]),
    dict(title='Модуль A · вагинальный', sources=[
        ('blend', 'Sex_Machine.blend', ['BarbellSybian_V2'])], target=(1.60, 1.30, 1.15)),
    dict(title='Модуль B · анальный', sources=[
        ('blend', 'dildo_chair_all_joined.blend', ['engine1', 'here goes the dildo'])],
        target=(1.60, 1.30, 1.15), parts=[
            dict(name='ложе_модуля_B', size=(0.70, 0.55, 0.08), color=C_SOFT, mode='top'),
        ]),
    dict(title='Модуль C · щекотка', sources=[
        ('glb', 'converted/tickle_chair_v1.glb', [])], target=(1.60, 1.30, 1.40)),
    dict(title='Модуль D · ротационный', sources=[
        ('blend', 'GordProps.blend', ['Wheel', 'Legs', 'Support'])],
        target=(1.60, 1.30, 1.55), decimate_to=20000),
]

report = []
# один ряд: подписи не наезжают, габариты сравнимы в одном масштабе
x = 0.0
for spec in DEVICES:
    before = len(report)
    build_device(spec, (x, 0.0))
    width = report[-1][1][0] if len(report) > before else spec['target'][0]
    x += width + 0.75

print('=== LINEUP ===')
for r in report:
    print('DEV', r)

# ряд по центру сцены, а не от нуля
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.transform(Matrix.Translation((-x / 2, 0, 0)))
    else:
        o.location = (o.location.x - x / 2, o.location.y, o.location.z)

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
target_pt = Vector((0.0, 0, 0.85))
cam.location = target_pt + Vector((-1.6, -11.0, 5.6))
cam.rotation_euler = (target_pt - cam.location).to_track_quat('-Z', 'Y').to_euler()

sc.render.filepath = os.path.join(OUT, 'devices_lineup.png')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'devices_lineup.blend'))
print('SAVED')
