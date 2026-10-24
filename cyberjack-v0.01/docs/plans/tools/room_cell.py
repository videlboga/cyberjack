"""Жилая камера v4 — полное повторение композиции рефа living-cell-v2.

Что строится:
  * комната 7.0 × 4.6, стены с НИШАМИ в толще: две койки в боковых стенах,
    санузел справа от проёма, проём-октагон слева от центра;
  * панельная развёртка стен 1.20 × 1.20 со швом 20 мм, плинтус, минтовая полоса;
  * койки в нишах: платформа, матрас, подушка, полка с ящиками и подсветка;
  * стол по центру с толстой столешницей, два табурета-куба;
  * санузел в нише: ступень, унитаз, раковина, зеркало;
  * шкафы с дверцами, ручками, вентиляцией и зелёными экранами;
  * потолок: световые панели, трубные трассы с хомутами и ревизионной коробкой;
  * глянцевый пол крупной плиткой.

Запуск: blender -b --factory-startup -noaudio --python tools/room_cell.py
Выход: blockout/cell_v4_*.png, blockout/room_cell.blend
"""
import bpy, sys, os, math, bmesh
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from room_kit import RoomKit   # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
PALETTE = {
    'panel': (0.87, 0.88, 0.87),
    'panel_dim': (0.66, 0.68, 0.67),
    'seam': (0.22, 0.24, 0.24),
    'floor': (0.90, 0.91, 0.90),
    'grout': (0.55, 0.57, 0.56),
    'ceiling': (0.90, 0.91, 0.90),
    'soft': (0.42, 0.47, 0.45),
    'accent': (0.36, 0.55, 0.51),
    'steel': (0.74, 0.76, 0.76),
    'paint': (0.84, 0.85, 0.84),
    'white': (0.93, 0.94, 0.93),
}
R = RoomKit(W=6.0, D=5.0, H=2.75, door_at=-0.80, door_w=1.30, door_h=2.25,
            prefix='cell_', palette=PALETTE)

T = R.T                    # 0.20
X0, X1, Y0, Y1, H = R.X0, R.X1, R.Y0, R.Y1, R.H
NICHE_D = 1.00             # глубина ниш в толще стены
BED_H = 0.44
BED_W, BED_L = 0.94, 2.02      # ширина поперёк, длина вдоль стены

# ниши: (u0, u1, z0, z1) в координатах развёртки стены
DOOR = (R.door_at - R.door_w / 2, R.door_at + R.door_w / 2, 0.0, R.door_h)
SAN = (0.60, 1.80, 0.0, 2.05)
BED_NICHE = (-0.62, 1.40, 0.0, 2.05)   # проём ниши вдоль стены, симметрично


def panel_face(side, cuts, with_plinth=True):
    """Стена: подложка с вырезами, панели 1.20, плинтус, полоса, скос в углах."""
    horiz = side in ('north', 'south')
    u0, u1 = (X0, X1) if horiz else (Y0, Y1)
    f = {'north': Y1, 'south': Y0, 'west': X0, 'east': X1}[side]
    out = {'north': 1, 'south': -1, 'west': -1, 'east': 1}[side]

    def box(name, a, b, z0, z1, depth_out=True, mat='panel'):
        """a,b — по оси развёртки; толщина панели внутрь комнаты."""
        if horiz:
            R.box(f'{side}_{name}', a, b, f - out * 0.024, f - out * 0.004, z0, z1, mat)
        else:
            R.box(f'{side}_{name}', f - out * 0.024, f - out * 0.004, a, b, z0, z1, mat)

    def solid(name, a, b, z0, z1):
        if horiz:
            R.box(f'{side}_{name}', a, b, f, f + out * T, z0, z1, 'seam')
        else:
            R.box(f'{side}_{name}', f, f + out * T, a, b, z0, z1, 'seam')

    # подложка: сегменты между вырезами по всей высоте + перемычки
    cuts_sorted = sorted(cuts, key=lambda c: c[0])
    edges = [u0] + [v for c in cuts_sorted for v in (c[0], c[1])] + [u1]
    for i in range(0, len(edges), 2):
        solid(f'solid_{i}', edges[i], edges[i + 1], 0.0, H)
    for i, (a, b, z0, z1) in enumerate(cuts_sorted):
        if z1 < H:
            solid(f'lintel_{i}', a, b, z1, H)

    # панели 1.20 × 1.20 со швом, вырезая ниши
    a = u0
    i = 0
    while a < u1 - 0.02:
        pa = min(a + 0.60, u1)
        z = 0.10
        j = 0
        while z < H - 0.02:
            pz = min(z + 0.60, H)
            hit = any(not (pa <= c[0] or a >= c[1]) and not (pz <= c[2] or z >= c[3])
                      for c in cuts)
            if not hit:
                box(f'p_{i}_{j}', a + 0.01, pa - 0.01, z + 0.01, pz - 0.01)
            z = pz + 0.02
            j += 1
        a = pa + 0.02
        i += 1

    if with_plinth:
        a = u0
        while a < u1 - 0.01:
            b = min(a + 1.20, u1)
            if not any(not (b <= c[0] or a >= c[1]) and c[2] < 0.10 for c in cuts):
                if horiz:
                    R.box(f'{side}_plinth_{int(a * 10)}', a, b, f - out * 0.018,
                          f - out * 0.004, 0.0, 0.10, 'panel_dim')
                else:
                    R.box(f'{side}_plinth_{int(a * 10)}', f - out * 0.018, f - out * 0.004,
                          a, b, 0.0, 0.10, 'panel_dim')
            a = b

    # минтовая полоса 1.15..1.27, рвётся на вырезах
    segs = [(u0, u1)]
    for c in cuts_sorted:
        if c[2] < 1.15 and c[3] > 1.27:
            nxt = []
            for s0, s1 in segs:
                if c[1] <= s0 or c[0] >= s1:
                    nxt.append((s0, s1))
                else:
                    if c[0] > s0:
                        nxt.append((s0, c[0]))
                    if c[1] < s1:
                        nxt.append((c[1], s1))
            segs = nxt
    for k, (s0, s1) in enumerate(segs):
        if s1 - s0 < 0.05:
            continue
        if horiz:
            R.box(f'{side}_stripe_{k}', s0, s1, f - out * 0.036, f - out * 0.024,
                  1.15, 1.27, 'accent')
        else:
            R.box(f'{side}_stripe_{k}', f - out * 0.036, f - out * 0.024, s0, s1,
                  1.15, 1.27, 'accent')


def pocket(side, cut, depth=NICHE_D):
    """Ниша в толще стены: задняя стенка, бока, потолок, пол."""
    a, b, z0, z1 = cut
    f = {'north': Y1, 'south': Y0, 'west': X0, 'east': X1}[side]
    out = {'north': 1, 'south': -1, 'west': -1, 'east': 1}[side]
    d0, d1 = f, f + out * depth
    if side == 'north':
        R.box('pocket_back', a, b, d1, d1 + out * 0.04, z0, z1, 'panel_dim')
        R.box('pocket_l', a - 0.04, a, min(d0, d1), max(d0, d1), z0, z1, 'panel_dim')
        R.box('pocket_r', b, b + 0.04, min(d0, d1), max(d0, d1), z0, z1, 'panel_dim')
        R.box('pocket_top', a - 0.04, b + 0.04, min(d0, d1), max(d0, d1), z1, z1 + 0.04,
              'panel_dim')
        R.box('pocket_floor', a - 0.04, b + 0.04, min(d0, d1), max(d0, d1), z0 - 0.04, z0,
              'floor')
    else:
        R.box('pocket_back', d1, d1 + out * 0.04, a, b, z0, z1, 'panel_dim')
        R.box('pocket_l', min(d0, d1), max(d0, d1), a - 0.04, a, z0, z1, 'panel_dim')
        R.box('pocket_r', min(d0, d1), max(d0, d1), b, b + 0.04, z0, z1, 'panel_dim')
        R.box('pocket_top', min(d0, d1), max(d0, d1), a - 0.04, b + 0.04, z1, z1 + 0.04,
              'panel_dim')
        R.box('pocket_floor', min(d0, d1), max(d0, d1), a - 0.04, b + 0.04, z0 - 0.04, z0,
              'floor')


# --- оболочка ---------------------------------------------------------------
R.box('floor_base', X0, X1, Y0, Y1, -0.10, -0.01, 'grout')
n = 0
x = X0
while x < X1 - 0.01:
    y = Y0
    while y < Y1 - 0.01:
        R.box(f'tile_{n}', x + 0.004, min(x + 0.796, X1), y + 0.004, min(y + 0.796, Y1),
              -0.01, 0.0, 'floor')
        n += 1
        y += 0.80
    x += 0.80
R.box('ceiling', X0, X1, Y0, Y1, H, H + 0.08, 'ceiling')

panel_face('north', [DOOR, SAN])
panel_face('south', [])
panel_face('west', [BED_NICHE])
panel_face('east', [BED_NICHE])
pocket('north', SAN, depth=1.10)
R.rbox('san_arch', SAN[0] - 0.05, SAN[1] + 0.05, Y1 - 0.02, Y1 + 0.06, 1.98, 2.10,
       'panel_dim', r=0.09, seg=5)
pocket('west', BED_NICHE, depth=0.58)
pocket('east', BED_NICHE, depth=0.58)

# угловые стойки
for i, (px, py) in enumerate(((X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1))):
    cx = px + (0.06 if px < 0 else -0.06)
    cy = py + (0.06 if py < 0 else -0.06)
    R.box(f'corner_{i}', min(px, cx), max(px, cx), min(py, cy), max(py, cy), 0.0, H, 'steel')


# --- проём-октагон и люк ----------------------------------------------------
R.octa_frame('door_frame', R.door_at, R.door_w + 0.06, R.door_h + 0.06, 0.0, mat='panel',
             corner=0.20, thick=0.07, depth=0.14)
R.rbox('door_leaf', R.door_at - 0.60, R.door_at + 0.60, Y1 - 0.06, Y1 + 0.02,
       0.02, R.door_h - 0.04, 'panel', r=0.04, seg=4)
R.box('door_handle', R.door_at - 0.42, R.door_at - 0.14, Y1 - 0.10, Y1 - 0.06, 1.02, 1.10,
      'steel')
R.box('door_panel', R.door_at + 0.32, R.door_at + 0.48, Y1 - 0.075, Y1 - 0.06, 1.30, 1.52,
      'accent')
# тамбур за проёмом
ty0, ty1 = Y1 + T, Y1 + T + 1.40
R.box('corr_floor', R.door_at - 1.10, R.door_at + 1.10, ty0, ty1, -0.02, 0.0, 'floor')
R.box('corr_ceil', R.door_at - 1.10, R.door_at + 1.10, ty0, ty1, 2.40, 2.46, 'ceiling')
R.box('corr_l', R.door_at - 1.30, R.door_at - 1.10, ty0, ty1, 0.0, 2.46, 'panel_dim')
R.box('corr_r', R.door_at + 1.10, R.door_at + 1.30, ty0, ty1, 0.0, 2.46, 'panel_dim')
R.box('corr_end', R.door_at - 1.30, R.door_at + 1.30, ty1, ty1 + 0.10, 0.0, 2.46, 'panel_dim')


# --- койки в нишах ----------------------------------------------------------
def bed(side):
    """Койка ВДОЛЬ стены: утоплена в нишу, изголовье к дальней стене (+Y)."""
    a0, a1 = BED_NICHE[0] + 0.02, BED_NICHE[1] - 0.02
    if side == 'west':
        x0, x1 = X0 - 0.50, X0 + 0.44
        head0, head1 = X0 - 0.52, X0 + 0.02
    else:
        x0, x1 = X1 - 0.44, X1 + 0.50
        head0, head1 = X1 - 0.02, X1 + 0.52

    R.rbox(f'{side}_bed_base', x0, x1, a0, a1, 0.10, BED_H - 0.10, 'paint', r=0.05, seg=4)
    R.rbox(f'{side}_bed_kick', x0 + 0.06, x1 - 0.06, a0 + 0.06, a1 - 0.06, 0.0, 0.10,
           'panel_dim', r=0.02)
    R.rbox(f'{side}_bed_mattress', x0 + 0.02, x1 - 0.02, a0 + 0.02, a1 - 0.02,
           BED_H - 0.10, BED_H + 0.05, 'soft', r=0.07, seg=6)
    # изголовье-панель у торца, подушка перед ним
    R.rbox(f'{side}_bed_head', head0, head1, a1 - 0.10, a1 + 0.02,
           BED_H + 0.02, BED_H + 0.52, 'paint', r=0.05, seg=4)
    R.rbox(f'{side}_bed_pillow', x0 + 0.06, x1 - 0.06, a1 - 0.50, a1 - 0.12,
           BED_H + 0.05, BED_H + 0.15, 'white', r=0.06, seg=6)
    # полка с ящиками над изголовьем и световая полоса под ней
    sx0, sx1 = (X0 - 0.34, X0 + 0.06) if side == 'west' else (X1 - 0.06, X1 + 0.34)
    R.rbox(f'{side}_shelf', sx0, sx1, a0 + 0.04, a1 - 0.04, 1.55, 1.62, 'panel', r=0.02)
    R.box(f'{side}_shelf_light', sx0 + 0.04, sx1 - 0.04, a0 + 0.08, a1 - 0.08, 1.51, 1.54,
          'accent')
    for k, dy in enumerate((-0.20, 0.20)):
        cy = (a0 + a1) / 2 + dy
        R.rbox(f'{side}_box_{k}', sx0 + 0.04, sx1 - 0.04, cy - 0.16, cy + 0.16, 1.62, 1.80,
               'panel_dim', r=0.02)


bed('west')
bed('east')
R.patient((X0 - 0.30, 0.0, BED_H + 0.04), height=1.68, lying=True, yaw=90)


# --- санузел в нише ---------------------------------------------------------
def build_san():
    sx, sy = 1.32, Y1 + 0.40
    R.box('san_step', 0.60, 1.80, Y1, Y1 + 0.30, 0.0, 0.05, 'panel_dim')
    R.rbox('toilet_base', sx - 0.19, sx + 0.19, sy - 0.10, sy + 0.40, 0.05, 0.42,
           'white', r=0.05)
    R.cyl('toilet_bowl', sx, sy + 0.15, 0.42, 0.48, 0.19, 'white', verts=32)
    R.rbox('toilet_tank', sx - 0.20, sx + 0.20, sy + 0.52, sy + 0.66, 0.48, 0.88,
           'white', r=0.04)
    R.rbox('basin_body', 0.66, 1.02, Y1 + 0.60, Y1 + 0.95, 0.05, 0.82, 'white', r=0.05)
    R.rbox('basin_bowl', 0.70, 0.98, Y1 + 0.64, Y1 + 0.92, 0.82, 0.86, 'steel', r=0.03)
    R.cyl('basin_tap', 0.84, Y1 + 0.90, 0.86, 1.04, 0.016, 'steel')
    R.box('san_mirror', 0.68, 1.00, Y1 + 0.98, Y1 + 1.00, 1.15, 1.70, 'glass')
    # шкафчик с полкой слева от проёма (как на рефе)
    R.rbox('wall_unit', -2.05, -1.55, Y1 - 0.22, Y1 - 0.02, 1.10, 1.75, 'panel', r=0.03)
    R.box('wall_unit_shelf', -2.02, -1.58, Y1 - 0.20, Y1 - 0.04, 1.38, 1.42, 'panel_dim')
    R.box('wall_unit_screen', -1.98, -1.72, Y1 - 0.24, Y1 - 0.22, 1.16, 1.34, 'accent')
    R.rbox('wall_unit_box', -1.94, -1.62, Y1 - 0.19, Y1 - 0.05, 1.42, 1.60, 'panel_dim', r=0.02)
    R.box('san_rail', 1.62, 1.66, Y1 + 0.10, Y1 + 0.50, 1.00, 1.04, 'steel')


build_san()


# --- стол, табуреты ---------------------------------------------------------
def build_table():
    cx, cy = 0.0, 0.30
    R.rbox('table_top', cx - 0.66, cx + 0.66, cy - 0.42, cy + 0.42, 0.72, 0.80,
           'panel', r=0.08, seg=6)
    R.rbox('table_apron', cx - 0.58, cx + 0.58, cy - 0.34, cy + 0.34, 0.60, 0.72,
           'panel', r=0.03)
    R.rbox('table_pedestal', cx - 0.30, cx + 0.30, cy - 0.22, cy + 0.22, 0.12, 0.60,
           'panel', r=0.05, seg=4)
    R.rbox('table_kick', cx - 0.38, cx + 0.38, cy - 0.28, cy + 0.28, 0.0, 0.12,
           'panel_dim', r=0.03)
    for k, sx in enumerate((-1.12, 0.82)):
        R.rbox(f'stool_{k}_seat', cx + sx - 0.20, cx + sx + 0.20, cy - 0.20, cy + 0.20,
               0.42, 0.50, 'soft', r=0.06, seg=5)
        R.rbox(f'stool_{k}_body', cx + sx - 0.16, cx + sx + 0.16, cy - 0.16, cy + 0.16,
               0.08, 0.42, 'paint', r=0.04)
        R.rbox(f'stool_{k}_kick', cx + sx - 0.20, cx + sx + 0.20, cy - 0.20, cy + 0.20,
               0.0, 0.08, 'panel_dim', r=0.02)
        R.box(f'stool_{k}_handle', cx + sx - 0.06, cx + sx + 0.06,
              cy + 0.20, cy + 0.215, 0.30, 0.34, 'steel')


build_table()


# --- шкафы с экранами -------------------------------------------------------
def wardrobe(name, x0, x1, y0, y1, doors=2):
    R.rbox(f'{name}_body', x0, x1, y0, y1, 0.0, 2.30, 'panel', r=0.03, seg=3)
    w = (x1 - x0) / doors
    for i in range(doors):
        a = x0 + i * w
        R.box(f'{name}_door_{i}', a + 0.02, a + w - 0.03, y0 - 0.008, y0, 0.06, 2.24, 'paint')
        R.box(f'{name}_gap_{i}', a + w - 0.03, a + w, y0 - 0.012, y0, 0.06, 2.24, 'seam')
        R.box(f'{name}_handle_{i}', a + w - 0.12, a + w - 0.08, y0 - 0.03, y0, 1.02, 1.26,
              'steel')


wardrobe('ward_w1', X0 + 0.02, X0 + 1.05, Y0 + 0.02, Y0 + 0.34)
wardrobe('ward_w2', X0 + 0.02, X0 + 1.05, Y1 - 0.34, Y1 - 0.02)
wardrobe('ward_e1', X1 - 1.05, X1 - 0.02, Y0 + 0.02, Y0 + 0.34)
wardrobe('ward_e2', X1 - 1.05, X1 - 0.02, Y1 - 0.34, Y1 - 0.02)

# вентиляция и экраны на шкафах
for name, x0, x1, y0 in (('ward_w1', X0 + 0.16, X0 + 0.50, Y0 + 0.34),
                         ('ward_e1', X1 - 0.50, X1 - 0.16, Y0 + 0.34)):
    R.box(f'{name}_vent', x0, x1, y0 - 0.006, y0, 0.35, 0.85, 'seam')
for name, x0, x1, y0 in (('ward_w1', X0 + 0.66, X0 + 0.94, Y0 + 0.34),
                         ('ward_e1', X1 - 0.94, X1 - 0.66, Y0 + 0.34)):
    R.rbox(f'{name}_screen', x0, x1, y0 - 0.03, y0 - 0.005, 1.20, 1.52, 'panel', r=0.03)
    R.box(f'{name}_screen_face', x0 + 0.03, x1 - 0.03, y0 - 0.036, y0 - 0.03, 1.24, 1.48,
          'accent')

# консоли на стенах
for i, (cx, cy, nx, ny) in enumerate(((-2.55, 0.70, 0, -1), (1.05, -0.60, 0, 1))):
    R.rbox(f'console_{i}', cx - 0.13, cx + 0.13, cy - 0.05, cy + 0.05, 1.20, 1.58, 'panel',
           r=0.03)
    R.box(f'console_{i}_scr', cx - 0.08, cx + 0.08, cy - 0.056, cy - 0.05, 1.26, 1.50,
          'accent')


# --- потолок: свет и трубы --------------------------------------------------
for i, (a, b, c, d) in enumerate(((-2.15, -1.25, -1.20, -0.60), (-0.45, 0.45, -1.20, -0.60),
                                  (-2.15, -1.25, 0.60, 1.20), (-0.45, 0.45, 0.60, 1.20))):
    R.box(f'light_lip_l_{i}', a - 0.04, a, c - 0.04, d + 0.04, H - 0.04, H - 0.005, 'steel')
    R.box(f'light_lip_r_{i}', b, b + 0.04, c - 0.04, d + 0.04, H - 0.04, H - 0.005, 'steel')
    R.box(f'light_lip_s_{i}', a, b, c - 0.04, c, H - 0.04, H - 0.005, 'steel')
    R.box(f'light_lip_n_{i}', a, b, d, d + 0.04, H - 0.04, H - 0.005, 'steel')
    R.box(f'light_{i}', a, b, c, d, H - 0.02, H - 0.005, 'light')


def pipe(y, x0, x1, z=2.42, r=0.055):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(x1 - x0), vertices=24,
                                        location=((x0 + x1) / 2, y, z),
                                        rotation=(0, math.radians(90), 0))
    o = bpy.context.object
    o.name = f'pipe_{int(y * 100)}_{int(z * 100)}'
    o.data.materials.append(R.M['steel'])


for yy in (Y0 + 0.16, Y1 - 0.16):
    pipe(yy, X0 + 0.10, X1 - 0.10)
for i, cx in enumerate((-2.9, -1.6, -0.3, 1.0, 2.3)):
    R.box(f'clamp_{i}', cx - 0.03, cx + 0.03, Y0 + 0.08, Y0 + 0.24, 2.36, 2.48, 'steel')
    R.box(f'clamp_n_{i}', cx - 0.03, cx + 0.03, Y1 - 0.24, Y1 - 0.08, 2.36, 2.48, 'steel')
R.rbox('junction_box', -0.60, -0.20, Y1 - 0.30, Y1 - 0.06, 2.24, 2.44, 'panel_dim', r=0.03)

for m in bpy.data.materials:
    if m.name.endswith('floor') or m.name.endswith('floor_tile'):
        b = m.node_tree.nodes.get('Principled BSDF')
        if b:
            b.inputs['Roughness'].default_value = 0.02
            if 'Specular IOR Level' in b.inputs:
                b.inputs['Specular IOR Level'].default_value = 0.7
R.bevel_all()

print('=== ROOM ===', f'{R.W} x {R.D} x {R.H} m', 'area', round(R.W * R.D, 1))

R.lights(
    key=((-0.30, 0.0, H - 0.10), (2.40, 1.80), 110),
    fill=((R.door_at, Y1 - 0.30, 2.00), (1.20, 1.60), 34),
    rim=((X1 - 0.30, 0.20, 2.30), (0.40, 2.40), 20),
    extra=[('bed_w', (X0 - 0.10, 0.0, 2.10), (0.60, 1.20), 20),
           ('bed_e', (X1 + 0.10, 0.0, 2.10), (0.60, 1.20), 20),
           ('san', (1.20, Y1 + 0.30, 2.20), (0.60, 0.60), 12)],
)
R.render_setup(res=(1680, 860))

R.shot('cell_v4_main.png', (0.0, Y0 + 0.05, 1.62), (0.0, Y1, 1.16), lens=16)
R.shot('cell_v4_bed.png', (0.30, -1.20, 1.30), (X0 - 0.60, 0.10, 0.70), lens=26)
R.shot('cell_v4_san.png', (0.10, 0.60, 1.55), (1.30, Y1 + 0.40, 0.90), lens=24)
R.shot('cell_v4_corner.png', (X1 - 0.60, Y0 + 0.40, 1.55), (X0 + 0.40, Y1 - 0.40, 1.10),
       lens=20)
R.shot_top('cell_v4_top.png', scale=8.0)

R.save('room_cell.blend')
print('SAVED')
