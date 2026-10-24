"""Блок-аут базовых комнат с устройствами из имеющихся ассетов.

Комнаты: калибровочная, медблок, жилая камера A, камера особого содержания,
пост наблюдения, комната персонала. Геометрия — из `lab-floorplan.json`,
устройства — из `kit_devices.py`, остальная мебель — боксы по данным плана.

Запуск: blender -b --factory-startup -noaudio --python tools/build_base_rooms.py
Выход: blockout/base_rooms_*.png, blockout/base_rooms.blend, замеры в stdout.
"""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
import kit_devices as K  # noqa: E402

PLAN = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/lab-floorplan.json'
OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
ROOMS = ['room_calibration', 'room_medbay', 'room_cell_a', 'room_cell_special',
         'room_control', 'room_staff_living',
         # станции, куда встают покупаемые модули из набора
         'room_st_073', 'room_st_086', 'room_st_087', 'room_st_084', 'room_st_080']
T = 0.20                      # толщина стены
OPEN_H = 2.10                 # высота проёма

C_WALL = (0.78, 0.79, 0.78, 1)
C_FLOOR = (0.44, 0.46, 0.45, 1)
C_CEIL = (0.70, 0.71, 0.70, 1)
C_WOOD = (0.45, 0.36, 0.28, 1)
C_WHITE = (0.86, 0.87, 0.86, 1)

FURN_COLOR = {
    'bed': (0.38, 0.33, 0.36, 1), 'couch': (0.38, 0.33, 0.36, 1),
    'table': C_WOOD, 'desk': C_WOOD, 'stool': C_WOOD,
    'san': C_WHITE, 'sink': C_WHITE, 'shower': C_WHITE, 'drain': C_WHITE,
    'cabinet': K.C_METAL, 'locker': K.C_METAL, 'lockers': K.C_METAL,
    'shelf': K.C_METAL, 'rail': K.C_METAL, 'sensor': K.C_DARK,
    'screen': K.C_ACCENT, 'videowall': K.C_ACCENT, 'glass': K.C_GLASS,
    'vent': K.C_DARK, 'iv': K.C_METAL, 'chair': K.C_SOFT,
}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'

plan = json.load(open(PLAN))
rooms = {r['id']: r for r in plan['rooms']}
doors = plan['doors']
objs = plan['objects']


def box(name, x0, x1, y0, y1, z0, z1, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.color = color
    size = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    o.data.transform(Matrix.Diagonal((max(size[0], 0.01), max(size[1], 0.01),
                                      max(size[2], 0.01), 1)))
    o.data.transform(Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)))
    return o


def wall_with_openings(rid, side, r, h):
    """Стена комнаты с проёмами: сегменты + перемычка над проёмом."""
    ops = sorted([d for d in doors if d['room'] == rid and d['wall'] == side],
                 key=lambda d: d['at'])
    if side in ('south', 'north'):
        a0, a1 = r['x0'], r['x1']
        y = r['y0'] if side == 'south' else r['y1']
        y0, y1 = y - T / 2, y + T / 2
        spans = [(a0, a1)]
        for d in ops:
            w = d['width']
            spans = cut(spans, d['at'] - w / 2, d['at'] + w / 2)
            box(f'{rid}_{side}_lintel', d['at'] - w / 2, d['at'] + w / 2, y0, y1, OPEN_H, h, C_WALL)
        for i, (s0, s1) in enumerate(spans):
            box(f'{rid}_{side}_{i}', s0, s1, y0, y1, 0, h, C_WALL)
    else:
        a0, a1 = r['y0'], r['y1']
        x = r['x0'] if side == 'west' else r['x1']
        x0, x1 = x - T / 2, x + T / 2
        spans = [(a0, a1)]
        for d in ops:
            w = d['width']
            spans = cut(spans, d['at'] - w / 2, d['at'] + w / 2)
            box(f'{rid}_{side}_lintel', x0, x1, d['at'] - w / 2, d['at'] + w / 2, OPEN_H, h, C_WALL)
        for i, (s0, s1) in enumerate(spans):
            box(f'{rid}_{side}_{i}', x0, x1, s0, s1, 0, h, C_WALL)


def cut(spans, a, b):
    out = []
    for s0, s1 in spans:
        if b <= s0 or a >= s1:
            out.append((s0, s1))
            continue
        if a > s0:
            out.append((s0, a))
        if b < s1:
            out.append((b, s1))
    return [(s0, s1) for s0, s1 in out if s1 - s0 > 0.03]


def build_room(rid):
    r = rooms[rid]
    h = r.get('h', 2.8)
    box(f'{rid}_floor', r['x0'], r['x1'], r['y0'], r['y1'], -0.06, 0.0, C_FLOOR)
    box(f'{rid}_ceiling', r['x0'], r['x1'], r['y0'], r['y1'], h, h + 0.06, C_CEIL)
    for side in ('south', 'north', 'west', 'east'):
        wall_with_openings(rid, side, r, h)


def place_furniture(rid):
    for o in [x for x in objs if x['room'] == rid]:
        kind = o['kind']
        if kind in ('dtable', 'stand', 'capsule', 'panel', 'slot'):
            continue
        w, d, hh = o.get('w', 0.5), o.get('d', 0.5), o.get('h', 0.5)
        if o.get('mount') == 'wall' or o.get('mount') == 'ceiling':
            # настенное/потолочное: тонкая панель на нужной высоте
            z0 = o.get('z', 0)
            box(o['id'], o['x'] - w / 2, o['x'] + w / 2, o['y'] - d / 2, o['y'] + d / 2,
                z0, z0 + max(hh, 0.04), FURN_COLOR.get(kind, K.C_DARK))
            continue
        z0 = o.get('z', 0.0)
        if kind in ('bed', 'couch') and z0 == 0:
            z0 = 0.30
        box(o['id'], o['x'] - w / 2, o['x'] + w / 2, o['y'] - d / 2, o['y'] + d / 2,
            z0, z0 + hh, FURN_COLOR.get(kind, K.C_DARK))


DEV_KIND = {'dtable': 'table', 'stand': 'stand', 'capsule': 'capsule', 'panel': 'panel'}

# покупка открывает станцию: модуль из набора стоит в своей комнате
STATION_DEV = {
    'room_st_073': 'machine_a',      # вагинальный — «Кресло с опорами»
    'room_st_086': 'machine_b',      # анальный — «Тоннель»
    'room_st_087': 'machine_c',      # щекотка — «Стремена»
    'room_st_084': 'machine_d',      # ротационный — «Диск»
    'room_st_080': 'chair',          # кресло коррекции — «Седло»
}


def prefixed(prefix):
    return [p for p in bpy.data.objects if p.name.startswith(prefix) and p.type == 'MESH']


def place_devices(rid):
    r = rooms[rid]
    log = []
    for o in [x for x in objs if x['room'] == rid]:
        kind = o['kind']
        if kind == 'slot':
            if o['id'] == 'slot_3':        # калибровочная: остаются два слота
                continue
            box(o['id'], o['x'] - o['w'] / 2, o['x'] + o['w'] / 2,
                o['y'] - o['d'] / 2, o['y'] + o['d'] / 2, 0.0, 0.03, K.C_ACCENT)
            continue
        key = STATION_DEV.get(rid) if kind == 'machine' else DEV_KIND.get(kind)
        if not key:
            continue
        spec = K.DEVICES[key]
        yaw = o.get('rot', 0) or 0
        objs_dev, info = K.build_device(spec, (o['x'], o['y']), yaw=yaw,
                                        prefix=f"{o['id']}_")
        if not objs_dev:
            continue
        shift = [0.0, 0.0, 0.0]
        if kind == 'panel':
            # настенная панель: прижимаем тыл к внутренней плоскости стены
            dist = {'south': abs(o['y'] - r['y0']), 'north': abs(o['y'] - r['y1']),
                    'west': abs(o['x'] - r['x0']), 'east': abs(o['x'] - r['x1'])}
            side = min(dist, key=dist.get)
            d_panel = 0.10
            if side == 'north':
                shift[1] = (r['y1'] - T / 2 - d_panel / 2) - o['y']
            elif side == 'south':
                shift[1] = (r['y0'] + T / 2 + d_panel / 2) - o['y']
            elif side == 'east':
                shift[0] = (r['x1'] - T / 2 - d_panel / 2) - o['x']
            else:
                shift[0] = (r['x0'] + T / 2 + d_panel / 2) - o['x']
            shift[2] = o.get('z', 1.30)
        if any(shift):
            for p in prefixed(o['id'] + '_'):
                p.data.transform(Matrix.Translation(tuple(shift)))
            info['h'] += shift[2]
        log.append((rid, o['id'], key, round(info['size'][0], 2), round(info['size'][1], 2),
                    round(info['h'], 2), info['tris']))
    return log


def gaps(rid):
    """Свободные проходы: от устройства до стен комнаты."""
    r = rooms[rid]
    out = []
    for o in [x for x in objs if x['room'] == rid
              and (x['kind'] in DEV_KIND or x['kind'] == 'machine')]:
        gx = min(o['x'] - o['w'] / 2 - r['x0'], r['x1'] - (o['x'] + o['w'] / 2))
        gy = min(o['y'] - o['d'] / 2 - r['y0'], r['y1'] - (o['y'] + o['d'] / 2))
        out.append((rid, o['id'], round(gx, 2), round(gy, 2)))
    return out


for rid in ROOMS:
    build_room(rid)

# потолок в блок-ауте только мешает обзору сверху
for o in bpy.data.objects:
    if o.name.endswith('_ceiling'):
        o.hide_render = True
        o.hide_viewport = True

device_log, gap_log = [], []
for rid in ROOMS:
    device_log += place_devices(rid)
    place_furniture(rid)
    gap_log += gaps(rid)

print('=== DEVICES ===')
for row in device_log:
    print('DEV', row)
print('=== GAPS ===')
for row in gap_log:
    print('GAP', row)

# --- рендер ---------------------------------------------------------------
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'
sh.studio_light = 'paint.sl'
sh.color_type = 'OBJECT'
sh.show_shadows = False           # на планах тени стен читаются как дыры в полу
sh.show_cavity = True
sh.cavity_type = 'BOTH'
sh.curvature_ridge_factor = 1.0
sh.curvature_valley_factor = 0.7
sh.background_type = 'VIEWPORT'
sh.background_color = (0.13, 0.15, 0.17)
sc.render.resolution_x, sc.render.resolution_y = 1100, 850

cd = bpy.data.cameras.new('CAM')
cam = bpy.data.objects.new('CAM', cd)
sc.collection.objects.link(cam)
sc.camera = cam


def shot_top(rid):
    r = rooms[rid]
    cx, cy = (r['x0'] + r['x1']) / 2, (r['y0'] + r['y1']) / 2
    cd.type = 'ORTHO'
    cd.ortho_scale = max(r['x1'] - r['x0'], r['y1'] - r['y0']) * 1.12
    cam.location = (cx, cy, 9.0)
    cam.rotation_euler = (0, 0, 0)
    sc.render.filepath = os.path.join(OUT, f'base_room_{rid.replace("room_", "")}_top.png')
    bpy.ops.render.render(write_still=True)


def shot_eye(name, loc, target, lens=20.0, ortho=None):
    cd.type = 'PERSP'
    cd.lens = lens
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)


sh.light = 'FLAT'                   # на планах ровная заливка читается лучше
for rid in ROOMS:
    shot_top(rid)
sh.light = 'STUDIO'

# обзор всех шести комнат
xs = [rooms[r]['x0'] for r in ROOMS] + [rooms[r]['x1'] for r in ROOMS]
ys = [rooms[r]['y0'] for r in ROOMS] + [rooms[r]['y1'] for r in ROOMS]
cd.type = 'ORTHO'
cd.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * 2.0) * 1.12
cam.location = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, 30.0)
cam.rotation_euler = (0, 0, 0)
sc.render.resolution_x, sc.render.resolution_y = 2200, 1100
sc.render.filepath = os.path.join(OUT, 'base_rooms_overview.png')
bpy.ops.render.render(write_still=True)

# виды изнутри, от проёма в глубину комнаты
sc.render.resolution_x, sc.render.resolution_y = 1200, 800
# камеры из дальнего от проёма угла — видно всю комнату, а не спинку стойки
shot_eye('base_view_calibration.png', (21.10, 10.80, 1.62), (25.60, 7.80, 0.95), lens=20)
shot_eye('base_view_medbay.png', (15.40, 10.90, 1.62), (19.90, 7.90, 1.10), lens=20)
shot_eye('base_view_cell_a.png', (4.50, 4.20, 1.62), (7.60, 0.60, 0.90), lens=18)
shot_eye('base_view_control.png', (27.20, 10.90, 1.62), (32.60, 7.30, 1.10), lens=20)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'base_rooms.blend'))
print('SAVED')
