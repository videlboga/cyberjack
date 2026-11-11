#!/usr/bin/env python3
"""Экспорт пилотных внешних клипов в формат банка (koikatsu-generic-v1).

Формат совпадает с `viewer/vrm_studio_assets/koikatsu-h.json`: clips[{id,label,duration,fps,
source,provenance,tracks:[{bone,times,rotations}]}]. Повороты — абсолютные локальные
трансформы исходного рига Koikatsu (rest = identity), как ждёт вьювер.

Перенос: source world → mirror-X (как в vrm_studio.js) → local нашей кости
`rest_local · (rest_local⁻¹ · parent_world⁻¹ · world_src)`; позиции не экспортируются
(generic-клип во вьювере rotation-only), окно берётся in-place.

Запуск:
  python3 export_pilot_clips.py --rig <source_rigs.json> --style100 <dir> --cmu <dir> \
      --bone-map <bone-map.json> --out ../data/external-pilot.json
"""
import argparse, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh_metrics as B
import quat_koik as K

IDENT = (0.0, 0.0, 0.0, 1.0)
FPS_OUT = 30

S100 = {'hips': ['Hips'], 'neck': ['Neck'], 'head': ['Head'],
        'shoulder_L': ['LeftCollar'], 'arm_L': ['LeftShoulder'], 'fore_L': ['LeftElbow'], 'hand_L': ['LeftWrist'],
        'shoulder_R': ['RightCollar'], 'arm_R': ['RightShoulder'], 'fore_R': ['RightElbow'], 'hand_R': ['RightWrist'],
        'thigh_L': ['LeftHip'], 'knee_L': ['LeftKnee'], 'ankle_L': ['LeftAnkle'], 'toe_L': ['LeftToe'],
        'thigh_R': ['RightHip'], 'knee_R': ['RightKnee'], 'ankle_R': ['RightAnkle'], 'toe_R': ['RightToe'],
        'spine': ['Chest', 'Chest2', 'Chest3', 'Chest4']}
CMU = {'hips': ['hip'], 'neck': ['neck'], 'head': ['head'],
       'shoulder_L': ['lcollar'], 'arm_L': ['lshoulder'], 'fore_L': ['lelbow'], 'hand_L': ['lhand'],
       'shoulder_R': ['rcollar'], 'arm_R': ['rshoulder'], 'fore_R': ['relbow'], 'hand_R': ['rhand'],
       'thigh_L': ['lhip'], 'knee_L': ['lknee'], 'ankle_L': ['lfoot'], 'toe_L': ['toe1'],
       'thigh_R': ['rhip'], 'knee_R': ['rknee'], 'ankle_R': ['rfoot'], 'toe_R': ['toe1'],
       'spine': ['abdomen', 'chest']}
TARGET = {'hips': 'cf_j_hips', 'neck': 'cf_j_neck', 'head': 'cf_j_head',
          'shoulder_L': 'cf_j_shoulder_L', 'arm_L': 'cf_j_arm00_L', 'fore_L': 'cf_j_forearm01_L', 'hand_L': 'cf_j_hand_L',
          'shoulder_R': 'cf_j_shoulder_R', 'arm_R': 'cf_j_arm00_R', 'fore_R': 'cf_j_forearm01_R', 'hand_R': 'cf_j_hand_R',
          'thigh_L': 'cf_j_thigh00_L', 'knee_L': 'cf_j_leg01_L', 'ankle_L': 'cf_j_leg03_L', 'toe_L': 'cf_j_toes_L',
          'thigh_R': 'cf_j_thigh00_R', 'knee_R': 'cf_j_leg01_R', 'ankle_R': 'cf_j_leg03_R', 'toe_R': 'cf_j_toes_R'}


def qinv(q): return (-q[0], -q[1], -q[2], q[3])
def mirror_x(q): return (q[0], -q[1], -q[2], q[3])
def slerp(a, b, t):
    dot = sum(x*y for x, y in zip(a, b))
    if dot < 0:
        b = tuple(-x for x in b); dot = -dot
    if dot > 0.9995:
        out = tuple(x + t*(y-x) for x, y in zip(a, b))
    else:
        th0 = math.acos(min(1.0, dot)); th = th0*t
        s0 = math.sin(th0-th)/math.sin(th0); s1 = math.sin(th)/math.sin(th0)
        out = tuple(s0*x + s1*y for x, y in zip(a, b))
    n = math.sqrt(sum(x*x for x in out)) or 1.0
    return tuple(x/n for x in out)


def cut_window(cuts_path, style, movement, seconds):
    """окно нужной длины внутри отрезка Frame_Cuts (без T-поз)."""
    import csv
    with open(cuts_path) as f:
        for row in csv.DictReader(f):
            if row['STYLE_NAME'].lower() != style.lower(): continue
            a, b = row.get(movement + '_START'), row.get(movement + '_STOP')
            if not a or not b or a == 'N/A': return None
            a, b = int(a), int(b)
            mid = (a + b)//2
            half = seconds/2
            return a, b, mid, half
    return None


def build_clip(rig_path, bvh_path, names_map, start_frame, n_frames, fps_src, meta, preparsed=None, hips_ref_cm=None):
    bones, _ = K.world(rig_path)
    children = {}
    for b in bones.values():
        children.setdefault(b.get('parent'), []).append(b)
    joints, frames, ft = preparsed if preparsed else B.parse(bvh_path)
    idx = {k: B.find(joints, v) for k, v in names_map.items()}
    spine_idx = [B.find(joints, [n]) for n in names_map.get('spine', [])]
    spine_idx = [i for i in spine_idx if i is not None]
    order = [b for b in bones.values() if b.get('parent') is None]
    byname = bones

    REST_HIP_Y = 1.076  # мировая высота cf_j_hips в rest нашей модели, м
    trans = []          # смещение таза по кадрам: только Y (окно in-place)
    hip0 = None
    tracks = {k: {'times': [], 'rotations': []} for k in TARGET.values()}
    for extra in ('cf_j_spine02', 'cf_j_spine03'):
        tracks.setdefault(extra, {'times': [], 'rotations': []})
    times = []
    for k in range(n_frames):
        t = k / FPS_OUT
        times.append(round(t, 5))
        src_pos = start_frame + t * fps_src
        i0 = max(0, min(len(frames)-1, int(math.floor(src_pos))))
        i1 = min(len(frames)-1, i0+1)
        a = src_pos - i0
        W0, W1 = B.fk(joints, frames[i0]), B.fk(joints, frames[i1])
        # высота таза в источнике: без неё присед/сидение/лежание физически невозможны
        if idx.get('hips') is not None:
            hip_y = W0[idx['hips']][0][1]
            if hip0 is None:
                hip0 = hip_y
            # опора = высота таза в стойке: максимум по всему источнику, иначе окно,
            # начатое в приседе, даёт ложный «рост» на полметра
            ref = hips_ref_cm or hip0
            ty = (hip_y - ref) * (REST_HIP_Y / ref) if ref else 0.0
            ty = max(-0.9, min(0.3, ty))   # страховка от разного масштаба сцены в файлах
            trans.extend([0.0, round(ty, 5), 0.0])
        src = {}
        for key, i in idx.items():
            if i is None or key not in TARGET: continue
            src[TARGET[key]] = mirror_x(slerp(W0[i][1], W1[i][1], a))
        spine = [mirror_x(slerp(W0[i][1], W1[i][1], a)) for i in spine_idx]
        if spine:
            src['cf_j_spine03'] = spine[-1]
            src['cf_j_spine02'] = spine[len(spine)//2]
        world, locals = {}, {}

        def walk(name, parent_world):
            b = byname[name]
            rest = tuple(b['rotation'])
            local = rest
            if name in src:
                local = B.qmul(rest, B.qmul(B.qmul(qinv(rest), qinv(parent_world)), src[name]))
            locals[name] = local
            wq = B.qmul(parent_world, local)
            world[name] = wq
            for c in children.get(name, []):
                walk(c['name'], wq)

        walk(order[0]['name'], IDENT)
        for bone in tracks:
            q = locals.get(bone, tuple(byname[bone]['rotation']))
            tracks[bone]['times'] = times
            tracks[bone]['rotations'].extend(round(v, 7) for v in q)
    out_tracks = [{'bone': b, 'times': tracks[b]['times'], 'rotations': tracks[b]['rotations']}
                  for b in tracks if b.startswith('cf_')]
    if trans and len(trans) == 3 * len(times):
        for t in out_tracks:
            if t['bone'] == 'cf_j_hips':
                t['translations'] = trans          # [x, y, z] на кадр, метры, in-place
                t['translationSpace'] = 'hips-world-offset'
    return {'id': meta['id'], 'label': meta['label'], 'name': meta['label'],
            'duration': round(n_frames / FPS_OUT, 5), 'fps': FPS_OUT,
            'source': meta['source'], 'provenance': meta['provenance'],
            'tracks': out_tracks}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rig', required=True)
    ap.add_argument('--style100', required=True)
    ap.add_argument('--cmu', required=True)
    ap.add_argument('--bone-map', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--seconds', type=float, default=2.0)
    a = ap.parse_args()
    keep = set(json.load(open(a.bone_map)).keys())
    n = int(a.seconds * FPS_OUT) + 1
    clips = []

    # 100STYLE: ходьба и переход, отрезки из Frame_Cuts.csv (без T-поз)
    for style, movement, label in [('Angry', 'FW', 'гневная ходьба'), ('Angry', 'TR1', 'переход TR1')]:
        path = os.path.join(a.style100, style, f'{style}_{movement}.bvh')
        if not os.path.exists(path): print('нет файла', path); continue
        cut = cut_window(os.path.join(a.style100, 'Frame_Cuts.csv'), style, movement, a.seconds)
        joints, frames, ft = B.parse(path)
        start = cut[2] - cut[3]*ft if cut else len(frames)*0.4
        start = max(0, min(len(frames)-n, int(start)))
        clips.append(build_clip(a.rig, path, S100, start, n, 1/ft, {
            'id': f'x-100style-{style.lower()}-{movement.lower()}',
            'label': f'100STYLE · {style} {movement} ({label})',
            'source': f'100STYLE/{style}/{style}_{movement}.bvh',
            'provenance': {'dataset': '100STYLE', 'license': 'CC BY 4.0', 'commercial': True,
                           'url': 'https://zenodo.org/records/8127870', 'style': style, 'movement': movement}}))

    # CMU: садится + бег
    for sub, name, label in [('needFix/114', '114_16', 'садится'), ('09', '09_01', 'бег')]:
        path = os.path.join(a.cmu, sub, name + '.bvh')
        if not os.path.exists(path): print('нет файла', path); continue
        joints, frames, ft = B.parse(path)
        start = max(0, min(len(frames)-n, int(len(frames)*0.45)))
        clips.append(build_clip(a.rig, path, CMU, start, n, 120.0, {
            'id': f'x-cmu-{name.replace("_","-")}',
            'label': f'CMU · {name} ({label})',
            'source': f'CMU/MotionCapture/{sub}/{name}.bvh',
            'provenance': {'dataset': 'CMU MoCap (MocapNET BVH)', 'license': 'CMU free for all uses / AFL-3.0',
                           'commercial': True, 'fps_source': 120, 'motion': name}}))

    # оставляем только кости, которые вообще попадают на VRM
    for c in clips:
        before = len(c['tracks'])
        c['tracks'] = [t for t in c['tracks'] if t['bone'] in keep]
        print(f"{c['id']}: костей {before} → {len(c['tracks'])}, кадров {len(c['tracks'][0]['times'])}, "
              f"длительность {c['duration']} с")
    doc = {'format': 'koikatsu-generic-v1',
           'coordinateSpace': 'Unity left-handed; quaternion xyzw. Mirror X for KKBP/PMX target: [x,-y,-z,w].',
           'clips': clips,
           'provenance': {'produced': 'motion-analysis/tools/external/export_pilot_clips.py',
                          'transfer': 'world_target = world_source, local = rest · (rest⁻¹ · parent_world⁻¹ · world_src)',
                          'positions': 'не экспортируются: generic-клип во вьювере rotation-only, окно in-place'}}
    json.dump(doc, open(a.out, 'w'), ensure_ascii=False)
    print('записано', a.out, os.path.getsize(a.out), 'байт')


if __name__ == '__main__':
    main()
