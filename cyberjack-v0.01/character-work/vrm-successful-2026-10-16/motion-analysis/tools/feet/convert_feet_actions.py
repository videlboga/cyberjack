#!/usr/bin/env python3
"""Конвертация стопных Actions из Blender-сцены Evanescia_Feet_Motion в наш формат клипов.

Источник: `/tmp/feet_actions.json` (снято `export_feet_actions.py`: локальные дельты
поворотов от rest для 22 костей стопы, 30 fps).

Что делает: сопоставляет кости анатомического рига с костями нашего рига Koikatsu
(`cf_j_leg03_*` — стопа, `cf_j_toes_*` — плюсна, `k_f_toe*_00..03` — пальцы),
собирает абсолютные локальные повороты `rest · delta` и пишет клипы в формате
`koikatsu-generic-v1`, который понимает рендерер и вьювер.

Запуск:
  python3 convert_feet_actions.py --in /tmp/feet_actions.json \
      --rig ../../tools/animation-library/inventory/source_rigs.json \
      --out ../data/feet-actions.json [--axis-flip]
"""
import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# анатомический риг → наш риг
MAP = {
    'foot.l': 'cf_j_leg03_L', 'foot.r': 'cf_j_leg03_R',
    'toes_01.l': 'cf_j_toes_L', 'toes_01.r': 'cf_j_toes_R',
    'BigToe.L': 'k_f_toeL_00', 'BigToe.R': 'k_f_toeR_00',
    'SmallToe1.L': 'k_f_toeL_01', 'SmallToe1.R': 'k_f_toeR_01',
    'SmallToe2.L': 'k_f_toeL_02', 'SmallToe2.R': 'k_f_toeR_02',
    'SmallToe3.L': 'k_f_toeL_03', 'SmallToe3.R': 'k_f_toeR_03',
}


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    )


def flip_axis(q, axis='y'):
    """Разворот локальной дельты (Blender Z-up → наш Y-up)."""
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--rig', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--gain', action='append', default=[],
                    help='усиление амплитуды: CLIP=FACTOR (например LOOP_03_Toe_Splay=2.5)')
    a = ap.parse_args()
    gains = {}
    for g in a.gain:
        name, val = g.split('=')
        gains[name] = float(val)

    rig_doc = json.load(open(a.rig))
    rigs = rig_doc['rigs'] if isinstance(rig_doc, dict) and 'rigs' in rig_doc else rig_doc
    idx = [r['name'] for r in rigs].index('p_cf_body_bone')
    rest = {b['name']: tuple(b['rotation']) for b in rigs[idx]['bones']}

    src = json.load(open(a.src))
    fps = src.get('fps', 30)
    clips = []
    for act_name, act in sorted(src['actions'].items()):
        frames = act['frames']
        keys = sorted(int(k) for k in frames)
        n = len(keys)
        tracks = {}
        for f in keys:
            per = frames[str(f)] if str(f) in frames else frames[f]
            for bone_src, delta in per.items():
                bone_dst = MAP.get(bone_src)
                if not bone_dst or bone_dst not in rest:
                    continue
                d = tuple(delta)
                if act_name in gains:
                    # усиление: слерп от identity к дельте (поворот на больший угол)
                    k = gains[act_name]
                    import math as _m
                    w = max(-1.0, min(1.0, d[3]))
                    ang = 2 * _m.acos(abs(w))
                    if ang > 1e-6:
                        sgn = 1.0 if w >= 0 else -1.0
                        half = ang * k / 2
                        axis = _m.sqrt(max(1e-12, 1 - w * w))
                        d = (d[0] / axis * _m.sin(half), d[1] / axis * _m.sin(half),
                             d[2] / axis * _m.sin(half), sgn * _m.cos(half))
                local = qmul(rest[bone_dst], d)
                tracks.setdefault(bone_dst, []).extend(round(v, 6) for v in local)
        out_tracks = [{'bone': b, 'rotations': r} for b, r in tracks.items()]
        kind = 'impulse' if act_name.startswith('IMPULSE') else 'loop'
        clips.append({
            'id': f"feet-{act_name.lower().replace('_', '-')}",
            'name': act_name,
            'label': f'Стопы · {act_name}',
            'fps': fps,
            'duration': round(n / fps, 4),
            'frames': n,
            'dataset': 'evanescia-feet',
            'kind': kind,
            'rig': 'female',
            'tracks': out_tracks,
        })

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump({'format': 'koikatsu-generic-v1', 'fps': fps, 'clips': clips},
              open(a.out, 'w'), ensure_ascii=False)
    print(f'клипов: {len(clips)} → {a.out}')
    for c in clips:
        print(f"   {c['name']:26} {c['duration']:5.2f} с · костей {len(c['tracks'])} · {c['kind']}")


if __name__ == '__main__':
    main()
