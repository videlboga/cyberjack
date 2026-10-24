"""Жилая камера v3 — композиция по рефу living-cell-v2.

Композиция рефа:
  * камера ставится у южной стены и смотрит на север, в проём со срезанными углами;
  * две койки стоят ПЕРПЕНДИКУЛЯРНО боковым стенам, изголовьем к стене,
    в нишах с полкой и подсветкой над изголовьем;
  * стол с толстой скруглённой столешницей — по центру, два табурета-куба
    слева и справа от него;
  * санузел — в нише справа от проёма, за перегородкой с арочным проёмом;
  * шкафы-панели с вентиляцией — у северной стены слева от проёма;
  * трубные трассы под потолком вдоль стен.

Запуск: blender -b --factory-startup -noaudio --python tools/room_cell.py
Выход: blockout/cell_v3_*.png, blockout/room_cell.blend
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from room_kit import RoomKit   # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
PALETTE = {
    'panel': (0.86, 0.87, 0.86),
    'panel_dim': (0.62, 0.64, 0.63),
    'seam': (0.20, 0.22, 0.22),
    'floor': (0.80, 0.81, 0.80),
    'grout': (0.46, 0.48, 0.47),
    'ceiling': (0.88, 0.89, 0.88),
    'soft': (0.44, 0.49, 0.47),
    'accent': (0.38, 0.56, 0.52),
    'steel': (0.72, 0.74, 0.74),
    'paint': (0.82, 0.83, 0.82),
}
R = RoomKit(W=6.6, D=5.2, door_at=-0.90, prefix='cell_', palette=PALETTE)

BED_H = 0.46
BED_Y = 0.05          # ось коек
BED_L = 1.85          # длина койки от стены
BED_W = 0.92


def bed(name, side):
    """Койка перпендикулярно боковой стене: изголовье у стены, ножка в комнату."""
    if side == 'west':
        x0, x1 = R.X0, R.X0 + BED_L
        hx0, hx1 = R.X0, R.X0 + 0.10
        px0, px1 = R.X0 + 0.14, R.X0 + 0.48
    else:
        x0, x1 = R.X1 - BED_L, R.X1
        hx0, hx1 = R.X1 - 0.10, R.X1
        px0, px1 = R.X1 - 0.48, R.X1 - 0.14
    y0, y1 = BED_Y - BED_W / 2, BED_Y + BED_W / 2

    R.rbox(f'{name}_base', x0, x1, y0, y1, 0.10, BED_H - 0.12, 'paint', r=0.05, seg=4)
    R.rbox(f'{name}_plinth', x0 + 0.10, x1 - 0.06, y0 + 0.08, y1 - 0.08, 0.0, 0.10,
           'panel_dim', r=0.02)
    R.rbox(f'{name}_mattress', x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02,
           BED_H - 0.12, BED_H + 0.02, 'soft', r=0.07, seg=6)
    R.rbox(f'{name}_head', hx0, hx1, y0 + 0.04, y1 - 0.04, BED_H - 0.02, BED_H + 0.50,
           'paint', r=0.05, seg=4)
    R.rbox(f'{name}_pillow', px0, px1, BED_Y - 0.26, BED_Y + 0.26, BED_H + 0.02, BED_H + 0.12,
           'white', r=0.06, seg=6)
    # полка над изголовьем и подсветка под ней
    sx0, sx1 = (R.X0 + 0.02, R.X0 + 0.34) if side == 'west' else (R.X1 - 0.34, R.X1 - 0.02)
    R.rbox(f'{name}_shelf', sx0, sx1, y0 + 0.04, y1 - 0.04, 1.52, 1.58, 'panel', r=0.02)
    R.box(f'{name}_strip', sx0 + 0.02, sx1 - 0.02, y0 + 0.08, y1 - 0.08, 1.49, 1.52, 'accent')
    # ящик в торце койки
    box_x0 = x1 - 0.34 if side == 'west' else x0 + 0.02
    R.rbox(f'{name}_drawer', box_x0, box_x0 + 0.32, y0 + 0.10, y1 - 0.10,
           BED_H - 0.30, BED_H - 0.14, 'panel', r=0.03)


def build_beds():
    bed('bed_l', 'west')
    bed('bed_r', 'east')


def build_table():
    cx, cy = -0.10, 0.05
    R.rbox('table_top', cx - 0.66, cx + 0.66, cy - 0.42, cy + 0.42, 0.70, 0.79,
           'panel', r=0.08, seg=6)
    R.rbox('table_lip', cx - 0.60, cx + 0.60, cy - 0.36, cy + 0.36, 0.63, 0.70,
           'panel_dim', r=0.04)
    R.rbox('table_pedestal', cx - 0.26, cx + 0.26, cy - 0.20, cy + 0.20, 0.10, 0.63,
           'paint', r=0.05, seg=4)
    R.rbox('table_kick', cx - 0.36, cx + 0.36, cy - 0.28, cy + 0.28, 0.0, 0.10,
           'panel_dim', r=0.03)
    for i, sx in enumerate((-1.05, 0.85)):
        R.rbox(f'stool_{i}_seat', cx + sx - 0.19, cx + sx + 0.19, cy - 0.19, cy + 0.19,
               0.40, 0.47, 'soft', r=0.06, seg=5)
        R.rbox(f'stool_{i}_body', cx + sx - 0.15, cx + sx + 0.15, cy - 0.15, cy + 0.15,
               0.06, 0.40, 'paint', r=0.04)
        R.rbox(f'stool_{i}_kick', cx + sx - 0.19, cx + sx + 0.19, cy - 0.19, cy + 0.19,
               0.0, 0.06, 'panel_dim', r=0.02)


def build_san_niche():
    """Санузел: ниша справа от проёма за перегородкой с арочным проёмом."""
    px0, px1 = 1.62, 1.68                 # перегородка
    y0, y1 = 0.98, R.Y1
    open_a, open_b, open_h = 1.35, 2.10, 1.95
    R.box('san_wall_a', px0, px1, y0, open_a, 0.0, 2.30, 'panel')
    R.box('san_wall_b', px0, px1, open_b, y1, 0.0, 2.30, 'panel')
    R.rbox('san_wall_lintel', px0, px1, open_a, open_b, open_h, 2.30, 'panel', r=0.06, seg=4)
    # арочная окантовка
    R.rbox('san_arch', px0 - 0.02, px1 + 0.02, open_a - 0.06, open_b + 0.06,
           open_h - 0.02, open_h + 0.06, 'steel', r=0.05, seg=4)
    # ступень и пол ниши
    R.box('san_step', px1, R.X1, 0.98, R.Y1, 0.0, 0.06, 'panel_dim')
    # унитаз
    sx, sy = 2.45, 1.75
    R.rbox('toilet_base', sx - 0.18, sx + 0.18, sy - 0.26, sy + 0.22, 0.06, 0.44, 'white', r=0.05)
    R.cyl('toilet_bowl', sx, sy - 0.02, 0.44, 0.50, 0.19, 'white', verts=32)
    R.rbox('toilet_tank', sx - 0.19, sx + 0.19, sy - 0.36, sy - 0.22, 0.50, 0.90, 'white', r=0.04)
    # раковина
    R.rbox('basin_body', 2.85, 3.24, 2.12, 2.50, 0.06, 0.84, 'white', r=0.05)
    R.rbox('basin_bowl', 2.89, 3.20, 2.16, 2.47, 0.84, 0.88, 'steel', r=0.03)
    R.cyl('basin_tap', 3.04, 2.47, 0.88, 1.06, 0.016, 'steel')
    R.box('mirror', 2.90, 3.20, 2.575, 2.59, 1.15, 1.75, 'glass')


def build_storage():
    """Шкафы-панели с вентиляцией у северной стены слева от проёма."""
    x0, x1 = R.X0, R.X0 + 1.65
    y0, y1 = R.Y1 - 0.34, R.Y1
    R.rbox('wardrobe', x0, x1, y0, y1, 0.0, 2.30, 'panel', r=0.03, seg=3)
    for i, xx in enumerate((x0 + 0.02, x0 + 0.84)):
        R.box(f'wardrobe_door_{i}', xx, xx + 0.80, y0 - 0.005, y0, 0.06, 2.24, 'paint')
        R.box(f'wardrobe_gap_{i}', xx + 0.80, xx + 0.82, y0 - 0.01, y0, 0.06, 2.24, 'seam')
        R.box(f'wardrobe_handle_{i}', xx + 0.72, xx + 0.76, y0 - 0.03, y0, 1.00, 1.24, 'steel')
    R.box('wardrobe_vent', x0 + 0.25, x0 + 0.65, y0 - 0.006, y0, 0.45, 0.95, 'seam')
    R.box('wardrobe_screen', x0 + 1.15, x0 + 1.45, y0 - 0.03, y0, 1.25, 1.55, 'accent')


def build_wall_extras():
    # консоли с зелёными экранами
    for i, (cx, cy, axis) in enumerate(((-2.30, BED_Y + 0.62, 'y'), (2.10, BED_Y - 0.62, 'y'))):
        R.rbox(f'console_{i}', cx - 0.11, cx + 0.11, cy - 0.05, cy + 0.05, 1.25, 1.60,
               'panel', r=0.03)
        R.box(f'console_{i}_scr', cx - 0.07, cx + 0.07, cy - 0.055, cy - 0.05, 1.32, 1.54,
              'accent')
    # трубные трассы под потолком вдоль стен
    for i, (yy, xx0, xx1) in enumerate(((-2.20, R.X0, R.X1), (2.10, 1.70, R.X1))):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=abs(xx1 - xx0), vertices=20,
                                            location=((xx0 + xx1) / 2, yy, 2.55),
                                            rotation=(0, math.radians(90), 0))
        o = bpy.context.object
        o.name = f'cell_pipe_{i}'
        o.data.materials.append(R.M['steel'])
    for i, cx in enumerate((-2.6, -1.2, 0.4, 2.0)):
        R.box(f'pipe_clamp_{i}', cx - 0.02, cx + 0.02, -2.26, -2.14, 2.48, 2.60, 'steel')


R.shell()
R.doorway()
R.octa_frame('cell_door_frame', R.door_at, 1.16, 2.16, 0.0, mat='steel', corner=0.20,
             thick=0.08, depth=0.12)
R.ceiling_lights([(-2.10, -0.90, -0.95, 0.65), (0.60, 1.80, -0.95, 0.65)])
build_beds()
build_table()
build_san_niche()
build_storage()
build_wall_extras()
R.patient((R.X0 + 0.95, BED_Y, BED_H + 0.03), height=1.70, lying=True, yaw=90)
R.bevel_all()

print('=== ROOM ===', f'{R.W} x {R.D} x {R.H} m', 'area', round(R.W * R.D, 1))

R.lights(
    key=((-0.10, -0.35, R.H - 0.12), (2.20, 1.60), 90),
    fill=((R.door_at, R.Y1 - 0.35, 1.95), (1.20, 1.60), 28),
    rim=((R.X1 - 0.30, 0.60, 2.20), (0.40, 2.20), 18),
    extra=[('left_light', (R.X0 + 0.60, BED_Y, 1.80), (0.40, 1.20), 14),
           ('right_light', (R.X1 - 0.60, BED_Y, 1.80), (0.40, 1.20), 14)],
)
R.render_setup()

# главный кадр — как в рефе: от южной стены в сторону проёма
R.shot('cell_v3_main.png', (-0.55, R.Y0 + 0.18, 1.45), (-0.55, R.Y1, 1.20), lens=18)
R.shot('cell_v3_bed.png', (-0.60, -1.60, 1.35), (-2.40, 0.10, 0.70), lens=26)
R.shot('cell_v3_san.png', (0.40, 0.20, 1.60), (2.60, 1.70, 1.00), lens=26)
R.shot('cell_v3_back.png', (-0.30, 1.90, 1.55), (0.60, R.Y0 + 0.4, 1.10), lens=24)
R.shot_top('cell_v3_top.png')

R.save('room_cell.blend')
print('SAVED')
