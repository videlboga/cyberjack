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


def build_capsule():
    objs, info = K.build_device(K.DEVICES['capsule'], (2.00, -0.85), yaw=0, prefix='med_capsule_')
    assign_materials('med_capsule_')
    # площадка и подиум под капсулу
    R.box('capsule_plinth', 1.35, 2.65, -1.50, -0.20, 0.0, 0.10, 'paint')
    R.box('capsule_plinth_lip', 1.31, 2.69, -1.54, -0.16, 0.10, 0.13, 'steel')
    # пульт капсулы на стойке рядом
    R.box('capsule_console', 2.72, 3.02, -0.95, -0.75, 1.05, 1.35, 'paint')
    R.cyl('capsule_console_pole', 2.87, -0.85, 0.0, 1.05, 0.024, 'steel')
    R.cyl('capsule_console_base', 2.87, -0.85, 0.0, 0.05, 0.18, 'paint')
    R.box('capsule_console_screen', 2.69, 2.72, -0.92, -0.78, 1.08, 1.32, 'accent')
    print('CAPSULE', [round(v, 2) for v in info['size']], info['tris'])


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
    R.cyl('bio_bin', 2.60, -2.10, 0.0, 0.55, 0.19, 'accent')
    R.cyl('bio_bin_lid', 2.60, -2.10, 0.55, 0.58, 0.20, 'paint')


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
build_couch()
build_storage()
build_gas_panel()
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
