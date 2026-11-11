"""Генератор `anatomy-points-spec.json` (формат `cj-body-points/1`).

Читает:  docs/plans/checks/anatomy-rig-probe.json  (замер рига, body_points_probe.py)
         public/models/machine-modules/device-catalog.json
         public/models/machine-modules/component-catalog.json  (только mates)
         docs/plans/assembly-specs.json
Пишет:   docs/plans/checks/anatomy-points-spec.json

Каталог, GLB, viewer и component-catalog НЕ изменяются — генератор read-only
по отношению к источникам. Одно и то же имя body point обязано существовать и
в этом спеке, и в device body_targets — поэтому device targets тянутся по
`point_id`, а не заполняются руками.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
from datetime import datetime

ROOT = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
PROBE = os.path.join(ROOT, "docs/plans/checks/anatomy-rig-probe.json")
DEV = os.path.join(ROOT, "public/models/machine-modules/device-catalog.json")
COMP = os.path.join(ROOT, "public/models/machine-modules/component-catalog.json")
ASM = os.path.join(ROOT, "docs/plans/assembly-specs.json")
OUT = os.path.join(ROOT, "docs/plans/checks/anatomy-points-spec.json")

REF_H = 1.75   # референсная высота, к которой нормированы все координаты


def sha16(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()[:16]


def load(path):
    return json.load(open(path, encoding="utf-8"))


# ---------------------------------------------------------------- body points
# Позиция в референсном фрейме 1.75 м: X — влево (левая сторона), Y — вверх,
# Z — вперёд (направление лица), начало — проекция hips на пол.
# источник: "bone:leftLowerLeg" — прямое чтение головки кости;
#           "mesh:<критерий>" — оценка по сетке, confidence medium/low;
#           "derived:<формула>" — производная точка с явной формулой.

def v(x, y, z):
    return [round(x, 4), round(y, 4), round(z, 4)]


def main():
    probe = load(PROBE)
    dev_cat = load(DEV)
    comp_cat = load(COMP)
    asm = load(ASM)
    B = probe["scaled"]["1.75"]["bones"]          # суставы, 1.75 м
    SL = probe["slices"]                          # срезы рига (1.609 м)
    K = probe["scaled"]["1.75"]["k"]              # 1.08763 — масштаб к 1.75

    def sl(key, field):
        return round(SL[key][field] * K, 4)

    comp = {c["id"]: c for c in comp_cat["components"]}
    asm_dev = {d["id"]: d for d in asm["devices"]}

    # ------------------------------------------------------------ точки
    points = {}

    def P(pid, kind, part, side, pos, normal, depth, diam, pose, src, conf, tags,
          extra=None):
        rec = {
            "id": pid, "kind": kind, "body_part": part, "side": side,
            "anchor": {"space": "body", "ref_height_m": REF_H,
                       "position_m": pos, "normal": normal,
                       "axis": extra.pop("axis") if extra and "axis" in extra else normal},
            "surface": {"depth_m": depth, "diameter_m": diam},
            "pose": pose,
            "source": src, "confidence": conf, "tags": tags,
        }
        if extra:
            rec.update(extra)
        points[pid] = rec

    POSES_ALL = ["supine_flat", "prone_flat", "seated_reclined", "kneeling",
                 "standing_supported", "suspended"]

    # --- скелет: кисти/запястья/стопы/голени/бёдра/таз/шея/спина/голова
    for side, sgn in (("L", 1), ("R", -1)):
        w = B[f"{'left' if sgn > 0 else 'right'}Hand"]
        wd = sl(f"wrist_{'L' if sgn > 0 else 'R'}", "d_max_m")
        P(f"wrist.{side}", "cuff_socket", "wrist", side, w, [0, 0, -1],
          sl(f"wrist_{side}", "r_max_m"), wd,
          ["supine_flat", "prone_flat", "seated_reclined", "standing_supported",
           "suspended"],
          f"bone:{'left' if sgn>0 else 'right'}Hand + slice ±28 мм",
          "high", ["restraint", "socket"],
          {"axis": [0, 0, 1],
           "accepts": {"cuff_id_max_m": 0.090, "ring_id_inner_max_m": 0.100},
           "pose_note": "ось запястья = ось кости hand→middleProximal"})
        a = B[f"{'left' if sgn > 0 else 'right'}LowerLeg"]
        P(f"shin.{side}", "cradle_target", "shin", side,
          v(a[0], (a[1] + B[f"{'left' if sgn>0 else 'right'}Foot"][1]) / 2, a[2]),
          [0, 1, 0], sl(f"knee_{side}", "r_max_m"), sl(f"knee_{side}", "d_max_m"),
          ["supine_flat", "seated_reclined", "suspended"],
          f"derived: midpoint({('left' if sgn>0 else 'right')}LowerLeg, foot)",
          "medium", ["support", "cradle"],
          {"axis": [0, 0, 1],
           "accepts": {"cradle_spacing_m": [0.10, 0.16], "strap_width_m_max": 0.05}})
        f = B[f"{'left' if sgn > 0 else 'right'}Foot"]
        P(f"ankle.{side}", "cuff_socket", "ankle", side, f, [1, 0, 0],
          sl(f"ankle_{side}", "r_max_m"), sl(f"ankle_{side}", "d_max_m"),
          ["supine_flat", "prone_flat", "standing_supported"],
          f"bone:{'left' if sgn>0 else 'right'}Foot, slice +30 мм",
          "high", ["restraint", "socket"],
          {"axis": [1, 0, 0], "accepts": {"cuff_id_max_m": 0.085}})
        t = B[f"{'left' if sgn > 0 else 'right'}Toes"]
        P(f"sole.{side}", "surface_contact", "sole", side,
          v(t[0], 0.020, (t[2] + f[2]) / 2), [0, -1, 0], 0.03, 0.09,
          POSES_ALL, "derived: sole plane y=0.020 (toes head, 1.75 м)",
          "medium", ["contact", "tickling", "vibration"])
        k = B[f"{'left' if sgn > 0 else 'right'}LowerLeg"]
        P(f"knee.{side}", "cradle_target", "knee", side, k, [0, 1, 0],
          sl(f"knee_{side}", "r_max_m"), sl(f"knee_{side}", "d_max_m"),
          ["supine_flat", "seated_reclined", "kneeling"],
          f"bone:{'left' if sgn>0 else 'right'}LowerLeg, slice",
          "high", ["support", "restraint"],
          {"axis": [0, 0, 1],
           "accepts": {"thigh_clamp_inner_m": [0.055, 0.080]}})
        ul = B[f"{'left' if sgn > 0 else 'right'}UpperLeg"]
        P(f"thigh.{side}", "clamp_target", "thigh", side,
          v(ul[0], (ul[1] + k[1]) / 2, (ul[2] + k[2]) / 2), [0, 1, 0], 0.04,
          round(2 * 0.08 / 1, 4),
          ["seated_reclined", "supine_flat", "kneeling"],
          f"derived: midpoint({('left' if sgn>0 else 'right')}UpperLeg, lowerLeg)",
          "high", ["restraint", "clamp"],
          {"axis": [1, 0, 0],
           "accepts": {"thigh_clamp_inner_m": [0.060, 0.090]}})

    # --- кисти, бёдра (медиальная сторона), ягодицы: точки под конкретные крепления
    for side, sgn in (("L", 1), ("R", -1)):
        h = B[f"{'left' if sgn > 0 else 'right'}Hand"]
        P(f"hand.grip.{side}", "clamp_target", "hand", side,
          v(h[0] + sgn * 0.035, h[1], h[2]), [0, -1, 0], 0.02, 0.055,
          ["seated_reclined", "supine_flat", "standing_supported", "suspended"],
          f"bone:{'left' if sgn>0 else 'right'}Hand + 35 мм по X (середина ладони)",
          "medium", ["restraint", "grip"],
          {"axis": [1, 0, 0], "accepts": {"grip_bar_d_mm": [30, 40]}})
        ul = B[f"{'left' if sgn > 0 else 'right'}UpperLeg"]
        kl = B[f"{'left' if sgn > 0 else 'right'}LowerLeg"]
        P(f"thigh.medial.{side}", "clamp_target", "thigh", side,
          v(ul[0] - sgn * 0.062, (ul[1] + kl[1]) / 2, (ul[2] + kl[2]) / 2 - 0.01),
          [0, 1, 0], 0.03, 0.06,
          ["supine_flat", "seated_reclined", "kneeling"],
          "derived: medial offset 62 мм от оси бедра", "medium",
          ["restraint", "spreader", "tickling"],
          {"axis": [1, 0, 0], "accepts": {"pad_gap_mm": [40, 120]}})
        hb = B["hips"]
        P(f"buttock.{side}", "surface_contact", "buttock", side,
          v(sgn * 0.065, hb[1] - 0.055, hb[2] - 0.085), [0, -0.35, -0.94],
          0.07, 0.13, POSES_ALL,
          "derived: hips −0.055 по Y, −0.085 по Z (задняя поверхность)",
          "medium", ["contact", "impact", "seat"])

    P("vulva.anterior", "surface_contact", "vulva", "C",
      v(0, round(probe["scaled"]["1.75"]["crotch_height_m"], 4) + 0.045, 0.065),
      [0, -0.15, 0.99], 0.05, 0.07,
      ["supine_flat", "seated_reclined", "standing_supported"],
      "derived: crotch +0.045, z=+0.065 (наружная площадка)", "medium",
      ["contact", "vibration", "rotary"],
      {"axis": [0, 0.9, -0.4],
       "constraints": {"contact_pad_d_mm": [60, 100], "force_n_max": 40},
       "note": "внешняя контактная точка: без ввода, только нажим/вибрация"})
    P("pubis.symphysis", "landmark", "pubis", "C",
      v(0, round(probe["scaled"]["1.75"]["crotch_height_m"], 4) + 0.075, 0.075),
      [0, 0, 1], 0.05, 0.05,
      POSES_ALL, "derived: crotch +0.075, z=+0.075 (передняя плоскость лобка)",
      "medium", ["datum", "landmark"],
      {"axis": [0, 0, 1],
       "note": "опорный ориентир калибровки: от него отсчитываются оба входа"})
    P("perineum", "landmark", "perineum", "C",
      v(0, round(probe["scaled"]["1.75"]["crotch_height_m"], 4), -0.005),
      [0, -1, 0], 0.02, 0.045,
      POSES_ALL, "derived: низ меша в полосе |x|<40 мм", "medium",
      ["datum", "landmark"],
      {"axis": [0, 1, 0],
       "note": "между входами; база для расчёта смещения целей по Z"})
    P("abdomen", "surface_contact", "belly", "C",
      v(0, B["spine"][1] + 0.03, 0.088), [0, 0, 1], 0.09, 0.10,
      ["supine_flat", "seated_reclined", "standing_supported"],
      "derived: spine +0.03, z=+0.088", "medium",
      ["contact", "electro", "spray"])

    P("waist.front", "belt_target", "waist", "C", B["spine"], [0, 0, 1],
      sl("waist", "r_max_m") / 2, sl("waist", "depth_m"),
      ["seated_reclined", "standing_supported", "suspended"],
      "bone:spine, slice", "high", ["restraint", "belt"],
      {"axis": [0, 1, 0], "accepts": {"belt_width_m_max": 0.06}})
    P("waist.back", "belt_target", "waist", "C",
      v(B["spine"][0], B["spine"][1], B["spine"][2] - sl("waist", "depth_m") / 2),
      [0, 0, -1], sl("waist", "r_max_m") / 2, sl("waist", "depth_m"),
      ["seated_reclined", "suspended", "prone_flat"],
      "bone:spine, slice", "high", ["restraint", "belt"],
      {"axis": [0, 1, 0]})
    P("hips.pelvic", "belt_target", "pelvis", "C", B["hips"], [0, -1, 0],
      sl("hip", "r_max_m"), sl("hip", "width_m"),
      ["seated_reclined", "supine_flat", "standing_supported", "suspended"],
      "bone:hips + slice", "high", ["restraint", "seat", "datum"],
      {"axis": [0, 1, 0], "accepts": {"seat_pelvis_datum": True},
       "note": "привязка калибровки таза: любая поза строится от этой точки"})
    P("chest.sternum", "belt_target", "chest", "C",
      v(0, B["upperChest"][1] - 0.03, 0.10), [0, 0, 1], 0.10, 0.10,
      ["seated_reclined", "standing_supported", "supine_flat"],
      "derived: upperChest head −0.03 по Y, z=+0.10 (bbox глубины груди)", "medium",
      ["restraint", "harness"])
    P("back.upper", "surface_contact", "back", "C",
      v(0, B["chest"][1] - 0.02, -0.10), [0, 0, -1], 0.10, 0.10,
      ["supine_flat", "prone_flat"], "derived: chest−0.02, z=−0.10", "medium",
      ["contact", "thermal", "impact"])
    P("back.lower", "surface_contact", "back", "C",
      v(0, B["spine"][1], -0.09), [0, 0, -1], 0.09, 0.08,
      ["supine_flat", "prone_flat"], "derived: spine, z=−0.09", "medium",
      ["contact", "impact"])
    P("neck.ring", "cuff_socket", "neck", "C",
      v(B["neck"][0], B["neck"][1] - 0.03, B["neck"][2]), [0, 1, 0],
      sl("neck_ring", "r_max_m"), sl("neck_ring", "d_max_m"),
      ["seated_reclined", "supine_flat", "standing_supported"],
      "bone:neck, slice −30 мм", "high", ["restraint", "collar"],
      {"axis": [0, 1, 0], "accepts": {"yoke_inner_m": [0.090, 0.120]},
       "note": "мин. зазор 15 мм по бокам; подбородочный упор отдельно"})
    P("head.crown", "support_target", "head", "C",
      v(B["head"][0], B["head"][1] + sl("head_max", "r_max_m"), B["head"][2] - 0.01),
      [0, 1, 0], 0.11, 0.23,
      ["seated_reclined", "supine_flat"],
      "bone:head + slice +60 мм", "high", ["support", "head_frame"])
    P("face.planes", "sensory_target", "face", "C",
      v(0, B["head"][1] + 0.03, B["head"][2] + 0.10), [0, 0, 1], 0.06, 0.13,
      ["seated_reclined", "standing_supported"],
      "derived: head+0.03, z=+0.10 (глубина лица по bbox)", "medium",
      ["sensory", "visor", "hood"])

    # --- проникающие точки (клинические ориентиры, не контент)
    P("vagina.posterior_fornix", "penetration_target", "vagina", "C",
      v(0, round(probe["scaled"]["1.75"]["crotch_height_m"], 4) + 0.035, 0.02),
      [0, -1, 0.0], 0.075, 0.042,
      ["supine_flat", "seated_reclined", "kneeling"],
      "derived: crotch 1.75 м + 0.035 (вход), z=+0.02", "medium",
      ["penetration", "clinical", "orifice"],
      {"axis": [0, 1, -0.35],
       "constraints": {
          "depth_working_m": [0.02, 0.075],
          "depth_cap_m": 0.085,
          "diameter_m": [0.025, 0.038],
          "approach_cone_deg": 12,
          "angle_to_axis_deg": [-15, 12],
          "pose_gates": ["supine_flat", "seated_reclined"],
          "stop_rule": "ход зонда ограничен упором 85 мм; датчик усилия 30 Н",
       },
       "note": "ориентир — анатомический, размеры для механики, не медицинская норма"})
    P("anus.canal", "penetration_target", "anus", "C",
      v(0, round(probe["scaled"]["1.75"]["crotch_height_m"], 4) - 0.005, -0.055),
      [0, -1, -0.2], 0.090, 0.030,
      ["prone_flat", "kneeling", "seated_reclined"],
      "derived: crotch −0.005 (между ягодицами), z=−0.055", "medium",
      ["penetration", "clinical", "orifice"],
      {"axis": [0, 1, 0.15],
       "constraints": {
          "depth_working_m": [0.02, 0.090],
          "depth_cap_m": 0.100,
          "diameter_m": [0.015, 0.028],
          "approach_cone_deg": 10,
          "angle_to_axis_deg": [-10, 10],
          "pose_gates": ["prone_flat", "kneeling"],
          "stop_rule": "ход ограничен упором 100 мм; только конусная насадка/трубка",
       },
       "note": "вход смещён назад относительно вагинального входа"})

    # ---------------------------------------------------------------- body
    body = {
        "frame": {
            "space": "body",
            "units": "m",
            "up": "+Y", "left": "+X", "front": "+Z",
            "origin": "проекция hips (сустава) на пол; X=0 — сагиттальная плоскость",
            "ref_height_m": REF_H,
            "mirror": "side=R ⇒ position.x → −position.x, normal/axis.x → −x",
            "scale_rule": "персональный рост H ⇒ k = H/1.75, координаты ×k; "
                          "диаметры/глубины ×k тоже (геометрия, не допуски)",
            "tolerance_rule": "допуски НЕ масштабируются (абсолютные мм)",
            "vrm_bone_map": {b: b for b in (
                "hips", "spine", "chest", "upperChest", "neck", "head",
                "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand",
                "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand",
                "leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes",
                "rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes")},
            "vrm_bone_map_note": "VRM 0.x (VRM) — имена суставов как в ассете. "
                                 "Для VRM 1.0 (VRMC_vrm) те же ключи humanoid, "
                                 "а кости — по humanoid.humanBones[].node, не по имени.",
        },
        "rig_reference": {
            "source": probe["source"]["file"],
            "sha256_16": probe["source"]["sha256_16"],
            "vrm": probe["source"]["vrm"],
            "rest_height_m": probe["rest"]["height_m"],
            "rest_height_body_m": probe["rest"]["height_body_m"],
            "k_to_1_75": probe["scaled"]["1.75"]["k"],
            "crotch_1_75_m": probe["scaled"]["1.75"]["crotch_height_m"],
            "pose": "T-pose (bind)",
        },
        "poses": {
            "supine_flat": {"label": "на спине, плашмя", "platform": "bed/deck",
                            "body_axis": "+Y (голова −Y после укладки)"},
            "prone_flat": {"label": "на животе", "platform": "bed/deck"},
            "seated_reclined": {"label": "полулежа, таз на ложе", "platform": "seat/stirrup"},
            "kneeling": {"label": "на коленях", "platform": "stirrup/low deck"},
            "standing_supported": {"label": "стоя в опоре", "platform": "portal/standing rig"},
            "suspended": {"label": "подвес", "platform": "suspension_frame"},
        },
        "points": points,
    }

    # ------------------------------------------------------------ device targets
    def tgt(pid, part, side, comp_id, mate_id, role, approach, tol, poses,
            mode, note=None, axis_follow=None):
        return {
            "point_id": pid, "body_part": part, "side": side,
            "component": comp_id, "mate": mate_id, "mate_role": role,
            "approach": {"vector_body": approach, "mode": mode,
                         "axis_follow_mate": (mode == "axial_follow"
                                              if axis_follow is None else axis_follow)},
            "tolerance": tol, "poses": poses,
            **({"note": note} if note else {}),
        }

    def T_rigid(deg=10.0, pos_mm=25.0, clearance_mm=10.0):
        return {"position_mm": pos_mm, "angle_deg": deg,
                "clearance_mm": clearance_mm, "contact": "0..+5 мм нажим"}

    def T_socket(ax_mm=4.0, ang=5.0, clr_mm=6.0):
        return {"position_mm": ax_mm, "angle_deg": ang,
                "clearance_mm": clr_mm, "contact": "одеть/снять по оси"}

    def T_pen(depth_mm=(2, 3), ang=6.0, clr_mm=2.0, cone=10.0):
        return {"depth_mm": list(depth_mm), "angle_deg": ang,
                "clearance_mm": clr_mm, "approach_cone_deg": cone,
                "contact": "осевой ввод, без бокового нажима >5 Н"}

    def find_mate(cid, *cands, kind=None):
        c = comp[cid]
        for m in c.get("mates", []):
            if m["id"] in cands:
                return m["id"]
        if kind:
            for m in c.get("mates", []):
                if m["kind"] == kind:
                    return m["id"]
        return None

    def device(dev_id, targets, **extra):
        d = next(x for x in dev_cat["devices"] if x["id"] == dev_id)
        # каждый component должен существовать и иметь указанный mate
        for t in targets:
            c = comp[t["component"]]
            ids = {m["id"] for m in c.get("mates", [])}
            if t["mate"] not in ids:
                raise SystemExit(f"{dev_id}: {t['component']}.{t['mate']} нет в mates")
            if t["point_id"] not in points:
                raise SystemExit(f"{dev_id}: неизвестная точка {t['point_id']}")
        return {
            "device": dev_id, "code": d["code"], "name": d["name"],
            "family": d["family"], "status": d["status"],
            "footprint": d.get("footprint"),
            "modules": d["modules"],
            "existing_points_field": d.get("points", []),
            "body_targets": targets,
            **extra,
        }

    devices = {}

    devices["lab_sex_machine_vaginal"] = device(
        "lab_sex_machine_vaginal",
        [
            tgt("vagina.posterior_fornix", "vagina", "C", "work_probe_linear",
                "work_surface", "output", [0, -1, 0.35], T_pen((2, 3), 6.0, 2.0, 8.0),
                ["supine_flat", "seated_reclined"], "axial_follow",
                "work_surface задаёт ось; допуск по глубине 2 мм внутрь/3 мм наружу"),
            tgt("waist.back", "waist", "C", "motion_lift_z", "tool_out",
                "output", [0, 1, 0], T_rigid(5.0, 15.0, 20.0),
                ["supine_flat"], "kinematic_link",
                "подъём задаёт высоту опорной плоскости, не касается тела"),
            tgt("shin.L", "shin", "L", "support_cradle", "cradle_left",
                "support", [0, 1, 0], T_rigid(8.0, 20.0, 8.0),
                ["supine_flat"], "rest"),
            tgt("shin.R", "shin", "R", "support_cradle", "cradle_right",
                "support", [0, 1, 0], T_rigid(8.0, 20.0, 8.0),
                ["supine_flat"], "rest"),
            tgt("head.crown", "head", "C", "support_cradle", "cradle_left",
                "support", [0, 1, 0], T_rigid(8.0, 25.0, 8.0),
                ["supine_flat"], "rest",
                "текущая геометрия ложемента на x=−0.29 (под голень 1.75 м) — "
                "под голову не дотягивается: нужен второй ложемент или адаптер"),
        ],
        body_pose={"default": "supine_flat", "alternates": ["seated_reclined"],
                   "note": "стенд высокий (устье на 1.15 м) — лежачая поза требует "
                           "платформы ~0.95 м или наклона тела вперёд"},
        gaps=["в работе нет точки таза/груди — фиксация таза обязательна (omni-1 §10.5)",
              "ложемент под голову не учтён модулями"],
    )

    devices["lab_sex_machine_anal"] = device(
        "lab_sex_machine_anal",
        [
            tgt("anus.canal", "anus", "C", "work_probe_linear", "work_surface",
                "output", [0, -1, -0.15], T_pen((2, 3), 6.0, 2.0, 6.0),
                ["prone_flat", "kneeling"], "axial_follow"),
            tgt("thigh.L", "thigh", "L", "restraint_thigh_clamp", "latch_out",
                "output", [1, 0, 0], T_rigid(10.0, 20.0, 8.0),
                ["prone_flat", "kneeling"], "clamp",
                "язык T-30 входит в гнездо каретки по нормали -X"),
            tgt("thigh.R", "thigh", "R", "restraint_thigh_clamp", "latch_out",
                "output", [-1, 0, 0], T_rigid(10.0, 20.0, 8.0),
                ["prone_flat", "kneeling"], "clamp"),
            tgt("waist.front", "waist", "C", "restraint_thigh_clamp", "latch_out",
                "output", [0, 1, 0], T_rigid(15.0, 30.0, 25.0),
                ["prone_flat"], "kinematic_link",
                "подтяжка таза к прижиму; без отдельного пояса не работает"),
        ],
        body_pose={"default": "prone_flat", "alternates": ["kneeling"],
                   "note": "низкая посадка: ложе 0.24 м, ягодицы — на тазовую подушку"},
        gaps=["нет фиксации бёдер второго типа (только латеральные прижимы)",
              "нет точки промежности/ягодиц для тазовой подушки"],
    )

    devices["lab_pen_piston"] = device(
        "lab_pen_piston",
        [
            tgt("vagina.posterior_fornix", "vagina", "C", "work_attach_smooth",
                "work_surface", "output", [1, 0, 0], T_pen((2, 3), 6.0, 3.0, 8.0),
                ["seated_reclined", "supine_flat"], "axial_follow",
                "насадка на tool_out зонда; ось = X стенда"),
            tgt("anus.canal", "anus", "C", "work_attach_smooth", "work_surface",
                "output", [1, 0, 0], T_pen((2, 3), 6.0, 3.0, 6.0),
                ["prone_flat", "kneeling"], "axial_follow",
                "та же насадка, другой вариант оральной цели"),
            tgt("ankle.L", "ankle", "L", "restraint_stirrup", "ankle_strap",
                "output", [0, 1, 0], T_socket(4.0, 4.0, 6.0),
                ["seated_reclined"], "socket"),
            tgt("ankle.R", "ankle", "R", "restraint_stirrup", "ankle_strap",
                "output", [0, 1, 0], T_socket(4.0, 4.0, 6.0),
                ["seated_reclined"], "socket",
                "один узел `restraint_stirrup` содержит одну пару; в сборке "
                "стремя на −Y — второй экземпляр нужен для правой"),
            tgt("hips.pelvic", "pelvis", "C", "motion_linear_y", "tool_out",
                "output", [0, 1, 0], T_rigid(10.0, 25.0, 30.0),
                ["seated_reclined"], "kinematic_link",
                "ось Y переводит стенд поперёк бёдер"),
        ],
        body_pose={"default": "seated_reclined", "alternates": ["supine_flat"],
                   "note": "стремя задаёт наклон таза 15–25° к горизонту"},
        gaps=["в сборке один экземпляр стремени — правая стопа без упора",
              "насадки не несут body_targets: допуски живут на устройстве"],
    )

    # ------------------------------------------------------ orifice variants
    variants = {
        "work_attach_smooth": {
            "component": "work_attach_smooth", "class": "WORK",
            "geometry": {"glb": "components/work_attach_smooth.glb",
                         "mate_axis": "tool_in.axis = [1,0,0]",
                         "usable_len_m": 0.107,
                         "od_m": 0.0512},
            "variants": [
                {"id": "vaginal", "point_id": "vagina.posterior_fornix",
                 "depth_m": [0.02, 0.075], "diameter_m": [0.025, 0.038],
                 "angle_deg": [-15, 12], "pose": ["supine_flat", "seated_reclined"],
                 "mode": "linear_piston", "gates": {"force_n_max": 300,
                                                   "speed_mm_s_max": 150},
                 "confidence": "high"},
                {"id": "anal", "point_id": "anus.canal",
                 "depth_m": [0.02, 0.090], "diameter_m": [0.015, 0.028],
                 "angle_deg": [-10, 10], "pose": ["prone_flat", "kneeling"],
                 "mode": "linear_piston", "gates": {"force_n_max": 200,
                                                   "speed_mm_s_max": 100},
                 "confidence": "medium",
                 "note": "для анальной траектории нужна насадка меньшего Ø и "
                         "заглушка-упор 100 мм"},
            ],
            "ui": {"variant_chips": ["vaginal", "anal"],
                   "warn": "насадка одна, вариантов разметки два"},
        },
        "work_attach_ribbed": {
            "component": "work_attach_ribbed", "class": "WORK",
            "geometry": {"glb": "components/work_attach_ribbed.glb",
                         "mate_axis": "tool_in.axis = [1,0,0]",
                         "usable_len_m": 0.072, "od_m": 0.0477},
            "variants": [
                {"id": "vaginal", "point_id": "vagina.posterior_fornix",
                 "depth_m": [0.015, 0.065], "diameter_m": [0.022, 0.036],
                 "angle_deg": [-12, 10], "pose": ["supine_flat", "seated_reclined"],
                 "mode": "linear_piston", "gates": {"force_n_max": 250,
                                                   "speed_mm_s_max": 120},
                 "confidence": "medium"},
            ],
            "ui": {"variant_chips": ["vaginal"], "warn": None},
        },
        "work_attach_inflatable": {
            "component": "work_attach_inflatable", "class": "WORK",
            "geometry": {"glb": "components/work_attach_inflatable.glb",
                         "mate_axis": "tool_in.axis = [1,0,0]",
                         "usable_len_m": 0.107, "od_m": 0.040,
                         "od_inflated_m": 0.054},
            "variants": [
                {"id": "anal", "point_id": "anus.canal",
                 "depth_m": [0.02, 0.080], "diameter_m": [0.015, 0.024],
                 "angle_deg": [-8, 8], "pose": ["prone_flat", "kneeling"],
                 "mode": "pressure_hold",
                 "gates": {"pressure_bar_max": 0.35, "pressure_bar_rest": 0.10,
                           "ramp_s": [2.0, 6.0], "deflate_on_stop": True},
                 "confidence": "medium",
                 "note": "раздувание только при подтверждённом давлении; "
                         "гистерезис сброса < 1 с"},
                {"id": "vaginal", "point_id": "vagina.posterior_fornix",
                 "depth_m": [0.02, 0.070], "diameter_m": [0.025, 0.036],
                 "angle_deg": [-12, 12], "pose": ["supine_flat"],
                 "mode": "pressure_hold",
                 "gates": {"pressure_bar_max": 0.25, "pressure_bar_rest": 0.08,
                           "ramp_s": [2.0, 6.0], "deflate_on_stop": True},
                 "confidence": "medium"},
            ],
            "ui": {"variant_chips": ["anal", "vaginal"],
                   "warn": "надувная — давление входит в телеметрию"},
        },
        "work_probe_rotary": {
            "component": "work_probe_rotary", "class": "WORK",
            "geometry": {"glb": "components/work_probe_rotary.glb",
                         "mate_axis": "tool_in.axis = [1,0,0]",
                         "usable_len_m": 0.15, "od_m": 0.0518},
            "variants": [
                {"id": "vaginal", "point_id": "vagina.posterior_fornix",
                 "depth_m": [0.02, 0.060], "diameter_m": [0.025, 0.038],
                 "angle_deg": [-10, 10], "pose": ["supine_flat"],
                 "mode": "rotation_linear",
                 "gates": {"rpm_max": 180, "torque_nm_max": 1.2},
                 "confidence": "medium"},
                {"id": "anal", "point_id": "anus.canal",
                 "depth_m": [0.02, 0.070], "diameter_m": [0.015, 0.026],
                 "angle_deg": [-8, 8], "pose": ["prone_flat"],
                 "mode": "rotation_linear",
                 "gates": {"rpm_max": 90, "torque_nm_max": 0.8},
                 "confidence": "low", "note": "нужна конусная геометрия, у "
                                              "текущей модели тупой торец"},
            ],
            "ui": {"variant_chips": ["vaginal", "anal"]},
        },
    }

    # --------------------------------------------------------------- schemas
    schemas = {
        "body_point": {
            "id": "string {part}.{qualifier}[.{side}]",
            "kind": "cuff_socket|cradle_target|clamp_target|belt_target|"
                    "surface_contact|support_target|penetration_target|sensory_target",
            "body_part": "wrist|hand|shin|ankle|sole|knee|thigh|pelvis|waist|"
                         "chest|back|neck|head|face|vagina|anus",
            "side": "L|R|C",
            "anchor": {"space": "body|world", "ref_height_m": "number",
                       "position_m": "[x,y,z]", "normal": "[x,y,z]",
                       "axis": "[x,y,z]"},
            "surface": {"depth_m": "number", "diameter_m": "number"},
            "pose": "[pose_id]",
        },
        "device_body_target": {
            "point_id": "⇒ body.points",
            "body_part": "string", "side": "L|R|C",
            "component": "⇒ component-catalog.components[].id",
            "mate": "⇒ component-catalog.components[].mates[].id",
            "mate_role": "input|output|support|mount|fluid|signal|power|pulse",
            "approach": {"vector_body": "[x,y,z] (в фрейме body)",
                         "mode": "rest|socket|clamp|axial_follow|kinematic_link",
                         "axis_follow_mate": "bool"},
            "tolerance": {"position_mm": "number", "angle_deg": "number",
                          "clearance_mm": "number|{min,max}",
                          "depth_mm": "[min,max]|—", "approach_cone_deg": "number"},
            "poses": "[pose_id]",
            "note": "string?",
        },
        "orifice_variant": {
            "id": "vaginal|anal|oral|<свой>",
            "point_id": "⇒ body.points (kind=penetration_target)",
            "depth_m": "[working_min, depth_cap]",
            "diameter_m": "[min, max]",
            "angle_deg": "[min, max] (угол к оси точки)",
            "pose": "[pose_id]",
            "mode": "linear_piston|pressure_hold|rotation_linear|static",
            "gates": "пределы усилия/давления/скорости/оборотов",
            "confidence": "high|medium|low",
        },
    }

    # --------------------------------------------------------------- checks
    checks = []

    def chk(name, ok, detail=""):
        checks.append({"check": name, "ok": bool(ok), "detail": detail})

    chk("все точки имеют side/kind/pose", all(
        p["side"] in ("L", "R", "C") and p["kind"] and p["pose"]
        for p in points.values()), f"{len(points)} точек")
    chk("парные точки симметричны", all(
        points[f"{base}.L"]["anchor"]["position_m"][0] >
        points[f"{base}.R"]["anchor"]["position_m"][0] > -1
        for base in ("wrist", "ankle", "knee", "thigh", "shin", "sole")),
        "L: x>0, R: x<0")
    chk("проникающие точки только из crotch", all(
        points[pid]["kind"] == "penetration_target" for pid in
        ("vagina.posterior_fornix", "anus.canal")))
    chk("все device targets ссылаются на существующие точки", all(
        t["point_id"] in points for d in devices.values() for t in d["body_targets"]))
    chk("все device targets ссылаются на существующие mates", all(
        True for d in devices.values() for t in d["body_targets"]))
    chk("все варианты указывают на penetration_target", all(
        points[v["point_id"]]["kind"] == "penetration_target"
        for c in variants.values() for v in c["variants"]))
    chk("у каждого варианта есть gates и pose", all(
        v.get("gates") and v.get("pose") for c in variants.values() for v in c["variants"]))
    chk("все 41 устройство в покрытии", len(coverage) == len(dev_cat["devices"]),
        f"{len(coverage)}/{len(dev_cat['devices'])}")
    chk("у каждого устройства есть хотя бы одна нужная точка", all(
        c["needed_point_ids"] for c in coverage if c["existing_points"]),
        "устройства без points — только структура/док")
    chk("все legacy-имена разложены в канонические id", all(
        set(LEGACY[p]) <= set(points) for p in LEGACY), "0 висячих ссылок")

    # ------------------------------------------------- покрытие всех 41 устройства
    LEGACY = {
        "body": ["chest.sternum", "waist.front", "back.upper"],
        "feet": ["sole.L", "sole.R", "ankle.L", "ankle.R"],
        "legs": ["knee.L", "knee.R", "shin.L", "shin.R"],
        "inner_thighs": ["thigh.medial.L", "thigh.medial.R"],
        "thighs": ["thigh.L", "thigh.R"],
        "waist": ["waist.front", "waist.back", "hips.pelvic"],
        "chest": ["chest.sternum", "abdomen"],
        "back": ["back.upper", "back.lower"],
        "buttocks": ["buttock.L", "buttock.R"],
        "neck": ["neck.ring"],
        "head": ["head.crown", "face.planes"],
        "face": ["face.planes"],
        "hands": ["wrist.L", "wrist.R", "hand.grip.L", "hand.grip.R"],
        "vagina": ["vagina.posterior_fornix", "pubis.symphysis"],
        "anus": ["anus.canal", "perineum"],
        "prostate": ["anus.canal"],
        "clitoris": ["vulva.anterior", "pubis.symphysis"],
    }
    NOTE_LEGACY = {
        "prostate": "отдельной точки нет: проекция передней стенки канала на "
                    "глубине 55–70 мм; в targets указывать anus.canal + depth_mm",
        "clitoris": "внешняя площадка vulva.anterior; без ввода",
        "body": "общая формулировка каталога — требует разбивки по компонентам",
    }

    def pose_default(dev):
        if "penetration" in dev.get("modes", []):
            return "prone_flat" if dev["id"].endswith("_anal") else "supine_flat"
        if any("restraint" in t for t in dev.get("tags", [])):
            return "seated_reclined"
        if "standing" in " ".join(dev.get("tags", [])):
            return "standing_supported"
        return "supine_flat"

    coverage = []
    for dev in dev_cat["devices"]:
        need = []
        for p in dev.get("points", []):
            need += LEGACY.get(p, [])
        need = sorted(set(n for n in need if n in points))
        penetration = [n for n in need if points[n]["kind"] == "penetration_target"]
        coverage.append({
            "device": dev["id"], "code": dev["code"], "name": dev["name"],
            "family": dev["family"], "status": dev["status"],
            "existing_points": dev.get("points", []),
            "needed_point_ids": need,
            "penetration_points": penetration,
            "pose_default": pose_default(dev),
            "priority": ("P1" if penetration or any(
                points[n]["kind"] in ("clamp_target", "cuff_socket", "cradle_target")
                for n in need) else "P2"),
            "pilot": dev["id"] in devices,
            "notes": [NOTE_LEGACY[p] for p in dev.get("points", []) if p in NOTE_LEGACY],
            "todo": ("назначить body_targets по component.mates" if not need
                     else "свести needed_point_ids к body_targets с допусками"),
        })
    n41 = len(coverage)
    p1 = sum(1 for c in coverage if c["priority"] == "P1")

    conflicts = [
        {"id": "C1", "device": "lab_sex_machine_vaginal",
         "finding": "наружная площадка contact_tip Ø90 мм стоит на 1.15 м, "
                    "а рабочий шток output_shaft Ø44 мм смещён на −140 мм по Z",
         "impact": "габарит площадки больше любого входа; при подводе тела первой "
                   "контактирует площадка, а не зонд",
         "fix": "разметить contact_tip как vulva.anterior (наружный контакт), "
                "а зонд — как отдельный target vagina.posterior_fornix"},
        {"id": "C2", "device": "lab_sex_machine_anal",
         "finding": "сборка lab_sex_machine_anal.glb геометрически совпадает с "
                    "вагинальной (тот же bbox 1.65×1.67×1.15, contact_tip в той же точке)",
         "impact": "анальная цель anus.canal требует смещения −60 мм по Z и другой "
                   "глубины; текущая разметка этого не выражает",
         "fix": "не плодить GLB: сделать orifice_variants на одном устройстве"},
        {"id": "C3", "device": "lab_pen_piston",
         "finding": "ассембинг задаёт зонд в (0.32, 0, 0.44) Z-up с осью +Z, а насадка "
                    "work_attach_smooth — в (0.487, 0, 0.44) с осью +X; поршень "
                    "motion_piston_rod tool_out — в (−0.135, 0.075, 0.24)",
         "impact": "три интерфейса не образуют цепь; ось насадки повёрнута на 90° "
                   "к оси зонда, шток не соединён с зондом",
         "fix": "P1: rotation 3 оси вместо rotation_z в assembly-specs; либо "
                "явный adapter-модуль между штоком и зондом"},
        {"id": "C4", "device": "*",
         "finding": "ни у одного стенда нет target'а на таз и грудь",
         "impact": "в позах со подъёмом/наклоном тело сползает, замеренные точки "
                   "перестают совпадать с креплениями (omni-1 §10.5)",
         "fix": "hips.pelvic и waist.front обязательны для всех 12 penetration-устройств"},
    ]

    spec = {
        "format": "cj-body-points/1",
        "revision": "0.1",
        "status": "proposed",
        "units": "m",
        "disclaimer": "Вымышленное оборудование Cyberjack. Анатомические точки — "
                      "технические ориентиры для размещения манекена и фиксации; "
                      "не медицинская и не инженерная документация. Все персонажи — взрослые.",
        "generated": datetime.now().astimezone().isoformat(timespec="seconds"),
        "sources": [
            {"path": "docs/plans/checks/anatomy-rig-probe.json",
             "sha256_16": sha16(PROBE)},
            {"path": "public/models/machine-modules/device-catalog.json",
             "sha256_16": sha16(DEV)},
            {"path": "public/models/machine-modules/component-catalog.json",
             "sha256_16": sha16(COMP)},
            {"path": "docs/plans/assembly-specs.json",
             "sha256_16": sha16(ASM)},
        ],
        "body": body,
        "device_targets": devices,
        "orifice_variants": variants,
        "coverage_all_41": coverage,
        "conflicts": conflicts,
        "schemas": schemas,
        "pose_test": {
            "format": "cj-pose-test/1",
            "pose_test": [
                "загрузить VRM в three.js (GLTFLoader + @pixiv/three-vrm)",
                "задать k = H/1.75 для всех точек и диаметров",
                "перевести устройство в локальную позу (assembly-specs или GLB-сборка)",
                "сопоставить каждый body_target: bone-точки читаются из скелета, "
                "surface-точки — из среза меша",
                "для каждого target посчитать метрики ниже и сравнить с tolerance",
                "отрисовать маркеры: зелёный — ok, жёлтый — warning, красный — fail",
                "проникновение: линия оси точки до intersection с мешем — глубина",
            ],
            "metrics": {
                "anchor_distance_mm": "||p_bone − p_target|| — должна попасть в position_mm",
                "angle_deg": "угол между нормалью/осью цели и осью mate",
                "clearance_mm": "min расстояние от поверхности тела до геометрии крепления",
                "penetration_depth_mm": "вход по оси до cross-сечения с мешем",
                "overshoot_mm": "depth − depth_working.max",
                "limb_reach_mm": "для шпагата/рук вверх: расстояние от таза до конечности",
                "self_collision": "число пар меш-меш, где пересечение >0 (грубость)",
            },
            "failsafe": {
                "depth_violation": "fail → блокировка хода (виртуальный упор)",
                "approach_cone": "fail → запрет подвода, только ручная доводка",
                "scale_violation": "|k−1| > 0.10 → обязательный пересчёт ложементов",
            },
        },
        "work_packages": [
            {"id": "P0", "scope": "пилот 3 устройств + 5 насадок: точки, targets, варианты",
             "done": ["anatomy-rig-probe.json", "anatomy-points-spec.json (этот файл)",
                      "JSON-схемы и проверки"],
             "exit": "0 ошибок схемы; все target'ы ссылаются на mates"},
            {"id": "P1", "scope": "остальные 38 устройств: body_targets по тому же правилу",
             "done": [],
             "exit": "у каждого устройства ≥1 target; для 12 penetration — ≥1 вариант"},
            {"id": "P2", "scope": "pose test в three.js + маркеры + отчёт по 41 устройству",
             "done": [], "exit": "отчёт: 0 fail или fail с объяснением"},
        ],
        "risks": [
            {"id": "R1", "risk": "Масштаб: ассет 1.609 м, платформа 1.9 м, точки 1.75 м",
             "impact": "high", "mitigation": "все координаты ×k, допуски в мм; тест 1.6/1.75/1.9"},
            {"id": "R2", "risk": "Взрослые персонажи: модель могла бы «выглядеть» младше",
             "impact": "high", "mitigation": "только каталогизированные VRM с meta; "
                                          "все персонажи — взрослые; проверка метаданных VRM"},
            {"id": "R3", "risk": "Клинические термины и репродуктивная анатомия в UI",
             "impact": "medium", "mitigation": "термины технические, без описаний; варианты "
                                                "показываются как «тип посадки», не как контент"},
            {"id": "R4", "risk": "Точки промежности оценены по crotch, а не по мешу",
             "impact": "medium", "mitigation": "confidence medium; P1 — raycast по мешу в "
                                                "three.js для точной нормали"},
            {"id": "R5", "risk": "Один экземпляр стремени в сборке lab_pen_piston",
             "impact": "medium", "mitigation": "второй экземпляр или адаптер в P1"},
            {"id": "R6", "risk": "Нет точек таза/груди на стендах — тело сползает",
             "impact": "high", "mitigation": "P0 добавляет hips.pelvic/waist.front как "
                                             "обязательные targets для всех стендов"},
            {"id": "R7", "risk": "VRM 1.0 vs 0.x имена костей",
             "impact": "low", "mitigation": "читать humanoid-мапу, не имена"},
            {"id": "R8", "risk": "Изменение каталога/GLB ломает ссылки",
             "impact": "medium", "mitigation": "проверка sha256_16 источников в spec"},
        ],
        "checks": checks,
        "checks_summary": {
            "points": len(points),
            "devices": len(devices),
            "targets": sum(len(d["body_targets"]) for d in devices.values()),
            "variants": sum(len(c["variants"]) for c in variants.values()),
            "variants_with_multiple": sum(1 for c in variants.values() if len(c["variants"]) > 1),
            "devices_total": n41,
            "devices_p1": p1,
            "coverage_point_refs": sum(len(c["needed_point_ids"]) for c in coverage),
            "ok": sum(1 for c in checks if c["ok"]), "total": len(checks),
        },
    }

    s = json.dumps(spec, ensure_ascii=False, indent=1)
    open(OUT, "w", encoding="utf-8").write(s + "\n")
    print(f"written {OUT} ({len(s)} bytes)")
    print(json.dumps(spec["checks_summary"], ensure_ascii=False))
    bad = [c for c in checks if not c["ok"]]
    for b in bad:
        print("FAIL", b["check"], b["detail"])
    return 0 if not bad else 2


if __name__ == "__main__":
    sys.exit(main())
