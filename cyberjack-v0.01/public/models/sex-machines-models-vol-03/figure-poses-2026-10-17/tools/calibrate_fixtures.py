# Fit machine-080 pose to the machine's own restraints (ledge peg, ankle arches, foot roller, hex sockets).
# Loop: aim_pose (swing-only) -> probe real joint positions in the viewer -> nudge direction targets.
# Usage: python3 calibrate_fixtures.py <mid> [iterations]
import sys, os, json, subprocess
import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(TOOLS))
POSE = os.path.join(BASE, 'vrm_poses', 'pose-SexMachineModel-{mid}.json')
URL = 'http://127.0.0.1:8766/machine_pose.html'
CHAR = 'x20/outfits/Rin_outfit_03.vrm'

# fixture points from the machine geometry (metres, prepared frame)
FIX = {
    'archL': [2.105, 1.292, -3.677], 'archR': [2.105, 1.292, -3.417],
    'roller': [2.044, 1.232, -3.548],
    'hexL': [2.403, 1.889, -3.676], 'hexR': [2.403, 1.889, -3.418],
}
# aim-target key -> (probe point, probe anchor, goal position)
SEGS = {
    'leftUpperLeg':  ('kneeL', 'hips',   [2.100, 1.420, -3.700]),
    'rightUpperLeg': ('kneeR', 'hips',   [2.100, 1.420, -3.394]),
    'leftUpperArm':  ('elbowL', 'shoulderL', [2.310, 1.860, -3.660]),
    'rightUpperArm': ('elbowR', 'shoulderR', [2.310, 1.860, -3.434]),
    'leftLowerLeg':  ('ankleL', 'kneeL',  [2.105, 1.292, -3.677]),
    'rightLowerLeg': ('ankleR', 'kneeR',  [2.105, 1.292, -3.417]),
    'leftFoot':      ('toeL', 'ankleL',   [2.035, 1.235, -3.610]),
    'rightFoot':     ('toeR', 'ankleR',   [2.035, 1.235, -3.486]),
    'leftLowerArm':  ('handL', 'elbowL',  [2.395, 1.885, -3.667]),
    'rightLowerArm': ('handR', 'elbowR',  [2.395, 1.885, -3.427]),
}


def probe(pose_file):
    out = subprocess.run(['node', os.path.join(TOOLS, 'qa', 'probe_fixtures.cjs'), URL, '080', CHAR, pose_file],
                         capture_output=True, text=True, timeout=400, cwd=TOOLS)
    try:
        return json.loads(out.stdout.split('PAGEERROR')[0])
    except Exception:
        print(out.stdout[-800:], out.stderr[-800:]); raise


def main():
    mid = sys.argv[1]
    iters = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    tpath = os.path.join(TOOLS, 'cache', f'aim-{mid}f.json')
    tgt = json.load(open(tpath))
    pose_path = POSE.format(mid=mid)
    pose_name = os.path.basename(pose_path)
    for it in range(iters):
        r = subprocess.run(['node', os.path.join(TOOLS, 'qa', 'aim_pose.cjs'), pose_path, URL, mid, CHAR, tpath, 'limits'],
                           capture_output=True, text=True, timeout=500, cwd=TOOLS)
        if r.returncode != 0:
            print(r.stdout[-1200:], r.stderr[-1200:]); raise SystemExit('aim failed')
        d = probe(pose_name)
        P = d['points']
        print(f'--- iteration {it}')
        tot = 0.0
        for seg, (endk, startk, goal) in SEGS.items():
            p1 = P.get(endk); p0 = P.get(startk)
            if not p1 or not p0:
                print(f'  {seg:14s} missing point'); continue
            p1 = np.array(p1); p0 = np.array(p0); g = np.array(goal)
            L = np.linalg.norm(p1 - p0) + 1e-9
            err = g - p1
            tot += float(np.linalg.norm(err))
            v = np.array(tgt[seg], dtype=float) + err / L
            tgt[seg] = list(v / np.linalg.norm(v))
            print(f'  {seg:14s} err={np.round(err*100,1)} cm ({np.linalg.norm(err)*100:.1f})')
        for k in ('crotch_to_protrusion_cm', 'handL_to_hexL_cm', 'ankleL_to_archL_cm', 'toeL_to_roller_cm'):
            print(f'  {k:26s} {d.get(k)}')
        print(f'  total reach error {tot*100:.1f} cm')
        json.dump(tgt, open(tpath, 'w'), indent=1)
    subprocess.run(['node', os.path.join(TOOLS, 'qa', 'aim_pose.cjs'), pose_path, URL, mid, CHAR, tpath, 'limits'],
                   check=True, cwd=TOOLS)
    print('final fixture pose written', pose_path)


if __name__ == '__main__':
    main()
