#!/usr/bin/env python3
"""Integrate the 10 "hard" restraint variants into component-catalog.json.

Read-only source of truth for the added mate point:
  docs/plans/checks/restraint-hard-mount-spec.json  (components[].mate_added)
Geometry metadata (nodes) comes from the per-component report.json:
  docs/plans/blockout/component-library/<id>_hard/report.json
bytes are taken from the GLB on disk.

What it changes, per component (10 targets only):
  variants          += "жёсткое крепление"
  model.variants     = [ flexible (default), hard ]
  mates             += latch_out (CJ-LATCH-30, custom connector, variant="hard")

Existing flexible model, mates and every other component are left untouched.
Idempotent: re-running rewrites the same values.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MM = os.path.join(ROOT, "public/models/machine-modules")
CAT = os.path.join(MM, "component-catalog.json")
SPEC = os.path.join(ROOT, "docs/plans/checks/restraint-hard-mount-spec.json")
LIB = os.path.join(ROOT, "docs/plans/blockout/component-library")

HARD_VARIANT_LABEL = "жёсткое крепление"


def rel(path):
    return os.path.relpath(path, ROOT)


def checks_of(rep):
    """Проверки из отчёта в одном виде для двух схем.

    Схема A (cj-restraint-hard/1): отчёт уже содержит готовый dict checks.
    Схема B (первые сборки): поля плоские — glb_ok / bbox_ok / floor_ok /
    contact_ok + списки недостающих и лишних узлов. Значения копируются как
    есть (без «приведения» к true), чтобы отчёт оставался проверяемым.
    """
    if isinstance(rep.get("checks"), dict):
        return rep["checks"]
    out = {}
    for k in ("glb_ok", "bbox_ok", "floor_ok", "contact_ok", "glb_prefix_ok"):
        if k in rep:
            out[k] = rep[k]
    for k in ("added_nodes_missing_vs_spec", "added_nodes_extra_vs_spec",
              "removed_nodes", "bad_names"):
        if k in rep:
            out[k] = rep[k]
    return out or None


def envelope_of(rep):
    """Габарит варианта: (new_m, fits, old_m, delta_max_mm).

    Схема A даёт envelope_new/envelope_fits (в осях glTF, относительно
    паспортного габарита каталога). Схема B даёт спек-габарит
    envelope_new_spec/envelope_old_spec и максимальную прибавку в мм;
    флага fits в ней нет — он не выдумывается.
    """
    if "envelope_new" in rep:
        return rep.get("envelope_new"), rep.get("envelope_fits"), None, None
    return (rep.get("envelope_new_spec"), None,
            rep.get("envelope_old_spec"), rep.get("envelope_delta_max_mm"))


def main():
    cat = json.load(open(CAT, encoding="utf-8"))
    spec = json.load(open(SPEC, encoding="utf-8"))
    comps = {c["id"]: c for c in cat["components"]}

    touched = []
    for sc in spec["components"]:
        cid = sc["id"]
        c = comps[cid]
        model = c["model"]

        hard_rel = "components/%s_hard.glb" % cid
        hard_abs = os.path.join(MM, hard_rel)
        flex_abs = os.path.join(MM, model["file"])
        rep_rel = "docs/plans/blockout/component-library/%s_hard/report.json" % cid
        rep = json.load(open(os.path.join(ROOT, rep_rel), encoding="utf-8"))

        # --- component-level variants (human-readable list) ---
        variants = list(c.get("variants") or [])
        if HARD_VARIANT_LABEL not in variants:
            variants.append(HARD_VARIANT_LABEL)
        c["variants"] = variants

        # --- model.variants: flexible (default) + hard ---
        env_new, env_fits, env_old, env_delta = envelope_of(rep)
        flex_entry = {
            "id": "flexible",
            "label": "Гибкий",
            "file": model["file"],
            "prefix": model["prefix"],
            "nodes": model.get("nodes"),
            "bytes": os.path.getsize(flex_abs),
            "quality": model.get("quality"),
            "default": True,
        }
        hard_entry = {
            "id": "hard",
            "label": "Жёсткий",
            "file": hard_rel,
            "prefix": cid,
            "nodes": rep["nodes"],
            "bytes": os.path.getsize(hard_abs),
            "quality": "hard-mount",
            "report": rep_rel,
            "standard": rep.get("spec") or rep.get("standard"),
            "format": rep.get("format"),
            "load_n": rep.get("load_n"),
            "envelope_new_m": env_new,
            "envelope_old_m": env_old,
            "envelope_delta_max_mm": env_delta,
            "envelope_fits": env_fits,
            "checks": checks_of(rep),
        }
        model["variants"] = [flex_entry, hard_entry]
        model["variant_default"] = "flexible"

        # --- latch_out mate (from the mount spec) ---
        ma = sc["mate_added"]
        add_nodes = sc.get("add_nodes") or []
        tongue = "hard_tongue" if "hard_tongue" in add_nodes else None
        source = "spec: docs/plans/checks/restraint-hard-mount-spec.json → %s.mate_added" % cid
        if tongue:
            source += "; узел %s__%s (отверстие языка)" % (cid, tongue)
        latch = {
            "id": "latch_out",
            "role": ma["role"],
            "kind": ma["kind"],
            "standard": ma["standard"],
            "gender": ma["gender"],
            "position_m": ma["position_m"],
            "normal": ma["normal"],
            "axis": ma["axis"],
            "size_m": ma["size_m"],
            "load_n": ma["load_n"],
            "source": source,
            "confidence": "high",
            "note": (
                "Жёсткое крепление: язык уходит в гнездо CJ-LATCH-30 на каретке/кронштейне "
                "матрицы (приём — гнездо, не входит в GLB фиксатора). Точка есть только у "
                "hard-варианта — в гибком GLB узла языка нет."
            ),
            "connector": ma.get("connector") or "custom",
            "connector_note": ma.get("connector_note"),
            "variant": "hard",
        }
        mates = [m for m in (c.get("mates") or []) if m.get("id") != "latch_out"]
        mates.append(latch)
        c["mates"] = mates

        touched.append({
            "id": cid,
            "code": c["code"],
            "nodes": rep["nodes"],
            "bytes": hard_entry["bytes"],
            "position_m": ma["position_m"],
            "standard": ma["standard"],
            "load_n": ma["load_n"],
        })

    cat["revision"] = cat.get("revision") or "0.1"
    with open(CAT, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("updated", rel(CAT), os.path.getsize(CAT), "bytes")
    for t in touched:
        print("  %-26s %-9s nodes=%3d bytes=%7d  latch=%s @ %s" % (
            t["id"], t["code"], t["nodes"], t["bytes"], t["standard"], t["position_m"]))
    print("components touched:", len(touched))


if __name__ == "__main__":
    main()
