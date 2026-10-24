"""Мастерская-бэй по композиции рефа sex_machine.png.

Повторяет не материалы, а постановку: крупный верстак с машиной в центре кадра,
мониторы на кронштейнах над ним, шкафы по краям (обрезаны кадром), плотная стена
приборов за верстаком, потолок из коробов и труб, кабели через пол к камере.

Запуск: blender -b --factory-startup -noaudio --python tools/ink_workshop.py
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

W, D, H = 6.4, 5.4, 2.75
X0, X1 = -W / 2, W / 2
Y0, Y1 = -D / 2, D / 2

# --- оболочка ---------------------------------------------------------------
K.box('floor', X0, X1, Y0, Y1, -0.10, 0.0, 'floor', 0.012)
K.box('ceiling', X0 - 0.2, X1 + 0.2, Y0 - 0.2, Y1 + 0.2, H, H + 0.1, 'wall_c', 0.01)
K.box('wall_n', X0 - 0.2, X1 + 0.2, Y1, Y1 + 0.2, 0.0, H, 'wall', 0.01)
K.box('wall_e', X1, X1 + 0.2, Y0, Y1, 0.0, H, 'wall_c', 0.01)
K.box('wall_w', X0 - 0.2, X0, Y0, Y1, 0.0, H, 'wall_c', 0.01)
K.box('wall_s', X0 - 0.2, X1 + 0.2, Y0 - 0.2, Y0, 0.0, H, 'wall_c', 0.01)

K.panel_wall('pn', 'X', Y1 - 0.03, X0, X1, 0.0, H, pw=0.70, ph=1.10)
K.panel_wall('pw', 'Y', X0 + 0.004, Y0, Y1, 0.0, H, pw=0.75, ph=1.10)
K.panel_wall('pe', 'Y', X1 - 0.03, Y0, Y1, 0.0, H, pw=0.75, ph=1.10)
for i in range(1, 7):
    K.box(f'floor_seam_{i}', X0, X1, Y0 + i * 0.77, Y0 + i * 0.77 + 0.014, 0.0, 0.003, 'metal_d')
K.box('plinth_n', X0, X1, Y1 - 0.06, Y1, 0.0, 0.16, 'metal_d', 0.006)
K.box('plinth_w', X0, X0 + 0.06, Y0, Y1, 0.0, 0.16, 'metal_d', 0.006)
K.box('plinth_e', X1 - 0.06, X1, Y0, Y1, 0.0, 0.16, 'metal_d', 0.006)

# --- потолок: короба, трубы, лоток, подвесной светильник -------------------
K.box('duct_a', X0 + 0.1, X1 - 0.1, -1.05, -0.55, H - 0.30, H - 0.02, 'metal', 0.02)
K.box('duct_b', X0 + 0.1, X1 - 0.1, 1.35, 1.75, H - 0.26, H - 0.02, 'metal', 0.02)
for i, y in enumerate((-1.85, -1.45, 0.35, 0.75, 2.05)):
    K.pipe(f'cp_{i}', [(X0 + 0.05, y, H - 0.10), (X1 - 0.05, y, H - 0.10)], 0.035)
for i, x in enumerate((-2.4, -0.9, 0.6, 2.1)):
    K.pipe(f'cpv_{i}', [(x, Y1 - 0.25, H - 0.05), (x, Y1 - 0.25, 2.45)], 0.03)
K.box('tray', X0 + 0.3, X1 - 0.3, 0.55, 0.85, H - 0.14, H - 0.02, 'metal', 0.01)
# подвесной светильник над верстаком
K.box('lamp_rod', -0.15, -0.05, 1.1, 1.2, 2.20, H - 0.02, 'metal', 0.006)
K.box('lamp_body', -0.35, 0.35, 1.00, 1.30, 2.08, 2.15, 'metal', 0.012)
K.box('lamp_glow', -0.31, 0.31, 1.04, 1.26, 2.06, 2.08, 'screen', 0.004)

# --- верстак с машиной (центр кадра) ---------------------------------------
BX0, BX1, BY0, BY1, BZ = -1.75, 1.35, 1.05, 1.95, 0.92
K.box('bench_top', BX0, BX1, BY0, BY1, BZ - 0.07, BZ, 'wall', 0.015)
K.box('bench_apron', BX0, BX1, BY0, BY0 + 0.10, BZ - 0.22, BZ - 0.07, 'metal', 0.008)
K.box('bench_lip', BX0 - 0.03, BX1 + 0.03, BY0 - 0.03, BY0, BZ - 0.10, BZ, 'metal', 0.006)
for i, x in enumerate((BX0 + 0.12, BX1 - 0.12)):
    K.box(f'bench_leg{i}', x - 0.05, x + 0.05, BY0 + 0.08, BY0 + 0.18, 0.0, BZ - 0.07,
          'metal', 0.008)
    K.box(f'bench_leg_r{i}', x - 0.05, x + 0.05, BY1 - 0.18, BY1 - 0.08, 0.0, BZ - 0.07,
          'metal', 0.008)
# нижняя полка с ящиками
K.box('bench_shelf', BX0 + 0.06, BX1 - 0.06, BY0 + 0.06, BY1 - 0.06, 0.30, 0.34, 'wall', 0.008)
for i, x in enumerate((BX0 + 0.10, BX0 + 0.60, 1.10)):
    K.box(f'bench_box{i}', x, x + 0.44, BY0 + 0.10, BY1 - 0.12, 0.34, 0.62, 'wall', 0.01)
    K.box(f'bench_box_lbl{i}', x + 0.06, x + 0.20, BY0 + 0.09, BY0 + 0.10, 0.52, 0.58,
          ('cyan', 'orange', 'pink')[i], 0.0)

# машина: цилиндр в кожухе на подставке
K.box('mach_base', -0.35, 0.75, 1.28, 1.74, BZ, BZ + 0.10, 'metal', 0.012)
_md = K.cyl('mach_drum', 0.20, 1.51, BZ + 0.10, BZ + 0.80, 0.22, 'metal', verts=32, axis='X')
K.sphere('mach_cap_l', -0.15, 1.51, BZ + 0.45, 0.22, 'wall', segs=28)
K.sphere('mach_cap_r', 0.55, 1.51, BZ + 0.45, 0.22, 'wall', segs=28)
for k, x in enumerate((-0.02, 0.12, 0.26, 0.40)):
    K.cyl(f'mach_ring{k}', x, 1.51, BZ + 0.26, BZ + 0.64, 0.235, 'metal_d', verts=28, axis='X')
K.cyl('mach_pipe', 0.55, 1.51, BZ + 0.42, BZ + 0.42, 0.05, 'metal', verts=16, axis='X')
K.box('mach_head', -0.15, 0.05, 1.34, 1.68, BZ + 0.10, BZ + 0.42, 'wall', 0.02)
K.screen('mach_scr', -0.12, 0.02, 1.33, 1.35, BZ + 0.16, BZ + 0.34, face='-Y')
K.cable('mach_cb', [(0.20, 1.30, BZ + 0.32), (0.25, 1.10, BZ - 0.05), (0.35, 0.95, 0.02)],
        r=0.012)

# приборы на верстаке: мониторы на кронштейнах
K.box('arm_post1', -1.55, -1.47, 1.75, 1.83, BZ, 1.72, 'metal', 0.008)
K.box('arm_h1', -1.55, -0.55, 1.76, 1.80, 1.66, 1.72, 'metal', 0.008)
K.screen('mon1', -1.32, -0.62, 1.62, 1.70, 1.24, 1.64, face='-Y')
K.box('arm_post2', 0.95, 1.03, 1.75, 1.83, BZ, 1.80, 'metal', 0.008)
K.box('arm_h2', 0.35, 1.03, 1.76, 1.80, 1.74, 1.80, 'metal', 0.008)
K.screen('mon2', 0.42, 1.00, 1.62, 1.70, 1.30, 1.72, face='-Y')

# склянки, лотки, образцы — мелкая плотность на столе
flask = [(-1.70, 'orange', 0.05), (-1.62, 'cyan', 0.045), (-1.54, 'pink', 0.038)]
for i, (x, role, r) in enumerate(flask):
    K.cyl(f'flask{i}', x, 1.18, BZ, BZ + 0.20, r, role, verts=18)
    K.cyl(f'flask_n{i}', x, 1.18, BZ + 0.20, BZ + 0.25, 0.016, 'metal', verts=12)
K.box('tray1', -1.05, -0.55, 1.12, 1.32, BZ, BZ + 0.05, 'metal', 0.008)
for i, x in enumerate((-1.00, -0.88, -0.76, -0.64)):
    K.cyl(f'sample{i}', x, 1.22, BZ + 0.05, BZ + 0.12, 0.035, ('pink', 'cyan', 'pink', 'orange')[i],
          verts=14)
K.box('tray2', 0.75, 1.05, 1.10, 1.35, BZ, BZ + 0.04, 'metal', 0.006)
K.box('toolbox', 0.78, 1.02, 1.14, 1.31, BZ + 0.04, BZ + 0.14, 'dark', 0.008)

# манипулятор на верстаке (робот-рука)
K.cyl('rob_base', 1.05, 1.58, BZ, BZ + 0.07, 0.13, 'metal', verts=24)
K.cyl('rob_col', 1.05, 1.58, BZ + 0.07, BZ + 0.46, 0.06, 'cyan', verts=20)
K.sphere('rob_j1', 1.05, 1.58, BZ + 0.48, 0.075, 'cyan')
K.box('rob_arm1', 1.01, 1.09, 1.30, 1.58, BZ + 0.48, BZ + 0.56, 'cyan', 0.010)
K.sphere('rob_j2', 1.05, 1.27, BZ + 0.52, 0.06, 'metal')
K.box('rob_arm2', 1.00, 1.10, 1.02, 1.27, BZ + 0.18, BZ + 0.52, 'cyan', 0.010)
K.cyl('rob_claw', 1.05, 1.00, BZ + 0.10, BZ + 0.20, 0.032, 'metal_d', verts=14)
K.cable('rob_cb', [(1.05, 1.58, BZ + 0.12), (1.18, 1.45, BZ - 0.12), (1.30, 1.30, 0.02)],
        r=0.010)

# доп. мелочь на столе и свисающие кабели
K.box('dev_x', -1.30, -1.02, 1.20, 1.36, BZ, BZ + 0.16, 'wall', 0.008)
K.screen('dev_x_scr', -1.27, -1.05, 1.19, 1.20, BZ + 0.05, BZ + 0.13, face='-Y')
K.box('dev_y', -0.42, -0.16, 1.18, 1.34, BZ, BZ + 0.12, 'wall', 0.008)
K.cyl('coil_b', 1.28, 1.16, BZ, BZ + 0.05, 0.09, 'dark', verts=24)
K.cable('drop1', [(-1.10, 1.10, BZ - 0.02), (-1.12, 0.95, 0.60), (-1.20, 0.80, 0.02)], r=0.009)
K.cable('drop2', [(0.30, 1.10, BZ - 0.02), (0.32, 0.90, 0.55), (0.40, 0.72, 0.02)], r=0.008)
K.cable('drop3', [(1.00, 1.12, BZ - 0.02), (1.05, 0.92, 0.58), (1.15, 0.75, 0.02)], r=0.008)

# --- передний план слева: пульт со скосом (как в рефе) ---------------------
K.box('con_body', X0 + 0.05, X0 + 0.95, -0.55, 0.75, 0.0, 0.95, 'wall', 0.02)
K.box('con_slope', X0 + 0.02, X0 + 0.98, -0.58, 0.78, 0.95, 1.02, 'metal', 0.012)
K.screen('con_scr', X0 + 0.12, X0 + 0.60, -0.50, 0.35, 1.02, 1.30, face='-Y')
for i in range(5):
    K.box(f'con_btn{i}', X0 + 0.68 + (i % 2) * 0.14, X0 + 0.78 + (i % 2) * 0.14,
          -0.30 + (i // 2) * 0.18, -0.22 + (i // 2) * 0.18, 1.02, 1.05, 'dark', 0.004)
K.blob('bl_con', X0 + 0.05, X0 + 0.95, -0.55, 0.75, layers=6, pad=0.18)

# --- шкафы по краям (обрезаны кадром, как в рефе) --------------------------
K.box('cab_l', X0 + 0.08, X0 + 0.75, 0.55, 1.85, 0.0, 1.95, 'wall', 0.02)
K.box('cab_l_top', X0 + 0.04, X0 + 0.80, 0.50, 1.90, 1.95, 2.02, 'metal', 0.01)
for i in range(4):
    K.box(f'cab_l_btn{i}', X0 + 0.20 + i * 0.12, X0 + 0.28 + i * 0.12, 1.20, 1.30,
          2.02, 2.05, 'dark', 0.004)
K.screen('cab_l_scr', X0 + 0.16, X0 + 0.66, 1.18, 1.26, 1.45, 1.86, face='-Y')

K.box('cab_r', 1.95, X1 - 0.08, 1.30, 2.60, 0.0, 2.10, 'wall', 0.02)
K.box('cab_r_face', 1.92, 1.95, 1.36, 2.54, 0.10, 2.00, 'metal', 0.008)
K.screen('cab_r_scr', 1.90, 1.92, 1.42, 2.48, 1.20, 1.85, face='-Y')
K.box('cab_r_handle', 1.86, 1.92, 1.80, 2.10, 0.95, 1.05, 'metal', 0.008)

# --- полка над верстаком с приборами (как в рефе) --------------------------
SHELF_Z = 1.46
K.box('shelf_hi', BX0 - 0.10, BX1 + 0.10, Y1 - 0.34, Y1 - 0.02, SHELF_Z, SHELF_Z + 0.05,
      'metal', 0.01)
K.box('shelf_lip', BX0 - 0.10, BX1 + 0.10, Y1 - 0.36, Y1 - 0.34, SHELF_Z, SHELF_Z + 0.08,
      'metal_d', 0.006)
for i, x in enumerate((BX0 + 0.15, BX0 + 0.25)):
    K.box(f'shelf_br{i}', x - 0.02, x + 0.02, Y1 - 0.34, Y1 - 0.04, SHELF_Z - 0.30,
          SHELF_Z, 'metal', 0.006)
# мониторы и приборы на полке
K.screen('sh_mon1', -1.55, -0.80, Y1 - 0.30, Y1 - 0.24, SHELF_Z + 0.05, SHELF_Z + 0.42,
         face='-Y')
K.screen('sh_mon2', -0.72, -0.10, Y1 - 0.30, Y1 - 0.24, SHELF_Z + 0.05, SHELF_Z + 0.40,
         face='-Y')
K.rbox('sh_dev1', 0.05, 0.42, Y1 - 0.30, Y1 - 0.06, SHELF_Z + 0.05, SHELF_Z + 0.30,
       'wall', r=0.015)
K.screen('sh_dev1_scr', 0.08, 0.24, Y1 - 0.315, Y1 - 0.30, SHELF_Z + 0.12,
         SHELF_Z + 0.26, face='-Y')
K.rbox('sh_dev2', 0.52, 0.92, Y1 - 0.30, Y1 - 0.06, SHELF_Z + 0.05, SHELF_Z + 0.28,
       'wall', r=0.015)
for k in range(3):
    K.cyl(f'sh_kn{k}', 0.58 + k * 0.09, Y1 - 0.32, SHELF_Z + 0.10, SHELF_Z + 0.14,
          0.016, 'metal_d', verts=12, axis='Y')
for k, x in enumerate((1.02, 1.16)):
    K.cyl(f'sh_flask{k}', x, Y1 - 0.18, SHELF_Z + 0.05, SHELF_Z + 0.24, 0.045,
          ('orange', 'cyan')[k], verts=18)

# --- стена за верстаком: плотный пояс приборов -----------------------------
def kit_panel(name, x, z, w=0.52, h=0.40):
    K.rbox(f'{name}_b', x, x + w, Y1 - 0.20, Y1 - 0.03, z, z + h, 'wall', r=0.015)
    K.screen(f'{name}_s', x + 0.03, x + w * 0.58, Y1 - 0.22, Y1 - 0.20, z + 0.12,
             z + h - 0.05, face='-Y')
    for k in range(3):
        K.cyl(f'{name}_k{k}', x + w * 0.66 + k * 0.055, Y1 - 0.23, z + 0.14 + k * 0.04,
              z + 0.17 + k * 0.04, 0.017, 'metal_d', verts=12, axis='Y')
    K.led(f'{name}_l', x + w * 0.68, Y1 - 0.24, z + 0.06, r=0.009,
          role=('cyan', 'pink', 'orange')[hash(name) % 3])


kit_panel('kp0', -2.75, 1.20, w=0.62, h=0.44)
kit_panel('kp1', -1.85, 1.30, w=0.50, h=0.36)
kit_panel('kp2', 0.15, 1.24, w=0.56, h=0.40)
kit_panel('kp3', 1.05, 1.34, w=0.46, h=0.34)
kit_panel('kq0', -2.35, 1.84, w=0.40, h=0.28)
kit_panel('kq1', -0.30, 1.90, w=0.38, h=0.26)
kit_panel('kq2', 0.75, 1.86, w=0.42, h=0.30)
for i, x in enumerate((-2.80, -2.20, -1.55, -0.30, 0.60, 1.30, 2.00)):
    K.wall_device(f'wd_top{i}', x, x + 0.34, Y1 - 0.14, Y1 - 0.03, 2.26, 2.52,
                  led_role=('cyan', 'pink', 'cyan', 'orange', 'cyan', 'pink', 'cyan')[i],
                  grille=False)
    K.drop(f'dp_top{i}', x, x + 0.34, Y1 - 0.03, 2.26, h=0.14, layers=2)

K.screen('big_scr', -0.85, 0.05, Y1 - 0.12, Y1 - 0.05, 1.42, 2.05, face='-Y')
K.screen('big_scr2', 1.15, 1.75, Y1 - 0.12, Y1 - 0.05, 1.50, 2.02, face='-Y')

# --- обвязка: трубы, каналы, кабели ---------------------------------------
K.conduit('cd_n', [(X0 + 0.10, Y1 - 0.10, 2.52), (X1 - 0.10, Y1 - 0.10, 2.52)], r=0.018)
K.conduit('cd_w', [(X0 + 0.10, Y0 + 0.10, 2.46), (X0 + 0.10, Y1 - 0.10, 2.46)], r=0.018)
K.pipe('pw_a', [(X0 + 0.12, Y1 - 0.26, 0.0), (X0 + 0.12, Y1 - 0.26, 2.40)], 0.04)
K.pipe('pw_b', [(X1 - 0.16, Y1 - 0.30, 0.0), (X1 - 0.16, Y1 - 0.30, 2.35), (X1 - 0.40, Y1 - 0.30, 2.35)],
       0.035)
K.bundle('bundle_s', [(X0 + 0.14, Y0 + 0.10, 0.02), (-1.00, Y0 + 0.14, 0.02),
                      (0.60, Y0 + 0.10, 0.02), (X1 - 0.14, Y0 + 0.12, 0.02)], n=4, spread=0.03)
# кабели через пол к камере — как в рефе
K.bundle('run1', [(-1.30, 1.00, 0.02), (-1.10, 0.30, 0.02), (-0.90, -0.60, 0.02),
                  (-0.75, -1.60, 0.02), (-0.60, -2.40, 0.02)], n=3, spread=0.035, r=0.010)
K.bundle('run2', [(0.90, 1.00, 0.02), (0.75, 0.10, 0.02), (0.55, -0.90, 0.02),
                  (0.35, -1.90, 0.02)], n=3, spread=0.032, r=0.009)
K.bundle('run3', [(2.10, 0.40, 0.02), (1.70, -0.40, 0.02), (1.20, -1.30, 0.02),
                  (0.80, -2.20, 0.02)], n=2, spread=0.03, r=0.008)

# --- тени ------------------------------------------------------------------
K.corner('cor_n', 'X', Y1 - 0.03, X0, X1, w=0.20)
K.corner('cor_w', 'Y', X0 + 0.06, Y0, Y1, w=0.20)
K.corner('cor_e', 'Y', X1 - 0.03, Y0, Y1, w=0.20)
K.blob('bl_bench', BX0, BX1, BY0, BY1, layers=6, pad=0.20)
K.blob('bl_cab_l', X0 + 0.08, X0 + 0.75, 0.55, 1.85, layers=6, pad=0.16)
K.blob('bl_cab_r', 1.95, X1 - 0.08, 1.30, 2.60, layers=6, pad=0.16)
for i, x in enumerate((-2.75, -2.05, -1.35, 0.05, 0.75, 1.45)):
    K.drop(f'dp_kp{i}', x, x + 0.52, Y1 - 0.03, 1.18 if i % 2 == 0 else 1.34, h=0.26)
for i, x in enumerate((-2.55, -1.60, 0.30, 1.25)):
    K.drop(f'dp_kq{i}', x, x + 0.46, Y1 - 0.03, 1.88, h=0.20)
K.drop('dp_big', -0.85, 0.05, Y1 - 0.05, 1.42, h=0.30, pad=0.06)

# --- камера: как в рефе — близко, чуть сверху, верстак в центре ------------
I.lights(sc)
cd = bpy.data.cameras.new('cam')
cd.lens = 26
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
cam.location = (-0.80, -2.35, 1.47)
aim = Vector((0.15, 1.70, 0.98)) - Vector(cam.location)
cam.rotation_euler = aim.to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

_near = bpy.data.collections.new('near')
_far = bpy.data.collections.new('far')
sc.collection.children.link(_near)
sc.collection.children.link(_far)
_cam = Vector(cam.location)
for _o in list(sc.objects):
    if _o.type not in {'MESH', 'CURVE'} or any(t in _o.name for t in ('_sh', '_dz', '_cz')):
        continue
    (_near if (_o.matrix_world.translation - _cam).length < 3.1 else _far).objects.link(_o)

I.render_setup(sc, res=(1680, 945), samples=36, exposure=-0.03, bloom=(1.9, 3))
I.ink(sc, thickness=1.5, crease=True, angle=150, collections=('near', 'far'))
sc.render.filepath = os.path.join(OUT, 'ink_workshop.png')
bpy.ops.render.render(write_still=True)
print('RENDERED ink_workshop.png')
print('DONE')
