#!/usr/bin/env python3
"""Adopt finished 3D blockouts into the component catalog.

Reads each report.json from docs/plans/blockout/component-library/<id>/ and the
GLB itself, then fills model {file, prefix, nodes, bytes, status} in
component-catalog.json and component-models.json. Motion is NOT overwritten:
the declared motion in the catalog is what the contract generator uses.

Usage:
  python3 docs/plans/tools/adopt_component_models.py            # только отчёт
  python3 docs/plans/tools/adopt_component_models.py --write    # записать
"""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "public/models/machine-modules"
BLOCKOUT = ROOT / "docs/plans/blockout/component-library"
IDS = ["work_probe_combined", "effect_thermal", "effect_pneumatic",
       "effect_hydraulic", "effect_electric"]

# Отчёты дети пишут по-разному, а движение в каталоге — источник для контракта.
# Насос гоняет ротор: это пассивное вращение эффекта, не привод станка.
MOTION_OVERRIDE = {"effect_hydraulic": {"type": "spin", "axis": "y", "speed": 0.8}}


def glb_stats(path: Path) -> dict:
    b = path.read_bytes()
    clen, _ = struct.unpack("<II", b[12:20])
    j = json.loads(b[20:20 + clen])
    names = [n.get("name", "") for n in j.get("nodes", [])]
    return {"bytes": len(b), "nodes": len(names),
            "materials": len(j.get("materials", [])),
            "prefix_ok": all(n.startswith(path.stem + "__") for n in names if n)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    cat_path = BASE / "component-catalog.json"
    models_path = BASE / "component-models.json"
    cat = json.loads(cat_path.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in cat["components"]}
    registry = json.loads(models_path.read_text(encoding="utf-8"))

    rows, problems = [], []
    for cid in IDS:
        glb = BASE / "components" / f"{cid}.glb"
        rep_path = BLOCKOUT / cid / "report.json"
        if not glb.exists() or not rep_path.exists():
            problems.append(f"{cid}: нет GLB или report.json")
            continue
        rep = json.loads(rep_path.read_text(encoding="utf-8"))
        st = glb_stats(glb)
        c = by_id.get(cid)
        if c is None:
            problems.append(f"{cid}: нет в каталоге")
            continue
        if not st["prefix_ok"]:
            problems.append(f"{cid}: узлы без префикса {cid}__")
        if not rep.get("bbox_ok"):
            problems.append(f"{cid}: bbox_ok=false")
        if rep.get("material_count", 0) < 4:
            problems.append(f"{cid}: материалов {rep.get('material_count')} < 4")
        motion = MOTION_OVERRIDE.get(cid) or (c.get("model") or {}).get("motion") or {"type": "none"}
        bbox_mm = rep.get("bbox_size_mm")
        if not bbox_mm and rep.get("bbox_size"):
            bbox_mm = [round(float(v) * 1000, 1) for v in rep["bbox_size"]]
        passport = rep.get("bbox_passport")
        passport_mm = [round(float(v) * 1000, 1) for v in passport] if passport else None
        pivot = rep.get("pivot_shift_mm")
        if pivot is None and rep.get("pivot_shift_m") is not None:
            pivot = round(float(rep["pivot_shift_m"]) * 1000, 4)
        moving = rep.get("moving_nodes") or rep.get("anim_children") or []
        rows.append({
            "id": cid, "code": c.get("code"), "nodes": st["nodes"],
            "materials": st["materials"], "bytes": st["bytes"],
            "bbox_mm": bbox_mm, "passport_mm": passport_mm,
            "bbox_ok": rep.get("bbox_ok"), "pivot_mm": pivot,
            "motion": motion.get("type"), "moving": len(moving),
        })
        if args.write:
            c["model"] = {
                "file": f"components/{cid}.glb", "prefix": cid, "nodes": st["nodes"],
                "bytes": st["bytes"], "status": "refined",
                "motion": motion,
                "materials": st["materials"],
                "bbox_mm": bbox_mm,
            }
            registry[cid] = {
                "file": f"components/{cid}.glb", "prefix": cid, "class": c["class"],
                "status": c.get("status", "concept"), "bytes": st["bytes"],
                "nodes": st["nodes"], "motion": motion.get("type", "none"),
            }

    for r in rows:
        print(f"{r['id']:22} {r['code']:10} nodes={r['nodes']:3} mats={r['materials']} "
              f"{r['bytes']//1024:4} KB  bbox={r['bbox_mm']} паспорт={r['passport_mm']} "
              f"pivot={r['pivot_mm']} motion={r['motion']} движ={r['moving']}")
    print("\nпроблемы:", problems or "нет")
    if args.write:
        cat_path.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        models_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                               encoding="utf-8")
        print(f"записано: {len(rows)} моделей в каталог и реестр")
    else:
        print("(dry-run: без записи)")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
