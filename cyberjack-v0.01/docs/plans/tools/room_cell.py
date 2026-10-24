"""Жилая камера v2 — по рефу living-cell-v2: обтекаемые формы, ниши, октогональный проём.

Что взято с рефа:
  * белые панели с мягкими радиусами, минтовая линия, крупные скругления мебели;
  * койки в нишах: подоконник-полка над изголовьем и подсветка под ней;
  * стол с толстой скруглённой столешницей на центральной тумбе;
  * табуреты-скруглённые кубы, а не цилиндры;
  * радиусная перегородка санмодуля, а не плоская плита;
  * проём со срезанными углами, настенные консоли, воздуховоды под потолком.

Запуск: blender -b --factory-startup -noaudio --python tools/room_cell.py
Выход: blockout/cell_v2_*.png, blockout/room_cell.blend
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from room_kit import RoomKit   # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
PALETTE = {
    'panel': (0.86, 0.87, 0.86),
    'panel_dim': (0.60, 0.62, 0.61),
    'seam': (0.20, 0.22, 0.22),
    'floor': (0.78, 0.79, 0.78),
    'grout': (0.42, 0.44, 0.43),
    'ceiling': (0.88, 0.89, 0.88),
    'soft': (0.46, 0.50, 0.48),        # серо-зелёный матрас как на рефе
    'accent': (0.38, 0.56, 0.52),      # минта
    'steel': (0.74, 0.76, 0.76),
    'paint': (0.80, 0.81, 0.80),       # корпуса мебели белые, а не тёмные
}
R = RoomKit(W=4.4, D=4.2, door_at=0.0, prefix='cell_', palette=PALETTE)

BED_H = 0.46
BED1 = dict(cx=-1.02, cy=0.00, L=2.00, Wd=0.92)
BED2 = dict(cx=1.62, cy=0.70, L=1.95, Wd=0.92)


def niche(name, x0, x1, y0, y1, wall, h=1.95):
    """Ниша за койкой: панель с подсветкой и полкой над изголовьем."""
    if wall == 'west':
        R.rbox(f'{name}_back', x0, x0 + 0.05, y0, y1, 0.10, h, 'panel_dim', r=0.02, seg=2)
        R.box(f'{name}_strip', x0 + 0.05, x0 + 0.07, y0 + 0.10, y1 - 0.10, 1.62, 1.66, 'accent')
        R.rbox(f'{name}_shelf', x0 + 0.02, x0 + 0.30, y0 + 0.06, y1 - 0.06, 1.66, 1.72,
               'panel', r=0.02)
    else:
        R.rbox(f'{name}_back', x1 - 0.05, x1, y0, y1, 0.10, h, 'panel_dim', r=0.02, seg=2)
        R.box(f'{name}_strip', x1 - 0.07, x1 - 0.05, y0 + 0.10, y1 - 0.10, 1.62, 1.66, 'accent')
        R.rbox(f'{name}_shelf', x1 - 0.30, x1 - 0.02, y0 + 0.06, y1 - 0.06, 1.66, 1.72,
               'panel', r=0.02)


def bed(name, cx, cy, L, Wd, along_x=True):
    """Койка в стиле рефа: скруглённая платформа, матрас, изголовье, лампа."""
    if along_x:
        x0, x1, y0, y1 = cx - L / 2, cx + L / 2, cy - Wd / 2, cy + Wd / 2
    else:
        x0, x1, y0, y1 = cx - Wd / 2, cx + Wd / 2, cy - L / 2, cy + L / 2
    R.rbox(f'{name}_base', x0, x1, y0, y1, 0.10, BED_H - 0.10, 'paint', r=0.05, seg=4)
    R.rbox(f'{name}_kick', x0 + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.06, 0.0, 0.10,
           'panel_dim', r=0.02)
    R.rbox(f'{name}_mattress', x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02,
           BED_H - 0.10, BED_H + 0.04, 'soft', r=0.07, seg=6)
    if along_x:
        R.rbox(f'{name}_head', x0 - 0.02, x0 + 0.10, y0 + 0.04, y1 - 0.04,
               BED_H, BED_H + 0.52, 'paint', r=0.05, seg=4)
        R.rbox(f'{name}_pillow', x0 + 0.14, x0 + 0.48, cy - 0.26, cy + 0.26,
               BED_H + 0.04, BED_H + 0.14, 'white', r=0.06, seg=6)
    else:
        R.rbox(f'{name}_head', cx - Wd / 2 + 0.04, cx + Wd / 2 - 0.04, y1 - 0.10, y1 + 0.02,
               BED_H, BED_H + 0.52, 'paint', r=0.05, seg=4)
        R.rbox(f'{name}_pillow', cx - 0.26, cx + 0.26, y1 - 0.48, y1 - 0.14,
               BED_H + 0.04, BED_H + 0.14, 'white', r=0.06, seg=6)


def build_beds():
    bed('bed1', **BED1, along_x=True)
    niche('niche1', -2.20, BED1['cx'] - BED1['L'] / 2, -0.46, 0.46, wall='west')
    bed('bed2', **BED2, along_x=False)
    niche('niche2', BED2['cx'] - BED2['Wd'] / 2, 2.20, BED2['cy'] - BED2['L'] / 2,
          BED2['cy'] + BED2['L'] / 2, wall='east', h=1.95)


def build_table():
    """Стол с толстой скруглённой столешницей на центральной тумбе."""
    cx, cy = 0.05, -1.30
    R.rbox('table_top', cx - 0.60, cx + 0.60, cy - 0.38, cy + 0.38, 0.70, 0.78,
           'panel', r=0.07, seg=6)
    R.rbox('table_lip', cx - 0.54, cx + 0.54, cy - 0.32, cy + 0.32, 0.64, 0.70,
           'panel_dim', r=0.04)
    R.rbox('table_pedestal', cx - 0.22, cx + 0.22, cy - 0.18, cy + 0.18, 0.10, 0.64,
           'paint', r=0.05, seg=4)
    R.rbox('table_kick', cx - 0.32, cx + 0.32, cy - 0.26, cy + 0.26, 0.0, 0.10,
           'panel_dim', r=0.03)
    # табуреты-кубы со скруглением
    for i, sx in enumerate((-0.78, 0.88)):
        R.rbox(f'stool_{i}_seat', cx + sx - 0.19, cx + sx + 0.19, cy - 0.19, cy + 0.19,
               0.40, 0.48, 'soft', r=0.06, seg=5)
        R.rbox(f'stool_{i}_body', cx + sx - 0.15, cx + sx + 0.15, cy - 0.15, cy + 0.15,
               0.06, 0.40, 'paint', r=0.04)
        R.rbox(f'stool_{i}_kick', cx + sx - 0.19, cx + sx + 0.19, cy - 0.19, cy + 0.19,
               0.0, 0.06, 'panel_dim', r=0.02)


def build_san():
    """Санмодуль за радиусной перегородкой."""
    sx, sy = 1.52, -1.52
    R.arc_wall('san_arc', sx, sy, 0.80, 150, 340, 0.0, 1.95, mat='panel', thick=0.05)
    R.box('san_arc_cap', sx - 0.82, sx + 0.82, sy - 0.82, sy + 0.82, 1.95, 1.99, 'steel')
    # унитаз: скруглённый корпус + бачок
    R.rbox('toilet_base', sx - 0.18, sx + 0.18, sy - 0.26, sy + 0.22, 0.0, 0.40, 'white', r=0.05)
    R.cyl('toilet_bowl', sx, sy - 0.02, 0.40, 0.46, 0.19, 'white', verts=32)
    R.rbox('toilet_tank', sx - 0.19, sx + 0.19, sy - 0.36, sy - 0.22, 0.46, 0.86, 'white', r=0.04)
    # раковина
    R.rbox('basin_body', sx - 0.44, sx - 0.06, sy + 0.30, sy + 0.74, 0.0, 0.80, 'white', r=0.05)
    R.rbox('basin_bowl', sx - 0.40, sx - 0.10, sy + 0.34, sy + 0.70, 0.80, 0.84, 'steel', r=0.03)
    R.cyl('basin_tap', sx - 0.25, sy + 0.70, 0.84, 1.02, 0.016, 'steel')
    # крючки и держатель
    R.box('san_hook', sx - 0.80, sx - 0.78, sy + 0.10, sy + 0.26, 1.28, 1.32, 'steel')


def build_walls_extras():
    """Настенные консоли и воздуховоды — как на рефе."""
    for i, (cx, cy, yaw) in enumerate(((-1.95, 1.05, 0), (1.95, -0.35, 180))):
        x0 = cx - 0.11
        R.rbox(f'console_{i}', x0, x0 + 0.22, cy - 0.16, cy + 0.16, 1.30, 1.62,
               'panel', r=0.03)
        R.box(f'console_{i}_screen', x0 - 0.006, x0, cy - 0.12, cy + 0.12, 1.36, 1.56, 'accent')
    # воздуховоды под потолком вдоль X
    for i, cy in enumerate((-1.05, -0.85)):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=4.0, vertices=20,
                                            location=(0, cy, 2.58),
                                            rotation=(0, math.radians(90), 0))
        o = bpy.context.object
        o.name = f'cell_duct_{i}'
        o.data.materials.append(R.M['steel'])
    for i, cx in enumerate((-1.9, -0.6, 0.7, 1.9)):
        R.box(f'duct_clamp_{i}', cx - 0.02, cx + 0.02, -1.14, -0.76, 2.52, 2.62, 'steel')


R.shell()
R.doorway()
R.octa_frame('cell_door_frame', 0.0, 1.16, 2.16, 0.0, mat='steel', corner=0.20,
             thick=0.08, depth=0.12)
R.ceiling_lights([(-1.10, 0.10, -0.55, 0.55)])
build_beds()
build_table()
build_san()
build_walls_extras()
R.patient((-1.02, BED1['cy'], BED_H + 0.05), height=1.70, lying=True, yaw=90)
R.bevel_all()

print('=== ROOM ===', f'{R.W} x {R.D} x {R.H} m', 'area', round(R.W * R.D, 1))

R.lights(
    key=((-0.40, 0.10, R.H - 0.12), (2.40, 2.00), 70),
    fill=((0.0, R.Y1 - 0.35, 1.95), (1.20, 1.60), 24),
    rim=((R.X1 - 0.30, 0.40, 2.20), (0.40, 2.40), 16),
    extra=[('bed_light', (-1.85, 0.0, 1.60), (0.30, 1.00), 10),
           ('san_light', (1.35, -1.40, 1.90), (0.60, 0.60), 8)],
)
R.render_setup()

R.shot('cell_v2_a.png', (-1.85, -1.85, 1.62), (1.30, 1.40, 1.00), lens=20)
R.shot('cell_v2_b.png', (1.90, 1.85, 1.62), (-1.60, -1.30, 1.00), lens=20)
R.shot('cell_v2_bed.png', (-0.25, 1.60, 1.30), (-1.75, -0.10, 0.60), lens=24)
R.shot('cell_v2_door.png', (0.05, 0.55, 1.55), (0.05, R.Y1, 1.20), lens=26)
R.shot_top('cell_v2_top.png')

R.save('room_cell.blend')
print('SAVED')
