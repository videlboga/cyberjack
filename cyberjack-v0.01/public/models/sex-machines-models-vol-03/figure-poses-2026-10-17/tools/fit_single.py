# Fit one machine's VRM pose with random restarts (robust for poses far from the hand archetype).
# Usage: python3 fit_single.py <mid> [restarts] [iters]
import sys, os, json, pickle
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fit_pose import fit, fk_positions, SEG_DEF
from build_poses import build_base, read_fig_bbox, read_anchor, OUT, SPECS, BASE
from fit_poses import TARGETS, BASE_TURNS, RIN_BONES
from pose_solve import fk_chain_rotations, quat_normalize

BONES = ['spine', 'chest', 'upperChest', 'neck', 'head',
         'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
         'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot']


def main():
    mid = sys.argv[1]
    restarts = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    iters = int(sys.argv[3]) if len(sys.argv) > 3 else 900
    bones = pickle.load(open(RIN_BONES, 'rb'))
    spec = dict(SPECS[mid])
    targets = TARGETS[mid]
    tj = os.environ.get('TARGETS_JSON')
    if tj and os.path.exists(tj):
        d = json.load(open(tj))
        targets = {k: list(v) for k, v in d['dirs'].items()}
        targets['_w'] = TARGETS[mid].get('_w', {})
    baseq = build_base({'baseTurns': BASE_TURNS[mid]})
    rng = np.random.default_rng(12345)
    candidates = [spec]
    for k in range(restarts):
        c = dict(spec)
        c['rot'] = {b: [float(rng.uniform(-100, 100)) for _ in range(3)] for b in BONES}
        # keep the torso lean init family: spine pitch varies but stays forward
        c['rot']['spine'] = [float(rng.uniform(10, 45)), float(rng.uniform(-15, 15)), float(rng.uniform(-15, 15))]
        candidates.append(c)
    scored = []
    for i, cand in enumerate(candidates):
        st, loss = fit(cand, bones, baseq, targets, iters=iters, seed=100 + i)
        scored.append((loss, st))
        print('  trial %2d loss=%.4f' % (i, loss))
    scored.sort(key=lambda t: t[0])
    best_loss, state = scored[0]
    state, best_loss = fit({'rot': state}, bones, baseq, targets, iters=max(3000, iters * 4), seed=7)
    print('best after refine: loss=%.4f' % best_loss)
    fitrot = {b: [round(float(x), 2) for x in v] for b, v in state.items()}
    pos, _ = fk_positions({'rot': state}, bones, baseq)
    for name, b_, c_ in SEG_DEF:
        if name in targets:
            d = pos[c_] - pos[b_]
            d = d / (np.linalg.norm(d) + 1e-9)
            t = np.asarray(targets[name])
            print(f'   {name:10s} fk={np.round(d,2)} target={np.round(t,2)} dot={np.dot(d,t):+.3f}')
    loc, _md = read_anchor(mid)
    fmn, fmx = read_fig_bbox(mid)
    pose = {'model': f'SexMachineModel-{mid}', 'character': 'Rin_outfit_00',
            'scale': spec['scale'], 'hipsPoint': spec['hips'], 'figHipsHeadSpan': spec['figHipsHeadSpan'],
            'yawFix': 0, 'anchorLoc': loc, 'notes': spec['notes'],
            'figBounds': {'min': [round(float(c), 4) for c in fmn], 'max': [round(float(c), 4) for c in fmx]}}
    order = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
             'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
             'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
             'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
             'rightUpperLeg', 'rightLowerLeg', 'rightFoot']
    full, _ = fk_chain_rotations(fitrot, order)
    full['hips'] = quat_normalize(baseq)
    pose['quats'] = {b: [round(float(c), 6) for c in full[b]] for b in full}
    hb = bones['hips']['wpos'] * spec['scale']
    pose['rootPos'] = [round(spec['hips'][0] - hb[0], 4), round(spec['hips'][1] - hb[1], 4),
                       round(spec['hips'][2] - hb[2], 4)]
    pose['fitLoss'] = round(best_loss, 4)
    pose['fitEulers'] = fitrot
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'pose-SexMachineModel-{mid}.json')
    json.dump(pose, open(path, 'w'), ensure_ascii=False, indent=1)
    print('written', path)


if __name__ == '__main__':
    main()
