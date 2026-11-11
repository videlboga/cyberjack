#!/usr/bin/env python3
"""Сборка отдельной библиотеки внешних клипов (100STYLE + CMU) для системы смешивания.

Складывает в `motion-analysis/external-library/`:
  clips/100style.json, clips/cmu.json   — полные треки в koikatsu-generic-v1
  index.jsonl                           — по строке на клип: метрики + теги (для выбора без чтения треков)
  manifest.json                         — состав, лицензии, кости, fps, версия скрипта
  README_RU.md                          — как читать и подключать

Запуск:
  python3 build_external_library.py --rig <source_rigs.json> --bone-map <bone-map.json> \
      --style100 <dir> --cmu <dir> --out <external-library dir> [--seconds 2] [--limit N]
"""
import argparse, csv, json, math, os, sys, time, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh_metrics as B
from export_pilot_clips import build_clip, cut_window, S100, CMU, FPS_OUT

CMU_KEYWORDS = [
    ('walk', 24), ('run', 12), ('sit', 6), ('stand up', 6), ('crouch', 5),
    ('kneel', 3), ('pick up', 5), ('wave', 4), ('dance', 6), ('box', 4),
    ('jump', 6), ('turn', 5), ('stretch', 4), ('climb', 3), ('lie', 2),
]
S100_MOVEMENTS = [('FW', 'ходьба'), ('FR', 'бег'), ('ID', 'стояние'), ('TR1', 'переход')]


def load_cmu_index(cmu_dir):
    path = os.path.join(cmu_dir, 'cmu-mocap-annotations.csv')
    rows = []
    with open(path) as f:
        for r in csv.reader(f):
            if len(r) > 1 and r[0] and r[0][0].isdigit():
                rows.append((r[0], (r[1] or '').strip(), (r[2] or '').strip()))
    return rows


def pick_cmu(cmu_dir, index):
    picked, used = [], set()
    for keyword, cap in CMU_KEYWORDS:
        n = 0
        for motion, desc, subject in index:
            if n >= cap or motion in used:
                continue
            if keyword not in desc.lower():
                continue
            sub = motion.split('_')[0]
            for base in (os.path.join(cmu_dir, sub, motion + '.bvh'),
                         os.path.join(cmu_dir, 'needFix', sub, motion + '.bvh')):
                if os.path.exists(base):
                    picked.append({'motion': motion, 'file': base, 'desc': desc, 'subject': subject, 'keyword': keyword})
                    used.add(motion); n += 1
                    break
    return picked


def clip_metrics(rig_path, clip):
    """Метрики по готовым трекам. FK считаем только по нужным костям и их предкам."""
    rig = json.load(open(rig_path))
    rb = rig['rigs'][[r['name'] for r in rig['rigs']].index('p_cf_body_bone')]['bones']
    by = {b['name']: b for b in rb}
    tracks = {t['bone']: t for t in clip['tracks']}
    n = len(clip['tracks'][0]['times'])

    need = ('cf_j_thigh00_L', 'cf_j_leg01_L', 'cf_j_leg03_L', 'cf_j_arm00_L',
            'cf_j_forearm01_L', 'cf_j_hand_L', 'cf_j_neck')
    chain, seen = [], set()

    def add(name):
        if not name or name in seen:
            return
        b = by.get(name)
        if not b:
            return
        seen.add(name)
        add(b.get('parent'))
        chain.append(b)
    for t in need:
        add(t)

    def local(name, i):
        t = tracks.get(name)
        if t:
            return tuple(t['rotations'][i*4:(i+1)*4])
        return tuple(by[name]['rotation'])

    def qmul(a, b):
        ax, ay, az, aw = a; bx, by, bz, bw = b
        return (aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx,
                aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz)

    def qrot(q, v):
        x, y, z, w = q; vx, vy, vz = v
        t = (2*(y*vz - z*vy), 2*(z*vx - x*vz), 2*(x*vy - y*vx))
        return (vx + w*t[0] + (y*t[2] - z*t[1]), vy + w*t[1] + (z*t[0] - x*t[2]), vz + w*t[2] + (x*t[1] - y*t[0]))

    def vadd(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
    def vsub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
    def vlen(a): return math.sqrt(sum(c*c for c in a))
    def vang(a, b):
        la, lb = vlen(a), vlen(b)
        if not la or not lb: return 0.0
        return math.degrees(math.acos(max(-1, min(1, sum(x*y for x, y in zip(a, b))/(la*lb)))))

    knee, elbow, lean, ankle = [], [], [], []
    for i in range(n):
        pos, wq = {}, {}
        for b in chain:
            pw = wq.get(b.get('parent'), (0, 0, 0, 1))
            pp = pos.get(b.get('parent'), (0, 0, 0))
            wq[b['name']] = qmul(pw, local(b['name'], i))
            pos[b['name']] = vadd(pp, qrot(pw, tuple(b['position'])))
        knee.append(vang(vsub(pos['cf_j_leg01_L'], pos['cf_j_thigh00_L']), vsub(pos['cf_j_leg03_L'], pos['cf_j_leg01_L'])))
        elbow.append(vang(vsub(pos['cf_j_forearm01_L'], pos['cf_j_arm00_L']), vsub(pos['cf_j_hand_L'], pos['cf_j_forearm01_L'])))
        up = vsub(pos['cf_j_neck'], pos['cf_j_thigh00_L'])
        lean.append(math.degrees(math.atan2(math.hypot(up[0], up[2]), up[1])))
        ankle.append(pos['cf_j_leg03_L'][1])
    r = lambda a: [round(min(a)), round(max(a))]
    return {
        'knee_deg': r(knee), 'elbow_deg': r(elbow), 'lean_deg': r(lean),
        'ankle_y': [round(min(ankle), 3), round(max(ankle), 3)],
        'frames': n, 'fps': clip['fps'], 'duration': clip['duration'],
        'bones': len(clip['tracks']),
    }



def standing_hip_ref(path, names_map):
    """Высота таза в стойке: максимум по ВСЕМУ файлу.

    Файлы CMU приходят с разным масштабом сцены, поэтому опора берётся из того же файла,
    что и окно: иначе получаются смещения в метры.
    """
    try:
        j, f, _ = B.parse(path)
        hi = B.find(j, names_map.get('hips', []))
        if hi is None or not f:
            return None
        ys = sorted(B.fk(j, fr)[hi][0][1] for fr in f)
        return ys[int(len(ys) * 0.95)] if ys else None   # 95-й процентиль: стойка без выбросов-прыжков
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rig', required=True)
    ap.add_argument('--bone-map', required=True)
    ap.add_argument('--style100', required=True)
    ap.add_argument('--cmu', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--seconds', type=float, default=2.0)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--style-limit', type=int, default=0)
    a = ap.parse_args()
    keep = set(json.load(open(a.bone_map)).keys())
    n_frames = int(a.seconds * FPS_OUT) + 1
    os.makedirs(os.path.join(a.out, 'clips'), exist_ok=True)
    started = time.time()

    # ---------- 100STYLE ----------
    styles = sorted({d for d in os.listdir(a.style100)
                     if os.path.isdir(os.path.join(a.style100, d))})
    if a.style_limit:
        styles = styles[:a.style_limit]
    style_clips, style_index = [], []
    total_style = len(styles) * len(S100_MOVEMENTS)
    done = 0
    for style in styles:
        for mv, mv_ru in S100_MOVEMENTS:
            done += 1
            path = os.path.join(a.style100, style, f'{style}_{mv}.bvh')
            if not os.path.exists(path):
                continue
            cut = cut_window(os.path.join(a.style100, 'Frame_Cuts.csv'), style, mv, a.seconds)
            total_frames = B.frame_count(path)
            if total_frames < n_frames + 2:
                continue
            if cut:
                start = cut[2] - cut[3] * 60.0
            else:
                start = total_frames * 0.4
            start = int(max(0, min(total_frames - n_frames, start)))
            prep = B.parse(path, window=(start, int(n_frames * 60 / FPS_OUT) + 6))
            clip = build_clip(a.rig, path, S100, 0, n_frames, 60.0, {
                'id': f'100style-{style.lower()}-{mv.lower()}',
                'label': f'100STYLE · {style} {mv} ({mv_ru})',
                'source': f'100STYLE/{style}/{style}_{mv}.bvh',
                'provenance': {'dataset': '100STYLE', 'license': 'CC BY 4.0', 'commercial': True,
                               'url': 'https://zenodo.org/records/8127870',
                               'style': style, 'movement': mv, 'movement_ru': mv_ru,
                               'transition': mv.startswith('TR')},
            }, preparsed=prep, hips_ref_cm=standing_hip_ref(path, S100))
            clip['tracks'] = [t for t in clip['tracks'] if t['bone'] in keep]
            clip['kind'] = 'base'
            clip['rig'] = 'female'
            clip['category'] = 'external'
            clip['dataset'] = '100style'
            clip['tags'] = {'style': style, 'movement': mv, 'transition': mv.startswith('TR')}
            style_clips.append(clip)
            style_index.append({'id': clip['id'], 'label': clip['label'], 'dataset': '100style',
                                'style': style, 'movement': mv, 'transition': mv.startswith('TR'),
                                'license': 'CC BY 4.0', 'commercial': True, **clip_metrics(a.rig, clip)})
            if done % 20 == 0:
                print(f'100STYLE {done}/{total_style} · клипов {len(style_clips)} · {time.time()-started:.0f}s', flush=True)

    # ---------- CMU ----------
    cmu_clips, cmu_index = [], []
    index_rows = load_cmu_index(a.cmu)
    for item in pick_cmu(a.cmu, index_rows):
        total_frames = B.frame_count(item['file'])
        if total_frames < n_frames + 4:
            continue
        start = int(total_frames * 0.45)
        prep = B.parse(item['file'], window=(start, int(n_frames * 120 / FPS_OUT) + 8))
        clip = build_clip(a.rig, item['file'], CMU, 0, n_frames, 120.0, {
            'id': 'cmu-' + item['motion'].replace('_', '-'),
            'label': f"CMU · {item['motion']} ({item['desc'][:60]})",
            'source': os.path.relpath(item['file'], a.cmu),
            'provenance': {'dataset': 'CMU MoCap (MocapNET BVH)', 'license': 'CMU free for all uses / AFL-3.0',
                           'commercial': True, 'motion': item['motion'], 'description': item['desc'],
                           'subject': item['subject'], 'keyword': item['keyword'], 'fps_source': 120},
        }, preparsed=prep, hips_ref_cm=standing_hip_ref(item['file'], CMU))
        clip['tracks'] = [t for t in clip['tracks'] if t['bone'] in keep]
        clip['kind'] = 'base'
        clip['rig'] = 'female'
        clip['category'] = 'external'
        clip['dataset'] = 'cmu'
        clip['tags'] = {'motion': item['motion'], 'keyword': item['keyword'], 'transition': False}
        cmu_clips.append(clip)
        cmu_index.append({'id': clip['id'], 'label': clip['label'], 'dataset': 'cmu',
                          'keyword': item['keyword'], 'motion': item['motion'], 'transition': False,
                          'license': 'CMU / AFL-3.0', 'commercial': True, **clip_metrics(a.rig, clip)})

    if a.limit:
        cmu_clips, cmu_index = cmu_clips[:a.limit], cmu_index[:a.limit]

    # ---------- запись ----------
    meta_common = {'format': 'koikatsu-generic-v1',
                   'coordinateSpace': 'Unity left-handed; quaternion xyzw. Mirror X for KKBP/PMX target: [x,-y,-z,w].',
                   'notes': 'Повороты — абсолютные локальные трансформы рига p_cf_body_bone. Позиции не экспортируются: '
                            'клип in-place, высота таза берётся из базы/пол-контакта.'}
    for name, clips in (('100style', style_clips), ('cmu', cmu_clips)):
        doc = {**meta_common, 'clips': clips}
        p = os.path.join(a.out, 'clips', f'{name}.json')
        json.dump(doc, open(p, 'w'), ensure_ascii=False)
        print(f'{p}: {len(clips)} клипов, {os.path.getsize(p)/1e6:.1f} МБ')

    with open(os.path.join(a.out, 'index.jsonl'), 'w') as f:
        for row in style_index + cmu_index:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')

    script = os.path.abspath(__file__)
    manifest = {
        'format': 'external-motion-library-v1',
        'created': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'script': os.path.basename(script),
        'scriptSha256': hashlib.sha256(open(script, 'rb').read()).hexdigest()[:16],
        'counts': {'total': len(style_clips) + len(cmu_clips),
                   'byDataset': {'100style': len(style_clips), 'cmu': len(cmu_clips)},
                   'byMovement': {mv: sum(1 for c in style_clips if c['tags']['movement'] == mv)
                                  for mv, _ in S100_MOVEMENTS},
                   'byKeyword': {k: sum(1 for c in cmu_clips if c['tags']['keyword'] == k) for k, _ in CMU_KEYWORDS}},
        'clip': {'fps': FPS_OUT, 'frames': n_frames, 'duration': round(n_frames / FPS_OUT, 3),
                 'bones': 21, 'kind': 'base', 'rig': 'female', 'positions': 'нет (in-place)'},
        'sources': {
            '100style': {'path': a.style100, 'license': 'CC BY 4.0', 'commercial': True,
                         'url': 'https://zenodo.org/records/8127870',
                         'attribution': 'Mason, I. et al. 100STYLE (2022)'},
            'cmu': {'path': a.cmu, 'license': 'CMU free for all uses / конверсия AFL-3.0', 'commercial': True,
                    'url': 'https://huggingface.co/datasets/AmmarkoV/MocapNET-CMUBVH-Dataset',
                    'attribution': 'CMU Graphics Lab Motion Capture Database; BVH-конверсия A. Qammaz (MocapNET)'},
        },
        'measured': 'index.jsonl: диапазоны колена/локтя/наклона, высота голеностопа, кадры, fps, кости',
        'transfer': 'world_target = world_source; local = rest · (rest⁻¹ · parent_world⁻¹ · world_src); mirror-X',
        'known': ['CMU: постоянный сдвиг −7.6° по колену (его rest-колено 7.7° против 1.0°)',
                  'высота таза и контакты не переносятся — нужна база/пол-контакт',
                  'кистей нет у 100STYLE, у CMU пальцы нулевые → пальцы в rest'],
        'build': {'seconds': time.time() - started},
    }
    json.dump(manifest, open(os.path.join(a.out, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(manifest['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
