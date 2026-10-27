"""Каталог модулей инк-стиля: одинаковые предметы во всех комнатах.

Каждый модуль описывается в локальных координатах Frame (u — вдоль, v — вглубь)
и ставится в комнату как `props.bench(F)` где F = Room.frame(x, y, yaw).
Габариты фиксированы — это и есть универсальность: кушетка везде 2.00 x 0.80,
приборная панель везде 0.50 x 0.40, кронштейн монитора всегда на 1.60.
"""
import math


# --- мебель и оборудование ---------------------------------------------------
def bench(F, w=2.40, d=0.90, h=0.92, machines=True):
    """Верстак: столешница, фартук, ножки, нижняя полка, три ящика."""
    x0, x1 = -w / 2, w / 2
    F.box('top', x0, x1, -d / 2, d / 2, h - 0.07, h, 'wall', 0.012)
    F.box('apron', x0, x1, -d / 2, -d / 2 + 0.08, h - 0.22, h - 0.07, 'metal', 0.008)
    F.box('lip', x0 - 0.03, x1 + 0.03, -d / 2 - 0.03, -d / 2, h - 0.10, h, 'metal', 0.006)
    for sx in (-1, 1):
        u = x0 + 0.12 if sx < 0 else x1 - 0.12
        F.box(f'leg{int(sx)}', u - 0.05, u + 0.05, -d / 2 + 0.06, -d / 2 + 0.16,
              0.0, h - 0.07, 'metal', 0.008)
        F.box(f'legr{int(sx)}', u - 0.05, u + 0.05, d / 2 - 0.16, d / 2 - 0.06,
              0.0, h - 0.07, 'metal', 0.008)
    F.box('shelf', x0 + 0.06, x1 - 0.06, -d / 2 + 0.06, d / 2 - 0.06, 0.30, 0.34,
          'wall', 0.008)
    for i, u in enumerate((x0 + 0.10, x0 + 0.58, x1 - 0.54)):
        F.box(f'box{i}', u, u + 0.42, -d / 2 + 0.10, d / 2 - 0.12, 0.34, 0.62, 'wall', 0.010)
        F.box(f'box_lbl{i}', u + 0.06, u + 0.20, -d / 2 + 0.09, -d / 2 + 0.10, 0.52, 0.58,
              ('cyan', 'orange', 'pink')[i], 0.0)
    F.blob('bl_bench', x0, x1, -d / 2, d / 2, layers=6, pad=0.20)


def machine_drum(F, w=1.10, d=0.46, z0=0.92, prefix='drum'):
    """Барабан на подставке: как центрифуга в рефе."""
    F.box(f'{prefix}_base', -w / 2, w / 2, -d / 2, d / 2, z0, z0 + 0.10, 'metal', 0.012)
    F.cyl(f'{prefix}_body', 0.0, 0.0, z0 + 0.10, z0 + 0.10 + 0.70, d / 2, 'metal',
          verts=32, axis='X')
    F.sphere(f'{prefix}_cap_l', -w / 2 + 0.02, 0.0, z0 + 0.45, d / 2, 'wall', segs=28)
    F.sphere(f'{prefix}_cap_r', w / 2 - 0.02, 0.0, z0 + 0.45, d / 2, 'wall', segs=28)
    for i in range(4):
        u = -w / 2 + 0.22 + i * 0.18
        F.cyl(f'{prefix}_ring{i}', u, 0.0, z0 + 0.26, z0 + 0.64, d / 2 + 0.015, 'metal_d',
              verts=28, axis='X')
    F.box(f'{prefix}_head', -w / 2 - 0.02, -w / 2 + 0.20, -d / 2 + 0.04, d / 2 - 0.04,
          z0 + 0.10, z0 + 0.44, 'wall', 0.02)
    F.screen(f'{prefix}_scr', -w / 2 + 0.02, -w / 2 + 0.18, -d / 2 + 0.03, -d / 2 + 0.05,
             z0 + 0.16, z0 + 0.36, face='-Y')


def wall_shelf(F, w=2.80, z=1.46, d=0.32):
    """Полка над верстаком: два монитора, прибор с экраном, прибор с ручками, колбы."""
    v0, v1 = -d, 0.0
    F.box('sh_board', -w / 2, w / 2, v0, v1, z, z + 0.05, 'metal', 0.010)
    F.box('sh_lip', -w / 2, w / 2, v0 - 0.02, v0, z, z + 0.08, 'metal_d', 0.006)
    for i, u in enumerate((-w / 2 + 0.12, w / 2 - 0.14)):
        F.box(f'sh_br{i}', u - 0.02, u + 0.02, v0, v1, z - 0.30, z, 'metal', 0.006)
    F.screen('sh_mon1', -w / 2 + 0.10, -w / 2 + 0.80, v0 + 0.04, v0 + 0.10, z + 0.05,
             z + 0.42, face='-Y')
    F.screen('sh_mon2', -w / 2 + 0.88, -w / 2 + 1.48, v0 + 0.04, v0 + 0.10, z + 0.05,
             z + 0.40, face='-Y')
    F.rbox('sh_dev', -w / 2 + 1.58, -w / 2 + 1.96, v0 + 0.04, v0 + 0.26, z + 0.05,
           z + 0.30, 'wall', r=0.015)
    F.screen('sh_dev_s', -w / 2 + 1.61, -w / 2 + 1.78, v0 + 0.02, v0 + 0.04, z + 0.12,
             z + 0.26, face='-Y')
    F.rbox('sh_dev2', -w / 2 + 2.02, -w / 2 + 2.44, v0 + 0.04, v0 + 0.26, z + 0.05,
           z + 0.28, 'wall', r=0.015)
    for k in range(3):
        F.cyl(f'sh_kn{k}', -w / 2 + 2.10 + k * 0.09, v0 + 0.03, z + 0.10, z + 0.14,
              0.016, 'metal_d', verts=12, axis='Y')
    F.cyl('sh_flask1', -w / 2 + 2.56, v0 + 0.14, z + 0.05, z + 0.24, 0.045, 'orange', verts=18)
    F.cyl('sh_flask2', -w / 2 + 2.68, v0 + 0.14, z + 0.05, z + 0.22, 0.045, 'cyan', verts=18)


def cabinet(F, w=0.70, d=0.60, h=1.95, side='-Y', screen=True):
    """Шкаф: корпус, дверца, ручка, вентиляция, экран (по желанию)."""
    x0, x1 = -w / 2, w / 2
    F.box('cab', x0, x1, -d / 2, d / 2, 0.0, h, 'wall', 0.02)
    F.box('cab_door', x0 + 0.02, x1 - 0.02, -d / 2 - 0.015, -d / 2, 0.06, h - 0.04,
          'metal', 0.008)
    F.box('cab_handle', x1 - 0.14, x1 - 0.08, -d / 2 - 0.05, -d / 2 - 0.015, 1.00, 1.30,
          'metal_d', 0.008)
    F.grille('cab_grille', x0 + 0.12, x0 + 0.34, -d / 2 - 0.02, -d / 2 - 0.015, 0.20, 0.62)
    if screen:
        F.screen('cab_scr', x0 + 0.36, x1 - 0.08, -d / 2 - 0.03, -d / 2 - 0.015, 1.30,
                 1.70, face='-Y')
    F.blob('bl_cab', x0, x1, -d / 2, d / 2, layers=6, pad=0.14)


def cart(F, w=0.70, d=0.46, h=0.86):
    """Тележка с тремя ящиками и колёсами."""
    x0, x1 = -w / 2, w / 2
    F.box('cart_body', x0, x1, -d / 2, d / 2, 0.10, h, 'wall', 0.02)
    F.box('cart_top', x0 - 0.02, x1 + 0.02, -d / 2 - 0.02, d / 2 + 0.02, h, h + 0.04,
          'metal', 0.010)
    for k in range(3):
        z = 0.18 + k * 0.22
        F.box(f'cart_dr{k}', x0 + 0.04, x1 - 0.04, -d / 2 - 0.015, -d / 2, z, z + 0.18,
              'metal', 0.006)
        F.box(f'cart_h{k}', -0.10, 0.10, -d / 2 - 0.04, -d / 2 - 0.015, z + 0.07, z + 0.11,
              'metal_d', 0.004)
    for i, (u, v) in enumerate(((x0 + 0.10, -d / 2 + 0.10), (x1 - 0.10, -d / 2 + 0.10),
                                (x0 + 0.10, d / 2 - 0.10), (x1 - 0.10, d / 2 - 0.10))):
        F.cyl(f'cart_w{i}', u, v, 0.0, 0.10, 0.045, 'dark', verts=14, axis='Y')
    F.blob('bl_cart', x0, x1, -d / 2, d / 2, layers=5, pad=0.12)


def console(F, w=0.95, d=1.30, h=0.95):
    """Пульт со скосом: корпус, наклонная панель, экран, кнопки."""
    x0, x1 = -w / 2, w / 2
    F.box('con_body', x0, x1, -d / 2, d / 2, 0.0, h, 'wall', 0.02)
    F.box('con_slope', x0 - 0.02, x1 + 0.02, -d / 2 - 0.02, d / 2 + 0.02, h, h + 0.06,
          'metal', 0.012)
    F.screen('con_scr', x0 + 0.10, x0 + 0.52, -d / 2 + 0.06, d / 2 - 0.10, h + 0.06,
             h + 0.30, face='-Y')
    for i in range(5):
        u = x0 + 0.62 + (i % 2) * 0.14
        v = -d / 2 + 0.20 + (i // 2) * 0.18
        F.box(f'con_btn{i}', u, u + 0.10, v, v + 0.08, h + 0.06, h + 0.09, 'dark', 0.004)
    F.blob('bl_con', x0, x1, -d / 2, d / 2, layers=6, pad=0.16)


def monitor_arm(F, z=1.60, span=0.90, w=0.60):
    """Кронштейн от стены с монитором."""
    F.box('ma_post', -0.04, 0.04, -0.06, 0.02, z - 0.30, z + 0.20, 'metal', 0.008)
    F.box('ma_arm', -0.04, span, -0.05, 0.01, z + 0.14, z + 0.20, 'metal', 0.008)
    F.screen('ma_scr', span - w, span, -0.10, -0.04, z - 0.10, z + 0.34, face='-Y')


def wall_cluster(F, w=0.50, h=0.40, led='cyan'):
    """Приборная панель на стене: корпус, стальная рамка, экран, ручки, светодиод."""
    d = 0.24
    F.rbox('cl_body', -w / 2, w / 2, -d, 0.0, 0.0, h, 'wall', r=0.018)
    F.box('cl_bezel', -w / 2 - 0.012, w / 2 + 0.012, -d - 0.018, -d + 0.004, -0.012,
          h + 0.012, 'metal', 0.006)
    F.screen('cl_scr', -w / 2 + 0.04, -w / 2 + w * 0.60, -d - 0.010, -d - 0.004, 0.10,
             h - 0.05, face='-Y')
    for k in range(3):
        F.cyl(f'cl_kn{k}', w / 2 - w * 0.32 + k * 0.058, -d - 0.020, 0.12 + k * 0.045,
              0.16 + k * 0.045, 0.018, 'metal_d', verts=12, axis='Y')
    F.cyl('cl_led', w / 2 - w * 0.28, -d - 0.022, 0.06, 0.076, 0.011, led, verts=12, axis='Y')
    F.box('cl_lip', -w / 2, w / 2, -d - 0.008, -d + 0.006, h - 0.02, h + 0.004, 'metal_d',
          0.004)


def capsule(F, r=0.59, h=2.42):
    """Медкапсула: станина, стекло, два хомута, верх, задняя панель с экраном."""
    F.cyl('cap_base', 0.0, 0.0, 0.0, 0.16, r + 0.04, 'metal')
    F.cyl('cap_base2', 0.0, 0.0, 0.16, 0.30, r + 0.02, 'metal_d')
    F.cyl('cap_body', 0.0, 0.0, 0.30, h - 0.26, r, 'wall_c')
    F.cyl('cap_inner', 0.0, 0.0, 0.32, h - 0.28, r - 0.07, 'wall')
    F.cyl('cap_band_a', 0.0, 0.0, 0.62, 0.70, r + 0.012, 'metal_d')
    F.cyl('cap_band_b', 0.0, 0.0, 1.42, 1.50, r + 0.012, 'metal_d')
    F.cyl('cap_ring_lo', 0.0, 0.0, 1.05, 1.22, r + 0.01, 'metal')
    F.cyl('cap_ring_hi', 0.0, 0.0, 1.92, 2.04, r + 0.01, 'metal')
    F.cyl('cap_top', 0.0, 0.0, h - 0.26, h, r + 0.04, 'metal')
    F.box('cap_back', -0.30, 0.30, -r - 0.34, -r - 0.02, 0.20, h - 0.10, 'wall', 0.04)
    F.screen('cap_back_scr', -0.16, 0.16, -r - 0.37, -r - 0.34, 1.30, 1.70, face='-Y')
    F.blob('bl_cap', -r - 0.1, r + 0.1, -r - 0.1, r + 0.1, layers=6, pad=0.20)


def couch(F, l=2.00, w=0.80, h=0.78):
    """Кушетка: станина, матрас, наклонное изголовье с валиком, ремни, ножки."""
    u0, u1 = -l / 2, l / 2
    v0, v1 = -w / 2, w / 2
    F.box('bed_kick', u0 + 0.08, u1 - 0.08, v0 + 0.08, v1 - 0.08, 0.0, 0.10, 'metal_d', 0.010)
    F.rbox('bed_frame', u0, u1, v0, v1, 0.42, h - 0.16, 'wall', r=0.05)
    F.rbox('bed_mattress', u0 + 0.02, u1 - 0.02, v0 + 0.02, v1 - 0.02, h - 0.16, h,
           'soft', r=0.06, segs=4)
    for i, (du, dv) in enumerate(((-l / 2 + 0.18, -w / 2 + 0.16), (l / 2 - 0.18, -w / 2 + 0.16),
                                  (-l / 2 + 0.18, w / 2 - 0.16), (l / 2 - 0.18, w / 2 - 0.16))):
        F.box(f'bed_leg{i}', du - 0.05, du + 0.05, dv - 0.05, dv + 0.05, 0.10, 0.42,
              'metal', 0.010)
    F.box('bed_head', u0 - 0.10, u0 - 0.02, v0 + 0.03, v1 - 0.03, h, h + 0.44, 'wall', 0.03)
    F.cyl('bed_rail', u0 - 0.14, 0.0, h + 0.44, h + 0.48, 0.045, 'soft', verts=18, axis='Y')
    F.rbox('bed_pillow', u0 + 0.06, u0 + 0.44, v0 + 0.14, v1 - 0.14, h, h + 0.10, 'soft',
           r=0.05, segs=4)
    for i, du in enumerate((-0.30, 0.45)):
        F.box(f'bed_strap{i}', du - 0.03, du + 0.03, v0, v1, h - 0.02, h + 0.005, 'dark', 0.004)
    F.blob('bl_couch', u0, u1, v0, v1, layers=6, pad=0.20)


def bed(F, l=2.00, w=0.95, h=0.44):
    """Койка: платформа, матрас, подушка, изголовье, полка с ящиками над изголовьем."""
    u0, u1 = -l / 2, l / 2
    v0, v1 = -w / 2, w / 2
    F.box('bed_kick', u0, u1, v0, v1, 0.0, 0.10, 'metal_d', 0.008)
    F.rbox('bed_frame', u0 + 0.02, u1 - 0.02, v0 + 0.02, v1 - 0.02, 0.10, h - 0.10, 'wall',
           r=0.05)
    F.rbox('bed_mattress', u0 + 0.03, u1 - 0.03, v0 + 0.03, v1 - 0.03, h - 0.10, h + 0.05,
           'soft', r=0.07, segs=5)
    F.rbox('bed_pillow', u0 + 0.10, u0 + 0.52, v0 + 0.10, v1 - 0.10, h + 0.05, h + 0.15,
           'soft', r=0.06, segs=5)
    F.box('bed_head', u0, u0 + 0.06, v0 - 0.04, v1 + 0.04, h + 0.05, h + 0.55, 'wall', 0.03)
    F.box('bed_shelf', u0 + 0.06, u0 + 0.40, v0 - 0.04, v1 + 0.04, 1.52, 1.58, 'metal', 0.008)
    F.box('bed_shelf_led', u0 + 0.08, u0 + 0.38, v0 - 0.02, v1 + 0.02, 1.49, 1.51, 'cyan', 0.0)
    F.blob('bl_bed', u0, u1, v0, v1, layers=6, pad=0.18)


def wardrobe(F, w=1.00, d=0.45, h=2.05):
    """Шкаф для одежды: две дверцы, ручки, вентиляция, экран."""
    x0, x1 = -w / 2, w / 2
    F.box('wr', x0, x1, -d / 2, d / 2, 0.0, h, 'wall', 0.02)
    F.box('wr_kick', x0 + 0.03, x1 - 0.03, -d / 2 - 0.02, d / 2, 0.0, 0.09, 'metal_d', 0.008)
    for i in range(2):
        u = x0 + i * (w / 2)
        F.box(f'wr_door{i}', u + 0.02, u + w / 2 - 0.03, -d / 2 - 0.015, -d / 2, 0.09,
              h - 0.04, 'wall', 0.006)
        F.box(f'wr_h{i}', u + w / 2 - 0.12, u + w / 2 - 0.08, -d / 2 - 0.04, -d / 2 - 0.015,
              1.02, 1.28, 'metal', 0.006)
    F.grille('wr_gr', x0 + 0.10, x0 + 0.32, -d / 2 - 0.02, -d / 2 - 0.015, 0.30, 0.72)
    F.screen('wr_scr', x0 + 0.52, x1 - 0.10, -d / 2 - 0.03, -d / 2 - 0.015, 1.24, 1.54,
             face='-Y')
    F.blob('bl_wr', x0, x1, -d / 2, d / 2, layers=6, pad=0.14)


def sink(F, w=0.60, d=0.55, h=0.85):
    """Мойка: тумба, чаша, смеситель, фартук."""
    x0, x1 = -w / 2, w / 2
    F.rbox('sink_body', x0, x1, -d / 2, d / 2, 0.0, h, 'wall', r=0.03)
    F.rbox('sink_bowl', x0 + 0.06, x1 - 0.06, -d / 2 + 0.07, d / 2 - 0.07, h, h + 0.04,
           'metal', r=0.02)
    F.cyl('sink_tap', 0.0, d / 2 - 0.12, h + 0.04, h + 0.30, 0.016, 'metal', verts=16)
    F.box('sink_back', x0 + 0.10, x1 - 0.10, d / 2 - 0.06, d / 2 - 0.02, h + 0.04, h + 0.26,
          'metal', 0.006)
    F.blob('bl_sink', x0, x1, -d / 2, d / 2, layers=5, pad=0.12)


def stool(F, r=0.20, h=0.48):
    """Табурет: сиденье, стойка, база."""
    F.rbox('stool_seat', -r, r, -r, r, h - 0.08, h, 'soft', r=0.04)
    F.cyl('stool_post', 0.0, 0.0, 0.06, h - 0.08, 0.04, 'metal', verts=16)
    F.cyl('stool_base', 0.0, 0.0, 0.0, 0.06, r * 0.9, 'metal_d', verts=24)
    F.blob('bl_stool', -r, r, -r, r, layers=5, pad=0.12)


def iv_stand(F, h=1.86):
    """Капельница: база, стойка, крюк, мешок, трубка."""
    F.cyl('iv_base', 0.0, 0.0, 0.0, 0.06, 0.22, 'metal_d', verts=24)
    F.cyl('iv_post', 0.0, 0.0, 0.06, h, 0.022, 'metal', verts=16)
    F.box('iv_hook', -0.06, 0.06, -0.02, 0.02, h - 0.04, h, 'metal', 0.006)
    F.rbox('iv_bag', -0.10, 0.10, -0.09, 0.09, h - 0.42, h - 0.06, 'soft', r=0.04)
    F.cable('iv_tube', [(0.0, 0.0, h - 0.44), (-0.10, 0.10, 1.20), (-0.25, 0.25, 0.85)],
            r=0.008, role='mid')
    F.blob('bl_iv', -0.22, 0.22, -0.22, 0.22, layers=5, pad=0.12)


def crate(F, w=0.60, d=0.45, h=0.50):
    """Контейнер с крышкой и замком."""
    x0, x1 = -w / 2, w / 2
    F.box('crate', x0, x1, -d / 2, d / 2, 0.0, h, 'metal_d', 0.015)
    F.box('crate_lid', x0 - 0.01, x1 + 0.01, -d / 2 - 0.01, d / 2 + 0.01, h, h + 0.05,
          'metal', 0.010)
    F.box('crate_latch', -0.06, 0.06, -d / 2 - 0.02, -d / 2, h * 0.55, h * 0.8, 'cyan', 0.004)
    F.blob('bl_crate', x0, x1, -d / 2, d / 2, layers=5, pad=0.10)


def terminal(F, h=0.42, w=0.34):
    """Настенный терминал: корпус, экран, три кнопки, LED, тень на стене."""
    F.box('term_body', -w / 2, w / 2, -0.12, 0.0, 0.0, h, 'wall', 0.010)
    F.screen('term_scr', -w / 2 + 0.03, w / 2 - 0.03, -0.14, -0.12, 0.12, h - 0.05,
             face='-Y')
    for k in range(3):
        F.cyl(f'term_btn{k}', -0.08 + k * 0.07, -0.15, 0.04, 0.065, 0.012, 'metal_d',
              verts=12, axis='Y')
    F.cyl('term_led', w / 2 - 0.05, -0.15, 0.12, 0.14, 0.010, 'cyan', verts=12, axis='Y')


def hose_coil(F, z=1.6, r=0.16):
    """Петля шланга на стене."""
    F.K.pipe(f'{F.prefix}coil', [(F.ox, F.oy - 0.02, z)], 0.02)
    import bpy
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.022, major_segments=32,
                                     minor_segments=10,
                                     location=(F.ox, F.oy - 0.05, z),
                                     rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.name = f'{F.prefix}coil_ring'
    F.K.I.apply(o, 'dark')


def pipe_run(F, pts, r=0.045, clamps=True, role='metal'):
    """Труба по локальным точкам с хомутами."""
    F.pipe('pipe', pts, r=r, role=role)
    if clamps:
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            n = max(1, int(math.dist(a, b) / 1.2))
            for k in range(n):
                t = (k + 0.5) / n
                u = a[0] + (b[0] - a[0]) * t
                v = a[1] + (b[1] - a[1]) * t
                z = a[2] + (b[2] - a[2]) * t
                F.box(f'cl{i}_{k}', u - 0.05, u + 0.05, v - 0.05, v + 0.05, z - 0.06, z + 0.06,
                      'metal_d', 0.004)


def cable_run(F, pts, n=3, spread=0.03, r=0.009):
    """Пучок кабелей по локальным точкам."""
    for j in range(n):
        off = (j - (n - 1) / 2) * spread
        F.cable(f'cb{j}', [(u + off, v + off * 0.6, z) for (u, v, z) in pts], r=r)


# --- импортированные машины (SKP vol-04 -> GLB) ------------------------------
VOL04 = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04'
VOL04_META = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04_meta.json'


def vol04_models():
    """Список подготовленных машин vol-04: [{id, glb, size_mm, figure_cut}]."""
    import json, os
    if not os.path.exists(VOL04_META):
        return []
    meta = json.load(open(VOL04_META))
    out = []
    for key, info in sorted(meta.items()):
        glb = os.path.join(VOL04, key + '.glb')
        if os.path.exists(glb):
            out.append({'id': key, 'glb': glb, 'bounds': info.get('bounds'),
                        'figure_cut': info.get('figure_cut') or []})
    return out


def _luma_role(mat):
    """Оригинальный материал -> роль инк-палитры по яркости."""
    try:
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        c = bsdf.inputs['Base Color'].default_value
        lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    except Exception:
        lum = 0.8
    if lum > 0.62:
        return 'wall'
    if lum > 0.30:
        return 'metal'
    return 'dark'


def imported_machine(F, model_id, target_h=1.75, yaw=0, max_span=2.2, keep_aspect=True,
                     target_tris=12000):
    """Машина из vol-04 как модуль кита: импорт GLB, нормализация, инк-материалы.

    GLB пишется в мм (units='mm'), поэтому сначала x0.001; затем масштаб под
    target_h, центр по X/Y, низ на пол, поворот yaw, окраска по яркости
    оригинальных материалов в роли палитры.
    """
    import bpy, os, math
    from mathutils import Vector

    path = os.path.join(VOL04, model_id + '.glb')
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    import bmesh
    from mathutils import Matrix

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    if not new:
        raise RuntimeError(f'no meshes in {path}')

    # --- децимация и чистка каждого меша (без операторов контекста) ----------
    for o in new:
        if o.data.users > 1:          # инстансы из GLB делят один меш
            o.data = o.data.copy()
        tris = sum(len(pp.vertices) - 2 for pp in o.data.polygons)
        if target_tris and tris > target_tris:
            mod = o.modifiers.new('dec', 'DECIMATE')
            mod.ratio = max(0.02, target_tris / tris)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='dec')
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.5),
                                 verts=list(bm.verts), edges=list(bm.edges))
        loose = [v for v in bm.verts if not v.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()

    # --- габарит в мире по вершинам полигонов --------------------------------
    def world_bb(objs):
        lo = Vector((1e18, 1e18, 1e18))
        hi = -lo.copy()
        for o in objs:
            used = {i for poly in o.data.polygons for i in poly.vertices}
            for i in used:
                w = o.matrix_world @ o.data.vertices[i].co
                lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
                hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
        return lo, hi

    def xform(M):
        for o in new:
            o.matrix_world = M @ o.matrix_world

    # 1) Y-up -> Z-up, если «высота» пришла по Y
    lo, hi = world_bb(new)
    sz = hi - lo
    if sz.y > sz.z:
        xform(Matrix.Rotation(math.radians(90), 4, 'X'))

    # 2) поворот кита + пользователя
    xform(Matrix.Rotation(math.radians(F.yaw + yaw), 4, 'Z'))

    # 3) масштаб под target_h с ограничением размаха
    lo, hi = world_bb(new)
    sz = hi - lo
    k = target_h / max(sz.z, 1e-6)
    span = max(sz.x, sz.y) * k
    if keep_aspect and span > max_span:
        k *= max_span / span
    xform(Matrix.Scale(k, 4))

    # 4) центр по X/Y, низ на пол
    lo, hi = world_bb(new)
    x, y = F._w(0.0, 0.0)
    xform(Matrix.Translation((x - (lo.x + hi.x) / 2, y - (lo.y + hi.y) / 2, -lo.z)))

    # --- слияние в один объект ----------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    if len(new) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = F._n(f'mach_{model_id}')

    # материал → роль, затем единый инк-материал на слот
    roles = []
    for slot in obj.material_slots:
        roles.append(_luma_role(slot.material) if slot.material else 'wall')

    # перекраска в палитру
    for i, slot in enumerate(obj.material_slots):
        role = roles[i] if i < len(roles) else 'wall'
        slot.material = F.K.I.M[role]

    obj.data.polygons.foreach_set('use_smooth', [False] * len(obj.data.polygons))
    obj.data.update()

    # машина должна попасть в ближний план линий, иначе Freestyle её не обводит
    ncoll = bpy.data.collections.get('near')
    if ncoll is not None and ncoll not in obj.users_collection:
        ncoll.objects.link(obj)

    # контактная тень под машиной
    lo2, hi2 = world_bb([obj])
    x0, x1 = lo2.x, hi2.x
    y0, y1 = lo2.y, hi2.y
    F.K.blob(F._n(f'blm_{model_id}'), x0, x1, y0, y1, layers=6, pad=0.18)
    return obj