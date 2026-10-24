"""Медблок 6.4 × 5.2: восстановительная капсула, кушетка, препараты.

Состав: капсула (ассет Creature Tank) на площадке, кушетка восстановления,
монитор на стойке, капельница с мешком, шкаф с застеклённой створкой, мойка,
столик с препаратами, медицинская газовая панель, табурет, ведро-биоотходы.

Запуск: blender -b --factory-startup -noaudio --python tools/room_medbay.py
Выход: blockout/med_v1_*.png, blockout/room_medbay.blend
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
import kit_devices as K          # noqa: E402
from room_kit import RoomKit     # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
R = RoomKit(W=6.4, D=5.2, door_at=0.0, prefix='med_')

CAP_X, CAP_Y = 1.85, -0.85     # центр капсулы
CAP_R, CAP_H = 0.63, 2.42      # радиус и высота: 0.13 + 2.42 = 2.55 при потолке 2.70

# --- оборудование -----------------------------------------------------------
def assign_materials(prefix):
    for o in bpy.data.objects:
        if not o.name.startswith(prefix) or o.type != 'MESH':
            continue
        n = o.name.lower()
        if 'glass' in n:
            m = R.M['glass']
        elif any(k in n for k in ('tank', 'legs', 'support', 'frame', 'pole', 'rod')):
            m = R.M['steel']
        else:
            m = R.M['paint']
        o.data.materials.clear()
        o.data.materials.append(m)


def zspan(o):
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    return min(zs), max(zs)


def scale_z(o, k, anchor):
    o.data.transform(Matrix.Translation((0, 0, anchor))
                     @ Matrix.Diagonal((1, 1, k, 1))
                     @ Matrix.Translation((0, 0, -anchor)))


def move_z(o, dz):
    o.data.transform(Matrix.Translation((0, 0, dz)))


def build_capsule():
    spec = dict(K.DEVICES['capsule'])
    spec['target'] = (CAP_R * 2, CAP_R * 2, CAP_H)
    objs, info = K.build_device(spec, (CAP_X, CAP_Y), yaw=0, prefix='med_capsule_')
    assign_materials('med_capsule_')

    # у ассета толстая станина (0.47) и высокая крышка: внутри остаётся 1.46 м.
    # Осаживаем станину и крышку по Z, стекло растягиваем — внутри 2.1 м.
    def find(part):
        got = [o for o in bpy.data.objects if part in o.name and o.type == 'MESH']
        return got[0] if got else None

    base, glass, cap = find('Tank_Base'), find('Glass'), find('Tank_Top')
    if base and glass and cap:
        top = 0.13 + CAP_H                     # верх капсулы над полом комнаты
        b0, b1 = zspan(base)
        scale_z(base, 0.16 / (b1 - b0), b0)     # станина 0.16
        c0, c1 = zspan(cap)
        scale_z(cap, 0.26 / (c1 - c0), c0)      # крышка 0.26
        c0, c1 = zspan(cap)
        move_z(cap, (top - 0.26) - c0)
        g0, g1 = zspan(glass)
        scale_z(glass, ((top - 0.26) - 0.16) / (g1 - g0), g0)
        move_z(glass, (0.13 + 0.16) - g0)
        print('CAPSULE_TUNE base 0.16, glass', round((top - 0.26) - (0.13 + 0.16), 2),
              ', cap 0.26')
    # подиум под капсулу
    R.box('capsule_plinth', CAP_X - CAP_R - 0.10, CAP_X + CAP_R + 0.10,
          CAP_Y - CAP_R - 0.10, CAP_Y + CAP_R + 0.10, 0.0, 0.10, 'paint')
    R.box('capsule_plinth_lip', CAP_X - CAP_R - 0.14, CAP_X + CAP_R + 0.14,
          CAP_Y - CAP_R - 0.14, CAP_Y + CAP_R + 0.14, 0.10, 0.13, 'steel')
    # пульт капсулы на стойке рядом
    R.box('capsule_console', 2.72, 3.02, -0.95, -0.75, 1.05, 1.35, 'paint')
    R.cyl('capsule_console_pole', 2.87, -0.85, 0.0, 1.05, 0.024, 'steel')
    R.cyl('capsule_console_base', 2.87, -0.85, 0.0, 0.05, 0.18, 'paint')
    R.box('capsule_console_screen', 2.69, 2.72, -0.92, -0.78, 1.08, 1.32, 'accent')
    # внутри капсулы только персонаж: ложе и жидкость убраны
    print('CAPSULE', [round(v, 2) for v in info['size']], info['tris'])


def build_patient():
    """Персонаж внутри капсулы: VRM-модель, руки опущены, рост 1.72."""
    candidates = [
        os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', 'assets', '3d',
                                     'converted', 'anna_nude.glb')),
        '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/anna_nude.glb',
    ]
    path = next((p for p in candidates if os.path.exists(p)), None)
    if not path:
        print('PATIENT MISS: anna_nude.glb не найден')
        return
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    all_meshes = [o for o in new if o.type == 'MESH']
    # в VRM приезжает служебная плоскость 2x2 без скина — она ломает габарит
    meshes = [o for o in all_meshes if any(m.type == 'ARMATURE' for m in o.modifiers)]
    for o in [x for x in all_meshes if x not in meshes]:
        bpy.data.objects.remove(o, do_unlink=True)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next((o for o in new if o.type == 'ARMATURE'), None)
    for o in new:
        o.name = 'med_patient_' + o.name

    def measure():
        """Габарит по деформированной сетке: армтура меняет позу, а не вершины."""
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        pts = []
        for o in meshes:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            pts += [ev.matrix_world @ v.co for v in me.vertices]
            ev.to_mesh_clear()
        if not pts:
            return (0, 0, 0, 0)
        return (max(p.x for p in pts) - min(p.x for p in pts),
                max(p.y for p in pts) - min(p.y for p in pts),
                min(p.z for p in pts), max(p.z for p in pts))

    # руки вниз: подбираем ось и знак поворота плеч по минимальной ширине модели
    best = None
    if arm:
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode='POSE')
        for pb in arm.pose.bones:
            pb.rotation_mode = 'XYZ'
        for axis in (0, 1, 2):
            for sgn in (1, -1):
                for ang in (55, 70, 85):
                    for pb in arm.pose.bones:
                        pb.rotation_euler = (0, 0, 0)
                        pb.matrix_basis.identity()
                    for side, ssgn in (('L', sgn), ('R', -sgn)):
                        pb = arm.pose.bones.get(f'J_Bip_{side}_UpperArm')
                        if not pb:
                            continue
                        e = [0.0, 0.0, 0.0]
                        e[axis] = math.radians(ang * ssgn)
                        pb.rotation_euler = e
                    w, d, z0, z1 = measure()
                    if best is None or w < best[0]:
                        best = (w, d, axis, sgn, ang)
        # ставим лучшую комбинацию
        for pb in arm.pose.bones:
            pb.rotation_euler = (0, 0, 0)
            pb.matrix_basis.identity()
        w, d, axis, sgn, ang = best
        for side, ssgn in (('L', sgn), ('R', -sgn)):
            pb = arm.pose.bones.get(f'J_Bip_{side}_UpperArm')
            if not pb:
                continue
            e = [0.0, 0.0, 0.0]
            e[axis] = math.radians(ang * ssgn)
            pb.rotation_euler = e
        bpy.ops.object.mode_set(mode='OBJECT')
        print('POSE best axis', axis, 'sign', sgn, 'angle', ang, 'width', round(w, 2))

    # пол капсулы — верх станины ассета; крышка — низ Tank_Top
    def zrange(part):
        objs = [o for o in bpy.data.objects if part in o.name and o.type == 'MESH']
        zs = [(o.matrix_world @ v.co).z for o in objs for v in o.data.vertices]
        return (min(zs), max(zs)) if zs else (0.0, 0.0)

    floor_z = zrange('Tank_Base')[1]
    cap_z = zrange('Tank_Top')[0]
    avail = cap_z - floor_z
    target_h = min(1.70, avail - 0.06)     # рост не выше свободной высоты капсулы
    print('CAPSULE_INSIDE floor', round(floor_z, 2), 'cap', round(cap_z, 2),
          'avail', round(avail, 2), 'h', round(target_h, 2))

    w, d, z0, z1 = measure()
    k = target_h / (z1 - z0)
    pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    for o in new:
        o.matrix_world = (Matrix.Translation((CAP_X, CAP_Y, floor_z + 0.004))
                          @ Matrix.Scale(k, 4)
                          @ Matrix.Translation((-cx, -cy, -z0))
                          @ o.matrix_world)
    bpy.context.view_layer.update()
    w, d, z0, z1 = measure()
    print('PATIENT', 'h', round(z1 - z0, 2), 'w', round(w, 2),
          'tris', sum(len(o.data.polygons) for o in meshes))


def disc(name, x, y, z, r, depth, axis, mat):
    """Диск/патрубок вдоль оси X или Y (манометр, порт, разъём)."""
    rot = (0, math.radians(90), 0) if axis == 'x' else (math.radians(90), 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=(x, y, z),
                                        rotation=rot, vertices=24)
    o = bpy.context.object
    o.name = 'med_' + name
    o.data.materials.append(R.M[mat])
    return o


def build_capsule_station():
    """Стойка в юго-восточном углу (манометры в комнату), пульт на южной стене,
    порты на восточной стороне капсулы и три шланга между ними."""
    # стойка в углу, фронт смотрит на запад (-x), в комнату
    x0, x1, y0, y1 = 2.62, 3.16, -2.54, -2.06
    R.box('lsu_body', x0, x1, y0, y1, 0.10, 1.38, 'paint')
    R.box('lsu_cap', x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, 1.38, 1.44, 'paint')
    R.box('lsu_toe', x0, x1, y0, y1, 0.0, 0.10, 'plinth')
    R.box('lsu_face', x0 - 0.002, x0 + 0.010, y0 + 0.04, y1 - 0.04, 0.88, 1.32, 'accent')
    for i, dy in enumerate((0.10, 0.28, 0.44)):
        disc(f'lsu_gauge_ring_{i}', x0 - 0.008, y0 + dy, 1.18, 0.062, 0.014, 'x', 'steel')
        disc(f'lsu_gauge_{i}', x0 - 0.016, y0 + dy, 1.18, 0.052, 0.012, 'x', 'white')
    for i, dy in enumerate((0.10, 0.20, 0.30, 0.40)):
        R.box(f'lsu_led_{i}', x0 - 0.012, x0 - 0.004, y0 + dy - 0.018, y0 + dy + 0.018,
              1.00, 1.03, 'accent' if i % 2 == 0 else 'white')
    R.box('lsu_vent', x0 - 0.008, x0 - 0.002, y0 + 0.06, y1 - 0.06, 0.26, 0.52, 'seam')
    for i, dy in enumerate((0.10, 0.40)):
        disc(f'lsu_knob_{i}', x0 - 0.012, y0 + dy, 0.68, 0.026, 0.016, 'x', 'steel')
    # пульт на южной стене, экраны смотрят в комнату (+y)
    wy = R.Y0 + 0.03
    R.box('wall_panel', 1.10, 2.30, wy, wy + 0.07, 1.26, 1.98, 'paint')
    R.box('wall_screen_1', 1.18, 1.80, wy + 0.072, wy + 0.080, 1.38, 1.90, 'accent')
    R.box('wall_screen_2', 1.86, 2.22, wy + 0.072, wy + 0.080, 1.38, 1.90, 'white')
    for i in range(5):
        R.box(f'wall_button_{i}', 1.20 + i * 0.10, 1.26 + i * 0.10, wy + 0.072, wy + 0.082,
              1.06, 1.14, 'steel')
    R.box('wall_label', 1.88, 2.20, wy + 0.072, wy + 0.078, 1.04, 1.12, 'accent')
    # порты на восточной стороне капсулы
    for i, (py, pz, m) in enumerate(((-1.20, 1.28, 'accent'), (-1.05, 1.02, 'steel'),
                                     (-0.90, 0.74, 'white'))):
        disc(f'port_{i}', CAP_X + CAP_R - 0.01, py, pz, 0.040, 0.09, 'x', 'steel')
        disc(f'port_collar_{i}', CAP_X + CAP_R + 0.035, py, pz, 0.048, 0.02, 'x', m)
    # шланги: подача, возврат, газ
    px = CAP_X + CAP_R
    R.hose('hose_supply', [(2.68, -2.10, 1.30), (2.70, -1.70, 1.52), (2.66, -1.40, 1.44),
                           (px, -1.20, 1.28)], radius=0.028, mat='accent')
    R.hose('hose_return', [(2.78, -2.10, 1.10), (2.76, -1.72, 1.26), (2.68, -1.35, 1.14),
                           (px, -1.05, 1.02)], radius=0.024, mat='steel')
    R.hose('hose_gas', [(2.72, -2.08, 0.82), (2.70, -1.62, 0.70), (2.66, -1.22, 0.66),
                        (px, -0.90, 0.74)], radius=0.020, mat='white')
    # кабель питания стойки в стену
    R.hose('lsu_cable', [(3.14, -2.30, 0.55), (3.18, -2.45, 0.32), (3.10, R.Y0 + 0.06, 0.22)],
           radius=0.014, mat='paint')


def build_couch():
    R.couch('couch', cx=-1.90, cy=0.55, L=2.00, Wd=0.80, h=0.78, headrest=True, straps=0)
    R.monitor('monitor', -3.02, 0.55, h=1.44)
    R.iv('iv', -0.90, 1.55, h=1.85)
    R.stool('stool', -2.55, -0.55)


def build_storage():
    R.cabinet('cabinet', -3.18, -2.73, -0.95, 0.05, h=2.00, glass=True)
    R.sink('sink', -3.18, -2.60, -2.20, -1.60)
    # столик с препаратами
    R.box('tray_top', -1.15, -0.55, -0.32, 0.13, 0.78, 0.82, 'steel')
    R.box('tray_shelf', -1.15, -0.55, -0.32, 0.13, 0.42, 0.45, 'steel')
    for i, (dx, dy) in enumerate(((-1.10, -0.27), (-0.60, -0.27), (-1.10, 0.08), (-0.60, 0.08))):
        R.cyl(f'tray_leg_{i}', dx, dy, 0.0, 0.42, 0.012, 'steel')
    R.box('tray_bin_1', -1.10, -0.92, -0.28, -0.05, 0.82, 0.98, 'white')
    R.box('tray_bin_2', -0.88, -0.64, -0.28, -0.05, 0.82, 0.94, 'accent')
    # ведро биоотходов
    R.cyl('bio_bin', -0.35, -2.30, 0.0, 0.55, 0.19, 'accent')
    R.cyl('bio_bin_lid', -0.35, -2.30, 0.55, 0.58, 0.20, 'paint')


def build_gas_panel():
    """Медицинская газовая панель у кушетки: два разъёма и манометр."""
    y = R.Y0 + 0.03
    R.box('gas_panel', -2.55, -1.15, y, y + 0.06, 1.30, 1.62, 'steel')
    for i, dx in enumerate((-2.30, -1.95)):
        R.cyl(f'gas_port_{i}', dx, y + 0.09, 1.38, 1.52, 0.035, 'paint')
    R.cyl('gas_gauge', -1.45, y + 0.09, 1.38, 1.52, 0.055, 'white')
    R.box('gas_label', -2.52, -2.05, y + 0.061, y + 0.066, 1.54, 1.60, 'accent')


R.shell()
R.doorway()
R.ceiling_lights([(-2.30, -1.10, -0.90, 0.30), (0.70, 1.90, -0.90, 0.30)])
build_capsule()
build_patient()
build_capsule_station()
build_couch()
build_storage()
build_gas_panel()
for o in bpy.data.objects:
    if o.name in ('med_capsule_liquid',):
        o.hide_render = False
R.bevel_all()

print('=== ROOM ===', f'{R.W} x {R.D} x {R.H} m', 'area', round(R.W * R.D, 1))

R.lights(
    key=(( -1.90, 0.55, R.H - 0.12), (1.60, 0.90), 80),
    fill=((0.0, R.Y1 - 0.35, 1.95), (1.20, 1.80), 22),
    rim=((R.X1 - 0.30, -0.20, 2.20), (0.40, 2.60), 18),
    extra=[('capsule_key', (2.00, -0.85, R.H - 0.15), (1.10, 1.10), 40),
           ('west_fill', (R.X0 + 0.35, 0.20, 2.30), (0.40, 2.40), 12)],
)
R.render_setup()

R.shot('med_v1_a.png', (-2.80, -2.20, 1.62), (2.20, 0.40, 1.05), lens=22)
R.shot('med_v1_b.png', (2.85, 1.95, 1.62), (-2.40, -1.20, 1.05), lens=22)
R.shot('med_v1_capsule.png', (-1.60, -2.30, 1.50), (2.00, -0.85, 1.10), lens=26)
R.shot_top('med_v1_top.png')

R.save('room_medbay.blend')
print('SAVED')
