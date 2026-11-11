"""Hard-mount variants (batch A) for five restraint fixators.

Builds `<cid>_hard.glb` from the existing soft GLB + the hard geometry defined in
`docs/plans/checks/restraint-hard-mount-spec.json` (anchor / shell / bracket /
tongue / add_nodes / hide_nodes / envelope_new), then renders 4 views + a
latch-demo close-up and writes report.json. The soft part is imported, never
rebuilt; D-rings are *deleted*.

  blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_hard_batch_a.py [-- <cid> ...]

Output:
  public/models/machine-modules/components/<cid>_hard.glb
  docs/plans/blockout/component-library/<cid>_hard/*.png + report.json

Coordinate note: hard geometry is authored in glTF space (Y-up, exactly the
numbers of the spec) and rotated by Rx(+90) onto the imported GLB.

Geometry is fitted to the *measured* soft part (bbox of every node of the source
GLB), not to the spec alone: where the spec contradicts the mesh the mesh wins
and the deviation is written into report.json -> deviations.
"""
import sys
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import restraint_hard_lib as L  # noqa: E402

PROJECT = HERE.parents[2]
SPEC = json.loads((PROJECT / 'docs/plans/checks/restraint-hard-mount-spec.json').read_text())
SPEC_BY_ID = {c['id']: c for c in SPEC['components']}
TONGUES = {t['id']: t for t in SPEC['standards']['CJ-LATCH-30']['tongues']}
BATCH = ['restraint_ankle_cuff', 'restraint_thigh_clamp',
         'restraint_waist_belt', 'restraint_suspension_cuff']

R = math.radians


def vec(t):
    return Vector(tuple(float(v) for v in t))


def t30():
    """(width, thick, length, hole_offset) of T-30 in metres."""
    t = TONGUES['T-30']
    hole = float(t['hole_mm'].split('на')[1].split('мм')[0].replace(',', '.')) / 1000.0
    return t['w_mm'] / 1000.0, t['t_mm'] / 1000.0, t['l_mm'] / 1000.0, hole


def t44():
    t = TONGUES['T-44']
    hole = float(t['hole_mm'].split('на')[1].split('мм')[0].replace(',', '.')) / 1000.0
    return t['w_mm'] / 1000.0, t['t_mm'] / 1000.0, t['l_mm'] / 1000.0, hole


def cuff_frame(center, a_deg):
    u = Vector((math.cos(R(a_deg)), math.sin(R(a_deg)), 0.0))
    w = Vector((0.0, 0.0, 1.0))
    p = u.cross(w)
    return u, w, p


def add_gusset(cid, name, center, r_root, r_tip, a_root, a_tip, thick, role='hardsteel'):
    """Triangular web in the polar (r, a) plane at z = 0 (component axis Z)."""
    cx, cy = center
    verts = []
    for z in (-thick * 0.5, thick * 0.5):
        for r, a in ((r_root, a_root), (r_tip, a_tip), (r_root, a_tip)):
            verts.append((cx + r * math.cos(R(a)), cy + r * math.sin(R(a)), z))
    faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return L.apply(obj, role)


def screws_radial(cid, tags, center, r_seat, angles, zs, axis_sign=1.0,
                  d=0.0050, head_d=0.0092, head_h=0.0032, shank=0.0055):
    """Screws whose heads sit on radius r_seat and go inward (toward the axis)."""
    for tag, a, z in zip(tags, angles, zs):
        ca, sa = math.cos(R(a)), math.sin(R(a))
        seat = Vector((center[0] + r_seat * ca, center[1] + r_seat * sa, z))
        axis = Vector((-ca, -sa, 0.0)) * axis_sign
        L.bolt(f'{cid}__hard_screw_{tag}', seat, axis, d=d, head_d=head_d,
               head_h=head_h, shank=shank)


# ------------------------------------------------------- cuff hard builder --
def build_cuff(cid, params):
    """Cylindrical cuff (ankle): shell lobes + curved bracket + tongue."""
    spec = SPEC_BY_ID[cid]
    P = f'{cid}__'
    removed, absent = L.drop_nodes(cid, spec['hide_nodes'])
    removed += L.hide_nodes(cid, params.get('hide_extra', []))
    center = params['center']
    u, w, p = cuff_frame(center, params['anchor_deg'])

    built = []
    shell_names = []
    for i, (a0, a1) in enumerate(params['lobes']):
        nm = f'{P}hard_shell' if i == 0 else f'{P}hard_shell_part{i}'
        L.arc_shell(nm, center, params['shell_rin'], params['shell_rout'],
                    a0, a1, -params['half_w'], params['half_w'], 'cfrp')
        shell_names.append(nm)
    L.join(shell_names, f'{P}hard_shell')
    built.append('hard_shell')

    lob = params['rib_lobe']
    for tag, zs in (('a', 1.0), ('b', -1.0)):
        L.arc_shell(f'{P}hard_shell_rib_{tag}', center,
                    params['shell_rout'] - 0.0004, params['shell_rout'] + 0.0026,
                    lob[0] + 1.5, lob[1] - 1.0,
                    zs * (params['half_w'] - 0.0040), zs * (params['half_w'] - 0.0070),
                    'cfrp')
        built.append(f'hard_shell_rib_{tag}')
        L.arc_shell(f'{P}hard_shell_flange_{tag}', center,
                    params['shell_rin'] - 0.0010, params['shell_rout'] + 0.0004,
                    lob[0] + 1.0, lob[1] - 0.5,
                    min(zs * params['half_w'], zs * (params['half_w'] - 0.0045)),
                    max(zs * params['half_w'], zs * (params['half_w'] - 0.0045)),
                    'cfrp')
        built.append(f'hard_shell_flange_{tag}')

    # bracket: curved plate on the shell + raised pad under the tongue root
    br = params['bracket']
    plate = L.arc_shell(f'{P}hard_bracket', center, br['r_in'], br['r_out'],
                        br['a0'], br['a1'], -br['half_w'], br['half_w'], 'hardsteel')
    base = vec(br['tongue_base'])
    pad = L.framed_bar(f'{P}hard_bracket_pad', base - u * br['pad_len'], u, w, p,
                       (br['pad_len'], br['tongue_w'], 0.0120), 'hardsteel', r=0.0007)
    L.join([plate.name, pad.name], f'{P}hard_bracket')
    built.append('hard_bracket')

    # two 2 mm fins filling the step between plate and pad (spec: косынка 2 мм)
    fins = []
    for tag, ws in (('a', 1.0), ('b', -1.0)):
        fins.append(L.tri_prism(
            f'{P}fin_tmp_{tag}',
            [base - u * br['pad_len'] + p * 0.0060 + w * (ws * 0.0135),
             base + u * 0.0006 + p * 0.0060 + w * (ws * 0.0135),
             base - u * br['pad_len'] - p * 0.0060 + w * (ws * 0.0135)],
            (0, 0, 1), 0.0020, 'hardsteel'))
    L.join([o.name for o in fins], f'{P}hard_bracket_web')
    built.append('hard_bracket_web')

    tw, tt, tl, thoff = t30()
    hole = L.add_tongue(cid, '', base, u, w, p, tw, tt, tl, thoff)
    built += ['hard_tongue', 'hard_tongue_bush', 'hard_antirot_pin_a',
              'hard_antirot_pin_b']

    screws_radial(cid, ['a', 'b', 'c', 'd'], center, br['r_out'] + 0.0002,
                  [br['screw_a0'], br['screw_a0'], br['screw_a1'], br['screw_a1']],
                  [0.0090, -0.0090, 0.0090, -0.0090])
    built += ['hard_screw_a', 'hard_screw_b', 'hard_screw_c', 'hard_screw_d']

    names = [o.name for o in bpy.context.scene.objects if o.type == 'MESH'
             and o.name.startswith(f'{cid}__hard_')]
    L.to_blender_space(names)
    return {'removed': removed, 'absent': absent, 'built': built, 'hole': hole,
            'frame': (u, w, p)}


# ------------------------------------------------------------------- ankle --
def build_ankle(cid):
    params = {
        'center': (0.0, 0.040),
        'anchor_deg': -30.0,
        'half_w': 0.0150,                 # = band width (0.030), spec says 0.034
        'shell_rin': 0.0398, 'shell_rout': 0.0434,
        'lobes': [(-105.0, -60.0), (-46.0, -13.0), (24.0, 45.0)],
        'rib_lobe': (-105.0, -60.0),
        'hide_extra': [],
        'bracket': {
            'r_in': 0.0432, 'r_out': 0.0462, 'a0': -46.0, 'a1': -13.5,
            'half_w': 0.0145,
            'tongue_base': (0.041805, 0.01535, 0.0), 'pad_len': 0.0051,
            'tongue_w': 0.030,
            'screw_a0': -40.0, 'screw_a1': -22.0,
        },
    }
    meta = build_cuff(cid, params)
    meta['deviations'] = [
        'оболочка тремя лепестками -105…-60, -46…-13, 24…45 (110° из 150°): '
        'окна под ограничитель длины (limit_stop -59…-47°, r≤0,0460) и под '
        'пряжку с роликом и воротником (buckle_frame/roller/pin -12…+15°, '
        'limit_collar 15…24°, r≤0,0476)',
        'ширина оболочки 30 мм вместо 34 (спек): ремень манжеты 30 мм '
        '(band z ±0,0150), оболочка 34 мм висела бы над ремнём на 2 мм с каждой стороны',
        'кронштейн: плита 32,5°×3 на оболочке + бобышка 5 мм под пятку языка; '
        'спека «48 × 34 × 3» относится к плоской плите, на дуге r=0,043 это 48 мм '
        'по дуге = 64° и перекрыло бы пряжку',
        'язык T-30 (34 мм, отверстие 18,7 от базы) посажен так, что отверстие '
        'попадает точно в position_m спеки (0,058 / 0,006); база — на бобышке '
        'кронштейна (r 0,0501), нос языка на 0,9 мм короче tip_m',
        'винтов 4×M5 (по спеке) в оболочку: головки на r 0,0464, стержень 5,5 мм внутрь',
    ]
    meta['views'] = {
        '3q': ((1.20, -1.35, 1.05), None),
        'front': ((1.00, -0.06, 0.20), None),
        'side': ((0.06, -1.00, 0.16), None),
        'closeup': ((0.85, -0.72, 0.42), 0.170),
    }
    return meta


# ------------------------------------------------------------------- thigh --
def build_thigh(cid):
    spec = SPEC_BY_ID[cid]
    P = f'{cid}__'
    removed, absent = L.drop_nodes(cid, spec['hide_nodes'])
    u, w, p = vec((1, 0, 0)), vec((0, 0, 1)), vec((0, -1, 0))

    # cheek is an elliptical cylinder a=0.0620 b=0.0445 (measured on jaw_a_shell);
    # the bracket band is generated on 0.8 mm smaller radii so it bites into it.
    A_IN, B_IN = 0.0612, 0.0437
    A_OUT, B_OUT = 0.0645, 0.0470
    # doubler plate on the cheek, wider than the bracket (spec: hard_stiffener_plate)
    L.oval_shell(f'{P}hard_stiffener_plate', (0.0, 0.0), 0.0612, 0.0437,
                 0.0632, 0.0457, -50.0, 50.0, 0.0160, 0.0640, 'hardsteel')
    band_tmp = L.oval_shell(f'{P}hard_bracket', (0.0, 0.0), A_IN, B_IN, A_OUT,
                            B_OUT, -30.0, 30.0, 0.0140, 0.0660, 'hardsteel')
    # flat pad sunk into the band, gives the tongue a plane seat at x = 0.0645
    L.cube(f'{P}pad_tmp', (0.06175, 0.040, 0.0), (0.0055, 0.020, 0.045),
           'hardsteel', r=0.0007)
    # shelf under the tongue (spec: "две полки")
    L.cube(f'{P}shelf_tmp', (0.07575, 0.03525, 0.0), (0.0225, 0.0035, 0.042),
           'hardsteel', r=0.0007)
    L.join([band_tmp.name, f'{P}pad_tmp', f'{P}shelf_tmp'], f'{P}hard_bracket')
    # 2 gussets between cheek, pad and shelf (spec: косынка 3 мм)
    for tag, zs in (('a', 1.0), ('b', -1.0)):
        L.tri_prism(f'{P}web_tmp_{tag}',
                    [(0.0645, 0.0370, zs * 0.0185),
                     (0.0790, 0.0370, zs * 0.0185),
                     (0.0645, 0.0190, zs * 0.0185)],
                    (0, 0, 1), 0.0030, 'hardsteel')
    L.join([f'{P}web_tmp_a', f'{P}web_tmp_b'], f'{P}hard_bracket_web')

    # tongue T-44: hole at spec 0.083 -> root 0.0632 (inside the band/pad)
    tw, tt, tl, thoff = t44()
    base = vec((0.083 - thoff, 0.040, 0.0))
    hole = L.add_tongue(cid, '', base, u, w, p, tw, tt, tl, thoff)

    # 4 x M5 into the cheek (heads on the band, shanks along -X)
    for tag, (zz, yy) in zip(['a', 'b', 'c', 'd'],
                             [(0.010, 0.024), (-0.010, 0.024),
                              (0.010, 0.056), (-0.010, 0.056)]):
        x_seat = A_OUT * math.sqrt(max(0.0, 1.0 - (zz / B_OUT) ** 2)) - 0.0002
        L.bolt(f'{P}hard_screw_{tag}', (x_seat, yy, zz), (-1, 0, 0), shank=0.0100)
    names = [o.name for o in bpy.context.scene.objects if o.type == 'MESH'
             and o.name.startswith(f'{cid}__hard_')]
    L.to_blender_space(names)
    return {
        'removed': removed, 'absent': absent,
        'hole': hole, 'frame': (u, w, p),
        'built': ['hard_stiffener_plate', 'hard_bracket', 'hard_bracket_web',
                  'hard_tongue', 'hard_tongue_bush', 'hard_antirot_pin_a',
                  'hard_antirot_pin_b', 'hard_screw_a', 'hard_screw_b',
                  'hard_screw_c', 'hard_screw_d'],
        'deviations': [
            'кронштейн посажен на внешнюю щёку jaw_a (+X), где стояла планка D-ring; '
            'в спеке она названа jaw_b, но dring_plate x 0,0599…0,0658 — это +X',
            'оболочки нет: щёки зажима уже жёсткие (CFRP) — спека shell type = none; '
            'вместо неё пояс 76° на эллиптической щёке (a 0,062 b 0,0445 по замеру)',
            'кронштейн = пояс 3,3 мм 76° + плоская бобышка 5,5 мм + полка 19 мм под '
            'язык + 2 косынки 3 мм (спека: «56 × 44 × 3, две полки, косынка 3 мм»); '
            'плоскую плиту 56×44 на цилиндр не посадить — она касалась бы только кромкой',
            'язык T-44 (44×6×36, отверстие 19,8 от базы): база 0,0632, отверстие '
            'точно в position_m 0,083, нос 0,098 вместо tip_m 0,099',
            '4×M5 в закладные щеки: головки легли на пояс по эллипсу (x = 0,0628 при '
            'z = ±0,010), стержень 10 мм внутрь щеки',
        ],
        'views': {
            '3q': ((1.15, -1.30, 1.05), None),
            'front': ((1.00, -0.05, 0.18), None),
            'side': ((0.08, -1.00, 0.16), None),
            'closeup': ((0.85, -0.62, 0.42), 0.240),
        },
    }


# ------------------------------------------------------------------- waist --
WAIST_STATIONS = [
    # tag, x, sign of the edge (±Z), strap edge at that x (measured)
    ('a', -0.240, 1.0, 0.0339),
    ('b', -0.100, -1.0, -0.0537),
    ('c', 0.040, 1.0, 0.0338),
    ('d', 0.180, -1.0, -0.0499),
]


def build_waist(cid):
    spec = SPEC_BY_ID[cid]
    P = f'{cid}__'
    removed, absent = L.drop_nodes(cid, spec['hide_nodes'])
    tw, tt, tl, thoff = t30()

    # rigid spine on the strap's outer face: the strap is flat (y 0.0030..0.0080)
    # from x -0.49 to +0.32; the free end curls up past x 0.40, so the spine stops
    # at 0.317. Width 74 = common overlap of the tapering strap (-0.044..+0.032).
    spine_x0, spine_x1 = -0.487, 0.317
    L.cube(f'{P}hard_spine', ((spine_x0 + spine_x1) * 0.5, 0.0098, -0.0060),
           (spine_x1 - spine_x0, 0.0040, 0.0740), 'cfrp', r=0.0008)
    for i, zz in enumerate([-0.034, -0.020, -0.006, 0.008, 0.022, 0.031]):
        L.cube(f'{P}hard_spine_rib_{i}', ((spine_x0 + spine_x1) * 0.5, 0.0128, zz),
               (spine_x1 - spine_x0 - 0.020, 0.0030, 0.0032), 'cfrp', r=0.0006)

    demo_hole, demo_frame = None, None
    for tag, xx, sgn, edge in WAIST_STATIONS:
        u = vec((0, 0, sgn))
        w = vec((1, 0, 0))
        p = vec((0, 1, 0))
        # plate on the strap's outer face, 30 mm inboard of the edge, 13 mm past it
        z0, z1 = edge - sgn * 0.030, edge + sgn * 0.013
        plate = L.cube(f'{P}bracket_tmp_{tag}', (xx, 0.0095, (z0 + z1) * 0.5),
                       (0.040, 0.0030, abs(z1 - z0)), 'hardsteel', r=0.0008)
        # lip wrapping the strap edge, pressed onto the pad under the strap
        lip = L.cube(f'{P}lip_tmp_{tag}',
                     (xx, 0.0043, edge + sgn * 0.0020),
                     (0.040, 0.0075, 0.0040), 'hardsteel', r=0.0006)
        L.join([plate.name, lip.name], f'{P}hard_bracket_{tag}')
        base = vec((xx, 0.014, sgn * (0.064 - thoff)))
        hole = L.add_tongue(cid, tag, base, u, w, p, tw, tt, tl, thoff,
                            bush_node=False, pin_names=(f'{tag}1', f'{tag}2'))
        if demo_hole is None:
            demo_hole, demo_frame = hole, (u, w, p)
        for k, dx in (('1', 0.013), ('2', -0.013)):
            L.bolt(f'{P}hard_screw_{tag}{k}',
                   (xx + dx, 0.0110, edge - sgn * 0.018), (0, -1, 0),
                   shank=0.0110)
    names = [o.name for o in bpy.context.scene.objects if o.type == 'MESH'
             and o.name.startswith(f'{cid}__hard_')]
    L.to_blender_space(names)
    built = ['hard_spine'] + [f'hard_spine_rib_{i}' for i in range(6)]
    for tag in ('a', 'b', 'c', 'd'):
        built += [f'hard_bracket_{tag}', f'hard_tongue_{tag}',
                  f'hard_antirot_pin_{tag}1', f'hard_antirot_pin_{tag}2',
                  f'hard_screw_{tag}1', f'hard_screw_{tag}2']
    return {
        'removed': removed, 'absent': absent, 'built': built,
        'hole': demo_hole, 'frame': demo_frame,
        'deviations': [
            'спинка 804×74×4 вместо 980×96: ремень плоский только до x≈0,32 — дальше '
            'хвост загибается вверх (y 0,0080 → 0,0395 при x 0,50); по ширине ремень '
            'сужается от 87 до 76 мм (замер кромок по x), взято общее перекрытие',
            'кронштейн = плита 40×3 на внешней стороне ремня + отбортовка 4 мм через '
            'кромку на подкладку + 2×M5 сквозь ремень; спека «2×M5 в закладные + '
            '2×M4 в спинку» — закладных в ремне нет, M4 заменены вторым M5',
            'языки T-30 на кромках ±Z (сборка V, палец вертикально) вместо колец на +Y: '
            'отверстия точно в position_m ±0,064, нос 0,079 вместо tip_m 0,082',
            'кромка ремня несимметрична (+0,0339 на a/c, -0,0537/-0,0499 на b/d), '
            'поэтому у a/c кронштейн выносит язык на 11 мм за кромку, у b/d пятка '
            'языка лежит над ремнём — это заложено в геометрию каждого узла',
        ],
        'views': {
            '3q': ((0.85, -1.25, 1.05), None, 1.20),
            'front': ((0.10, -0.45, 0.89), None, 0.42, (0.040, 0.008, 0.0)),
            'side': ((1.00, -0.06, 0.18), None, 0.30, (0.040, 0.008, 0.0)),
            'closeup': ((0.80, -0.60, 0.45), 0.200),
        },
    }


# -------------------------------------------------------------- suspension --
def build_suspension(cid):
    spec = SPEC_BY_ID[cid]
    P = f'{cid}__'
    removed, absent = L.drop_nodes(cid, spec['hide_nodes'])
    center = (0.0, 0.035)
    half_w = 0.0250

    # CFRP half shell on the lower 180 deg. Spec radius 0.0284..0.0324 sits inside
    # the lining (0.0294..0.0331); the band's outer surface is r = 0.0350.
    L.arc_shell(f'{P}hard_shell', center, 0.0348, 0.0392, 104.0, 284.0,
                -half_w, half_w, 'cfrp')
    for tag, zs in (('a', 1.0), ('b', -1.0)):
        L.arc_shell(f'{P}hard_shell_rib_{tag}', center, 0.0388, 0.0418, 108.0, 280.0,
                    zs * 0.0175, zs * 0.0145, 'cfrp')

    # saddle in the strap fold (fold: x ±0.0068, y 0.0735..0.0803, z ±0.0109)
    top = L.cube(f'{P}top_tmp', (0.0, 0.0834, 0.0), (0.034, 0.0062, 0.034),
                 'hardsteel', r=0.0009)
    legs = []
    for tag, zs in (('a', 1.0), ('b', -1.0)):
        legs.append(L.cube(f'{P}leg_tmp_{tag}', (0.0, 0.07475, zs * 0.0140),
                           (0.034, 0.0105, 0.0060), 'hardsteel', r=0.0008))
    L.join([top.name] + [o.name for o in legs], f'{P}hard_shackle')
    # thimble inside the strap fold
    L.tube(f'{P}hard_thimble', (0.0, 0.0769, -0.0100), (0, 0, 1), 0.0062, 0.0040,
           0.0200, 'bronze')
    # tongue T-30 stub: root at the fold's top face, hole at spec 0.088, tip 0.102
    tw, tt, tl, thoff = t30()
    base = vec((0.0, 0.0803, 0.0))
    hole = L.add_tongue(cid, '', base, (0, 1, 0), (0, 0, 1), (1, 0, 0),
                        tw, 0.006, 0.0227, 0.0077)
    # 2 x M6 through the fold + both legs (spec: 2 x M8)
    for tag, xx in (('a', 0.0036), ('b', -0.0036)):
        L.bolt(f'{P}m6_tmp_{tag}', (xx, 0.0762, 0.0215), (0, 0, -1), d=0.006,
               head_d=0.0100, head_h=0.0030, shank=0.0430, nut=0.0050,
               role='hardsteel')
    L.join([f'{P}m6_tmp_a', f'{P}m6_tmp_b'], f'{P}hard_shackle_bolt_a')
    # 2 x M5 through the saddle plate into the band (spec: 2 x M5)
    for tag, xx in (('a', 0.0100), ('b', -0.0100)):
        L.bolt(f'{P}m5_tmp_{tag}', (xx, 0.0865, 0.0), (0, -1, 0), d=0.005,
               head_d=0.0092, head_h=0.0028, shank=0.0170, role='hardsteel')
    L.join([f'{P}m5_tmp_a', f'{P}m5_tmp_b'], f'{P}hard_shackle_bolt_b')
    names = [o.name for o in bpy.context.scene.objects if o.type == 'MESH'
             and o.name.startswith(f'{cid}__hard_')]
    L.to_blender_space(names)
    return {
        'removed': removed, 'absent': absent,
        'hole': hole, 'frame': (Vector((0, 1, 0)), Vector((0, 0, 1)), Vector((1, 0, 0))),
        'built': ['hard_shell', 'hard_shell_rib_a', 'hard_shell_rib_b', 'hard_shackle',
                  'hard_shackle_bolt_a', 'hard_shackle_bolt_b', 'hard_tongue',
                  'hard_tongue_bush', 'hard_antirot_pin_a',
                  'hard_antirot_pin_b', 'hard_thimble'],
        'deviations': [
            'радиус оболочки 0,0348…0,0392 вместо 0,0284…0,0324: r_in из спеки лежит '
            'внутри подкладки (lining 0,0294…0,0331) и ремня (0,0332…0,0350)',
            'оболочка 180° по дуге 104…284 (низ/бока): окно сверху оставлено под стропу, '
            'пряжку (0°) и регулятор (adjust_slider 10…20°)',
            'скоба-седло 34×6,2×34 с двумя щеками 6 мм вместо «40 × 24 × 12»: щеки '
            'ложатся на боковые кольцевые поверхности ремня и подкладки (седло в петле '
            'стропы, как прежнее кольцо), по X уменьшено до габарита 0,10',
            '2×M8 заменены на 2×M6 вдоль Z: отверстие Ø8 не проходит в стропу '
            '(петля 13,6 × 6,8 мм), M6 встают в 1-мм перемычку',
            'язык 22,7 мм (T-30 укорочен) вместо 34: отверстие по спеке на 7,7 мм выше '
            'стропы, паспортный T-30 заставил бы язык пройти сквозь стропу',
            'добавлена втулка-тимбл Ø12,4/Ø8 × 20 бронза внутри петли стропы',
        ],
        'views': {
            '3q': ((1.10, -1.35, 1.10), None),
            'front': ((1.00, -0.05, 0.30), None),
            'side': ((0.06, -1.00, 0.24), None),
            'closeup': ((0.72, -0.70, 0.50), 0.165),
        },
    }


BUILDERS = {
    'restraint_ankle_cuff': build_ankle,
    'restraint_thigh_clamp': build_thigh,
    'restraint_waist_belt': build_waist,
    'restraint_suspension_cuff': build_suspension,
}


# ------------------------------------------------------------ demo receiver --
def demo_receiver(cid, hole, u, w, p, gap=0.0032, cheek_t=0.0078):
    """CJ-LATCH-30 receiver drawn for the close-up only (never exported).

    гнездо-вилка в разрезе: одна щека (дальняя), задняя стенка, палец Ø12,
    собачка Ø6 и рычаг 50 мм с красной накладкой. Ближняя щека не строится,
    иначе вилка закрывает язык и на демо-кадре не видно ни отверстия, ни пальца.
    """
    hole, u, w, p = vec(hole), vec(u).normalized(), vec(w).normalized(), vec(p).normalized()
    T = 'latch'
    mouth = hole - u * 0.006
    base = mouth + u * 0.017                      # centre of the 34 mm cheek
    off = gap + cheek_t * 0.5
    L.framed_bar(f'{T}_cheek', base - p * off, u, w, -p, (0.034, 0.046, cheek_t),
                 'hardsteel', r=0.0008)
    L.framed_bar(f'{T}_back', hole + u * 0.030 + p * off, u, w, -p,
                 (0.008, 0.046, 2 * off), 'hardsteel', r=0.0006)
    L.cyl(f'{T}_pin', hole - p * (off + cheek_t + 0.002), hole + p * 0.012,
          0.0060, 'hardsteel', verts=26)
    L.cyl(f'{T}_pin_head', hole - p * (off + cheek_t + 0.002),
          hole - p * (off + cheek_t + 0.008), 0.0080, 'hardsteel', verts=22)
    pivot = hole + u * 0.0130 + p * off
    L.cyl(f'{T}_pawl_pivot', pivot - w * 0.008, pivot + w * 0.008, 0.0030,
          'hardsteel', verts=16)
    L.framed_bar(f'{T}_pawl', pivot - w * 0.005 - u * 0.004, u, w, -p,
                 (0.022, 0.010, 0.0070), 'hardsteel', r=0.0006)
    lever_dir = (u * 0.55 - p * 0.85).normalized()
    L.framed_bar(f'{T}_lever', pivot, lever_dir, w, -p, (0.050, 0.015, 0.0050),
                 'hardsteel', r=0.0008)
    L.framed_bar(f'{T}_lever_pad', pivot + lever_dir * 0.036, lever_dir, w, -p,
                 (0.018, 0.015, 0.0062), 'red', r=0.0008)
    L.cyl(f'{T}_spring', pivot + u * 0.004 - w * 0.006 - p * 0.004,
          pivot + u * 0.004 + w * 0.006 - p * 0.004, 0.0022, 'black', verts=12)


# ------------------------------------------------------------------- render --
def render_component(cid, glb, views, out_dir, hole_gl=None):
    L.scene_setup(floor_z=-0.0018)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()
    mn, mx = L.bbox_blender()
    center = (mn + mx) * 0.5
    size = mx - mn
    diag = max(size.x, size.y, size.z)
    shots = []
    for name, view in views.items():
        direction, closeup_width = view[0], view[1]
        ortho = view[2] if len(view) > 2 else diag * 1.55
        if name == 'closeup':
            target = center
            if hole_gl is not None:
                hb = L.GL_TO_BL @ vec(hole_gl)
                target = hb + Vector((0.0, 0.0, 0.004))
            path = out_dir / f'{cid}_hard_closeup.png'
            L.shot(name, path, direction, target, width=closeup_width, lens=60,
                   res=(1100, 900))
        else:
            key = '3q' if name in ('3q', 'q3') else name
            path = out_dir / f'{cid}_hard_{key}.png'
            aim = L.GL_TO_BL @ vec(view[3]) if len(view) > 3 else center
            L.shot(name, path, direction, aim, ortho_scale=ortho,
                   res=(1100, 900))
        shots.append(path.name)
    return shots, (mn, mx)


def render_latch_demo(cid, glb, hole_gl, u, w, p, out_dir):
    L.scene_setup(floor_z=-0.0018)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    demo_receiver(cid, hole_gl, u, w, p)
    L.to_blender_space([o.name for o in bpy.context.scene.objects
                        if o.type == 'MESH' and o.name.startswith('latch')])
    bpy.context.view_layer.update()
    hb = L.GL_TO_BL @ vec(hole_gl)
    mn, mx = L.bbox_blender()
    # aim at the pair itself: the bore is the point of interest, the fixture
    # body is kept in frame only as context (a plain centre average pulls the
    # camera onto the middle of a 1 m belt and cuts the receiver off).
    target = hb + ((mn + mx) * 0.5 - hb) * 0.22
    path = out_dir / f'{cid}_hard_latch_demo.png'
    L.shot('latch_demo', path, (0.75, -0.75, 0.45), target, width=0.19, lens=60,
           res=(1100, 900))
    return path.name


# --------------------------------------------------------------------- main --
def run(cid):
    spec = SPEC_BY_ID[cid]
    L.scene_setup(with_floor=False)
    src = L.import_soft(cid)
    body = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    meta = BUILDERS[cid](cid)
    hard = [o for o in bpy.context.scene.objects if o.type == 'MESH'
            and o.name.startswith(f'{cid}__hard_')]
    body = [o for o in bpy.context.scene.objects if o.type == 'MESH'
            and not o.name.startswith(f'{cid}__hard_')]
    mn_b, mx_b = L.bbox_blender(body)
    contact = L.contact_map(hard, body)
    out_dir = L.LIB / f'{cid}_hard'
    out_dir.mkdir(parents=True, exist_ok=True)
    glb = L.COMP / f'{cid}_hard.glb'
    L.export_glb(glb)

    nodes = L.glb_nodes(glb)
    mn, mx = L.glb_bbox(glb)
    mn_s, mx_s = L.glb_bbox(src)
    env = spec['envelope_new']
    env_old = spec['envelope_old']
    size = [mx[i] - mn[i] for i in range(3)]
    size_src = [mx_s[i] - mn_s[i] for i in range(3)]
    views_shots, _ = render_component(cid, glb, meta['views'], out_dir,
                                      hole_gl=meta.get('hole'))
    extra_shot = []
    if meta.get('hole') is not None and meta.get('frame') is not None:
        u, w, p = meta['frame']
        extra_shot.append(render_latch_demo(cid, glb, meta['hole'], u, w, p, out_dir))

    built = [f'{cid}__{n}' for n in meta['built']]
    missing = [n for n in built if n not in nodes]
    extras = [n for n in nodes if n.split('__')[-1].startswith('hard_')
              and n not in built]
    residual = [n for n in nodes if 'dring' in n.lower()
                or n.split('__')[-1] in ('dring', 'suspension_ring')]
    # кольцевые узлы, оставленные осознанно (вторичный анкер) — должны быть
    # в keep_key спеки, иначе это непогашенный остаток мягкого варианта
    ring_like = sorted({n.split('__')[-1] for n in nodes
                        if 'dring' in n.lower()
                        or n.split('__')[-1].endswith('_ring')})
    kept_rings = [n for n in ring_like if n in spec.get('keep_key', [])]
    unjustified = [n for n in ring_like if n not in kept_rings]
    d_env = sorted(round((g - e) * 1000.0, 2) for g, e in
                   zip(sorted(size), sorted(env)))
    d_old = sorted(round((g - e) * 1000.0, 2) for g, e in
                   zip(sorted(size), sorted(env_old)))
    growth = sorted(round((g - o) * 1000.0, 2) for g, o in
                    zip(sorted(size), sorted(size_src)))
    env_order = [round((size[i] - env[i]) * 1000.0, 2) for i in range(3)]
    report = {
        'component': cid,
        'code': spec['code'],
        'name': spec['name'],
        'variant': 'hard',
        'standard': 'CJ-LATCH-30',
        'source_glb': str(src.relative_to(PROJECT)),
        'glb': str(glb.relative_to(PROJECT)),
        'format': 'cj-restraint-hard/1',
        'spec': 'docs/plans/checks/restraint-hard-mount-spec.json',
        'load_n': spec['load_n'],
        'priority': spec['priority'],
        'nodes': len(nodes),
        'nodes_source': spec['glb_nodes'],
        'node_names': nodes,
        'added_nodes': meta['built'],
        'added_nodes_missing_vs_spec': sorted(set(spec['add_nodes']) - set(meta['built'])),
        'added_nodes_extra_vs_spec': sorted(set(meta['built']) - set(spec['add_nodes'])),
        'removed_nodes': meta['removed'],
        'hide_nodes_absent_in_source': meta['absent'],
        'missing_add_nodes': [m.split('__')[-1] for m in missing],
        'extra_hard_nodes': [e.split('__')[-1] for e in extras],
        'glb_hidden_present': sorted(set(meta['removed'])
                                     & {n.split('__')[-1] for n in nodes}),
        'residual_ring_nodes': residual,
        'ring_nodes_in_export': ring_like,
        'ring_nodes_kept': [{'node': n,
                             'reason': spec.get('residual_rings', {}).get('kept_why', '')}
                            for n in kept_rings],
        'ring_nodes_unjustified': unjustified,
        'bbox_min_gltf': [round(v, 5) for v in mn],
        'bbox_max_gltf': [round(v, 5) for v in mx],
        'bbox_size_gltf': [round(v, 5) for v in size],
        'bbox_size_source_gltf': [round(v, 5) for v in size_src],
        'envelope_new': env,
        'envelope_old': env_old,
        'envelope_delta_mm_sorted': d_env,
        'envelope_delta_mm_axes': env_order,
        'envelope_delta_max_mm': max(abs(v) for v in d_env),
        'envelope_delta_old_mm_sorted': d_old,
        'envelope_fits': all(size[i] <= env[i] + 1e-4 for i in range(3)),
        'growth_vs_source_mm_sorted': growth,
        'floor_ok': abs(mn[1]) <= 0.0008,
        'contact': contact,
        'contact_ok': bool(all(v['attached'] for v in contact.values())),
        'renders': views_shots + extra_shot,
        'checks': {
            'dring_nodes_removed': len(residual) == 0,
            'no_ring_node_in_export': len(residual) == 0,
            'all_add_nodes_present': len(missing) == 0,
            'hidden_dring_not_visible': len(residual) == 0,
            'all_hard_parts_attached': bool(all(v['attached']
                                                for v in contact.values())),
            'residual_rings_justified': not unjustified,
        },
        'deviations': meta['deviations'],
        'latch_demo': {
            'exported': False,
            'hole_gltf': [round(v, 5) for v in meta['hole']] if meta.get('hole') else None,
            'note': 'гнездо CJ-LATCH-30 принадлежит каретке/кронштейну матрицы '
                    '(спека: «приём — гнездо на каретке»), в GLB фиксатора не входит; '
                    'собрано отдельной демо-сценой для проверки читаемости пары',
        },
    }
    (out_dir / 'report.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2))
    print('REPORT', out_dir / 'report.json', flush=True)
    print('CHECK ' + json.dumps({
        'component': cid, 'nodes': len(nodes),
        'bbox': [round(v, 4) for v in size], 'env': env,
        'env_delta_mm': d_env, 'growth_mm': growth,
        'contact_ok': report['contact_ok'],
        'missing': report['missing_add_nodes'],
        'residual_ring': residual,
        'unattached': [k for k, v in contact.items() if not v['attached']],
    }, ensure_ascii=False), flush=True)
    return report


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    todo = argv or BATCH
    for cid in todo:
        print('=' * 30, cid, flush=True)
        run(cid)
