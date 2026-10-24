"""Жилая камера 4.4 × 4.2: две койки, стол, санмодуль, панели, персонаж лежит.

Запуск: blender -b --factory-startup -noaudio --python tools/room_cell.py
Выход: blockout/cell_v1_*.png, blockout/room_cell.blend
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from room_kit import RoomKit   # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
R = RoomKit(W=4.4, D=4.2, door_at=0.0, prefix='cell_')

BED_H = 0.42          # верх койки
BED1 = dict(cx=-1.05, cy=0.00, L=2.00, Wd=0.90)
BED2 = dict(cx=1.70, cy=0.65, L=2.00, Wd=0.90)   # вдоль восточной стены (по Y)


def bed(name, cx, cy, L, Wd, along_x=True):
    """Койка: каркас, матрас, подушка, одеяло."""
    if along_x:
        x0, x1, y0, y1 = cx - L / 2, cx + L / 2, cy - Wd / 2, cy + Wd / 2
    else:
        x0, x1, y0, y1 = cx - Wd / 2, cx + Wd / 2, cy - L / 2, cy + L / 2
    R.box(f'{name}_frame', x0, x1, y0, y1, 0.12, BED_H - 0.06, 'paint')
    for i, (lx, ly) in enumerate(((x0 + 0.08, y0 + 0.08), (x1 - 0.08, y0 + 0.08),
                                  (x0 + 0.08, y1 - 0.08), (x1 - 0.08, y1 - 0.08))):
        R.cyl(f'{name}_leg_{i}', lx, ly, 0.0, 0.12, 0.022, 'steel')
    R.box(f'{name}_mattress', x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02,
          BED_H - 0.06, BED_H + 0.06, 'soft')
    if along_x:
        R.box(f'{name}_pillow', x0 + 0.08, x0 + 0.44, cy - 0.24, cy + 0.24,
              BED_H + 0.06, BED_H + 0.15, 'white')
        R.box(f'{name}_blanket', cx + 0.22, x1 - 0.02, y0 + 0.02, y1 - 0.02,
              BED_H + 0.06, BED_H + 0.065, 'accent')
    else:
        R.box(f'{name}_pillow', cx - 0.24, cx + 0.24, y1 - 0.44, y1 - 0.08,
              BED_H + 0.06, BED_H + 0.15, 'white')
        R.box(f'{name}_blanket', x0 + 0.02, x1 - 0.02, y0 + 0.02, cy + 0.10,
              BED_H + 0.06, BED_H + 0.11, 'accent')


def build_beds():
    bed('bed1', **BED1, along_x=True)
    bed('bed2', **BED2, along_x=False)


def build_furniture():
    # стол и два табурета
    R.box('table_top', -1.15, -0.05, -2.02, -1.32, 0.72, 0.76, 'white')
    for i, (lx, ly) in enumerate(((-1.10, -1.97), (-0.10, -1.97), (-1.10, -1.37), (-0.10, -1.37))):
        R.cyl(f'table_leg_{i}', lx, ly, 0.0, 0.72, 0.018, 'steel')
    R.stool('stool1', -1.45, -1.67, h=0.45)
    R.stool('stool2', 0.25, -1.67, h=0.45)

    # санмодуль за перегородкой: унитаз и раковина
    R.box('san_partition', 0.90, 0.95, -2.10, -1.45, 0.0, 1.90, 'panel')
    R.box('san_partition_cap', 0.88, 0.97, -2.12, -1.43, 1.90, 1.94, 'steel')
    R.box('toilet_base', 1.35, 1.75, -1.95, -1.55, 0.0, 0.40, 'white')
    R.box('toilet_bowl', 1.40, 1.70, -1.90, -1.62, 0.40, 0.44, 'white')
    R.box('toilet_tank', 1.38, 1.72, -2.06, -1.94, 0.44, 0.86, 'white')
    R.box('basin_body', 1.85, 2.18, -1.95, -1.60, 0.0, 0.80, 'white')
    R.box('basin_bowl', 1.88, 2.15, -1.92, -1.63, 0.80, 0.84, 'steel')
    R.cyl('basin_tap', 2.02, -1.66, 0.84, 1.02, 0.016, 'steel')

    # панели музыки и света у входа
    R.box('panel_music', -1.30, -1.05, R.Y1 - 0.05, R.Y1 - 0.02, 1.28, 1.42, 'paint')
    R.box('panel_music_face', -1.27, -1.08, R.Y1 - 0.055, R.Y1 - 0.05, 1.30, 1.40, 'accent')
    R.box('panel_light', -0.95, -0.75, R.Y1 - 0.05, R.Y1 - 0.02, 1.28, 1.40, 'paint')
    R.box('panel_light_face', -0.93, -0.77, R.Y1 - 0.055, R.Y1 - 0.05, 1.30, 1.38, 'white')

    # вентиляция и решётка под потолком
    R.box('vent', 1.60, 1.95, R.Y0 + 0.02, R.Y0 + 0.06, 0.15, 0.30, 'seam')


def build_patient():
    # персонаж лежит на первой койке, головой к подушке (в сторону -X)
    R.patient((-1.02, BED1['cy'], BED_H + 0.07), height=1.70, lying=True, yaw=90)


R.shell()
R.doorway()
R.ceiling_lights([(-0.90, 0.30, -0.60, 0.60)])
build_beds()
build_furniture()
build_patient()
R.bevel_all()

print('=== ROOM ===', f'{R.W} x {R.D} x {R.H} m', 'area', round(R.W * R.D, 1))

R.lights(
    key=((-0.90, 0.30, R.H - 0.12), (1.80, 1.80), 55),
    fill=((0.0, R.Y1 - 0.35, 1.95), (1.20, 1.60), 18),
    rim=((R.X1 - 0.30, 0.30, 2.20), (0.40, 2.40), 14),
    extra=[('bed_lamp', (-1.90, 1.55, 1.95), (0.60, 0.60), 12)],
)
R.render_setup()

R.shot('cell_v1_a.png', (-1.85, -1.85, 1.62), (1.30, 1.40, 1.00), lens=22)
R.shot('cell_v1_b.png', (1.90, 1.85, 1.62), (-1.60, -1.30, 1.00), lens=22)
R.shot('cell_v1_bed.png', (-0.25, 1.60, 1.30), (-1.70, -0.10, 0.55), lens=26)
R.shot_top('cell_v1_top.png')

R.save('room_cell.blend')
print('SAVED')
