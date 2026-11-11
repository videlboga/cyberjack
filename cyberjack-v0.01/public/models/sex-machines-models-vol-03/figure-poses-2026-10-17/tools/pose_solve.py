# Pose solve: archetype pose (per-machine spec) -> VRM normalized-humanoid local quats + root placement.
# Skeleton: parsed from the target VRM (Rin_outfit_00.vrm). Machine frame = prepared GLB frame (metres, Y-up).
#
# Pose spec (per machine):
#   baseEuler: the whole-body base rotation Q0 as Euler XYZ [rad] = standing VRM -> figure body frame.
#   hips: [x,y,z] machine-frame hips target position.
#   scale: VRM scale in machine units.
#   rot: {bone: [x,y,z] eulers} applied AFTER baseEuler, in the post-Q0 body frame (FK chain order).
#   yawFix: extra root yaw correction constant (deg) if the VRM faces the wrong way (verified visually).
import sys, os, json, pickle, math
import numpy as np


def quat_from_euler_xyz(x, y, z):
    """Three.js/Euler XYZ order (intrinsic), radians -> quat xyzw."""
    cx, sx = math.cos(x / 2), math.sin(x / 2)
    cy, sy = math.cos(y / 2), math.sin(y / 2)
    cz, sz = math.cos(z / 2), math.sin(z / 2)
    # R = Rx(yaw?) ... three.js 'XYZ': q = qx * qy * qz
    qx = (sx, 0, 0, cx)
    qy = (0, sy, 0, cy)
    qz = (0, 0, sz, cz)
    return quat_mul(quat_mul(qx, qy), qz)


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by + ay * bw + az * bx - ax * bz,
        aw * bz + az * bw + ax * by - ay * bx,
        aw * bw - ax * bx - ay * by - az * bz,
    )


def quat_conj(q):
    return (-q[0], -q[1], -q[2], q[3])


def quat_apply(q, v):
    # v' = q * v * q*
    qv = (v[0], v[1], v[2], 0.0)
    return quat_mul(quat_mul(q, qv), quat_conj(q))[:3]


def quat_normalize(q):
    n = math.sqrt(sum(c * c for c in q))
    return tuple(c / n for c in q)


def rotm(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]], dtype=np.float64)


CHAIN = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head']
ARM = ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand']
LEG = ['leftUpperLeg', 'leftLowerLeg', 'leftFoot']


def fk_chain_rotations(spec, order):
    """Compute local quats per bone with parent composition (FK); returns locals + worlds."""
    locals_ = {}
    worlds = {}
    for bone in order:
        e = spec.get(bone, (0, 0, 0))
        qloc = quat_from_euler_xyz(*[math.radians(a) for a in e])
        qpar = worlds.get(PARENT_OF.get(bone), (0, 0, 0, 1))
        qw = quat_mul(quat_normalize(qpar), qloc)
        locals_[bone] = quat_normalize(qloc)
        worlds[bone] = quat_normalize(qw)
    return locals_, worlds


PARENT_OF = {
    'hips': None, 'spine': 'hips', 'chest': 'spine', 'upperChest': 'chest', 'neck': 'upperChest',
    'head': 'neck',
    'leftShoulder': 'upperChest', 'leftUpperArm': 'leftShoulder', 'leftLowerArm': 'leftUpperArm', 'leftHand': 'leftLowerArm',
    'rightShoulder': 'upperChest', 'rightUpperArm': 'rightShoulder', 'rightLowerArm': 'rightUpperArm', 'rightHand': 'rightLowerArm',
    'leftUpperLeg': 'hips', 'leftLowerLeg': 'leftUpperLeg', 'leftFoot': 'leftLowerLeg', 'leftToes': 'leftFoot',
    'rightUpperLeg': 'hips', 'rightLowerLeg': 'rightUpperLeg', 'rightFoot': 'rightLowerLeg', 'rightToes': 'rightFoot',
}


def solve_machine_pose(spec, bones):
    """spec: machine pose spec; bones: parsed humanoid dict (from VRM) with 'wpos' rest world positions.
    Returns pose JSON dict (rootPos, scale, quats per bone in normalized-local space, fk debug)."""
    # rest positions in VRM model space (metres, y-up, hips around y=1.0)
    rest = {k: v['wpos'] for k, v in bones.items()}
    order = (['hips'] + CHAIN[1:] + ARM + ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand']
             + ['leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'])

    locals_, worlds = fk_chain_rotations(spec.get('rot', {}), order)
    # base = whole-body rotation about the body (applied first): prepend to hips
    base = quat_from_euler_xyz(*[math.radians(a) for a in spec.get('baseEuler', [0, 0, 0])])
    if spec.get('yawFix'):
        fix = quat_from_euler_xyz(0, math.radians(spec['yawFix']), 0)
        base = quat_mul(quat_normalize(fix), quat_normalize(base))
    # recompute with hips = base
    full = dict(locals_)
    full['hips'] = quat_normalize(quat_mul(quat_normalize(base), locals_.get('hips', (0, 0, 0, 1))))
    # world rotations recompute (hips->down)
    worlds2 = {}
    for bone in order:
        qloc = full[bone]
        par = PARENT_OF.get(bone)
        qw = quat_mul(worlds2.get(par, (0, 0, 0, 1)), qloc) if par else qloc
        worlds2[bone] = quat_normalize(qw)

    # FK positions in VRM space
    def fkpos(bone):
        if bone is None:
            return np.zeros(3)
        par = PARENT_OF.get(bone)
        base_p = fkpos(par) if par else np.zeros(3)
        if par:
            off = rest[bone] - rest[par]
            q = worlds2.get(par, (0, 0, 0, 1))
            return base_p + np.array(quat_apply(q, off))
        return np.array(rest[bone], dtype=np.float64)

    def chain_pos(chain):
        return {b: fkpos(b) for b in chain}

    # scale + root: hips pivot stays at rest['hips'] in model space (rotation rides on the hips node)
    s = float(spec.get('scale', 1.0))
    hipsw = np.array(rest['hips'], dtype=np.float64)
    root_pos = np.array(spec['hips'], dtype=np.float64) - hipsw * s

    fk = {
        'neckVsHips': (fkpos('neck') - fkpos('hips')).round(4).tolist(),
        'headVsNeck': (fkpos('head') - fkpos('neck')).round(4).tolist(),
        'handL': fkpos('leftHand').round(4).tolist(),
        'footL': fkpos('leftFoot').round(4).tolist(),
    }
    out = {
        'rootPos': root_pos.round(4).tolist(),
        'scale': s,
        'quats': {b: [round(c, 6) for c in full[b]] for b in sorted(full)},
        'fkSpaceCheck': fk,
        'hipsTarget': spec['hips'],
    }
    return out, worlds2, full


def fk_verify(landmarks_expected, pose_out):
    """Compare FK-space body dirs with machine-frame expectations rotated back by base — QC helper."""
    pass


if __name__ == '__main__':
    pass