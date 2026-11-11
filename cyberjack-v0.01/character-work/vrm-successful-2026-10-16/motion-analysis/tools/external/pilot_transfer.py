#!/usr/bin/env python3
"""Пилот переноса BVH → наш риг. Проверка числом.

Формула (проверена): мировые повороты костей источника переносятся на наш скелет
сверху вниз; локальный поворот нашей кости = rest_local · (rest_local⁻¹ · parent_world⁻¹ · src_world),
что эквивалентно «world_target = world_source». Позиции берутся из нашего rest-скелета,
поэтому перенос translation корня нужен отдельно — иначе стопа висит в воздухе.

Запуск:
  python3 pilot_transfer.py --rig ../../../animations/source_rigs.json \
      --file <bvh> --source 100style|cmu [--frame 0.5]
"""
import argparse, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh_metrics as B
import quat_koik as K

IDENT = (0.0, 0.0, 0.0, 1.0)

MAPS = {
    '100style': {'hips': ['Hips'], 'neck': ['Neck'], 'head': ['Head'],
                 'shoulder_L': ['LeftCollar'], 'arm_L': ['LeftShoulder'], 'fore_L': ['LeftElbow'], 'hand_L': ['LeftWrist'],
                 'shoulder_R': ['RightCollar'], 'arm_R': ['RightShoulder'], 'fore_R': ['RightElbow'], 'hand_R': ['RightWrist'],
                 'thigh_L': ['LeftHip'], 'knee_L': ['LeftKnee'], 'ankle_L': ['LeftAnkle'], 'toe_L': ['LeftToe'],
                 'thigh_R': ['RightHip'], 'knee_R': ['RightKnee'], 'ankle_R': ['RightAnkle'], 'toe_R': ['RightToe'],
                 'spine': ['Chest', 'Chest2', 'Chest3', 'Chest4']},
    'cmu': {'hips': ['hip'], 'neck': ['neck'], 'head': ['head'],
            'shoulder_L': ['lcollar'], 'arm_L': ['lshoulder'], 'fore_L': ['lelbow'], 'hand_L': ['lhand'],
            'shoulder_R': ['rcollar'], 'arm_R': ['rshoulder'], 'fore_R': ['relbow'], 'hand_R': ['rhand'],
            'thigh_L': ['lhip'], 'knee_L': ['lknee'], 'ankle_L': ['lfoot'], 'toe_L': ['lfoot'],
            'thigh_R': ['rhip'], 'knee_R': ['rknee'], 'ankle_R': ['rfoot'], 'toe_R': ['lfoot'],
            'spine': ['abdomen', 'chest']},
}

TARGET = {'hips': 'cf_j_hips', 'neck': 'cf_j_neck', 'head': 'cf_j_head',
          'shoulder_L': 'cf_j_shoulder_L', 'arm_L': 'cf_j_arm00_L', 'fore_L': 'cf_j_forearm01_L', 'hand_L': 'cf_j_hand_L',
          'shoulder_R': 'cf_j_shoulder_R', 'arm_R': 'cf_j_arm00_R', 'fore_R': 'cf_j_forearm01_R', 'hand_R': 'cf_j_hand_R',
          'thigh_L': 'cf_j_thigh00_L', 'knee_L': 'cf_j_leg01_L', 'ankle_L': 'cf_j_leg03_L', 'toe_L': 'cf_j_foot_L',
          'thigh_R': 'cf_j_thigh00_R', 'knee_R': 'cf_j_leg01_R', 'ankle_R': 'cf_j_leg03_R', 'toe_R': 'cf_j_foot_R'}


def qinv(q): return (-q[0], -q[1], -q[2], q[3])


def mirror(q, mode):
    """Та же поправка, что во вьювере: KKBP/PMX цель разворачивает X."""
    if mode == 'x': return (q[0], -q[1], -q[2], q[3])
    if mode == 'z': return (-q[0], -q[1], q[2], q[3])
    return q


def angles_from_positions(g):
    """g(name) → мировая позиция; возвращает сгибы и высоты (в единицах рига)."""
    knee = B.vang(B.vsub(g('cf_j_leg01_L'), g('cf_j_thigh00_L')), B.vsub(g('cf_j_leg03_L'), g('cf_j_leg01_L')))
    elbow = B.vang(B.vsub(g('cf_j_forearm01_L'), g('cf_j_arm00_L')), B.vsub(g('cf_j_hand_L'), g('cf_j_forearm01_L')))
    up = B.vsub(g('cf_j_neck'), g('cf_j_thigh00_L'))
    lean = math.degrees(math.atan2(math.hypot(up[0], up[2]), up[1]))
    return {'knee_deg': round(knee, 1), 'elbow_deg': round(elbow, 1), 'lean_deg': round(lean, 1),
            'ankle_y': round(g('cf_j_leg03_L')[1], 3), 'hips_y': round(g('cf_j_hips')[1], 3)}


def transfer(rig_path, joints, frame, names_map, mirror_mode='none'):
    bones, _ = K.world(rig_path)
    children = {}
    for b in bones.values():
        children.setdefault(b.get('parent'), []).append(b)
    W = B.fk(joints, frame)
    idx = {k: B.find(joints, v) for k, v in names_map.items()}
    src = {TARGET[k]: mirror(W[i][1], mirror_mode) for k, i in idx.items() if i is not None and k in TARGET}
    spine_idx = [B.find(joints, [n]) for n in names_map.get('spine', [])]
    spine_idx = [i for i in spine_idx if i is not None]
    spine_top = mirror(W[spine_idx[-1]][1], mirror_mode) if spine_idx else None
    spine_mid = mirror(W[spine_idx[len(spine_idx)//2]][1], mirror_mode) if spine_idx else None
    world = {}

    def walk(name, parent_world):
        b = bones[name]
        rest = tuple(b['rotation'])
        local = rest
        if name in src:
            local = B.qmul(rest, B.qmul(B.qmul(qinv(rest), qinv(parent_world)), src[name]))
        if name == 'cf_j_spine03' and spine_top is not None:
            wq = spine_top
        elif name == 'cf_j_spine02' and spine_mid is not None:
            wq = spine_mid
        else:
            wq = B.qmul(parent_world, local)
        wpos = None
        world[name] = [wq, wpos]
        for c in children.get(name, []):
            walk(c['name'], wq)

    root = [b for b in bones.values() if b.get('parent') is None][0]['name']
    walk(root, IDENT)

    def place(name, parent_pos, parent_q):
        b = bones[name]
        pos = B.vadd(parent_pos, B.qrot(parent_q, tuple(b['position'])))
        world[name][1] = pos
        for c in children.get(name, []):
            place(c['name'], pos, world[name][0])

    place(root, (0, 0, 0), IDENT)
    return {n: tuple(v[1]) for n, v in world.items()}, {n: tuple(v[0]) for n, v in world.items()}, bones


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rig', required=True)
    ap.add_argument('--file', required=True)
    ap.add_argument('--source', choices=['100style', 'cmu'], required=True)
    ap.add_argument('--frame', type=float, default=0.5)
    ap.add_argument('--mirror', choices=['none', 'x', 'z'], default='none',
                    help='x — как во вьювере для KKBP/PMX (Rin); z — generic glTF')
    a = ap.parse_args()

    joints, frames, ft = B.parse(a.file)
    fi = max(0, min(len(frames) - 1, int(len(frames) * a.frame)))
    nm = MAPS[a.source]
    W = B.fk(joints, frames[fi])
    idx = {k: B.find(joints, v) for k, v in nm.items()}
    src_pos = lambda n: W[idx[[k for k, v in TARGET.items() if v == n][0]]][0]
    src = angles_from_positions(src_pos)

    pos, _, bones = transfer(a.rig, joints, frames[fi], nm, a.mirror)
    ours = angles_from_positions(lambda n: pos[n])

    # контакт: переводим позу в масштаб нашей ноги и сажаем низшую стопу на пол
    src_leg = B.vlen(B.vsub(W[idx['ankle_L']][0], W[idx['thigh_L']][0]))
    _, rest_world = K.world(a.rig)
    our_leg = B.vlen(B.vsub(rest_world['cf_j_leg03_L'][0], rest_world['cf_j_thigh00_L'][0]))
    scale = our_leg / src_leg
    src_feet = (W[idx['ankle_L']][0][1], W[idx['ankle_R']][0][1])
    our_feet = (pos['cf_j_leg03_L'][1], pos['cf_j_leg03_R'][1])
    rest_ankle = rest_world['cf_j_leg03_L'][0][1]
    contact = {'scale_our_leg_over_src': round(scale, 5),
               'ankle_height_src_scaled': [round((x - min(src_feet)) * scale, 3) for x in src_feet],
               'ankle_height_ours': [round(x - min(our_feet), 3) for x in our_feet],
               'rest_ankle_y': round(rest_ankle, 3)}
    print(json.dumps({'file': os.path.basename(a.file), 'frame': fi, 'of': len(frames),
                      'source': src, 'transferred': ours,
                      'delta_deg': {'knee': round(ours['knee_deg'] - src['knee_deg'], 1),
                                    'elbow': round(ours['elbow_deg'] - src['elbow_deg'], 1),
                                    'lean': round(ours['lean_deg'] - src['lean_deg'], 1)},
                      'mirror': a.mirror, 'contact': contact},
                     ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
