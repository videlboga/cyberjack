# Closed-loop calibration of the swing-only aim solver: nudges the direction targets until the joints
# land on the mannequin landmarks (Rin's limb lengths differ, so directions alone leave offsets).
# Usage: python3 calibrate_aim.py <mid> <iterations>
import sys, os, json, subprocess
import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(TOOLS))
POSE = os.path.join(BASE, 'vrm_poses', 'pose-SexMachineModel-{mid}.json')
URL = 'http://127.0.0.1:8766/machine_pose.html'
CHAR = 'x20/outfits/Rin_outfit_03.vrm'

# segment -> (probe landmark of the segment END, start landmark, desired end position)
# goals = REFERENCE MANNEQUIN joints (voxel anatomy, machine frame, mannequin faces -X)
SEGS = {
    'leftUpperLeg':  ('kneeL', 'hips',      [2.030, 1.460, -3.202]),
    'leftLowerLeg':  ('footL', 'kneeL',     [2.040, 1.160, -3.484]),
    'rightUpperLeg': ('kneeR', 'hips',      [2.030, 1.460, -3.892]),
    'rightLowerLeg': ('footR', 'kneeR',     [2.040, 1.160, -3.610]),
    'leftUpperArm':  ('elbowL', 'shoulderL', [2.400, 1.780, -3.434]),
    'leftLowerArm':  ('handL', 'elbowL',    [2.410, 1.590, -3.487]),
    'rightUpperArm': ('elbowR', 'shoulderR', [2.400, 1.780, -3.660]),
    'rightLowerArm': ('handR', 'elbowR',    [2.410, 1.590, -3.607]),
}


def probe(pose_path):
    out = subprocess.run(['node', os.path.join(TOOLS, 'qa', 'probe_pose.cjs'), URL, '080', CHAR],
                         capture_output=True, text=True, timeout=400, cwd=TOOLS)
    d = json.loads(out.stdout.split('errors')[0])
    b = d['bones']
    b['hips'] = d['hipsW']
    return b


def main():
    mid = sys.argv[1]
    iters = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    tpath = os.path.join(TOOLS, 'cache', f'aim-{mid}m.json')
    tgt = json.load(open(tpath))
    pose_path = POSE.format(mid=mid)
    for it in range(iters):
        r = subprocess.run(['node', os.path.join(TOOLS, 'qa', 'aim_pose.cjs'), pose_path, URL, mid, CHAR, tpath, 'limits'],
                           capture_output=True, text=True, timeout=500, cwd=TOOLS)
        if r.returncode != 0:
            print(r.stdout[-1500:], r.stderr[-1500:]); raise SystemExit('aim failed')
        b = probe(pose_path)
        print(f'--- iteration {it}')
        tot = 0.0
        for seg, (endk, startk, goal) in SEGS.items():
            p0 = np.array(b[startk]); p1 = np.array(b[endk]); g = np.array(goal)
            L = np.linalg.norm(p1 - p0) + 1e-9
            err = g - p1
            tot += np.linalg.norm(err)
            d = np.array(tgt[seg], dtype=float) + err / L
            tgt[seg] = list(d / np.linalg.norm(d))
            print(f'  {seg:14s} err={np.round(err*100,1)} cm ({np.linalg.norm(err)*100:.1f})')
        print(f'  total {tot*100:.1f} cm')
        json.dump(tgt, open(tpath, 'w'), indent=1)
    # final solve with the calibrated targets
    subprocess.run(['node', os.path.join(TOOLS, 'qa', 'aim_pose.cjs'), pose_path, URL, mid, CHAR, tpath, 'limits'],
                   check=True, cwd=TOOLS)
    print('final pose written', pose_path)


if __name__ == '__main__':
    main()
