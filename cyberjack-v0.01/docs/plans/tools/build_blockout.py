"""Блок-аут ветки D лаборатории cyberjack по lab-floorplan.json.

Запуск: blender -b --factory-startup -noaudio --python build_blockout.py
Строит: полы, стены с проёмами, станки, пульты, экраны, светильники,
человеческие прокси 1.70 м. Рендер Workbench + замеры.
"""
import bpy, json, os, math
from mathutils import Vector, Matrix

MODELS = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03/prepared-2026-10-16/models'
MODELS_FIXED = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout/models_fixed'
USE_GLB = os.environ.get('USE_GLB', '1') == '1'

PLAN = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/lab-floorplan.json'
OUTDIR = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
WING = 'D'
os.makedirs(OUTDIR, exist_ok=True)

d = json.load(open(PLAN, encoding='utf-8'))
rooms = {r['id']: r for r in d['rooms']}
doors = d['doors']
objs = d['objects']

# --- что строим: комнаты ветки D + коридор ветки + кусок главного коридора
sel_rooms = [rid for rid, r in rooms.items() if r.get('sector') == WING] + ['room_corridor_x']
wing_rooms = [rid for rid, r in rooms.items() if r.get('sector') == WING]
R = {rid: rooms[rid] for rid in wing_rooms}
R['room_st_074'] = rooms['room_st_074']   # ряд кабин — отдельным кадром для масштаба
# кусок главного коридора, чтобы ветка читалась в связке
R['room_corridor_seg'] = dict(id='room_corridor_seg', name='Коридор', kind='corridor',
                              x0=24.0, y0=11.40, x1=36.0, y1=14.20, w=12.0, d=2.8,
                              h=2.8, area=33.6, sector='', station=None)

# ============================================================ helpers
def mat(name, color, rough=0.6):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    if b:
        b.inputs['Base Color'].default_value = (*color, 1)
        b.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*color, 1)
    return m

M_FLOOR = mat('floor', (0.74, 0.76, 0.77), 0.35)
M_WALL = mat('wall', (0.88, 0.90, 0.90), 0.5)
M_STRIP = mat('strip', (0.22, 0.55, 0.50), 0.4)
M_MACHINE = mat('machine', (0.12, 0.14, 0.16), 0.45)
M_PROP = mat('prop', (0.62, 0.64, 0.65), 0.5)
M_LIGHT = mat('lightpanel', (1.0, 0.96, 0.80), 0.2)
M_HUMAN = mat('human', (0.72, 0.36, 0.40), 0.6)
M_DOORFRAME = mat('doorframe', (0.32, 0.40, 0.42), 0.4)


def box(name, cx, cy, cz, sx, sy, sz, m, collection):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz + sz / 2))
    o = bpy.context.object
    o.name = name
    o.scale = (sx, sy, sz)
    o.data.materials.append(m)
    for c in o.users_collection:
        c.objects.unlink(o)
    collection.objects.link(o)
    return o


def collect(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


C_ROOM = collect('ROOMS')
C_WALL = collect('WALLS')
C_MACH = collect('MACHINES')
C_PROP = collect('PROPS')
C_LIGHT = collect('LIGHTS')
C_HUMAN = collect('HUMANS')
GLB_INFO = {}

# Рабочая сторона каждой модели в её собственных осях (куда смотрит пульт/вход).
# Определено облётом с 4 сторон: blockout/model_fronts_*.png
FRONT = {
 '065': (0, -1), '066': (1, 0),  '067': (1, 0),  '068': (0, 1),
 '069': (0, -1), '070': (0, -1), '071': (0, -1), '072': (0, -1),
 '073': (0, -1), '074': (-1, 0), '075': (0, 1),  '076': (1, 0),
 '077': (0, -1), '078': (0, -1), '079': (-1, 0), '080': (-1, 0),
 '081': (0, -1), '082': (-1, 0), '083': (0, -1), '084': (0, -1),
 '085': (0, -1), '086': (0, -1), '087': (0, -1), '088': (-1, 0),
}

WT = 0.20
H = {rid: r['h'] for rid, r in R.items()}

# ============================================================ полы
for rid, r in R.items():
    box(f'floor_{rid}', (r['x0'] + r['x1']) / 2, (r['y0'] + r['y1']) / 2, -0.02,
        r['w'], r['d'], 0.02, M_FLOOR, C_ROOM)
    # бирюзовая полоса по стене на 1.15 м — маркер стиля
# ============================================================ стены
# собираем уникальные линии стен и вычитаем проёмы
lines = {}   # (axis, coord) -> list of (start, end)
gaps = {}    # (axis, coord) -> list of (center, width)

def add_line(axis, coord, a, b):
    lines.setdefault((axis, round(coord, 3)), []).append((a, b))

for rid, r in R.items():
    add_line('h', r['y0'], r['x0'], r['x1'])
    add_line('h', r['y1'], r['x0'], r['x1'])
    add_line('v', r['x0'], r['y0'], r['y1'])
    add_line('v', r['x1'], r['y0'], r['y1'])

for dd in doors:
    if dd['room'] not in R:
        continue
    r = R[dd['room']]
    w = dd['width']
    if dd['wall'] in ('north', 'south'):
        add_line('h', r['y1'] if dd['wall'] == 'north' else r['y0'], r['x0'], r['x1'])
        gaps.setdefault(('h', round(r['y1'] if dd['wall'] == 'north' else r['y0'], 3)), []).append((dd['at'], w))
    else:
        add_line('v', r['x1'] if dd['wall'] == 'east' else r['x0'], r['y0'], r['y1'])
        gaps.setdefault(('v', round(r['x1'] if dd['wall'] == 'east' else r['x0'], 3)), []).append((dd['at'], w))

# высота стены (упрощение для блок-аута)
WALL_H = 2.8

# 1) собираем все отрезки стен в список, без создания объектов
wall_boxes = []   # (axis, mid, length, coord)
for (axis, coord), spans in lines.items():
    spans = sorted(spans)
    merged = []
    for a, b in spans:
        if merged and a <= merged[-1][1] + 1e-6:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    for a, b in merged:
        cuts = sorted([g for g in gaps.get((axis, coord), []) if a - 1e-6 <= g[0] <= b + 1e-6])
        pieces, cur = [], a
        for c, w in cuts:
            s, e = c - w / 2, c + w / 2
            if s > cur + 1e-6:
                pieces.append((cur, s))
            cur = max(cur, e)
        if b > cur + 1e-6:
            pieces.append((cur, b))
        for s, e in pieces:
            if e - s > 0.02:
                wall_boxes.append([axis, (s + e) / 2, e - s, coord])

# 2) вырезаем проёмы из ВСЕХ стен, попадающих в створ (у смежных комнат стены
#    дублируются с шагом 0.2, и стена соседа иначе заклеивает дверь)
DOOR_HALF = 0.45
for dd in doors:
    if dd['room'] not in R:
        continue
    r = R[dd['room']]
    w = dd['width']
    if dd['wall'] in ('north', 'south'):
        line = r['y1'] if dd['wall'] == 'north' else r['y0']
        sx0, sx1 = dd['at'] - w / 2, dd['at'] + w / 2
        sy0, sy1 = line - DOOR_HALF, line + DOOR_HALF
    else:
        line = r['x1'] if dd['wall'] == 'east' else r['x0']
        sx0, sx1 = line - DOOR_HALF, line + DOOR_HALF
        sy0, sy1 = dd['at'] - w / 2, dd['at'] + w / 2
    cut_list = []
    for bx in wall_boxes:
        axis, mid, length, coord = bx
        if axis == 'h':
            x0, x1 = mid - length / 2, mid + length / 2
            y0, y1 = coord - WT / 2, coord + WT / 2
        else:
            y0, y1 = mid - length / 2, mid + length / 2
            x0, x1 = coord - WT / 2, coord + WT / 2
        if x1 <= sx0 + 1e-6 or x0 >= sx1 - 1e-6 or y1 <= sy0 + 1e-6 or y0 >= sy1 - 1e-6:
            cut_list.append(bx)
            continue
        if axis == 'h':
            if x0 < sx0 - 1e-6:
                cut_list.append(['h', (x0 + sx0) / 2, sx0 - x0, coord])
            if sx1 < x1 - 1e-6:
                cut_list.append(['h', (sx1 + x1) / 2, x1 - sx1, coord])
        else:
            if y0 < sy0 - 1e-6:
                cut_list.append(['v', (y0 + sy0) / 2, sy0 - y0, coord])
            if sy1 < y1 - 1e-6:
                cut_list.append(['v', (sy1 + y1) / 2, y1 - sy1, coord])
    wall_boxes = cut_list

# 3) создаём объекты
segs = 0
for axis, mid, length, coord in wall_boxes:
    if length < 0.02:
        continue
    if axis == 'h':
        box(f'wall_h_{coord:.2f}_{mid:.2f}', mid, coord, 0, length, WT, WALL_H, M_WALL, C_WALL)
    else:
        box(f'wall_v_{coord:.2f}_{mid:.2f}', coord, mid, 0, WT, length, WALL_H, M_WALL, C_WALL)
    segs += 1
# дверей нет: на станции проходы-шлюзы. Оставляем только проёмы в стенах
# (гермоконтуры/шторки добавим отдельным проходом, когда будет стиль).

# ============================================================ импорт реальных GLB
def import_glb(sid, cx, cy, angle_deg, col, ref=2.0, room_rect=None, rid=''):
    """Импорт станка: робастный bbox (1–99 перцентиль), центр пятна в (cx, cy), низ на z=0."""
    fixed = os.path.join(MODELS_FIXED, f'SexMachineModel-{sid}.glb')
    path = fixed if os.path.exists(fixed) else os.path.join(MODELS, f'SexMachineModel-{sid}.glb')
    if not os.path.exists(path):
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.view_layer.update()
    new = [o for o in bpy.data.objects if o not in before]
    # объекты-линии (0 полигонов) раздувают bbox до габаритов исходной библиотеки
    lines = [o for o in new if o.type == 'MESH' and len(o.data.polygons) == 0]
    for o in lines:
        o.hide_render = True
        o.hide_viewport = True
    meshes = [o for o in new if o.type == 'MESH' and len(o.data.polygons) > 0]
    if not meshes:
        return None
    # вылеты: плоскости пола/фона больше станка в 2+ раза
    keep = []
    for o in meshes:
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        ext = max(max(p.x for p in bb) - min(p.x for p in bb),
                  max(p.y for p in bb) - min(p.y for p in bb),
                  max(p.z for p in bb) - min(p.z for p in bb))
        if ext > ref * 2.0:
            o.hide_render = True
            o.hide_viewport = True
        else:
            keep.append(o)
    meshes = keep
    if not meshes:
        return None

    # объединение bbox оставшихся мешей (перцентили по вершинам врут:
    # плотная мелкая деталь перевешивает редкий, но крупный каркас)
    xs, ys, zs = [], [], []
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    x_lo, x_hi = min(xs), max(xs)
    y_lo, y_hi = min(ys), max(ys)
    z_lo, z_hi = min(zs), max(zs)
    cx0, cy0, z0 = (x_lo + x_hi) / 2, (y_lo + y_hi) / 2, z_lo
    roots = [o for o in new if o.parent is None]
    orig = {o.name: o.matrix_world.copy() for o in roots}

    def apply(ang):
        M = (Matrix.Translation((cx, cy, 0))
             @ Matrix.Rotation(math.radians(ang), 4, 'Z')
             @ Matrix.Translation((-cx0, -cy0, -z0)))
        for o in roots:
            o.matrix_world = M @ orig[o.name]
        bpy.context.view_layer.update()
        fx, fy, fz = [], [], []
        for o in meshes:
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                fx.append(w.x); fy.append(w.y); fz.append(w.z)
        return (min(fx), max(fx), min(fy), max(fy), min(fz), max(fz))

    # ориентация: сначала «лицом к двери», затем развороты, если не влезает
    cands = [angle_deg, angle_deg + 180, angle_deg + 90, angle_deg - 90,
             angle_deg - 180, angle_deg + 270]
    best = None
    for ang in cands:
        bb = apply(ang)
        if room_rect:
            rx0, ry0, rx1, ry1 = room_rect
            m = min(bb[0] - rx0, rx1 - bb[1], bb[2] - ry0, ry1 - bb[3])
        else:
            m = 0.0
        if best is None or m > best[1] + 1e-4:
            best = (ang, m, bb)
    chosen, margin, bb = best
    apply(chosen)
    print(f'  ORIENT {sid}: yaw {chosen:+.0f}°, минимальный зазор {margin:+.2f} м')
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    tris = sum(len(o.data.loop_triangles) if o.data.loop_triangles else
               (len(o.data.polygons) if o.type == 'MESH' else 0) for o in meshes)
    # контроль: после поворота и переноса модель должна быть внутри комнаты
    bpy.context.view_layer.update()
    fx, fy, fz = [], [], []
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            fx.append(w.x); fy.append(w.y); fz.append(w.z)
    fit = None
    if room_rect:
        rx0, ry0, rx1, ry1 = room_rect
        fit = dict(left=min(fx) - rx0, right=rx1 - max(fx),
                   south=min(fy) - ry0, north=ry1 - max(fy),
                   z0=min(fz), h=max(fz) - min(fz))
        if min(fit['left'], fit['right'], fit['south'], fit['north']) < -0.005:
            print(f'  FIT WARN {rid} {sid}: выход за комнату '
                  f'L{fit["left"]:+.2f} R{fit["right"]:+.2f} S{fit["south"]:+.2f} N{fit["north"]:+.2f}')
    return dict(objects=len(new), meshes=len(meshes), tris=tris,
                bbox=(x_hi - x_lo, y_hi - y_lo, z_hi - z_lo), center=(cx, cy), fit=fit)


# ============================================================ станки и оборудование
for o in objs:
    if o['room'] not in R:
        continue
    k = o['kind']
    if k in ('machine', 'console', 'screen', 'prop', 'bin', 'hook', 'dispenser',
             'estop', 'shelf', 'beam'):
        if k == 'machine':
            m = M_MACHINE
        elif k == 'screen':
            m = M_DOORFRAME
        elif k == 'beam':
            m = M_DOORFRAME
        else:
            m = M_PROP
        hh = o['h'] if o['h'] > 0 else 0.05
        col = C_MACH if k == 'machine' else C_PROP
        if USE_GLB and k == 'machine':
            sid = o['id'].split('_')[-1]
            # дверь: для западных комнат она на востоке (+X), для восточных — на западе (-X)
            dx = 1.0 if o['rot'] == 180 else -1.0
            fx, fy = FRONT.get(sid, (0, -1))
            ang = math.degrees(math.atan2(0.0, dx) - math.atan2(fy, fx))
            rm = rooms[o['room']]
            info = import_glb(sid, o['x'], o['y'], ang, C_MACH,
                              ref=max(o['w'], o['d'], o['h']),
                              room_rect=(rm['x0'], rm['y0'], rm['x1'], rm['y1']),
                              rid=o['room'])
            if info:
                GLB_INFO[sid] = info
                continue
        if o['id'] == 'machine_074':
            # ряд из 7 кабин: единое помещение, но 7 отдельных ниш
            n = 7
            step = o['d'] / n
            for i in range(n):
                cy = o['y'] - o['d'] / 2 + step * (i + 0.5)
                box(f'machine_074_cab{i+1}', o['x'], cy, o['z'], o['w'], step - 0.04, hh, m, col)
                box(f'machine_074_part{i+1}', o['x'], cy + step / 2, o['z'] + 0.02,
                    o['w'], 0.04, hh, M_DOORFRAME, col)
        else:
            box(o['id'], o['x'], o['y'], o['z'], o['w'], o['d'], hh, m, col)
    elif k == 'light':
        box(o['id'], o['x'], o['y'], 2.72, o['w'], o['d'], 0.06, M_LIGHT, C_LIGHT)
    elif k == 'camera':
        box(o['id'], o['x'], o['y'], o['z'], 0.12, 0.12, 0.12, M_DOORFRAME, C_LIGHT)

GLB_REPORT = []


# ============================================================ люди 1.70 м
def human(name, x, y, rot_deg=0.0, height=1.70):
    """Прокси: две ноги, таз, торс, голова. Высота от пола — ровно height."""
    s = height / 1.70
    root = bpy.data.objects.new(name, None)
    C_HUMAN.objects.link(root)
    parts = []
    parts.append(box(f'{name}_legL', x - 0.09 * s, y, 0.02, 0.14 * s, 0.16 * s, 0.80 * s, M_HUMAN, C_HUMAN))
    parts.append(box(f'{name}_legR', x + 0.09 * s, y, 0.02, 0.14 * s, 0.16 * s, 0.80 * s, M_HUMAN, C_HUMAN))
    parts.append(box(f'{name}_hips', x, y, 0.80 * s, 0.34 * s, 0.22 * s, 0.18 * s, M_HUMAN, C_HUMAN))
    parts.append(box(f'{name}_torso', x, y, 0.98 * s, 0.40 * s, 0.24 * s, 0.50 * s, M_HUMAN, C_HUMAN))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.115 * s, segments=16, ring_count=12,
                                         location=(x, y, 1.585 * s))
    head = bpy.context.object
    head.name = f'{name}_head'
    head.data.materials.append(M_HUMAN)
    for c in head.users_collection:
        c.objects.unlink(head)
    C_HUMAN.objects.link(head)
    parts.append(head)
    return parts


human('human_st072', rooms['room_st_072']['x0'] + 1.35, rooms['room_st_072']['y0'] + 1.40)
human('human_st071', rooms['room_st_071']['x0'] + 0.80, rooms['room_st_071']['y0'] + 2.20)
human('human_corridor', 27.0, 12.80)
human('human_st074', rooms['room_st_074']['x0'] + 1.30, rooms['room_st_074']['y0'] + 3.60)

# ============================================================ камера и свет мира
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.light = 'STUDIO'
sc.display.shading.show_cavity = True
sc.display.shading.cavity_type = 'WORLD'
sc.display.render_aa = '8'
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.render.film_transparent = False
if sc.world is None:
    sc.world = bpy.data.worlds.new('W')
sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.92, 0.94, 0.95, 1)

cam_data = bpy.data.cameras.new('BlockCam')
cam_data.lens = 26
cam = bpy.data.objects.new('BlockCam', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam

def look_at(camobj, target):
    d = Vector(target) - camobj.location
    camobj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# вид 1: ветка D сверху-сбоку (вся ветка)
cam.location = (25.0, 9.0, 16.5)
look_at(cam, (29.5, 18.5, 0.6))
sc.render.filepath = os.path.join(OUTDIR, 'wing_D_overview.png')
bpy.ops.render.render(write_still=True)

# вид 2: из коридора ветки внутрь комнат
cam_data.lens = 18
cam.location = (30.75, 18.50, 1.60)
look_at(cam, (26.90, 18.50, 1.10))
sc.render.filepath = os.path.join(OUTDIR, 'wing_D_corridor.png')
bpy.ops.render.render(write_still=True)

# вид 3: комната 072 с человеком (масштаб), камера в углу комнаты
r72 = rooms['room_st_072']
cam_data.lens = 20
cam.location = (r72['x1'] - 0.25, r72['y0'] + 0.25, 1.65)
look_at(cam, (r72['x0'] + 0.9, r72['y0'] + 1.9, 1.05))
sc.render.filepath = os.path.join(OUTDIR, 'room_072_scale.png')
bpy.ops.render.render(write_still=True)

# вид 4: ряд кабин 074 с человеком, камера внутри комнаты
r74 = rooms['room_st_074']
cam_data.lens = 18
cam.location = (r74['x0'] + 0.30, r74['y0'] + 0.30, 1.62)
look_at(cam, (r74['x1'] - 0.60, r74['y0'] + 5.20, 1.00))
sc.render.filepath = os.path.join(OUTDIR, 'room_074_row.png')
bpy.ops.render.render(write_still=True)

# вид 5: план ветки сверху (ортографическая камера — сверка с чертежом)
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 11.0
cam.location = (29.30, 18.70, 20.0)
look_at(cam, (29.30, 18.70, 0.0))
sc.render.filepath = os.path.join(OUTDIR, 'wing_D_top.png')
bpy.ops.render.render(write_still=True)
cam_data.type = 'PERSP'

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTDIR, 'lab_wing_D_blockout.blend'))

# ============================================================ замеры
print('=== GLB IMPORT ===')
for sid, info in sorted(GLB_INFO.items()):
    bw, bd, bh = info['bbox']
    print(f'GLB {sid}: objects {info["objects"]}, meshes {info["meshes"]}, tris {info["tris"]}, '
          f'bbox {bw:.2f} x {bd:.2f} x {bh:.2f}')
print('=== FIT (зазор модели до стен комнаты) ===')
for sid, info in sorted(GLB_INFO.items()):
    f = info.get('fit')
    if not f:
        continue
    print(f'FIT {sid}: L{f["left"]:+.2f} R{f["right"]:+.2f} S{f["south"]:+.2f} N{f["north"]:+.2f} '
          f'z0={f["z0"]:+.2f} h={f["h"]:.2f}')
print('=== BLOCKOUT MEASUREMENTS ===')
print(f'rooms built: {len(R)}  wall segments: {segs}')
for rid, r in sorted(R.items()):
    fl = bpy.data.objects.get(f'floor_{rid}')
    print(f'ROOM {rid:22} {fl.dimensions.x:.2f} x {fl.dimensions.y:.2f} x {r["h"]:.2f} m')
for o in objs:
    if o['room'] in R and o['kind'] == 'machine':
        if o['id'] == 'machine_074' and f'machine_074_cab1' in bpy.data.objects:
            cabs = [bpy.data.objects[f'machine_074_cab{i}'] for i in range(1, 8)]
            print(f'MACHINE {"machine_074":22} ряд из {len(cabs)} кабин, шаг '
                  f'{cabs[1].location.y - cabs[0].location.y:.2f} м, ширина кабины '
                  f'{cabs[0].dimensions.y:.2f} x {cabs[0].dimensions.x:.2f} x {cabs[0].dimensions.z:.2f}')
            continue
        mo = bpy.data.objects.get(o['id'])
        if mo is None:
            sid = o['id'].split('_')[-1]
            if sid in GLB_INFO:
                bw, bd, bh = GLB_INFO[sid]['bbox']
                print(f'MACHINE {o["id"]:22} GLB {bw:.2f} x {bd:.2f} x {bh:.2f} '
                      f'at ({GLB_INFO[sid]["center"][0]:.2f},{GLB_INFO[sid]["center"][1]:.2f}) z0=0.00')
            continue
        print(f'MACHINE {o["id"]:22} {mo.dimensions.x:.2f} x {mo.dimensions.y:.2f} x {mo.dimensions.z:.2f} '
              f'at ({mo.location.x:.2f},{mo.location.y:.2f}) z0={mo.location.z - mo.dimensions.z / 2:.2f}')
# высота человеческого прокси
h = bpy.data.objects['human_st072_head']
print(f'HUMAN total height: {h.location.z + 0.115:.3f} m (top of head)')
# зазоры человек-станок в 067
hm = bpy.data.objects['human_st072_torso']
m72 = next(o for o in objs if o['id'] == 'machine_072')
face_x = m72['x'] + m72['w'] / 2
print(f'GAP human(torso x={hm.location.x:.2f}) to machine face(x={face_x:.2f}): '
      f'{hm.location.x - face_x - hm.dimensions.x / 2:.2f} m')
# сводка по GLB против плана
print('PLAN vs GLB (габарит по X x Y):')
for sid in sorted(GLB_INFO):
    mo = next((o for o in objs if o['id'] == f'machine_{sid}'), None)
    if not mo:
        continue
    bw, bd, bh = GLB_INFO[sid]['bbox']
    plan_w, plan_d = mo['w'], mo['d']
    print(f'  {sid}: план {plan_w:.2f}x{plan_d:.2f}  GLB(до поворота) {bw:.2f}x{bd:.2f}  '
          f'высота план {mo["h"]:.2f} / GLB {bh:.2f}')
# ============================================================ проходимость
print('=== ACCESS (flood-fill 0.1 м по плану, стены — препятствия) ===')
STEP = 0.1
xs_all = [r['x0'] for r in R.values()] + [r['x1'] for r in R.values()]
ys_all = [r['y0'] for r in R.values()] + [r['y1'] for r in R.values()]
gx0, gx1 = min(xs_all) - 1.0, max(xs_all) + 1.0
gy0, gy1 = min(ys_all) - 1.0, max(ys_all) + 1.0
nx = int((gx1 - gx0) / STEP) + 1
ny = int((gy1 - gy0) / STEP) + 1
blocked = [[False] * ny for _ in range(nx)]
for axis, mid, length, coord in wall_boxes:
    if axis == 'h':
        bx0, bx1 = mid - length / 2, mid + length / 2
        by0, by1 = coord - WT / 2, coord + WT / 2
    else:
        by0, by1 = mid - length / 2, mid + length / 2
        bx0, bx1 = coord - WT / 2, coord + WT / 2
    i0 = max(0, int((bx0 - gx0) / STEP))
    i1 = min(nx - 1, int((bx1 - gx0) / STEP))
    j0 = max(0, int((by0 - gy0) / STEP))
    j1 = min(ny - 1, int((by1 - gy0) / STEP))
    for i in range(i0, i1 + 1):
        for j in range(j0, j1 + 1):
            blocked[i][j] = True
seen = [[False] * ny for _ in range(nx)]
from collections import deque
si, sj = int((30.75 - gx0) / STEP), int((13.30 - gy0) / STEP)
q = deque([(si, sj)])
seen[si][sj] = True
while q:
    i, j = q.popleft()
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = i + di, j + dj
        if 0 <= a < nx and 0 <= b < ny and not seen[a][b] and not blocked[a][b]:
            seen[a][b] = True
            q.append((a, b))
for rid in sorted(R):
    if R[rid].get('kind') not in ('station', 'corridor'):
        continue
    rr = R[rid]
    ci, cj = int(((rr['x0'] + rr['x1']) / 2 - gx0) / STEP), int(((rr['y0'] + rr['y1']) / 2 - gy0) / STEP)
    print(f'ACCESS {rid:20} {"доступна" if seen[ci][cj] else "ЗАКРЫТА"}')
print('=== END ===')
