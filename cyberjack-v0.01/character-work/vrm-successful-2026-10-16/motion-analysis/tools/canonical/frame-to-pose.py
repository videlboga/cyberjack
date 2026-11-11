#!/usr/bin/env python3
"""Кадр библиотеки -> поза в формате POSE1 (см. POSE1.md).

Что пишется на каждый слот:
  d     — единичное направление кости в характерной рамке (X влево, Y вперёд, Z вверх);
          рамка строится из самого скелета, поэтому от системы координат источника не зависит;
  q     — мировой кватернион кости источника (несёт скрутку);
  qrest — мировой кватернион той же кости в rest источника (нужен, чтобы выделить именно скрутку).

  python3 frame-to-pose.py frame.json pose.json
"""
import json
import math
import sys


def sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def norm(v):
    n = math.sqrt(dot(v, v)) or 1.0
    return [v[0] / n, v[1] / n, v[2] / n]


def project(v, axis):
    k = dot(v, axis)
    return [v[i] - axis[i] * k for i in range(3)]


# слот -> (кость источника, точка, куда смотрит кость)
CHAIN = {
    'hips': ('cf_j_hips', 'cf_j_spine01'),
    'spine': ('cf_j_spine01', 'cf_j_spine02'),
    'chest': ('cf_j_spine02', 'cf_j_spine03'),
    'upperChest': ('cf_j_spine03', 'cf_j_neck'),
    'neck': ('cf_j_neck', 'cf_j_head'),
    'head': ('cf_j_head', 'cf_j_head_top'),
    'leftUpperArm': ('cf_j_arm00_L', 'cf_j_forearm01_L'),
    'leftLowerArm': ('cf_j_forearm01_L', 'cf_j_hand_L'),
    'leftHand': ('cf_j_hand_L', 'cf_j_index01_L'),
    'rightUpperArm': ('cf_j_arm00_R', 'cf_j_forearm01_R'),
    'rightLowerArm': ('cf_j_forearm01_R', 'cf_j_hand_R'),
    'rightHand': ('cf_j_hand_R', 'cf_j_index01_R'),
    'leftUpperLeg': ('cf_j_thigh00_L', 'cf_j_leg01_L'),
    'leftLowerLeg': ('cf_j_leg01_L', 'cf_j_foot_L'),
    'leftFoot': ('cf_j_foot_L', 'cf_j_toes_L'),
    'leftToes': ('cf_j_foot_L', 'cf_j_toes_L'),
    'rightUpperLeg': ('cf_j_thigh00_R', 'cf_j_leg01_R'),
    'rightLowerLeg': ('cf_j_leg01_R', 'cf_j_foot_R'),
    'rightFoot': ('cf_j_foot_R', 'cf_j_toes_R'),
    'rightToes': ('cf_j_foot_R', 'cf_j_toes_R'),
}


def main():
    frame_path, out_path = sys.argv[1], sys.argv[2]
    d = json.load(open(frame_path))
    pos = {n: v for n, v in zip(d['names'], d['frame'])}
    pos.update(d.get('extraPos') or {})
    WQ = d.get('worldQ') or {}
    WQR = d.get('restWorldQ') or {}

    def P(name):
        if name not in pos:
            raise SystemExit('нет сустава %s в кадре' % name)
        return pos[name]

    # характерная рамка строится из REST-скелета источника (не из позы!): иначе рамка
    # поворачивается вместе с телом и поза теряет разворот.
    rest = {n: v for n, v in zip(d['names'], d['restFrame'])}
    # три анатомические оси, без крестов и без переворотов: влево, вперёд, вверх.
    # Оси сопоставляются по смыслу (лево->лево, перёд->перёд, верх->верх), поэтому левосторонность
    # систем координат источника и цели может быть любой.
    a = norm(sub(rest['cf_j_thigh00_L'], rest['cf_j_thigh00_R']))
    f = norm(project(sub(rest['cf_j_toes_L'], rest['cf_j_foot_L']), a))
    u = norm(project(sub(rest['cf_j_head'], rest['cf_j_hips']), a))
    u = norm(project(u, f))
    print('FRAME a', [round(c, 3) for c in a], 'f', [round(c, 3) for c in f], 'u', [round(c, 3) for c in u])

    slots = {}
    for slot, (head, tip) in CHAIN.items():
        if tip not in pos:                      # нет макушки — продолжаем осью шеи
            tip = 'cf_j_head' if slot == 'head' else tip
            head = 'cf_j_neck' if slot == 'head' else head
        dv = norm(sub(P(tip), P(head)))
        ch = [round(dot(dv, a), 4), round(dot(dv, f), 4), round(dot(dv, u), 4)]
        s = {'d': ch}
        if head in WQ:
            s['q'] = [round(c, 5) for c in WQ[head]]
        if head in WQR:
            s['qrest'] = [round(c, 5) for c in WQR[head]]
        slots[slot] = s

    out = {
        'format': 'POSE1',
        'subject': {'clip': d.get('clip') or d.get('id'), 't': d.get('t'), 'source': 'koikatsu-cf_j'},
        'frame': 'character: A=left, F=forward, U=up',
        'slots': slots,
        'extras': {'parametric': 'not touched', 'fingers': 'rest'},
    }
    json.dump(out, open(out_path, 'w'), indent=1)
    print('POSE1_WRITTEN', out_path, 'slots', len(slots))


if __name__ == '__main__':
    main()
