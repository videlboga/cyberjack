#!/usr/bin/env python3
"""Assign a canonical connector family to every mate point + build the registry.

Reads `docs/plans/checks/mounting-audit.json` -> `proposed_unification.families`
(canonical Cj families), adds the local families that were minted from verified
geometry in batch 1, writes `docs/plans/connector-registry.json` and sets
`connector` (plus `connector_note` where the geometry does not fit a family)
on every point in `docs/plans/mates/*.json`.

Rule: a family id is only used when the geometry matches its spec. Otherwise
`connector: "custom"` with the concrete mismatch — never force a point into a
family it does not fit.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SHARDS = ROOT / "docs" / "plans" / "mates"
AUDIT = ROOT / "docs" / "plans" / "checks" / "mounting-audit.json"
REGISTRY = ROOT / "docs" / "plans" / "connector-registry.json"

# Families defined in batch 1 from verified geometry (not in the audit's
# proposed_unification). They exist because the real interface of these
# components is a plate / chuck / table, not an ISO flange.
LOCAL_FAMILIES = [
    {
        "id": "CJ-OSC-PLATE",
        "status": "local",
        "spec": "плита ползуна 32 × 106 мм, верх y=0.139 (crosshead 0.037…0.069 по X, "
                "-0.044…0.062 по Z), хомут + 2 стяжки по 106-мм стороне",
        "sides": "motion_oscillating.tool_out ↔ насадки/держатели с плоской пятой",
        "rule": "в центре плиты проходит палец шатуна Ø12 — осевой хвостовик и "
                "ISO-фланец Ø50 не размещаются; инструмент только накладной",
        "geometry": "node motion_oscillating__crosshead (GLB bbox top face)",
    },
    {
        "id": "CJ-TOOL-PLATE",
        "status": "local",
        "spec": "плита каретки под хомут/струбцину; размер по модулю "
                "(264 × 42 у motion_lift_z, 208 × 252 у motion_linear_x, "
                "150 × 150 на quick_plate 210 × 210 у motion_linear_y); "
                "болтовых полей и центрирующего бурта нет",
        "sides": "motion_lift_z / motion_linear_x / motion_linear_y ↔ накладные насадки",
        "rule": "если у насадки есть отверстия под болты — нужна переходная плита "
                "(ADP-STR-XX), сама плита отверстий не имеет",
        "geometry": "nodes carriage_bridge / carriage_top / tool_pad (GLB bbox faces)",
    },
    {
        "id": "CJ-TOOL-CHUCK-43",
        "status": "local",
        "spec": "3-кулачковый патрон, расточка Ø43 (chuck_bore), кулаки до x=0.150, "
                "корпус Ø120 x 0.118…0.140, ось +X",
        "sides": "motion_rotary.tool_out ↔ насадки с цилиндрическим хвостовиком Ø40…43",
        "rule": "зажим кулаками, не фланец; ISO 9409 Ø50 перекрыт корпусом патрона",
        "geometry": "nodes chuck_body / chuck_bore / jaw_1..3 / jaw_*_step",
    },
    {
        "id": "CJ-TOOL-BOSS-60",
        "status": "local",
        "spec": "бобышка Ø60 на передней грани моста каретки, ось +Z, "
                "y=0.630, z=0.124…0.146",
        "sides": "motion_lift_z.tool_boss_out ↔ насадки с центральным гнездом Ø60",
        "rule": "центрирование по бобышке, фиксация стяжкой; болтового поля нет",
        "geometry": "node carriage_bridge (tool_boss в составе моста) + build_motion_lift_z.py",
    },
    {
        "id": "CJ-TABLE-T900",
        "status": "local",
        "spec": "рабочий диск Ø900 (верх y=0.1445), 4 радиальных T-паза 210 × 12,5 на "
                "r=0.300 (азимут 45°+90°k); концентрично буртик Ø230 и шпиндель Ø144 "
                "до y=0.150; 8 болтов диска на PCD 340 — внутренний стык",
        "sides": "motion_turntable.tool_out ↔ приспособления/фиксаторы на T-пазах",
        "rule": "T-паз 12,5 мм — не T-slot 15; крепление сухариками в пазах, "
                "не фланцем",
        "geometry": "nodes disc / disc_slots / disc_boss / disc_spigot / disc_bolts",
    },
    {
        "id": "CJ-TOOL-D50",
        "status": "derived",
        "spec": "ротационный док Ø50 (подразмер D-серии; в аудите упомянут как "
                "вариант D90 для work_tickle_radial Ø52)",
        "sides": "ротационные насадки Ø48…54",
        "rule": "наследует правила CJ-TOOL-D90; вводится, чтобы не подгонять Ø52…58 "
                "под Ø90",
        "geometry": "—",
    },
]

# explicit assignments that no generic rule can derive
EXPLICIT = {
    ("motion_oscillating", "tool_out"): "CJ-OSC-PLATE",
    ("motion_lift_z", "tool_out"): "CJ-TOOL-PLATE",
    ("motion_linear_x", "tool_out"): "CJ-TOOL-PLATE",
    ("motion_linear_y", "tool_out"): "CJ-TOOL-PLATE",
    ("motion_lift_z", "tool_boss_out"): "CJ-TOOL-BOSS-60",
    ("motion_rotary", "tool_out"): "CJ-TOOL-CHUCK-43",
    ("motion_turntable", "tool_out"): "CJ-TABLE-T900",
    ("motion_piston_rod", "tool_out"): "CJ-CLEVIS-8",
    ("motion_piston_hydraulic", "tool_out"): "CJ-CLEVIS-8",
    ("motion_piston_telescopic", "tool_out"): "CJ-CLEVIS-8",
    ("motion_piston_servo", "tool_out"): "CJ-CLEVIS-8",
    ("work_probe_textured", "tool_in"): "CJ-TOOL-B50",
    ("work_attach_adapter", "flange_in"): "CJ-TOOL-B25",
    ("work_attach_adapter", "tool_out"): "CJ-TOOL-B25",
    ("work_attach_adapter", "index_pin"): "custom",
}

EXPLICIT_NOTE = {
    ("motion_piston_servo", "tool_out"): "палец Ø8,4 — номинал CJ-CLEVIS-8 Ø8 h8",
    ("work_attach_adapter", "flange_in"): ("гнездо Ø20 входит в B25 только через "
                                           "переходную втулку Ø20→Ø25"),
    ("work_attach_adapter", "index_pin"): ("штифт Ø1,6 против проворота — не "
                                           "самостоятельный коннектор"),
    ("work_probe_textured", "tool_in"): "обойма Ø48 — типоразмер B50 (Ø48…54)",
}

CUSTOM_NOTES = {
    ("motion_piston_cam", "tool_out"): ("фланец Ø50, но поле 4×Ø6 PCD 34 ≠ ISO 9409 "
                                        "(PCD 40, 4×M6)"),
    ("motion_piston_pneumatic", "tool_out"): ("палец Ø6,4 — подразмер CJ-CLEVIS-8 "
                                              "(Ø8): нужна переходная серьга"),
    ("motion_rotary", "flange_out"): ("фланец Ø144 с 6 болтами PCD 116 — в семействах "
                                      "CJ-TOOL нет; инструмент идёт в патрон"),
    ("work_probe_linear", "tool_in"): ("муфта Ø42 + цанга Ø35 — не байонет; ближайший "
                                       "B40 требует втулку Ø42→Ø40"),
    ("work_probe_rotary", "tool_in"): ("ротационный док Ø58 — подразмер D-серии; "
                                       "ближайший D90 не садится без кольца"),
    ("work_probe_inflatable", "tool_in"): ("обойма Ø59 с 2 усиками — B50 требует "
                                           "пересборки обоймы под Ø50"),
    ("work_probe_thermal", "tool_in"): ("плита Ø38 с 2 ушами до Ø51,6 — B40 требует "
                                        "пересборки кольца под Ø40"),
}

ISO_BY_PCD = re.compile(r"pcd\s*(\d+)")
DIA = re.compile(r"(?:Ø|ø)\s*(\d+(?:[.,]\d+)?)")


def first_dia(std: str) -> float | None:
    m = DIA.search(std or "")
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def bayonet_family(d: float) -> str | None:
    if 18.0 <= d <= 26.4:
        return "CJ-TOOL-B25"
    if 26.4 < d <= 42.4:
        return "CJ-TOOL-B40"
    if 42.4 < d <= 54.0:
        return "CJ-TOOL-B50"
    if 54.0 < d <= 96.0:
        return "CJ-TOOL-D90"
    return None


def has_any(s: str, words) -> bool:
    return any(w in s for w in words)


def classify(cid: str, cls: str, m: dict) -> tuple[str, str | None]:
    key = (cid, m.get("id") or "")
    if key in EXPLICIT:
        fam = EXPLICIT[key]
        note = EXPLICIT_NOTE.get(key)
        if fam == "custom":
            note = note or "нет канонического семейства"
        return fam, note
    if key in CUSTOM_NOTES:
        return "custom", CUSTOM_NOTES[key]

    role = (m.get("role") or "").lower()
    kind = (m.get("kind") or "").lower()
    std = m.get("standard") or ""
    s = std.lower()

    # ---- media families ----
    if role == "power":
        if has_any(s, ("c20", "c19")):
            return "CJ-PWR-C20", None
        if has_any(s, ("c14", "c13")):
            return "CJ-PWR-C14", None
        if has_any(s, ("24 в", "24в", "24 v", "m12 a", "dc jack", "dc 24")):
            return "CJ-PWR-DC24", None
        return "custom", "питание не описано ни одним CJ-PWR-* (нет C14/C20/M12 A-coded)"
    if role == "signal":
        if "rj45" in s:
            return "CJ-SIG-RJ45", None
        if has_any(s, ("m12 d", "ethercat")):
            return "CJ-SIG-M12D", None
        if "usb" in s:
            return "CJ-SIG-USBC", None
        return "custom", "сигнальный порт не RJ45/M12 D/USB-C (клеммы, гермоввод, штифты)"
    if role == "fluid":
        if has_any(s, ("ø16", "ø18", "ø19", "ø22", "ø66", "dn32", "слив", "дренаж")):
            return "CJ-QD-F16", None
        if has_any(s, ("ø8", "ø9", "ø10", "ø12", "ø13", "ø15", "g1/4", "barb", "барб")):
            return "CJ-QD-F10", None
        return "custom", "fluid-порт без номинала быстросъёма"

    # ---- mechanical families ----
    if kind == "pivot":
        d = first_dia(std)
        if d is not None and 7.5 <= d <= 8.8:
            return "CJ-CLEVIS-8", "палец Ø%s в номинале CJ-CLEVIS-8 (Ø8 h8)" % f"{d:g}"
        if d is not None and 5.5 <= d <= 11.0:
            return "custom", ("палец/ось Ø%s не в номинале CJ-CLEVIS-8 (Ø8 h8)"
                               % f"{d:g}")
        return "custom", ("рым/шарнир Ø%s — CJ-CLEVIS-8 (вилка штока) не применим"
                           % f"{d:g}" if d is not None
                           else "рым/шарнир без нормированного пальца")

    if kind == "bayonet":
        d = first_dia(std)
        fam = bayonet_family(d) if d is not None else None
        if fam:
            return fam, None
        if d is not None and 12.0 <= d <= 120.0:
            return "custom", ("байонет Ø%s не попадает в B25/B40/B50/D90" % f"{d:g}")
        return "custom", ("штифт/фиксатор Ø%s — не байонетная посадка" % f"{d:g}"
                           if d is not None else "байонет без типоразмера")

    if kind == "bolt_pattern":
        px, pz = m.get("pitch_x_m"), m.get("pitch_z_m")
        if "m12" in s:
            if px and pz and abs(px - 0.6) <= 0.005 and abs(pz - 0.6) <= 0.005:
                return "CJ-STR-M12", None
            return "custom", "M12, но поле не 0.600 × 0.600 м (CJ-STR-M12)"
        if "m8" in s:
            if px and pz and abs(px - 0.24) <= 0.005 and abs(pz - 0.24) <= 0.005:
                return "CJ-STR-M8", None
            return "custom", "M8, но поле не 0.240 × 0.240 м (CJ-STR-M8)"
        if has_any(s, ("резьб", "м6", "м8", "м10", "m6", "m10", "m4", "m3")):
            return "custom", "мелкий крепёж вне CJ-STR-M12/M8 (M8 — минимум семейства)"
        return "custom", ("болтовое поле «%s» без нормированного поля" % std[:40]
                           if std else "болтовое поле без спецификации")

    if kind == "rail":
        if "t-slot 15" in s or "din 35" in s:
            return "CJ-RAIL-15", None
        if has_any(s, ("rail", "рельс", "guide", "направляющая", "профиль")):
            return "custom", "профиль не T-slot 15 и не DIN 35 (CJ-RAIL-15)"
        return "custom", "рельсовая точка без профиля CJ-RAIL-15"

    if kind == "dock":
        if has_any(s, ("лоток", "dock", "док", "2 guides", "guide +")):
            return "CJ-DOCK-M", None
        if has_any(s, ("палец", "pin", "штифт")):
            return "custom", "палец/штифт вторичной фиксации — не лоток CJ-DOCK-M"
        return "custom", "док без лотка 440 × 520 и штифтов Ø10 (CJ-DOCK-M)"

    if kind in ("surface", "support"):
        if has_any(s, ("deck", "настил")) and "2000" in s:
            return "CJ-DECK", None
        if has_any(s, ("iso 9409",)):
            return "custom", "ISO-фланец на поверхности — Ø/PCD не подтверждены"
        return "custom", None

    if kind == "flange":
        if "iso 9409" in s:
            pcd = ISO_BY_PCD.search(s)
            if pcd and abs(int(pcd.group(1)) - 40) <= 1:
                return "CJ-TOOL-ISO50", None
            return "custom", "ISO 9409, но PCD/крепёж не 40 мм / 4×M6"
        return "custom", "фланец без стандарта ISO 9409 / байонета"
    return "custom", None


def build_registry(audit: dict, counts: Counter, by_family: dict, unknown: list) -> dict:
    pu = audit.get("proposed_unification", {})
    families = []
    for f in pu.get("families", []):
        families.append({
            "id": f["id"],
            "status": "audit",
            "replaces": f.get("replaces", []),
            "spec": f.get("spec"),
            "sides": f.get("sides"),
            "rule": f.get("rule"),
        })
    for f in LOCAL_FAMILIES:
        families.append(dict(f))
    fam_index = {f["id"]: f for f in families}
    for fid, ids in by_family.items():
        if fid in fam_index:
            fam_index[fid]["points"] = len(ids)
            fam_index[fid]["components"] = sorted({c for c, _ in ids})
    return {
        "format": "cj-connector-registry/1",
        "generated": "2026-11-10",
        "source": ("docs/plans/checks/mounting-audit.json → proposed_unification "
                   "(families 19 + адаптеры) плюс локальные семейства batch 1, "
                   "выведенные из проверенной геометрии GLB"),
        "policy": {
            "field": "connector",
            "where": "каждая точка в docs/plans/mates/*.json (все роли)",
            "rule": ("семейство ставится только при совпадении геометрии со спецификацией; "
                     "иначе connector=\"custom\" и connector_note с конкретным "
                     "расхождением — подгонка запрещена"),
            "pitch": ("для CJ-STR-* шаг поля — часть стандарта: точка без pitch_x_m/"
                      "pitch_z_m недействительна"),
            "local": ("статус local — семейство введено в batch 1 по фактической "
                      "геометрии (плита/патрон/диск), а не предложено аудитом"),
        },
        "families": families,
        "custom": {
            "count": counts.get("custom", 0),
            "note": ("custom — не «нет крепления», а «нет канонического семейства»: "
                     "посадка описана в standard/note точки"),
        },
        "adapter_matrix": pu.get("adapter_matrix", []),
        "counts": dict(sorted(counts.items())),
        "unregistered": unknown,
    }


def main() -> int:
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    shard_files = sorted(p for p in SHARDS.glob("*.json") if p.is_file())
    known = {f["id"] for f in audit["proposed_unification"]["families"]}
    known |= {f["id"] for f in LOCAL_FAMILIES}

    counts: Counter = Counter()
    by_family: dict[str, list] = {}
    changed = 0

    for path in shard_files:
        doc = json.loads(path.read_text(encoding="utf-8"))
        dirty = False
        for cid, entry in doc.get("components", {}).items():
            cls = entry.get("class") or ""
            for m in entry.get("mates", []):
                fam, note = classify(cid, cls, m)
                if fam not in known and fam != "custom":
                    raise SystemExit(f"unknown family {fam} for {cid}/{m.get('id')}")
                if m.get("connector") != fam:
                    m["connector"] = fam
                    dirty = True
                if note:
                    if m.get("connector_note") != note:
                        m["connector_note"] = note
                        dirty = True
                elif "connector_note" in m and (cid, m.get("id")) not in EXPLICIT_NOTE:
                    # keep hand-written notes from apply_mount_fixes out of the way,
                    # but drop stale auto notes when the point now fits a family
                    if m["connector"] != "custom":
                        m.pop("connector_note")
                        dirty = True
                counts[fam] += 1
                by_family.setdefault(fam, []).append((cid, m.get("id")))
        if dirty:
            path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
            changed += 1

    unknown = sorted(k for k in counts if k not in known and k != "custom")
    registry = build_registry(audit, counts, by_family, unknown)
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")

    print(json.dumps({
        "shards_written": changed,
        "points": sum(counts.values()),
        "counts": dict(sorted(counts.items(), key=lambda kv: -kv[1])),
        "families_used": len([k for k in counts if k != "custom"]),
        "unknown": unknown,
        "registry": str(REGISTRY.relative_to(ROOT)),
    }, ensure_ascii=False, indent=1))
    return 1 if unknown else 0


if __name__ == "__main__":
    sys.exit(main())
