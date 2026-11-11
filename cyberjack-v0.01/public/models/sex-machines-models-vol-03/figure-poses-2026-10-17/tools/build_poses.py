# Build VRM pose JSONs for selected SKP vol-03 machines from hand-tuned archetype specs.
# Machine frame: prepared-2026-10-16 GLB (metres, Y-up). Anchor read from prepared metadata.
# Tuning knobs live in SPECS below; iterate against machine_pose.html screenshots.
import sys, os, json, math, pickle
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pose_solve import solve_machine_pose, quat_from_euler_xyz, quat_mul, quat_normalize

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(BASE, 'vrm_poses')

RIN_BONES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'rin_bones.pkl')
if not os.path.exists(RIN_BONES):
    RIN_BONES = '/tmp/rin_bones.pkl'


def read_anchor(mid):
    md = json.load(open(f"{BASE}/prepared-2026-10-16/metadata/SexMachineModel-{mid}.json"))
    fr = md['figureReferences'][0]
    m = np.array(fr['worldMatrix'], dtype=np.float64).reshape(4, 4).T  # stored col-major
    loc = m[:3, 3]
    figb = md['full']
    return loc.tolist(), md


# body-frame conventions after baseTurns: the lying/leaning body has axes:
#   up = belly direction, fwd = head-ward.
# The VRM model: at rest spine=+Y, arms along +X (left), front = -Z (assumed; yawFix corrects visually).

SPECS = {
    # 065: lying on the back inside the capsule; head to -X; face up (+Y); frog knees up; arms out.
    '065': {
        'baseTurns': [['X', 90], ['Y', 90]],   # stand -> lie on back (face up), head-ward -X (tune yawFix)
        'hips': [2.50, 1.38, -3.04],
        'scale': 0.75,
        'figHipsHeadSpan': 0.30,
        'rot': {
            'spine': [0, 0, 0],
            'chest': [-8, 0, 0],
            'upperChest': [-12, 0, 0],
            'neck': [-10, 0, 0],
            'head': [-25, 0, 0],
            # arms spread out to the sides, palms up, elbows slightly bent
            'leftUpperArm': [0, -70, -25],
            'leftLowerArm': [0, -25, -6],
            'leftHand': [0, 0, 0],
            'rightUpperArm': [0, 70, -25],
            'rightLowerArm': [0, 25, 6],
            'rightHand': [0, 0, 0],
            # frog legs: knees up-out
            'leftUpperLeg': [-70, 0, 18],
            'leftLowerLeg': [95, 0, 0],
            'rightUpperLeg': [-70, 0, -18],
            'rightLowerLeg': [95, 0, 0],
        },
        'notes': 'lying on back in capsule; head -X; frog legs; arms spread',
    },
    # 070: reclined against the console; legs bent out, feet on the platform
    '070': {
        'baseTurns': [['X', 55], ['Y', 90]],
        'hips': [0, 0, 0],          # FILL from anchor during QA
        'scale': 0.75,
        'figHipsHeadSpan': 0.32,
        'rot': {
            'spine': [0, 0, 0], 'chest': [0, 0, 0], 'upperChest': [0, 0, 0],
            'neck': [-8, 0, 10], 'head': [-10, 0, -4],
            'leftUpperArm': [0, 55, -70], 'leftLowerArm': [0, -95, 0],
            'rightUpperArm': [0, -55, -70], 'rightLowerArm': [0, 95, 0],
            'leftUpperLeg': [-95, 0, 14], 'leftLowerLeg': [100, 0, 0],
            'rightUpperLeg': [-95, 0, -14], 'rightLowerLeg': [100, 0, 0],
        },
        'notes': 'reclined against console; PENDING anchor numbers',
    },
    # 078: on all fours (forearms + knees on the platform)
    '078': {
        'baseTurns': [['X', 90], ['Y', 180]],  # prone, head forward (+tune)
        'hips': [0, 0, 0],          # FILL from anchor during QA
        'scale': 0.8,
        'figHipsHeadSpan': 0.34,
        'rot': {
            'spine': [-6, 0, 0], 'chest': [-6, 0, 0], 'upperChest': [-8, 0, 0],
            'neck': [-14, 0, 0], 'head': [-28, 0, 2],
            'leftUpperArm': [10, 0, 62], 'leftLowerArm': [0, 0, -96],
            'rightUpperArm': [10, 0, -62], 'rightLowerArm': [0, 0, 96],
            'leftUpperLeg': [-70, 0, 8], 'leftLowerLeg': [115, 0, 0],
            'rightUpperLeg': [-70, 0, -8], 'rightLowerLeg': [115, 0, 0],
        },
        'notes': 'all fours on platform; PENDING anchor numbers',
    },
    # 087: riding straddle; lean forward; arms forward to grips
    '087': {
        'baseTurns': [['X', -40], ['Y', 90]],
        'hips': [0, 0, 0],          # FILL from anchor during QA
        'scale': 0.85,
        'figHipsHeadSpan': 0.33,
        'rot': {
            'spine': [-4, 0, 0], 'chest': [-5, 0, 0], 'upperChest': [-7, 0, 0],
            'neck': [-12, 0, 0], 'head': [-26, 0, 0],
            'leftUpperArm': [0, 75, -45], 'leftLowerArm': [0, -35, 0],
            'rightUpperArm': [0, -75, -45], 'rightLowerArm': [0, 35, 0],
            'leftUpperLeg': [-75, 0, 20], 'leftLowerLeg': [105, 0, 0],
            'rightUpperLeg': [-75, 0, -20], 'rightLowerLeg': [105, 0, 0],
        },
        'notes': 'riding straddle, lean fwd; PENDING anchor numbers',
    },
    # 080: seated in the pod, facing +X; torso leaning forward; knees wide apart, feet drawn together;
    # hands down-forward in the lap. hipsPoint = pelvis centre from voxel anatomy (not bbox centre).
    '080': {
        'baseTurns': [['Y', 90]],
        'hips': [2.190, 1.600, -3.547],
        'scale': 0.85,
        'figHipsHeadSpan': 0.63,
        'rot': {
            'spine': [8, 0, 0], 'chest': [4, 0, 0], 'upperChest': [0, 0, 0],
            'neck': [-6, 0, 0], 'head': [-8, 0, 0],
            'leftUpperArm': [0, -55, 25], 'leftLowerArm': [0, -35, 0],
            'rightUpperArm': [0, 55, -25], 'rightLowerArm': [0, 35, 0],
            'leftUpperLeg': [-60, 0, 45], 'leftLowerLeg': [75, 0, 0],
            'rightUpperLeg': [-60, 0, -45], 'rightLowerLeg': [75, 0, 0],
        },
        'notes': 'sits on the ledge, back to the machine (face -X); knees wide, feet drawn in, hands behind back',
    },
}


def build_base(spec):
    q = (0, 0, 0, 1)
    for ax, deg in spec['baseTurns']:
        idx = {'X': 0, 'Y': 1, 'Z': 2}[ax]
        e = [0.0, 0.0, 0.0]
        e[idx] = math.radians(deg)
        t = quat_from_euler_xyz(*e)
        q = quat_mul(quat_normalize(t), quat_normalize(q))
    return q


def read_fig_bbox(mid):
    j, b = __import__('skp_glb_figure').parse_glb(f"{BASE}/prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb")
    V, F = __import__('skp_glb_figure').extract_figure_triangles(j, b)
    return V.min(0), V.max(0)


def main():
    bones = pickle.load(open(RIN_BONES, 'rb'))
    os.makedirs(OUT, exist_ok=True)
    for mid, spec in SPECS.items():
        loc, extra = read_anchor(mid)
        if spec['hips'] == [0, 0, 0]:
            mn, mx = read_fig_bbox(mid)
            off = np.array(spec.get('hipsOff', [0, 0, 0]), dtype=np.float64)
            spec = dict(spec)
            spec['hips'] = [round(float(c), 4) for c in ((mn + mx) / 2 + off)]
            print(mid, 'fig bbox', np.round(mn, 3), np.round(mx, 3), '-> hips', spec['hips'])
        s = spec['scale']
        # base euler list -> we keep baseTurns; the solver needs baseEuler: emulate via explicit quat
        out, worlds, full = solve_machine_pose(spec, bones)
        # solver applies baseEuler only; re-run with base quats built from baseTurns
        fmn, fmx = read_fig_bbox(mid)
        pose = {'model': f'SexMachineModel-{mid}', 'character': 'Rin_outfit_00',
                'scale': s, 'hipsPoint': spec['hips'], 'figHipsHeadSpan': spec['figHipsHeadSpan'],
                'yawFix': 0, 'anchorLoc': loc, 'notes': spec['notes'],
                'figBounds': {'min': [round(float(c), 4) for c in fmn], 'max': [round(float(c), 4) for c in fmx]}}
        pose['quats'] = {b: [round(c, 6) for c in full[b]] for b in sorted(full)}
        # note: solver used no baseTurns; apply turns to hips here:
        baseq = build_base(spec)
        hipsq = quat_mul(quat_normalize(baseq), quat_normalize(full['hips']))
        # children locals stay; they are relative to hips (already base-turned chain)
        pose['quats']['hips'] = [round(c, 6) for c in hipsq]
        # root placement: hips pivot
        hb = bones['hips']['wpos'] * s
        pose['rootPos'] = [round(spec['hips'][0] - hb[0], 4), round(spec['hips'][1] - hb[1], 4), round(spec['hips'][2] - hb[2], 4)]
        path = os.path.join(OUT, f'pose-SexMachineModel-{mid}.json')
        json.dump(pose, open(path, 'w'), ensure_ascii=False, indent=1)
        print('written', path)
        print('  fk neck-vs-hips (model space, should match baseTurned spine dir):', out['fkSpaceCheck']['neckVsHips'])


if __name__ == '__main__':
    main()