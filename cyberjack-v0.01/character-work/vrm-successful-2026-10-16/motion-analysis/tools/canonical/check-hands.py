# Проверка кистей: направление и плоскость ладони против источника.
#   blender -b posed.blend --python check-hands.py -- frame.json
import bpy, sys, json, math
from mathutils import Vector, Quaternion

frame_path = sys.argv[sys.argv.index('--') + 1]
d = json.load(open(frame_path))
names = d['names']
src = {n: Vector(v) for n, v in zip(names, d['frame'])}
extra = {n: Vector(v) for n, v in (d.get('extraPos') or {}).items()}
WQ = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (d.get('worldQ') or {}).items()}

arm = bpy.data.objects['rig_H']
P = arm.pose.bones
B = arm.data.bones
flip = (src['cf_j_foot_L'].x < src['cf_j_foot_R'].x) != (B['leftFoot'].head_local.x < B['rightFoot'].head_local.x)
conv = (lambda p: Vector((-p.x, -p.z, p.y))) if flip else (lambda p: Vector((p.x, -p.z, p.y)))
S = {n: conv(p) for n, p in src.items()}
S.update({n: conv(p) for n, p in extra.items()})

for side, cap in (('left', 'L'), ('right', 'R')):
    hb = P[f'{side}Hand']
    hand_dir = (hb.tail - hb.head).normalized()
    src_dir = (S[f'cf_j_index01_{cap}'] - S[f'cf_j_hand_{cap}']).normalized()
    dir_err = math.degrees(hand_dir.angle(src_dir))
    # плоскость ладони: большой палец x средний (в источнике) и по локальной рамке кисти (у нас)
    out = {}
    if f'cf_j_thumb01_{cap}' in S and f'cf_j_middle01_{cap}' in S:
        w = S[f'cf_j_hand_{cap}']
        n_src = (S[f'cf_j_thumb01_{cap}'] - w).cross(S[f'cf_j_middle01_{cap}'] - w)
        if n_src.length > 1e-9:
            n_src.normalize()
            # нормаль ладони цели — по её же пальцам, но в её текущей позе это вырождено,
            # поэтому сравниваем только направление кисти и нормаль источника
            out['src_normal'] = [round(c, 2) for c in n_src]
    print('HANDCHK', side,
          'dir_err', round(dir_err, 1),
          'hand_dir', [round(c, 2) for c in hand_dir],
          'src_dir', [round(c, 2) for c in src_dir],
          out.get('src_normal'))
