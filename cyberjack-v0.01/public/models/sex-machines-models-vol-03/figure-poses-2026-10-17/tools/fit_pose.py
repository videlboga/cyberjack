# Numeric pose fitting: per-machine pose spec eulers fitted to anatomical segment direction targets
# (from voxel anatomy of the static figures). Hill-climb on euler params, FK loss = 1 - |dot(seg_dir, target)|.
import sys, os, json, math, pickle
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pose_solve import PARENT_OF, fk_chain_rotations, quat_from_euler_xyz, quat_mul, quat_normalize, quat_apply

ORDER = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
         'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
         'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
         'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
         'rightUpperLeg', 'rightLowerLeg', 'rightFoot']

SEG_DEF = [
    # (segment name, joint whose direction we measure, child joint; dir = fk(child)-fk(joint))
    ('spine', 'hips', 'neck'),
    ('head', 'neck', 'head'),
    ('upperArmL', 'leftUpperArm', 'leftLowerArm'),
    ('lowerArmL', 'leftLowerArm', 'leftHand'),
    ('upperArmR', 'rightUpperArm', 'rightLowerArm'),
    ('lowerArmR', 'rightLowerArm', 'rightHand'),
    ('thighL', 'leftUpperLeg', 'leftLowerLeg'),
    ('shinL', 'leftLowerLeg', 'leftFoot'),
    ('thighR', 'rightUpperLeg', 'rightLowerLeg'),
    ('shinR', 'rightLowerLeg', 'rightFoot'),
]


def fk_positions(spec, bones, baseq):
    rest = {k: v['wpos'] for k, v in bones.items()}
    locals_, _ = fk_chain_rotations(spec.get('rot', {}), ORDER)
    full = dict(locals_)
    full['hips'] = quat_mul(quat_normalize(baseq), quat_normalize(locals_.get('hips', (0, 0, 0, 1))))
    worlds = {'hips': full['hips']}
    # NOTE: hips' world rotation = its local quat; children compose.
    for bone in ORDER[1:]:
        par = PARENT_OF[bone]
        worlds[bone] = quat_normalize(quat_mul(worlds.get(par, (0, 0, 0, 1)), full.get(bone, (0, 0, 0, 1))))
    pos = {'hips': np.array(rest['hips'], dtype=np.float64)}
    for bone in ORDER[1:]:
        par = PARENT_OF[bone]
        off = rest[bone] - rest[par]
        pos[bone] = pos[par] + np.array(quat_apply(worlds[par], off))
    return pos, worlds


def loss_eval(params_state, spec, bones, baseq, targets, weights):
    spec_fit = {'rot': {k: v for k, v in params_state.items()}}
    pos, _ = fk_positions(spec_fit, bones, baseq)
    total, parts = 0.0, {}
    for seg, bjoint, cjoint in SEG_DEF:
        t = targets.get(seg)
        if t is None:
            continue
        d = pos[cjoint] - pos[bjoint]
        n = np.linalg.norm(d)
        if n < 1e-6:
            continue
        d /= n
        w = weights.get(seg, 1.0)
        L = (1 - float(np.dot(d, np.asarray(t)))) * w
        parts[seg] = round(L, 4)
        total += L
    return total, parts


def fit(spec, bones, baseq, targets, iters=1200, seed=7):
    rng = np.random.default_rng(seed)
    state = {b: [float(x) for x in v] for b, v in spec.get('rot', {}).items()}
    # only joints that exist
    state = {b: v for b, v in state.items() if b in ORDER}
    best, best_parts = loss_eval(state, spec, bones, baseq, targets, targets.get('_w', {}))
    step = 14.0
    for it in range(iters):
        trial = {b: list(v) for b, v in state.items()}
        # perturb a random subset
        chosen = [b for b in state if rng.random() < 0.4] or [next(iter(state))]
        for b in chosen:
            k = rng.integers(0, len(trial[b]))
            trial[b][k] += float(rng.normal(0, step))
        total, parts = loss_eval(trial, spec, bones, baseq, targets, targets.get('_w', {}))
        if total < best:
            best = total
            state = trial
        if step > 2 and it % 200 == 199:
            step *= 0.6
    return state, best