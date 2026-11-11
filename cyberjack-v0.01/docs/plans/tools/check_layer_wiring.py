#!/usr/bin/env python3
"""Validate layer wiring between the component catalog and the device catalog.

Checks
  1. every device module id exists in the catalog;
  2. every effect module and every pen base is used by at least one device;
  3. no device combines parts a `forbid` reject rule separates;
  4. a device that lists a contact with an effect socket also lists that module
     (core Mk-I devices are reported as info, not errors);
  5. device module order follows the layer chain structure → drive → base →
     form → effect → rig → restraint → control.

Exit code 1 on errors. Writes docs/plans/checks/layer-wiring.json.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "public/models/machine-modules"
OUT = ROOT / "docs/plans/checks/layer-wiring.json"

LAYER_RANK = {"base": 2, "preset": 2, "form": 3, "effect": 4, "rig": 5}
CLASS_RANK = {"STRUCTURE": 0, "MOTION": 1, "FLUID": 2, "RESTRAINT": 6,
              "SURFACE": 7, "SENSORY": 8, "CONTROL": 9, "UTILITY": 10, "SERVICE": 11}


def rank(c: dict) -> int:
    if c.get("layer") in LAYER_RANK:
        return LAYER_RANK[c["layer"]]
    return CLASS_RANK.get(c["class"], 5)


def main() -> int:
    cat = json.loads((BASE / "component-catalog.json").read_text(encoding="utf-8"))
    dc = json.loads((BASE / "device-catalog.json").read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in cat["components"]}
    findings = []

    def add(sev, dev, code, msg, detail=None):
        findings.append({"severity": sev, "device": dev, "code": code,
                         "message": msg, "detail": detail})

    used = {}
    for d in dc["devices"]:
        mods = d.get("modules", [])
        for m in mods:
            if m not in by_id:
                add("error", d["id"], "unknown_module", f"Неизвестный модуль {m}")
                continue
            used.setdefault(m, []).append(d["id"])
        for m in mods:
            if m not in by_id:
                continue
        # forbid rules between parts of one device
        for m in mods:
            c = by_id.get(m)
            if not c:
                continue
            for r in c.get("rejects") or []:
                if r.get("kind") != "forbid":
                    continue
                others = [x for x in mods if x != m]
                for o in others:
                    oc = by_id.get(o)
                    if not oc:
                        continue
                    if r["target"] == "form.subtype" and oc.get("layer") == "form" and oc.get("subtype") in r["value"]:
                        add("error", d["id"], "reject_form", f"{m} несовместим с формой {o}", r)
                    if r["target"] == "effect.type" and oc.get("layer") == "effect" and oc.get("subtype") in r["value"]:
                        add("error", d["id"], "reject_effect", f"{m} несовместим с эффектом {o}", r)
                    if r["target"] == "drive.modality" and r["value"] == "impact" and o == "work_impact_paddle":
                        add("error", d["id"], "reject_impact", f"{m} несовместим с ударом")
        # contact with effect socket must have its module
        listed_effects = {by_id[m].get("subtype") for m in mods
                          if m in by_id and by_id[m].get("layer") == "effect"}
        for m in mods:
            c = by_id.get(m)
            if not c:
                continue
            # Гнёзда эффектов у базы-зонда — это возможности, а не требования.
            # Обязателен модуль только там, где сам контакт бесполезен без физики.
            needs = (c.get("slots") or {}).get("effect") or []
            required = c.get("slots", {}).get("effectRequired")
            if required is None:
                required = needs if (c.get("subtype") == "spec" or c.get("class") == "FLUID") else []
            for need in required:
                if need in listed_effects:
                    continue
                sev = "info" if d.get("status") == "core" else "error"
                add(sev, d["id"], "missing_effect",
                    f"{c['name']} требует модуль эффекта «{need}», в составе его нет")
        # order
        ranks = [rank(by_id[m]) for m in mods if m in by_id]
        if ranks != sorted(ranks):
            sev = "info" if d.get("status") == "core" else "warn"
            add(sev, d["id"], "order", "Модули идут не по цепочке слоёв",
                {"modules": mods})

    for c in cat["components"]:
        if c.get("layer") == "effect" and c["id"] not in used:
            add("error", "-", "effect_unused", f"Эффект {c['id']} не входит ни в одно устройство")
        if c.get("layer") == "base" and c.get("subtype") in ("linear", "rotary", "combined") \
                and c["id"] not in used:
            add("error", "-", "base_unused", f"База {c['id']} не входит ни в одно устройство")

    counts = {}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    errors = counts.get("error", 0)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"format": "cj-layer-wiring/1", "devices": len(dc["devices"]),
                               "findings": findings, "counts": counts,
                               "status": "pass" if not errors else "fail"},
                              ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for f in findings:
        print(f"{f['severity']:5} {f['code']:16} {f['device']:28} {f['message']}")
    print(json.dumps({"devices": len(dc["devices"]), "counts": counts,
                      "report": str(OUT)}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
