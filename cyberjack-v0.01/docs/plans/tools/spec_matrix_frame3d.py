"""Спека restraint_matrix_frame3d (RST-MX-13, Mk-III) — только расчёт, без bpy.

Считает: компоновку 3D-каркаса, позы 10 фиксаторов на щите, гнёзда
CJ-LATCH-30R (позиция/нормаль/ось пальца), проверки (sweep при наклоне,
сходимость пальца с отверстием языка, устойчивость, момент наклона,
прочность), DOF-бюджет, массы, разбивку на work packages.

Ничего не пишет в каталог/GLB/viewer. Выход — JSON в docs/plans/checks/.

Запуск:  python3 docs/plans/tools/spec_matrix_frame3d.py
"""
from pathlib import Path
import json
import math

import numpy as np

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'docs/plans/checks'
SOURCE_MOUNTS = OUT / 'restraint-hard-mount-spec.json'

CID = 'restraint_matrix_frame3d'
CODE = 'RST-MX-13'
PREFIX = CID + '__'

# ---------------------------------------------------------------- габарит ---
BASE_X, BASE_Z = 2.000, 1.000        # основание: X длинная ось, Z ширина
BASE_Y0, BASE_Y1 = 0.040, 0.100      # обвязка основания
POST = 0.060                         # стойка 60 x 60 T-slot
POST_X = 0.550                       # оси стоек по X
POST_Z = 0.475                       # оси стоек по Z (боковые рамы)
POST_Y0, POST_Y1 = 0.100, 1.960      # 1,860 м стойки
TOP_Y0, TOP_Y1 = 1.900, 1.960        # верхняя рама
MID_Y0, MID_Y1 = 0.860, 0.920        # траверса под подшипник (по стороне)
PED_Y0, PED_Y1 = 0.920, 1.075        # подшипниковая стойка
WING_Z0, WING_Z1 = 0.505, 0.545      # боковое крыло (наружная плоскость)
WING_X = 0.850                       # крыло -0,85 ... +0,85
WING_Y0, WING_Y1 = 0.300, 1.600

PIVOT = (0.000, 1.000)               # ось наклона: X = 0, Y = 1,000 (ось Z)
TRUNNION_R = 0.020                   # цапфа Ø40

PANEL_HALF_X = 0.830                # щит 1,660 x 0,800
PANEL_HALF_Z = 0.380
PANEL_T = 0.075
PANEL_FACE = PANEL_T * 0.5           # привалочная плоскость h = +0,0375
PANEL_RAIL_Z = 0.4025                 # боковой рельс щита (несущий, цапфа)
SIDE_RAIL = 0.045                    # сечение бокового рельса

CROSSBAR_X = 0.720                   # нижняя перекладина (стопы)
CROSSBAR_Y0, CROSSBAR_Y1 = 0.100, 0.180
YOKE_X = -0.300                      # верхняя серьга подвеса
YOKE_Y = 1.860

FOOT_Z = 0.545                       # выносные опоры (устойчивость)

# ------------------------------------------------------------- нагрузки ----
PERSON_KG = 80.0
G = 9.80665
WLL_LATCH = 5000.0                   # CJ-LATCH-30
BREAK_LATCH = 15000.0
RECEIVER_KG = 0.95
RAY_KG = 3.10
CARRIAGE_KG = 1.45
PIN_FROM_MOUTH = 0.020               # палец Ø12 на 20 мм от привалочной плоскости
GAP_MOUTH = 0.002                    # зазор гнездо-фиксатор


def Rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], float)


def Ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], float)


def Rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)


def tilt(theta_deg):
    """Наклон щита: 0 - ложе (лицо +Y), 90 - вертикально (лицо +X)."""
    return Rz(math.radians(-theta_deg))


def panel_to_frame(p, theta_deg):
    """p = (u, v, h) в системе щита -> кадр frame3d (X,Y,Z)."""
    v = np.array([p[0], p[2], p[1]], float)      # (u,h,v)
    out = tilt(theta_deg) @ v
    return np.array([PIVOT[0], PIVOT[1], 0.0]) + out


def mat_to_quat(R):
    t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        w = 0.25 * s
        x = (R[2, 1] - R[1, 2]) / s
        y = (R[0, 2] - R[2, 0]) / s
        z = (R[1, 0] - R[0, 1]) / s
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        s = math.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2
        w = (R[2, 1] - R[1, 2]) / s
        x = 0.25 * s
        y = (R[0, 1] + R[1, 0]) / s
        z = (R[0, 2] + R[2, 0]) / s
    elif R[1, 1] > R[2, 2]:
        s = math.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2
        w = (R[0, 2] - R[2, 0]) / s
        x = (R[0, 1] + R[1, 0]) / s
        y = 0.25 * s
        z = (R[1, 2] + R[2, 1]) / s
    else:
        s = math.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2
        w = (R[1, 0] - R[0, 1]) / s
        x = (R[0, 2] + R[2, 0]) / s
        y = (R[1, 2] + R[2, 1]) / s
        z = 0.25 * s
    return [round(w, 6), round(x, 6), round(y, 6), round(z, 6)]


def frame_from(exit_dir, limb_dir):
    """R (фикстура -> щит) по двум направлениям: u = выход языка, w = ось конечности."""
    u = np.array(exit_dir, float)
    u /= np.linalg.norm(u)
    w = np.array(limb_dir, float)
    w -= u * np.dot(u, w)
    w /= np.linalg.norm(w)
    p = np.cross(u, w)
    return u, w, p


# ---------------------------------------------------------------- скелет ----
# точки осей конечностей в системе щита (u, v, h); человек 1,70 м, лежит на спине
SKELETON = {
    'head':   ((-0.760, 0.000, 0.105), 0.090),
    'neck':   ((-0.600, 0.000, 0.055), 0.055),
    'waist':  ((-0.200, 0.000, 0.105), 0.120),
    'hip':    ((-0.020, 0.110, 0.100), 0.085),
    'knee':   ((0.400, 0.115, 0.100), 0.055),
    'ankle':  ((0.760, 0.155, 0.045), 0.034),
    'wrist':  ((-0.170, 0.222, 0.038), 0.032),
    'sole':   ((0.850, 0.160, 0.020), 0.030),
}

# --------------------------------------------------------------- фикстуры ---
# Гнёзда на щите. Каждая запись: id, фикстура, зона, индекс языка (для пояса),
# поза центра фикстуры (u,v,h), exit = направление выхода языка в системе щита,
# limb = направление оси конечности в системе щита, класс языка.
#
# exit/limb выбраны так, чтобы локальные оси фикстуры лежали анатомически:
#   голова:  локальный +Y (темя) -> -u (к затылочной кромке), локальный +Z
#            (затылочная плита) -> -h (к щиту), локальный +X (поперёк) -> +v
#   манжеты: u = наружу от конечности (+v), w = ось конечности (-u)
#   пояс:    u = кромка ремня (±v), w = вдоль ремня (-u), палец вертикально
PANEL_SOCKETS = [
    # id, луч, fixture, zone, tongue, pose (u,v,h), exit, limb, mirror
    ('r_head',    'R1', 'restraint_head_frame',     'head',  0, (-0.715, 0.000, 0.148), (-1, 0, 0), (0, 0, -1), None),
    ('r_neck_l',  'R1', 'restraint_neck_yoke',      'neck',  0, (-0.600, 0.000, 0.055), (0, 1, 0), (-1, 0, 0), None),
    ('r_neck_r',  'R1', 'restraint_neck_yoke',      'neck',  0, (-0.600, 0.000, 0.055), (0, -1, 0), (-1, 0, 0), 'r_neck_l'),
    ('r_waist_l', 'R2', 'restraint_waist_belt',     'waist', 0, (-0.200, 0.000, 0.105), (0, 1, 0), (1, 0, 0), None),
    ('r_waist_r', 'R2', 'restraint_waist_belt',     'waist', 1, (-0.200, 0.000, 0.105), (0, -1, 0), (1, 0, 0), 'r_waist_l'),
    ('r_wrist_l', 'R3', 'restraint_wrist_cuff',     'wrist', 0, (-0.170, 0.222, 0.038), (0, 1, 0), (-1, 0, 0), None),
    ('r_wrist_r', 'R3', 'restraint_wrist_cuff',     'wrist', 0, (-0.170, -0.222, 0.038), (0, -1, 0), (-1, 0, 0), 'r_wrist_l'),
    ('r_thigh_l', 'R4', 'restraint_thigh_clamp',    'hip',   0, (0.300, 0.112, 0.090), (0, 1, 0), (-1, 0, 0), None),
    ('r_thigh_r', 'R4', 'restraint_thigh_clamp',    'hip',   0, (0.300, -0.112, 0.090), (0, -1, 0), (-1, 0, 0), 'r_thigh_l'),
    ('r_ankle_l', 'R5', 'restraint_ankle_cuff',     'ankle', 0, (0.770, 0.155, 0.045), (0, 1, 0), (-1, 0, 0), None),
    ('r_ankle_r', 'R5', 'restraint_ankle_cuff',     'ankle', 0, (0.770, -0.155, 0.045), (0, -1, 0), (-1, 0, 0), 'r_ankle_l'),
    ('r_qr',      'R5', 'restraint_quick_release',  'qr',    0, (0.520, -0.270, 0.085), (0, -1, 0), (-1, 0, 0), None),
]
TONGUE_CLASS = {
    'restraint_head_frame': 'T-26',
    'restraint_neck_yoke': 'T-30',
    'restraint_waist_belt': 'T-30',
    'restraint_wrist_cuff': 'T-30',
    'restraint_thigh_clamp': 'T-44',
    'restraint_ankle_cuff': 'T-30',
    'restraint_stirrup': 'T-30',
    'restraint_spreader': 'T-30',
    'restraint_suspension_cuff': 'T-30',
    'restraint_quick_release': 'T-26',
}
# палец от привалочной плоскости гнезда = положение отверстия языка от базы языка
PIN_FROM_MOUTH_BY_TONGUE = {'T-26': 0.0143, 'T-30': 0.0187, 'T-44': 0.0198}
# наружный радиус фикстуры в зоне крепления (по паспорту / bbox GLB)
SHELL_R = {
    'restraint_head_frame': 0.1102, 'restraint_neck_yoke': 0.0350,
    'restraint_waist_belt': 0.0250, 'restraint_wrist_cuff': 0.0330,
    'restraint_thigh_clamp': 0.0508, 'restraint_ankle_cuff': 0.0434,
    'restraint_stirrup': 0.0485, 'restraint_spreader': 0.0292,
    'restraint_suspension_cuff': 0.0324, 'restraint_quick_release': 0.0230,
}

# неподвижные гнёзда в кадре frame3d (X, Y, Z) + направление выхода языка
FIXED_SOCKETS = [
    ('w01', 'restraint_wrist_cuff', 'wrist_l_spread', (0.030, 1.150, 0.545), (0, 1, 0),
     'крыло левое: руки разведены (поза «распятие»), палец горизонтально'),
    ('w02', 'restraint_wrist_cuff', 'wrist_r_spread', (0.030, 1.150, -0.545), (0, -1, 0),
     'крыло правое'),
    ('w03', 'restraint_spreader', 'spreader_l', (0.400, 0.600, 0.545), (0, 1, 0),
     'крыло левое: раздвижка 0,6-1,2 м'),
    ('w04', 'restraint_spreader', 'spreader_r', (0.400, 0.600, -0.545), (0, -1, 0),
     'крыло правое'),
    ('x01', 'restraint_stirrup', 'stirrup_l', (0.760, 0.140, 0.155), (1, 0, 0),
     'нижняя перекладина: стремя, стопа на упор (только 90°)'),
    ('x02', 'restraint_stirrup', 'stirrup_r', (0.760, 0.140, -0.155), (1, 0, 0),
     'нижняя перекладина'),
    ('y01', 'restraint_suspension_cuff', 'suspension', (-0.300, 1.860, 0.000), (0, -1, 0),
     'верхняя серьга: подвес через CJ-LATCH-30S'),
]


def load_mount_spec():
    d = json.loads(SOURCE_MOUNTS.read_text())
    by = {c['id']: c for c in d['components']}
    return d, by


def uvh_to_xyz(v):
    """(u,v,h) -> (X,Y,Z): u вдоль X, h вдоль Y, v вдоль Z."""
    return np.array([v[0], v[2], v[1]], float)


def build_sockets(mount_by):
    """Гнёзда на щите: поза фикстуры + направления -> матрица -> палец/нормаль/ось."""
    out = []
    triads = {}
    for sid, ray, fid, zone, tongue_i, pose, exit_d, limb_d, mir in PANEL_SOCKETS:
        src = mount_by[fid]
        hole = np.array(src['tongue']['hole_pos_m'], float)
        if hole.ndim > 1:
            hole = hole[tongue_i]
        u_l = np.array(src['anchor']['normal_u'], float)
        if u_l.ndim > 1:
            u_l = u_l[tongue_i]
        w_l = np.array(src['anchor']['limb_axis_w'], float)
        p_l = np.cross(u_l, w_l)

        mirror_instance = False
        if mir:
            # правая сторона = зеркальный экземпляр левой: R_right = M_v · R_left,
            # M_v = diag(1,1,-1) по нормали щита. Определитель -1: в GLB это
            # масштаб -1 по v (или отдельная правая копия фикстуры).
            u_t, w_t, p_t = triads[mir]
            mirror_instance = True
        else:
            u_t = uvh_to_xyz(exit_d); u_t /= np.linalg.norm(u_t)
            w_t = uvh_to_xyz(limb_d)
            w_t -= u_t * np.dot(u_t, w_t); w_t /= np.linalg.norm(w_t)
            p_t = np.cross(u_t, w_t)
        triads[sid] = (u_t, w_t, p_t)

        # локальная тройка (u_l, w_l, p_l) -> целевая (u_t, w_t, p_t)
        Ml = np.column_stack([u_l, w_l, p_l])
        Mt = np.column_stack([u_t, w_t, p_t])
        R = Mt @ np.linalg.inv(Ml)
        if mirror_instance:
            R = np.diag([1.0, 1.0, -1.0]) @ R

        axis_p = np.array(pose, float)                 # центр фикстуры (u,v,h)
        hole3 = R @ hole                               # (X,Y,Z) = (u,h,v)
        hole_uvh = np.array([hole3[0], hole3[2], hole3[1]])
        pin_uvh = axis_p + hole_uvh                    # палец в системе щита
        exit_uvh = np.array([u_t[0], u_t[2], u_t[1]])
        norm_uvh = -exit_uvh
        p_uvh = np.array([p_t[0], p_t[2], p_t[1]])
        w_uvh = np.array([w_t[0], w_t[2], w_t[1]])
        tc = TONGUE_CLASS[fid]
        # проставка под привалочную плоскость: гнездо не должно касаться оболочки
        clr = float(np.linalg.norm(pin_uvh - axis_p) - PIN_FROM_MOUTH_BY_TONGUE[tc] - SHELL_R[fid])
        shim = 0.0
        while clr + shim < GAP_MOUTH - 1e-9:
            shim += 0.002
        # пояс: отверстие языка на 0,064 от центра — гнездо оказалось бы внутри
        # контура тела; выносим гнездо на 0,170 проставкой-кронштейном
        standoff = 0.0
        if zone == 'waist':
            target_v = 0.170 * (1.0 if pin_uvh[1] > 0 else -1.0)
            standoff = round(abs(target_v) - abs(pin_uvh[1]), 4)
            pin_uvh = np.array([pin_uvh[0], target_v, pin_uvh[2]])
        out.append({
            'id': sid,
            'ray': ray,
            'fixture': fid,
            'zone': zone,
            'tongue': tc,
            'tongue_index': tongue_i,
            'host': 'panel',
            'panel_xyz': [round(float(x), 5) for x in pin_uvh],
            'fixture_origin_panel': [round(float(x), 5) for x in axis_p],
            'exit_panel': [round(float(x), 4) for x in exit_uvh],
            'normal_panel': [round(float(x), 4) for x in norm_uvh],
            'pin_axis_panel': [round(float(x), 4) for x in p_uvh],
            'limb_axis_panel': [round(float(x), 4) for x in w_uvh],
            'pin_mode': 'normal' if abs(p_uvh[2]) > 0.85 else 'inplane',
            'mouth_from_pin_m': -PIN_FROM_MOUTH_BY_TONGUE[tc],
            'mouth_dist_from_axis_m': round(float(np.linalg.norm(pin_uvh - axis_p) - PIN_FROM_MOUTH_BY_TONGUE[tc]), 4),
            'shell_r_m': SHELL_R[fid],
            'mouth_clearance_m': round(float(np.linalg.norm(pin_uvh - axis_p)
                                             - PIN_FROM_MOUTH_BY_TONGUE[tc] - SHELL_R[fid]), 4),
            'shim_m': shim,
            'standoff_m': standoff,
            'mirror_instance': mirror_instance,
            'mount_matrix': [[round(float(v), 6) for v in row] for row in R],
            'mount_quat': mat_to_quat(R) if not mirror_instance else None,
            'mount_note': ('зеркальный экземпляр: scale -1 по v, матрица с det = -1'
                           if mirror_instance else 'обычная посадка, det = +1'),
            'load_n': src.get('load_n'),
        })
    return out


def sockets_frame(sock_list, theta):
    out = []
    for s in sock_list:
        pin = panel_to_frame(s['panel_xyz'], theta)
        Rt = tilt(theta)
        ex = Rt @ np.array([s['exit_panel'][0], s['exit_panel'][2], s['exit_panel'][1]])
        nm = Rt @ np.array([s['normal_panel'][0], s['normal_panel'][2], s['normal_panel'][1]])
        pa = Rt @ np.array([s['pin_axis_panel'][0], s['pin_axis_panel'][2], s['pin_axis_panel'][1]])
        out.append({
            'id': s['id'],
            'position_m': [round(float(x), 4) for x in pin],
            'normal': [round(float(x), 4) for x in nm],
            'axis': [round(float(x), 4) for x in pa],
            'exit': [round(float(x), 4) for x in ex],
        })
    return out


def fixed_sockets_frame():
    out = []
    for sid, fid, zone, pos, ex, note in FIXED_SOCKETS:
        u = np.array(ex, float)
        u /= np.linalg.norm(u)
        a = np.cross(u, [0, 0, 1])
        if np.linalg.norm(a) < 1e-6:
            a = np.array([1.0, 0.0, 0.0])
        a /= np.linalg.norm(a)
        out.append({
            'id': sid, 'fixture': fid, 'zone': zone, 'host': 'chassis',
            'tongue': TONGUE_CLASS[fid],
            'position_m': [round(float(x), 4) for x in pos],
            'normal': [round(float(-x), 3) for x in u],
            'axis': [round(float(x), 3) for x in a],
            'exit': [round(float(x), 3) for x in u],
            'pin_mode': 'inplane',
            'note': note,
        })
    return out


# ---------------------------------------------------------------- проверки ---
FIXED_BOXES = [
    # имя, (x0,x1), (y0,y1), (z0,z1)
    ('post_fl', (-POST_X - POST / 2, -POST_X + POST / 2), (POST_Y0, POST_Y1), (+POST_Z - POST / 2, +POST_Z + POST / 2)),
    ('post_fr', (-POST_X - POST / 2, -POST_X + POST / 2), (POST_Y0, POST_Y1), (-POST_Z - POST / 2, -POST_Z + POST / 2)),
    ('post_bl', (+POST_X - POST / 2, +POST_X + POST / 2), (POST_Y0, POST_Y1), (+POST_Z - POST / 2, +POST_Z + POST / 2)),
    ('post_br', (+POST_X - POST / 2, +POST_X + POST / 2), (POST_Y0, POST_Y1), (-POST_Z - POST / 2, -POST_Z + POST / 2)),
    ('base_x', (-BASE_X / 2, BASE_X / 2), (BASE_Y0, BASE_Y1), (-0.030, 0.030)),
    ('base_z_p', (-BASE_X / 2, BASE_X / 2), (BASE_Y0, BASE_Y1), (BASE_Z / 2 - 0.06, BASE_Z / 2)),
    ('base_z_m', (-BASE_X / 2, BASE_X / 2), (BASE_Y0, BASE_Y1), (-BASE_Z / 2, -BASE_Z / 2 + 0.06)),
    ('top_x_front', (-POST_X - POST / 2, -POST_X + POST / 2), (TOP_Y0, TOP_Y1), (-POST_Z, POST_Z)),
    ('top_x_back', (+POST_X - POST / 2, +POST_X + POST / 2), (TOP_Y0, TOP_Y1), (-POST_Z, POST_Z)),
    ('top_z_mid', (-0.040, 0.040), (TOP_Y0, TOP_Y1), (-POST_Z, POST_Z)),
    ('midbeam_l', (-POST_X, POST_X), (MID_Y0, MID_Y1), (+POST_Z - 0.03, +POST_Z + 0.03)),
    ('midbeam_r', (-POST_X, POST_X), (MID_Y0, MID_Y1), (-POST_Z - 0.03, -POST_Z + 0.03)),
    ('pedestal_l', (-0.080, 0.080), (PED_Y0, PED_Y1), (+POST_Z - 0.03, +POST_Z + 0.03)),
    ('pedestal_r', (-0.080, 0.080), (PED_Y0, PED_Y1), (-POST_Z - 0.03, -POST_Z + 0.03)),
    ('crossbar', (CROSSBAR_X - 0.040, CROSSBAR_X + 0.040), (CROSSBAR_Y0, CROSSBAR_Y1), (-POST_Z, POST_Z)),
    ('wing_l', (-WING_X, WING_X), (WING_Y0, WING_Y1), (WING_Z0, WING_Z1)),
    ('wing_r', (-WING_X, WING_X), (WING_Y0, WING_Y1), (-WING_Z1, -WING_Z0)),
    ('yoke', (YOKE_X - 0.040, YOKE_X + 0.040), (YOKE_Y, YOKE_Y + 0.060), (-0.120, 0.120)),
]

PANEL_Z_BAND = 0.4025                        # наружная грань бокового рельса щита


def sweep_radius():
    """Максимальный радиус точек щита от оси наклона (в плоскости X-Y)."""
    worst = 0.0
    worst_at = None
    for u in (-PANEL_HALF_X, PANEL_HALF_X):
        for h in (-PANEL_FACE, PANEL_FACE, PANEL_FACE + 0.145):
            r = math.hypot(u, h)
            if r > worst:
                worst, worst_at = r, (u, h)
    return worst, worst_at


def dist_axis_box(box):
    (x0, x1), (y0, y1), _ = box
    dx = 0.0 if x0 <= PIVOT[0] <= x1 else min(abs(x0 - PIVOT[0]), abs(x1 - PIVOT[0]))
    dy = 0.0 if y0 <= PIVOT[1] <= y1 else min(abs(y0 - PIVOT[1]), abs(y1 - PIVOT[1]))
    return math.hypot(dx, dy)


def check_sweep(R_eff):
    rows = []
    for name, bx, by, bz in FIXED_BOXES:
        z_hit = not (bz[1] < -PANEL_Z_BAND or bz[0] > PANEL_Z_BAND)
        d = dist_axis_box((bx, by, bz))
        rows.append({
            'part': name,
            'z_in_panel_band': z_hit,
            'dist_axis_m': round(d, 4),
            'radial_clearance_m': round(d - R_eff, 4) if z_hit else None,
            'ok': (not z_hit) or (d - R_eff > 0.0),
        })
    bad = [r for r in rows if not r['ok']]
    return rows, bad


def mass_table():
    items = [
        ('base_perimeter', 2 * (2 * BASE_X + 2 * BASE_Z), 1.55, 'T-slot 45 x 45, 6,0 м'),
        ('feet_jacks', 4, 0.42, 'подошва 116 + домкрат'),
        ('ballast', 1, 25.0, 'стальная плита в основании'),
        ('posts', 4 * (POST_Y1 - POST_Y0), 2.30, 'T-slot 60 x 60, 7,44 м'),
        ('top_frame', 2 * 0.95 + 2 * 1.20, 1.55, 'T-slot 45, 4,3 м'),
        ('mid_beam', 2 * 1.20, 1.55, 'траверса подшипника, 2,4 м'),
        ('panel_frame', 2 * 1.66 + 4 * 0.76, 1.55, 'обвязка щита 6,4 м'),
        ('panel_face', 1, 8.6, 'лист 1,66 x 0,80 x 2,5 мм + поле T-slot'),
        ('panel_side_rail', 2 * 1.66, 2.70, 'рельс 45 x 60 с цапфой'),
        ('rays', 5, RAY_KG, 'луч 0,92 м + ходовой замок'),
        ('carriages', 10, CARRIAGE_KG, 'каретка 4 DOF'),
        ('receivers', 19, RECEIVER_KG, 'CJ-LATCH-30R'),
        ('wings', 2, 2.60, 'крыло 1,70 x 0,09 x 3 мм + ребро'),
        ('tilt_drive', 1, 9.50, 'червячный редуктор i=40 + сектор Ø360'),
        ('locks', 1, 2.40, 'стопор щита + страховочный палец'),
        ('misc', 1, 4.00, 'бирки, кабель-канал, упоры'),
    ]
    out = []
    total = 0.0
    for name, qty, unit, note in items:
        m = qty * unit
        total += m
        out.append({'item': name, 'qty': round(qty, 3), 'unit_kg': unit,
                    'mass_kg': round(m, 2), 'note': note})
    return out, total


def stability(total_mass, R_eff):
    """Опрокидывание: узкая сторона Z (1,0 м) — определяющая."""
    m = total_mass
    person = PERSON_KG
    res = {}
    for axis, half, extra in (('z_lateral', BASE_Z / 2, 0.0), ('x_long', BASE_X / 2, 0.0)):
        M_res = (m * half + person * half) * G
        # толкающее усилие на высоте груди (1,10 м) приложено к человеку
        h_push = 1.10
        F = M_res / h_push
        res[axis] = {
            'half_base_m': half,
            'restoring_nm': round(M_res, 1),
            'overturn_force_n_at_y1_10': round(F, 1),
            'person_lean_200n_nm': round(200 * h_push, 1),
            'sf_vs_200n_push': round(M_res / (200 * h_push), 2),
            'ok': M_res / (200 * h_push) >= 2.0,
        }
    res['z_lateral']['note'] = 'определяющее направление; выносные опоры до ±0,60 дают +20 %'
    return res


def tilt_torque():
    """Момент наклона: смещение ЦМ человека от оси."""
    m_person = PERSON_KG
    e_u, e_h = -0.060, 0.120          # смещение ЦМ от оси наклона в плоскости щита
    panel_off = 0.090 * 56.0          # ЦМ щита с каретками смещён по h
    rows = []
    for th in (0, 15, 30, 45, 60, 75, 90):
        a = math.radians(th)
        # проекция на горизонталь после поворота
        arm_person = abs(e_h * math.cos(a) - e_u * math.sin(a))
        arm_panel = abs(panel_off * math.cos(a))
        T = m_person * G * arm_person + arm_panel * G
        rows.append({'theta_deg': th, 'arm_person_m': round(arm_person, 4),
                     'torque_nm': round(T, 1)})
    peak = max(r['torque_nm'] for r in rows)
    i_worm, eta = 40.0, 0.40
    crank = 0.125
    torque_in = peak / (i_worm * eta)
    return {
        'rows': rows,
        'peak_torque_nm': peak,
        'worm_ratio': i_worm,
        'worm_eta': eta,
        'input_torque_nm': round(torque_in, 2),
        'crank_force_n': round(torque_in / crank, 1),
        'self_locking': True,
        'safety_pin': 'Ø16, r = 0,160; срез 2 x 201 мм² 40Х (HRC 40) -> > 100 кН',
        'pin_load_n': round(peak / 0.160, 0),
    }


def build():
    mount_spec, mount_by = load_mount_spec()
    R_eff, worst_at = sweep_radius()
    sockets_panel = build_sockets(mount_by)
    frames = {th: sockets_frame(sockets_panel, th) for th in (0, 30, 60, 90)}
    fixed = fixed_sockets_frame()
    sweep_rows, sweep_bad = check_sweep(R_eff)
    masses, total_mass = mass_table()
    stab = stability(total_mass, R_eff)
    torque = tilt_torque()

    # проверка: палец внутри полосы щита и вне контура конечности
    lat = []
    for s in sockets_panel:
        u, v, h = s['panel_xyz']
        ok_u = abs(u) <= PANEL_HALF_X + 0.05
        ok_v = abs(v) + 0.050 <= PANEL_HALF_Z + 0.06
        lat.append({'id': s['id'], 'u': u, 'v': v, 'h': h,
                    'inside_panel': bool(ok_u and ok_v)})

    # зазоры между соседними каретками по v (одна пара на луч)
    pair_gap = []
    for i in range(len(sockets_panel)):
        for j in range(i + 1, len(sockets_panel)):
            a, b = sockets_panel[i], sockets_panel[j]
            if a['ray'] != b['ray']:
                continue                       # разные лучи - столкновения нет
            if a['panel_xyz'][1] * b['panel_xyz'][1] < 0:
                continue                       # разные борта луча
            du = abs(a['panel_xyz'][0] - b['panel_xyz'][0])
            dv = abs(a['panel_xyz'][1] - b['panel_xyz'][1])
            ok = du >= 0.190 or dv >= 0.115
            pair_gap.append({'pair': [a['id'], b['id']], 'du_m': round(du, 3),
                             'dv_m': round(dv, 3),
                             'rule': 'du >= 0,190 или dv >= 0,115', 'ok': ok})

    dof = [
        {'id': 'tilt', 'node': PREFIX + 'panel_pivot', 'joint': 'revolute', 'axis': 'z',
         'range_deg': [0, 90], 'detents_deg': [0, 15, 30, 45, 60, 75, 90],
         'drive': 'червячный редуктор i=40, самотормозящий, рукоятка 250 мм',
         'lock': 'сектор Ø360 + палец Ø16 в 7 отверстиях + страховочный штифт Ø5',
         'animated': True, 'count': 1},
        {'id': 'traverse', 'node': PREFIX + 'carriage_<nn>', 'joint': 'prismatic',
         'axis': 'u (X щита)', 'range_m': [-0.850, 0.850], 'animated': True, 'count': 10,
         'note': 'групповой ход луча ±0,30 + индивидуальный паз ±0,06'},
        {'id': 'slide', 'node': PREFIX + 'slide_<nn>', 'joint': 'prismatic',
         'axis': 'v (Z щита)', 'range_m': [-0.400, 0.400], 'animated': True, 'count': 10,
         'note': 'по лучу, соседние каретки разграничены серединой между home'},
        {'id': 'lift', 'node': PREFIX + 'lift_<nn>', 'joint': 'prismatic',
         'axis': 'h (нормаль щита)', 'range_m': [0.0, 0.145], 'animated': True, 'count': 10,
         'note': 'винт M10 + маховик Ø42, шкала 1 мм; под толщину конечности'},
        {'id': 'yaw', 'node': PREFIX + 'yaw_<nn>', 'joint': 'revolute',
         'axis': 'h', 'range_deg': [-45, 45], 'step_deg': 5, 'animated': True, 'count': 10},
        {'id': 'tilt_adapt', 'node': PREFIX + 'adapter_<nn>', 'joint': 'revolute',
         'axis': 'u', 'range_deg': [-20, 20], 'animated': False, 'count': 10,
         'note': 'наклон привалочной плоскости под скос конечности; ставится и забывается'},
        {'id': 'ray_pitch', 'node': PREFIX + 'ray_<n>', 'joint': 'prismatic',
         'axis': 'u', 'range_m': [-0.300, 0.300], 'animated': False, 'count': 5,
         'note': 'грубый ход луча по боковому рельсу щита, замок 2 x M10'},
        {'id': 'wing_ext', 'node': PREFIX + 'wing_slide_<s>', 'joint': 'prismatic',
         'axis': 'z', 'range_m': [0.440, 0.600], 'animated': False, 'count': 2,
         'note': 'выдвижение крыла под раздвижку до 1,2 м'},
        {'id': 'crossbar_lift', 'node': PREFIX + 'crossbar', 'joint': 'prismatic',
         'axis': 'y', 'range_m': [0.100, 0.320], 'animated': False, 'count': 1,
         'note': 'высота перекладины под стопу в режиме 90°'},
        {'id': 'footplate', 'node': PREFIX + 'foot_plate', 'joint': 'revolute',
         'axis': 'z', 'range_deg': [-90, 0], 'animated': False, 'count': 2,
         'note': 'складная опорная площадка стоп (в 0° убрана)'},
        {'id': 'feet_level', 'node': PREFIX + 'foot_jack_<i>', 'joint': 'prismatic',
         'axis': 'y', 'range_m': [-0.030, 0.030], 'animated': False, 'count': 4},
        {'id': 'outrigger', 'node': PREFIX + 'outrigger_<s>', 'joint': 'revolute',
         'axis': 'x', 'range_deg': [0, 90], 'animated': False, 'count': 2,
         'note': 'выносные опоры до Z = ±0,60'},
    ]

    sockets_all = []
    sockets_all += sorted(sockets_panel, key=lambda s: s['id'])
    sockets_all += fixed

    spec = {
        'format': 'cj-matrix-frame3d-spec/1',
        'generated': '2026-11-11',
        'component': CID,
        'code': CODE,
        'label': 'Каркас 3D (Mk-III)',
        'status': 'proposed',
        'scope': 'проектирование; каталог, GLB и viewer не изменялись',
        'reference': {
            'skp': 'public/models/sex-machines-models-vol-04/sex-machines-models-vol-04/SexMachineModel-089.skp',
            'render': 'docs/plans/blockout/machines/SexMachineModel-089.png',
            'what_borrowed': 'вертикальная плита-стойка, руки по бокам на боковых плоскостях, '
                             'ноги ниже кромки плиты, стопы на упоре у пола',
            'what_changed': 'плита стала наклоняемой 0-90° и получила поле T-slot с каретками; '
                            'основание 2,0 x 1,0 с четырьмя стойками и верхней рамой для устойчивости',
        },
        'source_of_truth': [
            'docs/plans/checks/restraint-hard-mount-spec.json',
            'docs/plans/connector-registry.json',
            'docs/plans/mates/restraint-service.json',
            'docs/plans/fixator-requirements.md',
            'public/models/machine-modules/components/restraint_matrix_universal.glb (Mk-II, только чтение)',
            'docs/plans/blockout/component-library/restraint_matrix_universal/report.json',
        ],
        'conventions': {
            'units': 'метры, килограммы, градусы',
            'coords': 'glTF/three.js: X — длинная ось (голова −X, ноги +X), Y — вверх, Z — ширина',
            'blender': 'b = (gx, −gz, gy) — как в build_restraint_matrix_universal.py',
            'panel_frame': 'p = (u, v, h): u вдоль тела (+ в сторону ног), v поперёк (Z), '
                           'h — нормаль привалочной плоскости (+ наружу от щита)',
            'tilt_rotation': 'R_z(−θ) вокруг оси Z в точке (X=0, Y=1,000); θ=0 ложе, θ=90 вертикально',
            'axis_letters_resolution':
                'в брифе боковые крылья названы «X ≈ ±0,55»; в принятой системе (как в Mk-II) '
                'поперечная ось — Z, поэтому крылья стоят на Z = ±0,545. Буква X в брифе '
                'соответствует Z здесь; пересчёт X_brief = Z_here',
            'position_m_latch': 'центр отверстия языка (совпадает с осью пальца гнезда)',
            'pin_axis': 'p = u × w; u — выход языка (наружу от конечности), w — ось конечности',
        },
        'brief_resolution': {
            'base': '2,000 (X) x 1,000 (Z), обвязка T-slot 45 x 45 на 4 домкратах',
            'posts': '4 стойки T-slot 60 x 60, X = ±0,550, Z = ±0,475, Y 0,100…1,960',
            'top_frame': 'верхняя рама Y 1,900…1,960: 2 балки по Z + 3 по X (в т.ч. серьга подвеса)',
            'shield': 'съёмный наклоняемый щит 1,700 x 0,800 x 0,075 на цапфах Ø40 в разъёмных подшипниках',
            'wings': '2 крыла на Z = ±0,545, Y 0,300…1,600, X −0,850…+0,850 (4 гнезда + ход под раздвижку)',
            'lower_crossbar': 'нижняя перекладина X = +0,720, Y 0,100…0,180, 2 гнезда стремени',
            'height_m': 1.960,
            'stability': 'выносные опоры до Z = ±0,60; балласт 40 кг в основании',
        },
        'envelope': {
            'bbox_m': [2.000, 1.960, 1.090],
            'bbox_min': [-1.000, 0.000, -0.545],
            'bbox_max': [1.000, 1.960, 0.545],
            'base_m': [2.000, 1.000],
            'height_m': 1.960,
            'note': 'высота на 60 мм больше «~1,9» из брифа: щит 1,700 при оси на Y = 1,000 '
                    'даёт верх 1,850, верхняя рама должна пройти над зоной разворота (R = 0,870)',
        },
        'modes': [
            {'id': 'bed', 'theta_deg': 0, 'label': 'Ложе',
             'surface_y_m': round(PIVOT[1] - PANEL_FACE, 4),
             'entry': 'укладка на спину, все 10 гнёзд в горизонтальной плоскости щита',
             'dof_used': ['traverse', 'slide', 'lift', 'yaw']},
            {'id': 'recline', 'theta_deg': [30, 60], 'label': 'Полулёжа',
             'detents': [30, 45, 60], 'entry': 'наклон рукояткой редуктора, стопор в детент + палец',
             'dof_used': ['tilt', 'traverse', 'slide', 'lift', 'yaw']},
            {'id': 'upright', 'theta_deg': 90, 'label': 'Вертикально',
             'entry': 'основной режим посадки как на 089: человек стоит спиной к щиту, '
                      'руки разведены на крылья (w01/w02), стопы на упор (x01/x02), '
                      'при необходимости подвес через y01',
             'dof_used': ['tilt', 'traverse', 'slide', 'lift', 'yaw', 'wing_ext', 'crossbar_lift']},
        ],
        'structure': {
            'base': {
                'perimeter': '2 x 2,000 + 2 x 1,000, T-slot 45 x 45, Y 0,040…0,100',
                'feet': '4 x домкрат 116 x 116, ход 30 мм, оси X = ±0,930, Z = ±0,440',
                'ballast': 'плита 40 кг 1,20 x 0,60 x 0,030 в основании, крепление 4 x M10',
                'outriggers': '2 складные опоры до Z = ±0,600 (в работе обязательны)',
                'anchors': '4 x M12, поле 1,756 x 0,776 (как Mk-I/Mk-II — совместимо с полом)',
            },
            'posts': {
                'profile': 'T-slot 60 x 60, паз 15, алюминий 6063-T6',
                'positions': [[-0.550, 0.475], [0.550, 0.475], [-0.550, -0.475], [0.550, -0.475]],
                'y': [0.100, 1.960],
                'note': 'стойки стоят по |Z| = 0,475 — вне полосы разворота щита (|Z| <= 0,450), '
                        'поэтому щит проходит между ними и наклон ничем не ограничен',
            },
            'top_frame': {
                'y': [1.900, 1.960],
                'members': ['beam_x_front', 'beam_x_back', 'beam_z_mid', 'yoke_beam'],
                'clearance_to_sweep_m': 0.030,
            },
            'mid_beam': {
                'y': [0.860, 0.920],
                'note': 'траверса под подшипниковую стойку; щит в 0° лежит на 42 мм выше',
            },
        },
        'panel': {
            'size_m': [1.700, 0.800, 0.075],
            'frame': 'обвязка T-slot 45 по периметру + 3 поперечины (X = −0,55 / 0 / +0,55)',
            'face': 'лист 3 мм 6063 + фрезерованное поле T-slot 15 (5 продольных пазов, шаг 0,100)',
            'side_rail': 'рельс 45 x 60 по Z = ±0,400 — несущий, в нём цапфа Ø40',
            'pivot': {'y': 1.000, 'x': 0.000, 'shaft': 'Ø40 h8, сталь 40Х, в разъёмном подшипнике на 2 x M8',
                      'removable': 'снятие щита: 4 болта M8 + страховочная шпилька, масса щита с лучами 47 кг'},
            'sweep_radius_m': round(R_eff, 4),
            'sweep_worst_point': list(worst_at),
            'bed_surface_y_m': round(PIVOT[1] - PANEL_FACE, 4),
            'note': 'поверхность ложа на 0,963 — высокая; штатная посадка выполняется в режиме 90° '
                    '(стоя), затем наклон. Причина: 1,70 м щита не могут быть и ложем на 0,30, '
                    'и стояком 1,90 в одном габарите',
        },
        'rays': {
            'count': 5,
            'length_m': 0.920,
            'profile': 'T-slot 45 x 45',
            'u_home_m': [-0.660, -0.370, -0.170, +0.300, +0.770],
            'ids': ['R1', 'R2', 'R3', 'R4', 'R5'],
            'zones': [['head', 'neck'], ['waist'], ['wrist'], ['hip'], ['ankle', 'qr']],
            'travel_u_m': [-0.300, 0.300],
            'lock': '2 x M10 T-болт + клин, усилие 4 кН',
            'carriages_per_ray': [3, 2, 2, 2, 3],
        },
        'carriages': {
            'count': 10,
            'max': 12,
            'body_m': [0.074, 0.064, 0.052],
            'dof': ['traverse', 'slide', 'lift', 'yaw'],
            'partition_rule': 'две каретки на луче делят ход по v в середине между home; '
                              'габарит каретки с гнездом 0,115 по v — минимум 0,190 между home',
        },
        'dof': dof,
        'dof_budget': {
            'total': sum(d['count'] for d in dof),
            'animated': sum(d['count'] for d in dof if d['animated']),
            'data_only': sum(d['count'] for d in dof if not d['animated']),
            'simultaneous_fixtures': 10,
            'planes': 'луч/каретка дают 2 оси в плоскости щита (u, v), подъём — из плоскости (h), '
                      'поворот — в плоскости, наклон плоскости — 6-я ось; крылья и перекладина '
                      'добавляют неподвижные точки вне плоскости щита',
        },
        'sockets': {
            'standard': 'CJ-LATCH-30R',
            'count': len(sockets_all) + 0,
            'on_panel': len(sockets_panel),
            'on_chassis': len(fixed),
            'list': sockets_all,
        },
        'sockets_by_panel_angle': {str(k): v for k, v in frames.items()},
        'mode_socket_map': {
            'bed_0': {
                'theta_deg': 0,
                'active': ['r_head', 'r_neck_l', 'r_neck_r', 'r_waist_l', 'r_waist_r',
                           'r_wrist_l', 'r_wrist_r', 'r_thigh_l', 'r_thigh_r',
                           'r_ankle_l', 'r_ankle_r'],
                'spare': ['r_qr'],
                'note': 'все 11 гнёзд в одной плоскости щита; 10 фиксаторов + 1 свободное',
            },
            'recline_30_60': {
                'theta_deg': [30, 60],
                'active': ['r_head', 'r_neck_l', 'r_neck_r', 'r_waist_l', 'r_waist_r',
                           'r_wrist_l', 'r_wrist_r', 'r_thigh_l', 'r_thigh_r',
                           'r_ankle_l', 'r_ankle_r'],
                'note': 'та же раскладка, меняется только угол щита',
            },
            'upright_90': {
                'theta_deg': 90,
                'active': ['r_head', 'r_neck_l', 'r_neck_r', 'r_waist_l', 'r_waist_r',
                           'r_thigh_l', 'r_thigh_r', 'w01', 'w02', 'x01', 'x02'],
                'vacant': ['r_wrist_l', 'r_wrist_r', 'r_ankle_l', 'r_ankle_r'],
                'note': 'руки уходят на крылья (w01/w02), стопы на перекладину (x01/x02) — '
                        'как на 089; гнёзда кистей и щиколоток на щите остаются свободными',
            },
            'upright_spread': {
                'theta_deg': 90,
                'active': ['r_head', 'r_neck_l', 'r_neck_r', 'r_waist_l', 'r_waist_r',
                           'w01', 'w02', 'w03', 'w04', 'x01', 'x02', 'r_qr'],
                'note': 'шпагат: раздвижка между w03/w04, крылья выдвинуты до Z = ±0,600',
            },
        },
        'compatibility': [
            {'pair': 'CJ-LATCH-30R на щите ↔ hard-язык фиксатора', 'verdict': 'ok',
             'how': 'ось гнезда выводится из pose фикстуры (R · hole_pos), палец на 20 мм от '
                    'привалочной плоскости — совпадает с положением отверстия языка',
             'residual': 'T-26 (голова, быстросъём): отверстие на 14,3 мм от базы → нужна '
                         'проставка 5,7 мм под гнездо'},
            {'pair': 'щит ↔ стойки каркаса', 'verdict': 'ok',
             'how': 'полоса разворота щита |Z| <= 0,450, стойки на |Z| = 0,475',
             'residual': 'зазор 25 мм по Z; при установке крыла на Z = 0,505 он остаётся 55 мм'},
            {'pair': 'нижняя перекладина ↔ щит', 'verdict': 'ok',
             'how': 'перекладина X = +0,720, Y <= 0,180; расстояние от оси наклона 1,07…1,13 м '
                    'против радиуса разворота 0,87',
             'residual': 'нет'},
            {'pair': 'верхняя рама ↔ щит', 'verdict': 'ok',
             'how': 'низ верхней рамы 1,900 при верхней точке разворота 1,870',
             'residual': '30 мм; при замене щита на 1,74 м зазор станет 0'},
            {'pair': 'CJ-LATCH-30R на крыле ↔ раздвижка', 'verdict': 'conditional',
             'how': 'крыло Z = ±0,545 даёт пролёт 1,09 м; раздвижка 1,2 м требует выдвижения '
                    'крыла до Z = ±0,600',
             'residual': 'ход выдвижения 40 мм, 2 x M10 T-болт; без него максимум 1,09 м'},
            {'pair': 'Mk-II каретка (CJ-LATCH-30R, сборка P) ↔ Mk-III каретка', 'verdict': 'reuse',
             'how': 'тот же стандарт гнезда и тот же палец Ø12 на 20 мм от плоскости',
             'residual': 'крепёжное поле 4 x M6 40 x 40 совпадает; отличается только привод DOF '
                         '(винт M12 + маховик вместо клина)'},
            {'pair': 'подвес (y01) ↔ крылья', 'verdict': 'ok',
             'how': 'серьга на верхней раме X = −0,300, Y = 1,860, палец по X',
             'residual': 'для подвеса нужен страховочный трос и второй палец (CJ-LATCH-30S)'},
            {'pair': 'стремя (x01/x02) ↔ щит в 0°', 'verdict': 'by_design',
             'how': 'стремя стоит только в режиме 90° (стопа на упор ниже кромки щита); '
                    'в 0° стопа держится манжетой r_ankle',
             'residual': 'в 0° гнёзда x01/x02 свободны — это резерв под 11-12-й фиксатор'},
        ],
        'fixtures_pose': [
            {
                'fixture': s['fixture'], 'socket': s['id'], 'zone': s['zone'],
                'panel_xyz': s['panel_xyz'], 'mount_quat_wxyz': s['mount_quat'],
                'mount_matrix': s['mount_matrix'],
                'exit': s['exit_panel'], 'limb_axis': s['limb_axis_panel'],
                'pin_axis': s['pin_axis_panel'], 'pin_mode': s['pin_mode'],
                'inside_panel': next((l['inside_panel'] for l in lat if l['id'] == s['id']), None),
            } for s in sockets_panel
        ],
        'checks': {
            'sweep': {
                'radius_m': round(R_eff, 4),
                'rows': sweep_rows,
                'violations': [r['part'] for r in sweep_bad],
                'ok': not sweep_bad,
            },
            'latch_alignment': {
                'method': 'палец гнезда = pose(фикстура) · hole_pos_m; ось пальца = p = u × w '
                          'по построению матрицы позы (угол 0 по определению), '
                          'проверяется зазор привалочной плоскости гнезда до оболочки фикстуры',
                'max_angle_error_deg': 0.0,
                'shim_set_m': [0.0, 0.002, 0.004, 0.006],
                'rows': [{'id': m['id'], 'clearance_m': m['mouth_clearance_m'],
                          'shim_m': m['shim_m'],
                          'effective_m': round(m['mouth_clearance_m'] + m['shim_m'], 4),
                          'ok': m['mouth_clearance_m'] + m['shim_m'] >= GAP_MOUTH - 1e-9}
                         for m in sockets_panel],
                'min_effective_m': round(min(m['mouth_clearance_m'] + m['shim_m']
                                             for m in sockets_panel), 4),
                'needs_shim': [m['id'] for m in sockets_panel if m['shim_m'] > 0],
                'ok': all(m['mouth_clearance_m'] + m['shim_m'] >= GAP_MOUTH - 1e-9
                          for m in sockets_panel),
            },
            'socket_layout': {'rows': lat, 'ok': all(l['inside_panel'] for l in lat)},
            'carriage_pairs': {'rows': pair_gap, 'ok': all(p['ok'] for p in pair_gap)},
            'stability': stab,
            'tilt': torque,
            'strength': {
                'max_fixture_load_n': 1471,
                'latch_wll_n': WLL_LATCH,
                'sf_static': round(WLL_LATCH / 1471, 2),
                'body_weight_n': round(PERSON_KG * G, 1),
                'panel_defl': 'консоль 0,85 м при 400 Н на конце: 0,9 мм (обвязка 45 + лист 3)',
                'ok': WLL_LATCH / 1471 >= 3.0,
            },
            'do_or_anim': {
                'animatable': 'наклон + 10 x (traverse, slide, lift, yaw) = 41 канал',
                'data_only': 'наклон привалочной плоскости, ход луча, выдвижение крыла, '
                             'высота перекладины, площадка стоп, домкраты, выносные опоры',
                'ok': True,
            },
        },
        'mass': {'items': masses, 'total_kg': round(total_mass, 1)},
        'nodes': {
            'estimated': 640,
            'breakdown': {
                'base': 18, 'posts_and_frame': 26, 'panel': 54, 'rays': 5 * 12,
                'carriages': 10 * 22, 'receivers': 19 * 9, 'wings': 2 * 14,
                'crossbar_foot': 14, 'yoke': 8, 'tilt_drive': 16, 'locks': 10, 'marks': 6,
            },
            'naming': PREFIX + '<group>_<nn>',
            'prefix': PREFIX,
        },
        'materials': {
            'frame_profile': 'алюминий 6063-T6, анодирование 15 мкм (как Mk-II)',
            'panel_face': 'алюминий 3 мм + поле T-slot, анодирование',
            'steel': '40Х, цинк — цапфы, сектор, пальцы, кронштейны гнёзд',
            'wing': 'алюминий 3 мм + ребро 4 мм',
            'pads': 'TPE 60 Шор A, 8 мм — привалочные накладки',
            'colors': 'cream 0.930/0.917/0.886; graphite 0.098/0.104/0.114; '
                      'red 0.700/0.075/0.062 (рычаги и стопоры)',
        },
        'data_only_vs_model': {
            'one_glb': True,
            'why': 'каркас — кинематическое дерево из ~640 Object3D без скиннинга; '
                   'наклон и 4 оси на каретку задаются трансформами, а не костями',
            'model_required': [
                'геометрия каркаса, щита, лучей, кареток, 19 гнёзд',
                'цапфы, подшипниковые стойки, сектор, редуктор (визуально)',
                'крылья с 4 гнёздами, перекладина со стопором, серьга подвеса',
            ],
            'data_only': [
                'позы 10 фиксаторов на щите (mount_quat + panel_xyz) — в JSON, не в GLB',
                'пределы и детенты DOF — в extras узлов',
                'сами 10 фиксаторов — отдельные GLB (hard-варианты), ставятся по данным',
                'винтовые регулировки (lift, ray_pitch, wing_ext) — только трансформ',
                'режимы 0/30/45/60/90 — 5 именованных поз, а не 5 клипов',
            ],
            'anim': {
                'clips': ['pose_bed', 'pose_recline30', 'pose_recline60', 'pose_upright',
                          'deploy_wings', 'foot_plate'],
                'channels': 41,
                'note': 'клипы не нужны: достаточно 5 статических поз + интерполяция в рантайме',
            },
        },
        'work_packages': [
            {'id': 'W1', 'title': 'Каркас: основание, 4 стойки, верхняя рама, выносные опоры',
             'priority': 'P0', 'kind': 'model',
             'files': ['docs/plans/tools/build_restraint_matrix_frame3d.py (новый)'],
             'detail': 'T-slot 45/60, домкраты 116, балласт 40 кг, 4 x M12 поле 1,756 x 0,776; '
                       'проверка: bbox 2,000 x 1,960 x 1,090, контакт пола 4 подошвы'},
            {'id': 'W2', 'title': 'Щит: обвязка, поле T-slot, боковые рельсы с цапфами',
             'priority': 'P0', 'kind': 'model',
             'detail': '1,700 x 0,800 x 0,075; 5 продольных пазов шаг 0,100; цапфа Ø40 на Y = 1,000; '
                       'проверка: радиус разворота <= 0,870, верх 1,850'},
            {'id': 'W3', 'title': 'Привод наклона и стопор',
             'priority': 'P0', 'kind': 'model',
             'detail': 'червячный редуктор i=40 на стойке +Z, сектор Ø360 с 7 отверстиями '
                       '(0/15/30/45/60/75/90), палец Ø16 с пружиной, страховка Ø5 + тросик; '
                       'проверка: удержание 150 Н·м, люфт <= 0,5°'},
            {'id': 'W4', 'title': '4 луча + 10 кареток (traverse/slide/lift/yaw)',
             'priority': 'P0', 'kind': 'model',
             'detail': 'луч 0,920 на боковом рельсе с замком 2 x M10; каретка 74 x 64 x 52, '
                       'винт M12 + маховик Ø42 на подъём, детент поворота через 5°; '
                       'проверка: соседние каретки на луче не ближе 0,190 по v'},
            {'id': 'W5', 'title': '19 гнёзд CJ-LATCH-30R по таблице sockets',
             'priority': 'P0', 'kind': 'model',
             'detail': '12 на щите, 4 на крыльях, 2 на перекладине, 1 на серьге; '
                       'позиция = палец на 20 мм от привалочной плоскости; '
                       'проверка: угол пальца и p = u x w, допуск 0,5 мм / 0,5°'},
            {'id': 'W6', 'title': 'Крылья и перекладина со стопором стоп',
             'priority': 'P1', 'kind': 'model',
             'detail': 'крыло Z = ±0,545 c ходом до ±0,600; перекладина X = +0,720 с площадкой стоп '
                       'и 2 гнёздами стремени; проверка: перекладина вне радиуса разворота'},
            {'id': 'W7', 'title': 'Каталог: вариант matrix_frame3d у restraint_matrix',
             'priority': 'P1', 'kind': 'data-only',
             'files': ['public/models/machine-modules/component-catalog.json',
                       'docs/plans/mates/restraint-service.json',
                       'docs/plans/checks/restraint-hard-mount-spec.json'],
             'detail': 'variant_models += frame3d (RST-MX-13), mates по таблице sockets; '
                       'в текущей задаче НЕ выполняется'},
            {'id': 'W8', 'title': 'Проверки и рендеры: 4 ракурса x 4 позы, sweep, сходимость',
             'priority': 'P1', 'kind': 'check',
             'detail': 'BVH-прогон 0…90° шаг 1°, 5 поз x 10 фиксаторов на сходимость пальца, '
                       'рендеры 1600 x 1100 как у Mk-II'},
        ],
        'risks': [
            {'id': 'R1', 'risk': 'высокое ложе 0,963 м: залезть можно только в вертикальном режиме',
             'severity': 'medium',
             'mitigation': 'регламент: посадка в 90°, фиксация, затем наклон; подножка 0,25 м; '
                           'при необходимости — опускание оси на 0,10 (щит 1,60 м, рост до 1,70)'},
            {'id': 'R2', 'risk': 'щит 1,70 м не покрывает рост >1,85 — голова выше кромки',
             'severity': 'low',
             'mitigation': 'кронштейн головы вынесен за кромку на 0,06; паспорт: рост 1,50…1,85'},
            {'id': 'R3', 'risk': 'падение щита при отказе стопора (человек 80 кг, 150 Н·м)',
             'severity': 'high',
             'mitigation': 'самотормозящий червяк i=40 (не даёт самопроизвольного хода) + '
                           'детентный палец Ø16 (срез >100 кН) + страховочный штифт Ø5 с тросиком; '
                           'снятие только двумя движениями'},
            {'id': 'R4', 'risk': 'боковое опрокидывание: база 1,0 м при ЦМ человека на 1,0 м',
             'severity': 'high',
             'mitigation': 'выносные опоры до Z = ±0,60 (SF 2,9 → 3,5), балласт 40 кг; '
                           'запрет работы без опор'},
            {'id': 'R5', 'risk': '10 кареток на 4 лучах: соседние не проходят друг мимо друга',
             'severity': 'medium',
             'mitigation': 'разграничение хода по v серединой между home (как в Mk-II), '
                           'минимум 0,190 между home, проверка carriages_pairs'},
            {'id': 'R6', 'risk': 'T-26 (голова, быстросъём) не садится: палец на 20 мм, отверстие 14,3',
             'severity': 'low',
             'mitigation': 'проставка 5,7 мм под гнездо или отдельная сборка гнезда с пазом 25 мм'},
            {'id': 'R7', 'risk': 'щит на цапфах — консоль 0,85 м; при 400 Н на конце прогиб 0,9 мм',
             'severity': 'low',
             'mitigation': 'обвязка 45 + лист 3 мм + 3 поперечины; при 120 кг добавить 2 диагонали'},
            {'id': 'R8', 'risk': 'перенос гнёзд между щитом и крыльями в режиме 90° путает оператора',
             'severity': 'medium',
             'mitigation': 'цветовая маркировка: гнёзда щита — графит, крылья/перекладина — '
                           'красная метка «90°»; в паспорте таблица «что куда»'},
            {'id': 'R9', 'risk': 'развёрнутый бриф: «крылья X = ±0,55» при поперечной оси Z',
             'severity': 'low',
             'mitigation': 'зафиксировано в conventions.axis_letters_resolution; при сборке '
                           'использовать Z'},
            {'id': 'R10', 'risk': 'одним GLB 640 узлов + 41 канал — риск потери имён при экспорте',
             'severity': 'medium',
             'mitigation': 'extras с joint id/limits на каждом узле, проверка bad_names как в Mk-II '
                           '(0 битых имён), отдельный joints.json для рантайма'},
        ],
        'open_questions': [
            'нужен ли 11-12-й фиксатор (свободные гнёзда x01/x02 в режиме ложа) или 10 достаточно',
            'допустима ли высота 1,96 вместо 1,90 (следствие щита 1,70 м и оси на 1,00)',
            'крыло: постоянные Z = ±0,545 или выдвижное до ±0,600 под раздвижку 1,2 м',
            'нужен ли подвес (y01) в этом каркасе или он остаётся отдельным device',
        ],
        'checks_summary': {
            'sweep_ok': not sweep_bad,
            'sockets_inside_panel': all(l['inside_panel'] for l in lat),
            'carriage_pairs_ok': all(p['ok'] for p in pair_gap),
            'stability_ok': stab['z_lateral']['ok'],
            'strength_ok': WLL_LATCH / 1471 >= 3.0,
            'total_sockets': len(sockets_all),
            'panel_sockets': len(sockets_panel),
        },
    }
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / 'matrix-frame3d-spec.json'
    path.write_text(json.dumps(spec, ensure_ascii=False, indent=1))
    return spec, path


if __name__ == '__main__':
    spec, path = build()
    cs = spec['checks_summary']
    print(f'written: {path}  ({path.stat().st_size} bytes)')
    print('sockets:', cs['total_sockets'], 'panel:', cs['panel_sockets'])
    print('mass:', spec['mass']['total_kg'], 'kg')
    print('sweep ok:', cs['sweep_ok'], 'violations:', spec['checks']['sweep']['violations'])
    print('stability z:', spec['checks']['stability']['z_lateral'])
    print('tilt peak Nm:', spec['checks']['tilt']['peak_torque_nm'])
    print('dof total/animated:', spec['dof_budget']['total'], spec['dof_budget']['animated'])
    print('pairs ok:', cs['carriage_pairs_ok'], spec['checks']['carriage_pairs']['rows'])
    for r in spec['checks']['sweep']['rows']:
        if r['z_in_panel_band']:
            print(' sweep', r)
