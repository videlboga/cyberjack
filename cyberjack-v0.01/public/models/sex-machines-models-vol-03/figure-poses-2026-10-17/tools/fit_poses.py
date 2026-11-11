# Fit pose specs to anatomical segment directions (voxel anatomy), then write final pose-*.json.
# Targets in machine frame (metres, Y-up). init spec from build_poses.SPECS; result written per machine.
import sys, os, json, math, pickle
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fit_pose import fit, fk_positions, SEG_DEF
from build_poses import build_base, read_fig_bbox, read_anchor, BASE, OUT, SPECS
from pose_solve import PARENT_OF, fk_chain_rotations, quat_mul, quat_normalize

RIN_BONES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'rin_bones.pkl')
if not os.path.exists(RIN_BONES):
    RIN_BONES = '/tmp/rin_bones.pkl'


def norm(v):
    v = np.asarray(v, dtype=np.float64)
    return (v / np.linalg.norm(v)).tolist()


TARGETS = {
    # 065: lying on back inside the capsule; head to -X; belly +Y; frog legs; arms raised sideways.
    '065': {
        'spine': norm([-0.67, 0.74, 0]), 'head': norm([-0.25, 0.97, 0]),
        'thighL': norm([0.39, 0.91, 0.19]), 'shinL': norm([-0.61, -0.77, 0.13]),
        'thighR': norm([0.39, 0.91, -0.19]), 'shinR': norm([-0.61, -0.77, -0.13]),
        'upperArmL': norm([0.05, 0.30, 0.95]), 'lowerArmL': norm([0.1, 0.4, 0.9]),
        'upperArmR': norm([0.05, 0.30, -0.95]), 'lowerArmR': norm([0.1, 0.4, -0.9]),
        '_w': {'spine': 2.0, 'head': 1.2, 'thighL': 1.5, 'shinL': 1.5, 'thighR': 1.5, 'shinR': 1.5,
               'upperArmL': 0.5, 'lowerArmL': 0.4, 'upperArmR': 0.5, 'lowerArmR': 0.4},
    },
    # 078: all fours on the platform; head +Z; belly -Y (face down-ish); hips above knees.
    '078': {
        'spine': norm([0.1, 0.98, 0.15]), 'head': norm([0.5, 0.85, 0.1]),
        'thighL': norm([0.1, -0.99, 0.08]), 'shinL': norm([0.85, -0.5, 0.15]),
        'thighR': norm([0.1, -0.99, -0.08]), 'shinR': norm([0.85, -0.5, -0.15]),
        'upperArmL': norm([0.1, -0.97, 0.2]), 'lowerArmL': norm([0.1, -0.97, 0.15]),
        'upperArmR': norm([0.1, -0.97, -0.2]), 'lowerArmR': norm([0.1, -0.97, -0.15]),
        '_w': {'spine': 2.0, 'head': 1.0, 'thighL': 1.4, 'shinL': 1.2, 'thighR': 1.4, 'shinR': 1.2,
               'upperArmL': 1.0, 'lowerArmL': 0.8, 'upperArmR': 1.0, 'lowerArmR': 0.8},
    },
    # 070: reclined against console; body tilted back, legs bent up; arms forward.
    '070': {
        'spine': norm([-0.35, 0.94, 0]), 'head': norm([-0.2, 0.98, 0]),
        'thighL': norm([0.7, -0.2, 0.35]), 'shinL': norm([0.4, -0.9, 0.1]),
        'thighR': norm([0.7, -0.2, -0.35]), 'shinR': norm([0.4, -0.9, -0.1]),
        'upperArmL': norm([0.55, -0.5, 0.6]), 'lowerArmL': norm([0.4, -0.6, 0.5]),
        'upperArmR': norm([0.55, -0.5, -0.6]), 'lowerArmR': norm([0.4, -0.6, -0.5]),
        '_w': {'spine': 2.0, 'head': 1.0, 'thighL': 1.3, 'shinL': 1.2, 'thighR': 1.3, 'shinR': 1.2,
               'upperArmL': 0.8, 'lowerArmL': 0.6, 'upperArmR': 0.8, 'lowerArmR': 0.6},
    },
    # 087: riding straddle; lean forward; arms down-forward; legs bent out/down.
    '087': {
        'spine': norm([0.55, 0.83, 0]), 'head': norm([0.75, 0.65, 0]),
        'thighL': norm([0.35, -0.85, 0.4]), 'shinL': norm([0.55, -0.75, 0.35]),
        'thighR': norm([0.35, -0.85, -0.4]), 'shinR': norm([0.55, -0.75, -0.35]),
        'upperArmL': norm([0.75, -0.5, 0.4]), 'lowerArmL': norm([0.8, -0.45, 0.35]),
        'upperArmR': norm([0.75, -0.5, -0.4]), 'lowerArmR': norm([0.8, -0.45, -0.35]),
        '_w': {'spine': 2.2, 'head': 1.2, 'thighL': 1.4, 'shinL': 1.1, 'thighR': 1.4, 'shinR': 1.1,
               'upperArmL': 1.1, 'lowerArmL': 0.8, 'upperArmR': 1.1, 'lowerArmR': 0.8},
    },
    # 080: sits on the small ledge (seat plate Y=1.53, X 2.12..2.26) with her BACK to the machine body
    # (backrest wall at X~2.28, higher panel X~2.40) -> faces -X. Thighs hang forward-down over the
    # ledge edge, shins drawn inward to the feet on the base plate, arms go BACK and down behind the
    # body (hands together behind the lower back, machine X~2.40). Landmarks: reports/anatomy-080.txt.
    '080': {
        'spine': norm([0.19, 0.98, 0]), 'head': norm([-0.20, 0.98, 0]),
        'thighL': norm([-0.39, -0.34, 0.83]), 'shinL': norm([0.0, -0.74, -0.67]),
        'thighR': norm([-0.39, -0.34, -0.83]), 'shinR': norm([0.0, -0.74, 0.67]),
        'upperArmL': norm([0.75, -0.60, -0.25]), 'lowerArmL': norm([0.12, -0.97, -0.24]),
        'upperArmR': norm([0.75, -0.60, 0.25]), 'lowerArmR': norm([0.12, -0.97, 0.24]),
        '_w': {'spine': 2.4, 'head': 1.0, 'thighL': 1.6, 'shinL': 1.2, 'thighR': 1.6, 'shinR': 1.2,
               'upperArmL': 1.2, 'lowerArmL': 1.0, 'upperArmR': 1.2, 'lowerArmR': 1.0},
    },
}

BASE_TURNS = {
    '065': [['X', 90], ['Y', -90]],
    '070': [['X', 55], ['Y', -90]],
    '078': [['X', 90], ['Y', 0]],
    '087': [['X', -40], ['Y', -90]],
    '080': [['Y', 90]],   # upright, back to the machine body -> faces -X
}


def main():
    bones = pickle.load(open(RIN_BONES, 'rb'))
    os.makedirs(OUT, exist_ok=True)
    for mid in ('065', '070', '078', '087'):
        spec = SPECS[mid]
        if spec['hips'] == [0, 0, 0]:
            mn, mx = read_fig_bbox(mid)
            off = np.array(spec.get('hipsOff', [0, 0, 0]), dtype=np.float64)
            spec = dict(spec)
            spec['hips'] = [round(float(c), 4) for c in ((mn + mx) / 2 + off)]
            print(mid, 'fig bbox', np.round(mn, 3), np.round(mx, 3), '-> hips', spec['hips'])
        baseq = build_base({'baseTurns': BASE_TURNS[mid]})
        targets = TARGETS[mid]
        state, best = fit(spec, bones, baseq, targets, iters=1600)
        total, parts = fit.__globals__['loss_eval'](state, spec, bones, baseq, targets, targets.get('_w', {}))
        pos, _ = fk_positions({'rot': state}, bones, baseq)
        fitrot = {b: [round(float(x), 2) for x in v] for b, v in state.items()}
        print(f"--- {mid} loss={best:.4f}")
        for name, b_, c_ in SEG_DEF:
            if name in targets:
                d = pos[c_] - pos[b_]
                d = d / (np.linalg.norm(d) + 1e-9)
                t = np.asarray(targets[name])
                print(f"   {name:10s} fk={np.round(d,2)} target={np.round(t,2)} dot={np.dot(d,t):+.3f}")
        loc, _md = read_anchor(mid)
        fmn, fmx = read_fig_bbox(mid)
        pose = {'model': f'SexMachineModel-{mid}', 'character': 'Rin_outfit_00',
                'scale': spec['scale'], 'hipsPoint': spec['hips'], 'figHipsHeadSpan': spec['figHipsHeadSpan'],
                'yawFix': 0, 'anchorLoc': loc, 'notes': spec['notes'],
                'figBounds': {'min': [round(float(c), 4) for c in fmn], 'max': [round(float(c), 4) for c in fmx]}}
        # hips quat = base; остальные — fitted locals
        full, _ = fk_chain_rotations(fitrot, ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
                                              'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
                                              'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
                                              'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
                                              'rightUpperLeg', 'rightLowerLeg', 'rightFoot'])
        full['hips'] = quat_normalize(baseq)
        pose['quats'] = {b: [round(float(c), 6) for c in full[b]] for b in full}
        hb = bones['hips']['wpos'] * spec['scale']
        pose['rootPos'] = [round(spec['hips'][0] - hb[0], 4), round(spec['hips'][1] - hb[1], 4), round(spec['hips'][2] - hb[2], 4)]
        json.dump(pose, open(os.path.join(OUT, f'pose-SexMachineModel-{mid}.json'), 'w'), ensure_ascii=False, indent=1)
        print("   written", os.path.join(OUT, f'pose-SexMachineModel-{mid}.json'))


if __name__ == '__main__':
    main()