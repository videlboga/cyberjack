#!/usr/bin/env python3
"""Сверка внешних моушен-датасетов с ригом библиотеки Koikatsu.

Считает: размер/иерархию скелета, позу покоя, длины сегментов в долях длины ноги,
числовые параметры движения (скорость корня, сгибы, наклон, каденция, fps).

Запуск:
  python3 compare_external_rigs.py --koik <path to source_rigs.json> \
      --style100 /tmp/rigtest/style100/100STYLE --cmu /tmp/rigtest/cmu/MotionCapture
"""
import argparse, os, sys, json, math, statistics as st
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh_metrics as B
import quat_koik as K


S100 = {'hips': ['Hips'], 'chest': ['Chest4'], 'neck': ['Neck'], 'head': ['Head'],
        'shoulder': ['RightShoulder'], 'elbow': ['RightElbow'], 'wrist': ['RightWrist'],
        'hip': ['RightHip'], 'knee': ['RightKnee'], 'ankle': ['RightAnkle'], 'toe': ['RightToe']}
CMU = {'hips': ['hip'], 'chest': ['chest'], 'neck': ['neck'], 'head': ['head'],
       'shoulder': ['lshoulder'], 'elbow': ['lelbow'], 'wrist': ['lhand'],
       'hip': ['lhip'], 'knee': ['lknee'], 'ankle': ['lfoot'], 'toe': ['lfoot']}


def koik_ratios(rig_path):
    bones, w = K.world(rig_path)
    g = lambda n: w[n][0]
    leg = B.vlen(B.vsub(g('cf_j_leg03_L'), g('cf_j_thigh00_L')))
    torso = B.vlen(B.vsub(g('cf_j_neck'), g('cf_j_thigh00_L')))
    seg = {'бедро': B.vlen(B.vsub(g('cf_j_leg01_L'), g('cf_j_thigh00_L'))),
           'голень': B.vlen(B.vsub(g('cf_j_leg03_L'), g('cf_j_leg01_L'))),
           'стопа': B.vlen(B.vsub(g('cf_j_toes_L'), g('cf_j_foot_L'))) + B.vlen(B.vsub(g('cf_j_foot_L'), g('cf_j_leg03_L'))),
           'плечо': B.vlen(B.vsub(g('cf_j_forearm01_L'), g('cf_j_arm00_L'))),
           'предплечье': B.vlen(B.vsub(g('cf_j_hand_L'), g('cf_j_forearm01_L'))),
           'голова': B.vlen(B.vsub(g('cf_j_head'), g('cf_j_neck')))}
    arm_dir = B.vsub(g('cf_j_forearm01_L'), g('cf_j_arm00_L'))
    return {'bones': len(bones), 'leg': leg, 'torso': torso, 'seg': seg, 'arm_dir': arm_dir,
            'hip_y': g('cf_j_thigh00_L')[1], 'height': g('cf_j_head')[1] - g('cf_j_leg03_L')[1]}


def bvh_ratios(path, m):
    j, _, ft = B.parse(path)
    R = B.fk(j)
    nm = [x['name'] for x in j]
    p = lambda n: R[nm.index(n)][0]
    leg = B.vlen(B.vsub(p(m['ankle'][0]), p(m['hip'][0])))
    seg = {'бедро': B.vlen(B.vsub(p(m['knee'][0]), p(m['hip'][0]))),
           'голень': B.vlen(B.vsub(p(m['ankle'][0]), p(m['knee'][0]))),
           'стопа': B.vlen(B.vsub(p(m['toe'][0]), p(m['ankle'][0]))),
           'плечо': B.vlen(B.vsub(p(m['elbow'][0]), p(m['shoulder'][0]))),
           'предплечье': B.vlen(B.vsub(p(m['wrist'][0]), p(m['elbow'][0]))),
           'голова': B.vlen(B.vsub(p(m['head'][0]), p(m['neck'][0])))}
    return {'bones': sum(1 for x in j if x['name'] != 'END'),
            'leg': leg, 'torso': B.vlen(B.vsub(p(m['neck'][0]), p(m['hip'][0]))), 'seg': seg,
            'arm_dir': B.vsub(p(m['elbow'][0]), p(m['shoulder'][0])), 'fps': 1/ft}


def table(rows):
    keys = ['бедро', 'голень', 'стопа', 'плечо', 'предплечье', 'голова']
    head = '| сегмент | ' + ' | '.join(n for n, _ in rows) + ' |'
    sep = '|---|' + '---|'*len(rows)
    out = [head, sep]
    for k in keys:
        cells = []
        for _, r in rows:
            v = r['seg'].get(k)
            cells.append('%.1f%%' % (v/r['leg']*100) if v and v > 1e-6 else 'n/a')
        out.append('| %s | %s |' % (k, ' | '.join(cells)))
    out.append('| торс (таз→шея) | %s |' % ' | '.join('%.1f%%' % (r['torso']/r['leg']*100) for _, r in rows))
    out.append('| костей | %s |' % ' | '.join(str(r['bones']) for _, r in rows))
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--koik', required=True)
    ap.add_argument('--style100', required=True)
    ap.add_argument('--cmu', required=True)
    a = ap.parse_args()

    koik = koik_ratios(a.koik)
    s100 = bvh_ratios(os.path.join(a.style100, 'Angry/Angry_FW.bvh'), S100)
    cmu_path = os.path.join(a.cmu, '02/02_01.bvh')
    cmu = bvh_ratios(cmu_path, CMU)
    cmu2 = bvh_ratios(os.path.join(a.cmu, '13/13_01.bvh'), CMU)
    same = all(abs(cmu['seg'][k]-cmu2['seg'][k]) < 1e-3 for k in cmu['seg'])
    print('## Пропорции (в % длины ноги)\n')
    print(table([('Koikatsu', koik), ('100STYLE', s100), ('CMU 02_01', cmu)]))
    print('\nскелет CMU одинаков у разных субъектов:', same)
    print('поза покоя (плечо→локоть): Koik %s / 100STYLE %s / CMU %s' % tuple(
        [round(x, 2) for x in r['arm_dir']] for r in (koik, s100, cmu)))
    print('длина ноги (таз→стопа в позе покоя): Koik %.3f ед., 100STYLE %.1f см, CMU %.1f см' % (
        koik['leg'], s100['leg'], cmu['leg']))
    print('\n## Движение\n')
    print('| файл | fps (заявлено) | кадров | при заявленном fps: скорость h/s, шаг/с | при 120 fps: скорость h/s, шаг/с | сгиб колена° | наклон° |')
    print('|---|---|---|---|---|---|---|')
    samples = [
        ('100STYLE Angry FW', os.path.join(a.style100, 'Angry/Angry_FW.bvh'), S100, True),
        ('100STYLE Old FW', os.path.join(a.style100, 'Old/Old_FW.bvh'), S100, True),
        ('100STYLE Angry ID', os.path.join(a.style100, 'Angry/Angry_ID.bvh'), S100, True),
        ('100STYLE Angry TR1', os.path.join(a.style100, 'Angry/Angry_TR1.bvh'), S100, True),
        ('CMU 02_01 walk', cmu_path, CMU, False),
        ('CMU 09_01 run', os.path.join(a.cmu, '09/09_01.bvh'), CMU, False),
        ('CMU 114_16 sit', os.path.join(a.cmu, 'needFix/114/114_16.bvh'), CMU, False),
        ('CMU 13_01 stand up', os.path.join(a.cmu, '13/13_01.bvh'), CMU, False),
        ('CMU 22_03 kneel', os.path.join(a.cmu, '22/22_03.bvh'), CMU, False),
        ('CMU 26_09 pick up', os.path.join(a.cmu, '26/26_09.bvh'), CMU, False),
    ]
    for label, path, m, trusted in samples:
        if not os.path.exists(path):
            print('| %s | файл не найден |' % label); continue
        r = B.metrics(path, m, fps_override=120 if not trusted else None)
        print('| %s | %.0f | %d | %s | %s | %s | %s |' % (
            label, r['fps'], r['frames'],
            '%.3f h/s, %.2f' % (r['speed_h_s'], r.get('steps_per_s', 0)) if trusted else 'нет (Frame Time недостоверен)',
            '%.3f h/s, %.2f' % (r.get('speed_h_s_alt', r['speed_h_s']), r.get('steps_per_s_alt', 0)),
            r.get('knee_deg'), r.get('torso_lean_deg')))


if __name__ == '__main__':
    main()
