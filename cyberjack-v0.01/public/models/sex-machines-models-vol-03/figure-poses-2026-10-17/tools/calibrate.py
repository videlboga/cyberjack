# Closed-loop pose calibration against the REAL viewer kinematics.
# The analytic FK in pose_solve ignores the VRM rest orientations, so directions that fit perfectly
# in the model still land 10-15 cm off in three-vrm. This script measures the real bone positions in
# machine_pose.html (puppeteer) and corrects the direction targets by the observed landmark error.
# Usage: python3 calibrate.py <mid> <iterations>
import sys, os, json, subprocess, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TOOLS = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(TOOLS))
OUT = os.path.join(BASE, 'vrm_poses')
VIEW = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16/viewer'
VIEW_POSES = os.path.join(VIEW, 'scene-objects/skp-vol03/figure-poses')
URL = 'http://127.0.0.1:8766/machine_pose.html'
CACHE = os.path.join(TOOLS, 'cache')

# desired joint positions in the machine frame (mannequin landmarks / fitted chain targets)
def targets_for(mid):
    f = os.path.join(CACHE, f'landmarks-target-{mid}.json')
    return json.load(open(f))


def probe(mid):
    out = subprocess.run(['node', os.path.join(TOOLS, 'qa', 'probe_pose.cjs'), URL, mid],
                         capture_output=True, text=True, timeout=300, cwd=TOOLS)
    txt = out.stdout.split('errors')[0]
    d = json.loads(txt)
    return {'hips': d['hipsW'], 'head': d['bones']['head'], 'neck': d['bones']['neck'],
            'shoulderL': d['bones']['shoulderL'], 'shoulderR': d['bones']['shoulderR'],
            'elbowL': d['bones']['elbowL'], 'elbowR': d['bones']['elbowR'],
            'handL': d['bones']['handL'], 'handR': d['bones']['handR'],
            'kneeL': d['bones']['kneeL'], 'kneeR': d['bones']['kneeR'],
            'footL': d['bones']['footL'], 'footR': d['bones']['footR']}


# segment -> (start bone, end bone, landmark key for the desired end position)
SEGS = {
    'thighL': ('hips', 'kneeL', 'kneeL'), 'shinL': ('kneeL', 'footL', 'footL'),
    'thighR': ('hips', 'kneeR', 'kneeR'), 'shinR': ('kneeR', 'footR', 'footR'),
    'upperArmL': ('shoulderL', 'elbowL', 'elbowL'), 'lowerArmL': ('elbowL', 'handL', 'handL'),
    'upperArmR': ('shoulderR', 'elbowR', 'elbowR'), 'lowerArmR': ('elbowR', 'handR', 'handR'),
}


def main():
    mid = sys.argv[1]
    iters = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    t = targets_for(mid)
    dirs = dict(t['dirs'])
    goal = {k: np.array(v, dtype=float) for k, v in t['landmarks'].items()}
    tpath = os.path.join(CACHE, f'targets-{mid}.json')
    for it in range(iters):
        json.dump({'dirs': dirs, 'landmarks': t['landmarks']}, open(tpath, 'w'))
        env = dict(os.environ, TARGETS_JSON=tpath)
        r = subprocess.run([sys.executable, os.path.join(TOOLS, 'fit_single.py'), mid, '6', '700'],
                           capture_output=True, text=True, env=env, cwd=TOOLS)
        if r.returncode != 0:
            print(r.stdout[-2000:], r.stderr[-2000:])
            raise SystemExit('fit failed')
        try:
            shutil.copyfile(os.path.join(OUT, f'pose-SexMachineModel-{mid}.json'),
                            os.path.join(VIEW_POSES, f'pose-SexMachineModel-{mid}.json'))
        except shutil.SameFileError:
            pass  # viewer file is a hardlink of the generated pose: nothing to copy
        act = probe(mid)
        print(f'--- iteration {it}')
        err_all = 0.0
        for seg, (b0, b1, gk) in SEGS.items():
            p0 = np.array(act[b0]); p1 = np.array(act[b1])
            d_act = p1 - p0
            L = np.linalg.norm(d_act) + 1e-9
            err = goal[gk] - p1
            err_all += np.linalg.norm(err)
            d_new = np.array(dirs[seg], dtype=float) + err / L
            dirs[seg] = list(d_new / np.linalg.norm(d_new))
            print(f'  {seg:10s} err={np.round(err*100,1)} cm |d|={np.linalg.norm(err)*100:.1f}')
        print(f'  total landmark error {err_all*100:.1f} cm')
    print(json.dumps({'dirs': dirs}, indent=1))


if __name__ == '__main__':
    main()
