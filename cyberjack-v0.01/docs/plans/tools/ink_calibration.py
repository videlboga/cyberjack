"""Калибровочная 7.6 x 5.6 в инк-стиле: кушетка, монитор, шкаф, мойка, слоты.

Комната собрана по уже согласованной планировке (room_calibration.py), но
в языке рефа: белые панели со швами, тонкие линии по кромкам, серые размывки,
плотная обвязка (трубы, кабели, экраны), цвет только в приборах.

Запуск: blender -b --factory-startup -noaudio --python tools/ink_calibration.py
"""
import bpy, sys, os, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from ink_lib import Ink      # noqa: E402
from ink_kit import Kit      # noqa: E402

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
I = Ink()
I.build()
K = Kit(I, sc)

W, D, H = 7.6, 5.6, 2.80
X0, X1 = -W / 2, W / 2
Y0, Y1 = -D / 2, D / 2
DOOR_X, DOOR_W, DOOR_H = -1.45, 1.30, 2.25
BOX = dict(x0=X0, x1=X1, y0=Y0, y1=Y1)

# --- оболочка ---------------------------------------------------------------
K.box('floor', X0, X1, Y0, Y1, -0.10, 0.0, 'floor', 0.012)
K.box('ceiling', X0 - 0.2, X1 + 0.2, Y0 - 0.2, Y1 + 0.2, H, H + 0.10, 'wall_c', 0.01)
n = 0
for x in (-3.4, -2.3, -1.2, -0.1, 1.0, 2.1, 3.2):
    n += 1
    K.box(f'floor_seam_x{n}', x, x + 0.014, Y0, Y1, 0.0, 0.003, 'metal_d', 0.0)
for y in (-2.2, -1.1, 0.0, 1.1, 2.2):
    n += 1
    K.box(f'floor_seam_y{n}', X0, X1, y, y + 0.014, 0.0, 0.003, 'metal_d', 0.0)

K.box('wall_n', X0 - 0.2, X1 + 0.2, Y1, Y1 + 0.2, 0.0, H, 'wall', 0.01)
K.box('wall_e', X1, X1 + 0.2, Y0, Y1, 0.0, H, 'wall_c', 0.01)
K.box('wall_w', X0 - 0.2, X0, Y0, Y1, 0.0, H, 'wall_c', 0.01)
# южная стена с проёмом
dl, dr = DOOR_X - DOOR_W / 2, DOOR_X + DOOR_W / 2
K.box('wall_s_l', X0 - 0.2, dl, Y0 - 0.2, Y0, 0.0, H, 'wall_c', 0.01)
K.box('wall_s_r', dr, X1 + 0.2, Y0 - 0.2, Y0, 0.0, H, 'wall_c', 0.01)
K.box('wall_s_top', dl, dr, Y0 - 0.2, Y0, DOOR_H, H, 'wall_c', 0.01)
K.box('door_floor', dl, dr, Y0 - 0.35, Y0, -0.10, 0.0, 'floor', 0.008)
K.box('door_frame_l', dl - 0.07, dl, Y0 - 0.06, Y0 + 0.02, 0.0, DOOR_H + 0.07, 'metal', 0.01)
K.box('door_frame_r', dr, dr + 0.07, Y0 - 0.06, Y0 + 0.02, 0.0, DOOR_H + 0.07, 'metal', 0.01)
K.box('door_frame_t', dl - 0.07, dr + 0.07, Y0 - 0.06, Y0 + 0.02,
      DOOR_H, DOOR_H + 0.07, 'metal', 0.01)
K.box('door_mark_l', dl - 0.05, dl, Y0 - 0.02, Y0 + 0.01, 0.0, 0.16, 'orange', 0.004)

K.panel_wall('pn', 'X', Y1 - 0.03, X0, X1, 0.0, H, pw=0.72, ph=1.10)
K.panel_wall('pe', 'Y', X1 - 0.03, Y0, Y1, 0.0, H, pw=0.80, ph=1.10)
K.panel_wall('pw', 'Y', X0 + 0.002, Y0, Y1, 0.0, H, pw=0.80, ph=1.10)
K.box('plinth_n', X0, X1, Y1 - 0.05, Y1, 0.0, 0.14, 'metal_d', 0.006)
K.box('plinth_e', X1 - 0.05, X1, Y0, Y1, 0.0, 0.14, 'metal_d', 0.006)
K.box('plinth_w', X0, X0 + 0.05, Y0, Y1, 0.0, 0.14, 'metal_d', 0.006)

# --- потолок: панели света, лоток, трубы -----------------------------------
for i, x in enumerate((-2.4, 0.4)):
    K.box(f'light_panel_{i}', x, x + 1.6, -0.55, 0.55, H - 0.06, H - 0.03, 'screen', 0.004)
    K.box(f'light_case_l_{i}', x - 0.07, x, -0.62, 0.62, H - 0.07, H - 0.02, 'metal', 0.006)
    K.box(f'light_case_r_{i}', x + 1.6, x + 1.67, -0.62, 0.62, H - 0.07, H - 0.02, 'metal', 0.006)
K.box('tray', X0 + 0.2, X1 - 0.2, 1.55, 1.95, H - 0.16, H - 0.02, 'metal', 0.01)
for i, y in enumerate((1.62, 1.78, 1.90)):
    K.pipe(f'tray_pipe_{i}', [(X0 + 0.25, y, H - 0.20), (X1 - 0.25, y, H - 0.20)], 0.028)
for i, x in enumerate((-2.9, -1.2, 0.5, 2.2)):
    K.pipe(f'ceil_pipe_{i}', [(x, Y0 + 0.3, H - 0.09), (x, Y1 - 0.4, H - 0.09)], 0.038)
    for j, y in enumerate((-1.8, -0.2, 1.4, 2.4)):
        K.box(f'ceil_clamp_{i}_{j}', x - 0.045, x + 0.045, y - 0.05, y + 0.05,
              H - 0.13, H - 0.03, 'metal_d', 0.004)

# --- кушетка по центру ------------------------------------------------------
CX, CY = 0.25, 0.30
L, Wd, HB = 2.00, 0.80, 0.78
K.rbox('bed_frame', CX - L / 2, CX + L / 2, CY - Wd / 2, CY + Wd / 2, 0.42, HB - 0.16,
       'wall', r=0.05)
K.rbox('bed_mattress', CX - L / 2 + 0.02, CX + L / 2 - 0.02, CY - Wd / 2 + 0.02,
       CY + Wd / 2 - 0.02, HB - 0.16, HB, 'soft', r=0.06, segs=4)
K.box('bed_kick', CX - L / 2 + 0.08, CX + L / 2 - 0.08, CY - Wd / 2 + 0.08,
      CY + Wd / 2 - 0.08, 0.0, 0.10, 'metal_d', 0.01)
for i, (dx, dy) in enumerate(((-0.80, -0.30), (0.80, -0.30), (-0.80, 0.30), (0.80, 0.30))):
    K.box(f'bed_leg_{i}', CX + dx - 0.05, CX + dx + 0.05, CY + dy - 0.05, CY + dy + 0.05,
          0.10, 0.42, 'metal', 0.01)
# изголовье: наклонная панель с валиком, а не коробка
_bh = K.rbox('bed_head', CX - L / 2 - 0.02, CX - L / 2 + 0.10, CY - Wd / 2 + 0.03,
             CY + Wd / 2 - 0.03, HB, HB + 0.44, 'wall', r=0.03)
_bh.rotation_euler = (0, math.radians(-14), 0)
_bh.location.x -= 0.10
K.cyl('bed_head_rail', CX - L / 2 - 0.16, CY, HB + 0.44, HB + 0.48, 0.045, 'soft',
      verts=20, axis='Y')
bpy.data.objects['bed_head_rail'].scale.z = 4.4
K.rbox('bed_pillow', CX - L / 2 + 0.12, CX - L / 2 + 0.52, CY - 0.26, CY + 0.26,
       HB, HB + 0.10, 'soft', r=0.05, segs=4)
for i, dx in enumerate((-0.30, 0.45)):
    K.box(f'strap_{i}', CX + dx - 0.03, CX + dx + 0.03, CY - Wd / 2, CY + Wd / 2,
          HB - 0.02, HB + 0.005, 'dark', 0.004)

# --- монитор на стойке ------------------------------------------------------
K.box('mon_base', -2.95, -2.35, 1.60, 2.20, 0.0, 0.05, 'metal_d', 0.012)
K.box('mon_post', -2.70, -2.60, 1.85, 1.95, 0.05, 1.55, 'metal', 0.012)
K.box('mon_body', -3.05, -2.25, 1.72, 1.80, 1.40, 1.98, 'wall', 0.02)
K.screen('mon_scr', -2.98, -2.32, 1.70, 1.78, 1.46, 1.92, face='-Y')

# --- шкаф, мойка, табурет, тележка, капельница ------------------------------
K.rbox('ward', 2.85, 3.70, 1.55, 2.05, 0.0, 2.05, 'wall', r=0.02)
K.box('ward_seam', 3.27, 3.29, 1.53, 1.56, 0.08, 2.00, 'metal_d', 0.004)
K.box('ward_handle_l', 3.20, 3.24, 1.50, 1.54, 1.05, 1.32, 'metal', 0.006)
K.box('ward_handle_r', 3.32, 3.36, 1.50, 1.54, 1.05, 1.32, 'metal', 0.006)
K.grille('ward_grille', 3.02, 3.22, 1.52, 1.545, 0.30, 0.72, n=6)
K.box('ward_screen', 3.35, 3.62, 1.50, 1.52, 1.35, 1.62, 'screen', 0.004)

K.rbox('sink', 2.95, 3.55, -1.10, -0.50, 0.0, 0.85, 'wall', r=0.03)
K.rbox('sink_bowl', 3.02, 3.20, -1.02, -0.58, 0.85, 0.88, 'metal', r=0.02)
K.cyl('sink_tap', 3.12, -0.62, 0.88, 1.14, 0.016, 'metal', verts=16)
K.box('sink_back', 3.18, 3.22, -1.06, -0.54, 0.90, 1.14, 'metal', 0.004)

K.rbox('stool_seat', 1.75, 2.15, -0.90, -0.50, 0.46, 0.54, 'soft', r=0.04)
K.cyl('stool_post', 1.95, -0.70, 0.06, 0.46, 0.04, 'metal', verts=18)
K.cyl('stool_base', 1.95, -0.70, 0.0, 0.06, 0.20, 'metal_d', verts=24)

K.rbox('cart', -3.15, -2.55, -1.95, -1.40, 0.10, 0.86, 'wall', r=0.03)
for k in range(3):
    K.box(f'cart_draw_{k}', -3.11, -2.59, -1.99, -1.95, 0.18 + k * 0.22, 0.36 + k * 0.22,
          'metal', 0.005)
    K.box(f'cart_h_{k}', -2.95, -2.75, -2.01, -1.99, 0.24 + k * 0.22, 0.28 + k * 0.22,
          'metal_d', 0.003)
for k, dx in enumerate((-0.20, 0.20)):
    K.cyl(f'cart_w_{k}', -2.85 + dx, -1.98, 0.0, 0.10, 0.05, 'dark', verts=14, axis='Y')
K.box('cart_top', -3.18, -2.52, -1.98, -1.37, 0.86, 0.90, 'metal', 0.01)

K.cyl('iv_base', -1.30, 1.55, 0.0, 0.06, 0.22, 'metal_d', verts=24)
K.cyl('iv_post', -1.30, 1.55, 0.06, 1.86, 0.022, 'metal', verts=16)
K.box('iv_hook', -1.36, -1.24, 1.53, 1.57, 1.82, 1.88, 'metal', 0.006)
K.rbox('iv_bag', -1.44, -1.16, 1.40, 1.62, 1.44, 1.80, 'soft', r=0.04)
K.cable('iv_tube', [(-1.30, 1.48, 1.46), (-1.35, 1.30, 1.20), (-1.45, 1.00, 0.92),
                    (-1.60, 0.75, 0.80)], r=0.008, role='mid')

# --- монтажные слоты на северной стене -------------------------------------
for i, x in enumerate((-1.95, 0.35)):
    K.box(f'slot_back_{i}', x, x + 1.20, Y1 - 0.04, Y1 - 0.02, 0.35, 2.05, 'wall_c', 0.004)
    K.box(f'slot_side_l_{i}', x, x + 0.03, Y1 - 0.26, Y1 - 0.02, 0.35, 2.05, 'metal', 0.004)
    K.box(f'slot_side_r_{i}', x + 1.17, x + 1.20, Y1 - 0.26, Y1 - 0.02, 0.35, 2.05, 'metal', 0.004)
    K.box(f'slot_top_{i}', x, x + 1.20, Y1 - 0.26, Y1 - 0.02, 2.02, 2.05, 'metal', 0.004)
    K.box(f'slot_floor_{i}', x, x + 1.20, Y1 - 0.26, Y1 - 0.02, 0.35, 0.38, 'metal', 0.004)
    K.box(f'slot_plate_{i}', x + 0.04, x + 1.16, Y1 - 0.22, Y1 - 0.19, 0.35, 0.42, 'metal', 0.006)
    K.box(f'slot_power_{i}', x + 0.10, x + 0.34, Y1 - 0.235, Y1 - 0.22, 1.10, 1.28, 'mid', 0.004)
    K.box(f'slot_data_{i}', x + 0.82, x + 1.10, Y1 - 0.235, Y1 - 0.22, 1.10, 1.28, 'metal_d', 0.004)
    K.box(f'slot_tag_{i}', x + 0.52, x + 0.70, Y1 - 0.232, Y1 - 0.22, 1.66, 1.80, 'orange', 0.003)
    K.box(f'slot_rail_{i}', x + 0.06, x + 1.14, Y1 - 0.225, Y1 - 0.21, 1.92, 1.98, 'metal', 0.004)

# прибор внутри первого слота и полка во втором
K.rbox('slot_dev', -1.60, -1.05, Y1 - 0.24, Y1 - 0.06, 0.42, 1.30, 'wall', r=0.02)
K.screen('slot_dev_scr', -1.54, -1.11, Y1 - 0.26, Y1 - 0.24, 0.92, 1.22, face='-Y')
K.grille('slot_dev_grille', -1.54, -1.11, Y1 - 0.27, Y1 - 0.26, 0.52, 0.78, n=5, role='mid')
for k, x in enumerate((-1.52, -1.34, -1.16)):
    K.cyl(f'slot_dev_knob_{k}', x, Y1 - 0.28, 0.60, 0.64, 0.026, 'metal_d', verts=14, axis='Y')
K.box('slot_shelf', 0.45, 1.45, Y1 - 0.24, Y1 - 0.06, 1.15, 1.19, 'metal', 0.005)
for k, x in enumerate((0.55, 0.85, 1.15, 1.35)):
    K.rbox(f'slot_box_{k}', x, x + 0.22, Y1 - 0.22, Y1 - 0.09, 1.19, 1.42, 'wall', r=0.015)
    K.box(f'slot_box_lbl_{k}', x + 0.03, x + 0.19, Y1 - 0.23, Y1 - 0.22, 1.30, 1.36,
          ('cyan', 'orange', 'pink', 'cyan')[k], 0.0)

# тележка с прибором у кушетки
K.rbox('icart', 1.45, 2.00, 1.35, 1.95, 0.06, 0.82, 'wall', r=0.025)
K.box('icart_top', 1.42, 2.03, 1.32, 1.98, 0.82, 0.86, 'metal', 0.008)
K.screen('icart_scr', 1.50, 1.95, 1.30, 1.32, 0.90, 1.32, face='-Y')
for k, (dx, dy) in enumerate(((0.10, 0.10), (0.45, 0.10), (0.10, 0.48), (0.45, 0.48))):
    K.cyl(f'icart_w_{k}', 1.45 + dx, 1.35 + dy, 0.0, 0.06, 0.04, 'dark', verts=12, axis='Y')

# --- экраны и мелочь на стенах ----------------------------------------------
K.screen('ws_a', -3.55, -2.35, Y1 - 0.10, Y1 - 0.04, 1.35, 1.95, face='-Y')
K.screen('ws_b', 1.55, 1.95, Y1 - 0.10, Y1 - 0.04, 1.60, 2.05, face='-Y')
K.screen('ws_c', X1 - 0.04, X1 + 0.02, -2.30, -1.55, 1.25, 1.85, face='-X' if False else '-Y')
for i, (x, z) in enumerate(((-3.40, 0.75), (-2.20, 0.60), (2.60, 1.05))):
    K.box(f'jbox_{i}', x, x + 0.26, Y1 - 0.14, Y1 - 0.04, z, z + 0.32, 'wall', 0.008)
    K.grille(f'jbox_gr_{i}', x + 0.04, x + 0.22, Y1 - 0.15, Y1 - 0.14, z + 0.06, z + 0.16, n=4, role='mid')
    K.led(f'jbox_led_{i}', x + 0.06, Y1 - 0.155, z + 0.24, r=0.012, role='cyan')

# --- трубы по стенам и кабели ----------------------------------------------
K.pipe('nb_a', [(X0 + 0.15, Y1 - 0.22, 2.55), (X1 - 0.15, Y1 - 0.22, 2.55)], 0.045)
K.pipe('nb_b', [(X0 + 0.15, Y1 - 0.34, 2.38), (X1 - 0.15, Y1 - 0.34, 2.38)], 0.032)
K.pipe('nb_c', [(-3.30, Y1 - 0.22, 2.55), (-3.30, Y1 - 0.22, 0.55), (-3.05, Y1 - 0.22, 0.55),
                (-3.05, Y1 - 0.22, 0.35)], 0.045)
K.pipe('nb_d', [(3.25, Y1 - 0.22, 2.55), (3.25, Y1 - 0.22, 1.95), (3.45, Y1 - 0.22, 1.95)], 0.045)
K.pipe('eb_a', [(X1 - 0.20, Y0 + 0.4, 2.45), (X1 - 0.20, Y1 - 0.4, 2.45)], 0.04)
for i, y in enumerate((-1.9, -0.6, 0.8, 1.9)):
    K.box(f'eb_clamp_{i}', X1 - 0.26, X1 - 0.14, y - 0.05, y + 0.05, 2.36, 2.50, 'metal_d', 0.004)

cables = [
    [(-3.05, -1.30, 0.02), (-2.40, -0.70, 0.02), (-1.70, -0.30, 0.02), (-0.90, -0.55, 0.02),
     (-0.20, -0.30, 0.02), (0.60, -0.55, 0.02)],
    [(-2.60, 1.35, 0.02), (-1.90, 0.95, 0.03), (-1.10, 0.70, 0.02), (-0.30, 0.95, 0.02),
     (0.60, 0.70, 0.02), (1.40, 0.95, 0.02)],
    [(2.95, -0.45, 0.02), (2.30, -0.15, 0.03), (1.60, -0.45, 0.02), (0.95, -0.20, 0.02)],
    [(-1.30, 1.45, 0.02), (-1.55, 0.75, 0.03), (-1.30, 0.05, 0.02), (-1.60, -0.70, 0.02)],
]
for i, pts in enumerate(cables):
    K.cable(f'cab_{i}', pts)

# висячие кабели от лотка к приборам
K.cable('hang_1', [(-2.60, 1.70, H - 0.18), (-2.62, 1.55, 2.10), (-2.66, 1.50, 1.72)],
        r=0.009)
K.cable('hang_2', [(1.90, 1.70, H - 0.18), (1.92, 1.55, 2.15), (1.95, 1.50, 1.62)], r=0.009)
K.cable('hang_3', [(0.30, 1.70, H - 0.18), (0.45, 1.35, 2.20), (0.60, 1.05, 1.80)], r=0.008)


# --- плотность: каналы, приборчики, бирки, фурнитура ------------------------
# кабельные каналы по северной и восточной стене с распредкоробками
K.conduit('cd_n', [(X0 + 0.12, Y1 - 0.12, 2.62), (X1 - 0.12, Y1 - 0.12, 2.62)], r=0.020)
K.conduit('cd_e', [(X1 - 0.12, Y0 + 0.12, 2.55), (X1 - 0.12, Y1 - 0.12, 2.55)], r=0.020)
for i, x in enumerate((-3.05, -1.65, -0.25, 1.15, 2.55)):
    K.wall_device(f'wd_n{i}', x, x + 0.30, Y1 - 0.16, Y1 - 0.04, 2.10, 2.44,
                  led_role=('cyan', 'pink', 'cyan', 'orange', 'cyan')[i])
for i, y in enumerate((-2.05, -0.75, 0.55, 1.85)):
    K.box(f'jbe_{i}', X1 - 0.20, X1 - 0.04, y, y + 0.34, 2.02, 2.34, 'wall', 0.008)
    K.grille(f'jbe_gr{i}', X1 - 0.21, X1 - 0.20, y + 0.04, y + 0.30, 2.06, 2.20, n=4)
    K.led(f'jbe_led{i}', X1 - 0.215, y + 0.28, 2.28, r=0.010, role='cyan')

# пучки кабелей по полу вдоль стен
K.bundle('bund_s', [(X0 + 0.15, Y0 + 0.12, 0.02), (0.0, Y0 + 0.10, 0.02),
                    (1.6, Y0 + 0.14, 0.02), (X1 - 0.15, Y0 + 0.10, 0.02)], n=4, spread=0.030)
K.bundle('bund_w', [(X0 + 0.12, Y0 + 0.20, 0.02), (X0 + 0.10, 0.4, 0.02),
                    (X0 + 0.14, 1.6, 0.02), (X0 + 0.10, Y1 - 0.20, 0.02)], n=3, spread=0.028)

# бирки и маркировка на панелях
for i, (x, z) in enumerate(((-3.35, 1.62), (-2.55, 0.95), (-1.05, 1.75), (0.15, 0.62),
                            (1.35, 1.70), (2.45, 0.88), (3.30, 1.45))):
    K.tag(f'panel_tag_{i}', x, x + 0.16, Y1 - 0.035, Y1 - 0.028, z, z + 0.05,
          ('orange', 'cyan', 'orange', 'pink', 'cyan', 'orange', 'cyan')[i])
for i, y in enumerate((-2.30, -1.20, 0.35, 1.45)):
    K.tag(f'panel_tag_e{i}', X1 - 0.035, X1 - 0.028, y, y + 0.16, 1.05, 1.10, 'cyan')

# приборы на стенах: датчики, извещатели, кнопки
for i, (x, z) in enumerate(((-3.45, 2.32), (-2.15, 2.32), (0.85, 2.32), (2.35, 2.32))):
    K.wall_device(f'wd_top{i}', x, x + 0.22, Y1 - 0.12, Y1 - 0.04, z, z + 0.18,
                  led_role=('cyan', 'orange', 'cyan', 'pink')[i], grille=False)
for i, y in enumerate((-1.75, -0.35, 1.05, 2.15)):
    K.box(f'sensor_e{i}', X1 - 0.10, X1 - 0.02, y, y + 0.12, 1.98, 2.10, 'wall', 0.006)
    K.led(f'sensor_e_led{i}', X1 - 0.12, y + 0.06, 2.02, r=0.009, role='cyan')

# потолок: датчики, спринклеры, хомуты
for i, x in enumerate((-2.6, -1.0, 0.6, 2.2)):
    K.cyl(f'sprink_{i}', x, -1.6, H - 0.07, H - 0.02, 0.035, 'metal_d', verts=12)
    K.cyl(f'smoke_{i}', x + 0.6, 0.9, H - 0.06, H - 0.02, 0.05, 'wall', verts=16)
    K.led(f'smoke_led_{i}', x + 0.6, 0.9, H - 0.065, r=0.008, role='cyan')

# кронштейн монитора над кушеткой и рейлинг
K.box('arm_post', 1.35, 1.43, 1.15, 1.23, 0.0, 1.90, 'metal', 0.008)
K.box('arm_horiz', 0.55, 1.43, 1.16, 1.22, 1.86, 1.92, 'metal', 0.008)
K.screen('arm_scr', 0.45, 0.98, 1.02, 1.10, 1.42, 1.80, face='-Y')
K.cyl('rail_couch', CX - 0.65, CY + Wd / 2 + 0.05, 0.98, 1.02, 0.020, 'metal',
      verts=16, axis='X')

# фурнитура на оборудовании
for k in range(4):
    K.cyl(f'slot_dev_port{k}', -1.52 + k * 0.13, Y1 - 0.30, 1.32, 1.36, 0.018, 'metal_d',
          verts=12, axis='Y')
K.box('slot_dev_handle', -1.50, -1.15, Y1 - 0.30, Y1 - 0.27, 0.44, 0.48, 'metal', 0.006)
for k in range(3):
    K.box(f'ward_vent{k}', 2.98, 3.18, 1.52, 1.54, 0.34 + k * 0.06, 0.37 + k * 0.06, 'mid', 0.0)
for k, x in enumerate((-0.85, 0.55, 1.05)):
    K.cyl(f'bed_port{k}', x, CY - Wd / 2 - 0.03, 0.50, 0.54, 0.022, 'metal_d', verts=12, axis='Y')
K.cable('hose_1', [(-0.85, CY - 0.45, 0.52), (-1.10, CY - 0.75, 0.40),
                   (-1.35, CY - 1.00, 0.30), (-1.55, CY - 1.25, 0.10)], r=0.016, role='mid')
K.cable('hose_2', [(0.55, CY - 0.45, 0.52), (0.30, CY - 0.85, 0.36),
                   (0.05, CY - 1.15, 0.22), (-0.15, CY - 1.45, 0.06)], r=0.014, role='dark')

# пол: трап, разметка, мелкие плиты
K.rbox('drain', -2.05, -1.75, -2.55, -2.25, 0.0, 0.012, 'metal_d', r=0.01)
K.grille('drain_gr', -2.02, -1.78, -2.52, -2.28, 0.005, 0.014, n=4)
K.box('floor_mark_1', 1.25, 2.85, -2.45, -2.38, 0.0, 0.004, 'orange', 0.0)
K.box('floor_mark_2', 1.25, 1.32, -2.45, -1.35, 0.0, 0.004, 'orange', 0.0)
K.rbox('floor_plate', 2.55, 3.15, -0.35, 0.25, 0.0, 0.010, 'metal', r=0.008)


# --- средний пояс: приборы и обвязка на уровне глаз -------------------------
def cluster(name, x, z, w=0.46, h=0.34):
    K.rbox(f'{name}_body', x, x + w, Y1 - 0.16, Y1 - 0.03, z, z + h, 'wall', r=0.02)
    K.screen(f'{name}_scr', x + 0.03, x + w * 0.62, Y1 - 0.18, Y1 - 0.16, z + 0.10,
             z + h - 0.04, face='-Y')
    for k in range(3):
        K.cyl(f'{name}_kn{k}', x + w * 0.70 + k * 0.06, Y1 - 0.19, z + 0.12 + k * 0.03,
              z + 0.15 + k * 0.03, 0.018, 'metal_d', verts=12, axis='Y')
    K.led(f'{name}_led', x + w * 0.72, Y1 - 0.20, z + 0.06, r=0.010, role='cyan')
    K.cable(f'{name}_cb', [(x + w * 0.5, Y1 - 0.18, z), (x + w * 0.5, Y1 - 0.30, z - 0.10),
                           (x + w * 0.55, Y1 - 0.42, 0.02)], r=0.008)


cluster('cl_a', -2.35, 1.28)
cluster('cl_b', -0.35, 1.36, w=0.40, h=0.30)
cluster('cl_c', 2.45, 1.24, w=0.44, h=0.32)

# петли шлангов на стене и свисающие с потолка
for i, (x, z) in enumerate(((-1.55, 1.72), (1.35, 1.68))):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.16, minor_radius=0.022,
                                     major_segments=32, minor_segments=10,
                                     location=(x, Y1 - 0.18, z),
                                     rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.name = f'coil_{i}'
    I.apply(o, 'dark')
K.cable('drop_hose', [(1.55, Y1 - 0.30, 2.60), (1.45, Y1 - 0.55, 2.10),
                      (1.30, Y1 - 0.75, 1.55), (1.05, Y1 - 0.95, 1.15)], r=0.014, role='mid')

# шарнирная консоль-манипулятор на стене (как в рефе)
K.rbox('arm_base', 1.05, 1.35, Y1 - 0.22, Y1 - 0.03, 1.92, 2.12, 'wall', r=0.02)
K.cyl('arm_j1', 1.20, Y1 - 0.26, 1.86, 1.98, 0.075, 'metal', verts=20, axis='Y')
K.box('arm_seg1', 1.16, 1.24, Y1 - 1.05, Y1 - 0.26, 1.88, 1.96, 'metal', 0.012)
K.cyl('arm_j2', 1.20, Y1 - 1.10, 1.82, 1.94, 0.06, 'metal_d', verts=18, axis='Y')
K.box('arm_seg2', 1.16, 1.24, Y1 - 1.10, Y1 - 1.55, 1.60, 1.86, 'metal', 0.012)
K.screen('arm_hmi', 0.95, 1.45, Y1 - 1.62, Y1 - 1.55, 1.42, 1.62, face='-Y')

# --- контактные тени --------------------------------------------------------
K.blob('bl_couch', CX - L / 2, CX + L / 2, CY - Wd / 2, CY + Wd / 2, layers=3, pad=0.16)
K.blob('bl_cart', -3.15, -2.55, -1.98, -1.37, layers=2, pad=0.10)
K.blob('bl_stool', 1.75, 2.15, -0.90, -0.50, layers=2, pad=0.09)
K.blob('bl_ward', 2.85, 3.70, 1.55, 2.05, layers=2, pad=0.08)
K.blob('bl_sink', 2.95, 3.55, -1.10, -0.50, layers=2, pad=0.09)
K.blob('bl_mon', -2.95, -2.35, 1.60, 2.20, layers=2, pad=0.10)
K.blob('bl_iv', -1.52, -1.08, 1.33, 1.77, layers=3, pad=0.12)
K.blob('bl_icart', 1.45, 2.00, 1.35, 1.95, layers=2, pad=0.09)
K.blob('bl_under', -1.20, 1.55, 3.30, 3.90, layers=2, pad=0.10)

# --- камера и рендер --------------------------------------------------------
I.lights(sc)
cd = bpy.data.cameras.new('cam')
cd.lens = 24
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (-2.30, -1.80, 1.38)
aim = Vector((0.45, 1.35, 1.12)) - Vector(cam.location)
cam.rotation_euler = aim.to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

# два плана для линий: близкое жирнее, дальнее тоньше; плашки тени без линий
_near = bpy.data.collections.new('near')
_far = bpy.data.collections.new('far')
sc.collection.children.link(_near)
sc.collection.children.link(_far)
_cam = Vector(cam.location)
for _o in list(sc.objects):
    if _o.type not in {'MESH', 'CURVE'} or '_sh' in _o.name:
        continue
    _d = (_o.matrix_world.translation - _cam).length
    (_near if _d < 2.9 else _far).objects.link(_o)

I.render_setup(sc, res=(1680, 945), samples=32, exposure=-0.04, bloom=(1.9, 3))
I.ink(sc, thickness=1.5, crease=True, angle=150, collections=('near', 'far'))
sc.render.filepath = os.path.join(OUT, 'ink_calibration.png')
bpy.ops.render.render(write_still=True)
print('RENDERED ink_calibration.png')

# второй кадр: кушетка и слоты крупно
cam.location = (-1.25, -2.05, 1.42)
aim = Vector((0.55, 1.55, 1.05)) - Vector(cam.location)
cam.rotation_euler = aim.to_track_quat('-Z', 'Y').to_euler()
cd.lens = 30
sc.render.filepath = os.path.join(OUT, 'ink_calibration_detail.png')
bpy.ops.render.render(write_still=True)
print('RENDERED ink_calibration_detail.png')
print('DONE')
