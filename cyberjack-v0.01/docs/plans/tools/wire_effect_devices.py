#!/usr/bin/env python3
"""Wire the layered work heads into the device catalog.

Replaces the three legacy probe presets in devices with their parts
(base + form + effect), and gives every effect module at least one device.
Devices are ordered by layer: structure → drive → base → form → effect → rig →
restraint → control, so a device composition reads as a chain.

Idempotent: re-running removes/adds the same modules and keeps order.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "public/models/machine-modules"
CATALOG = BASE / "component-catalog.json"
DEVICES = BASE / "device-catalog.json"

# Что меняем и почему.
REWIRE = {
    # Пресет «надувной зонд» распадается на базу, камеру и пневмо-модуль.
    # Комбинированная база — единственная, где вращение и ход идут по одной оси.
    "lab_pen_rotary": dict(
        remove=["work_probe_rotary", "work_probe_inflatable"],
        add=["work_probe_combined", "work_attach_inflatable", "effect_pneumatic"],
        note="вращение + ход на одной оси; камера питается пневмо-модулем",
    ),
    # Пресет «термо-зонд» — это линейная база + гладкая форма + термо-вставка.
    "lab_pen_thermal": dict(
        remove=["work_probe_thermal"],
        add=["work_probe_linear", "work_attach_smooth", "effect_thermal"],
        note="термо-рампа через вставку, форма отдельно",
    ),
    # Камера без источника давления — половина сборки; рёбра с надувом несовместимы.
    "lab_pen_pneumatic": dict(
        remove=["work_attach_ribbed"],
        add=["effect_pneumatic"],
        note="пневмо-модуль добавлен, ребристая форма убрана (конфликт с камерой)",
    ),
    # Электроды без источника тока ничего не делают.
    "lab_electro_bench": dict(add=["effect_electric"], note="источник тока и импеданса"),
    "lab_sensitivity_arch": dict(add=["effect_electric"], note="сканирует зоны через электроды"),
    "lab_posture_chair": dict(add=["effect_electric"], note="наказание за сход — ток"),
    # Головки подачи и отсоса — это сопла; насос живёт в модуле.
    "lab_irrigation_station": dict(add=["effect_hydraulic"], note="подача жидкости"),
    "lab_fluid_collector": dict(add=["effect_hydraulic"], note="отсос и реверс контура"),
    # Воздушная форсунка без пневмо-модуля — просто сопло.
    "lab_feather_pod": dict(add=["effect_pneumatic"], note="воздушный поток"),
    # Портативный аппарат — носимая вибрирующая головка.
    "lab_portable_unit": dict(add=["work_attach_vibrating"], note="локальная вибрация"),
    # Ядро: добавлять модуль можно, снимать и переставлять — нельзя.
    "lab_mental_correction_chair": dict(add=["effect_electric"],
                                        note="контакты обусловливания без источника тока"),
}

# Ядро Mk-I не перебираем: это существующие сборки в игре.
CORE = {"lab_diagnostic_table", "lab_sex_machine_tickling", "lab_sex_machine_vaginal",
        "lab_sex_machine_anal", "lab_sex_machine_circularsaw",
        "lab_mental_correction_chair"}

RANK = {"STRUCTURE": 0, "MOTION": 1, "RESTRAINT": 6, "SURFACE": 7,
        "SENSORY": 8, "CONTROL": 9, "UTILITY": 10, "SERVICE": 11}
LAYER_RANK = {"base": 2, "preset": 2, "form": 3, "effect": 4, "rig": 5}


def rank(comp: dict) -> int:
    if comp.get("layer") in LAYER_RANK:
        return LAYER_RANK[comp["layer"]]
    if comp["class"] == "FLUID":
        return 2
    return RANK.get(comp["class"], 5)


def insert_ordered(modules: list[str], additions: list[str], by_id: dict) -> list[str]:
    out = list(modules)
    for cid in additions:
        r = rank(by_id[cid])
        pos = len(out)
        for i, m in enumerate(out):
            if rank(by_id[m]) > r:
                pos = i
                break
        out.insert(pos, cid)
    return out


def main() -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in cat["components"]}
    dc = json.loads(DEVICES.read_text(encoding="utf-8"))
    changed = []

    for d in dc["devices"]:
        spec = REWIRE.get(d["id"])
        if not spec:
            continue
        before = list(d.get("modules", []))
        if d["id"] in CORE:
            if spec.get("remove"):
                raise SystemExit(f"core device {d['id']}: снимать модули нельзя")
            extra = [m for m in (spec.get("add") or []) if m not in before]
            if extra:
                d["modules"] = before + extra
                changed.append({"device": d["id"], "removed": [], "added": extra,
                                "note": str(spec.get("note") or "") + " (ядро: только добавление)"})
            continue
        mods = [m for m in before if m not in spec.get("remove", [])]
        mods = [m for m in mods if m not in spec.get("add", [])]
        add_list: list[str] = spec.get("add") or []
        mods = insert_ordered(mods, add_list, by_id)
        missing = [m for m in mods if m not in by_id]
        if missing:
            raise SystemExit(f"{d['id']}: unknown modules {missing}")
        d["modules"] = mods
        if mods != before:
            changed.append({"device": d["id"], "removed": sorted(set(before) - set(mods)),
                            "added": [m for m in mods if m not in before],
                            "note": spec.get("note", "")})

    # Порядок модулей = цепочка слоёв. Ядро не трогаем: там порядок исторический.
    for d in dc["devices"]:
        if d["id"] in CORE:
            continue
        d["modules"] = sorted(d.get("modules", []), key=lambda m: rank(by_id[m]))

    # Индекс модулей устройства читает устройства.html для имён в составе.
    # Каталог компонентов — источник истины: имена и назначения синхронизируются,
    # иначе переименованная форма остаётся в составе под старым названием.
    index = {m["id"]: m for m in dc.setdefault("modules", [])}
    for c in cat["components"]:
        slots = c.get("slots") or {}
        iface = slots.get("in") or slots.get("slot") or ""
        row = index.get(c["id"])
        if row is None:
            row = {"id": c["id"]}
            dc["modules"].append(row)
            index[c["id"]] = row
        row.update({"class": c["class"], "name": c["name"], "purpose": c["purpose"],
                    "status": c.get("status", "concept"), "interface": iface})

    dc["revision"] = "0.2"
    dc["layerWiring"] = {
        "rule": "Устройство собирается как привод → база → форма → эффект → оснастка.",
        "coreProtected": sorted(CORE),
        "changed": len(changed),
    }
    DEVICES.write_text(json.dumps(dc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"changed": changed}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
