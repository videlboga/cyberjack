#!/usr/bin/env python3
"""Merge mate-point shards into component-catalog.json and component-mates.json.

Reads docs/plans/mates/*.json (except schema.md), validates against the
catalog, writes:

  public/models/machine-modules/component-mates.json
  public/models/machine-modules/component-catalog.json  (adds .mates)

Never touches GLBs or contracts.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MODELS = ROOT / "public" / "models" / "machine-modules"
SHARDS = ROOT / "docs" / "plans" / "mates"
CATALOG = MODELS / "component-catalog.json"
OUT = MODELS / "component-mates.json"

ROLES = {"input", "output", "support", "mount", "fluid", "signal", "power"}
KINDS = {"bolt_pattern", "flange", "bayonet", "dock", "rail", "clamp",
         "surface", "hose", "cable", "pivot", "mount"}


def vec(v, n=3):
    return isinstance(v, list) and len(v) >= n and all(isinstance(x, (int, float)) for x in v[:n])


def check_point(cid, m, errs):
    if not isinstance(m, dict):
        errs.append(f"{cid}: mate is not object")
        return
    mid = m.get("id")
    if not mid:
        errs.append(f"{cid}: mate without id")
    if m.get("role") not in ROLES:
        errs.append(f"{cid}/{mid}: bad role {m.get('role')!r}")
    if m.get("kind") not in KINDS:
        errs.append(f"{cid}/{mid}: bad kind {m.get('kind')!r}")
    if not vec(m.get("position_m")):
        errs.append(f"{cid}/{mid}: bad position_m")
    for key in ("normal", "axis"):
        if key in m and not vec(m[key]):
            errs.append(f"{cid}/{mid}: bad {key}")
    if m.get("confidence") not in {"high", "medium", "low"}:
        errs.append(f"{cid}/{mid}: bad confidence {m.get('confidence')!r}")
    if not m.get("source"):
        errs.append(f"{cid}/{mid}: missing source")


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    comps = {c["id"]: c for c in catalog.get("components", [])}
    merged = {}
    errors = []
    shard_files = sorted(p for p in SHARDS.glob("*.json") if p.is_file())
    for path in shard_files:
        try:
            shard = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"{path.name}: {e}")
            continue
        group = shard.get("group", path.stem)
        data = shard.get("components", {})
        for cid, entry in data.items():
            if cid not in comps:
                errors.append(f"{path.name}: unknown component {cid}")
                continue
            if cid in merged:
                errors.append(f"{path.name}: duplicate {cid} (already {merged[cid]['group']})")
                continue
            mates = entry.get("mates") or []
            if not mates:
                errors.append(f"{path.name}/{cid}: no mates")
            for m in mates:
                check_point(cid, m, errors)
            merged[cid] = {
                "group": group,
                "class": entry.get("class") or comps[cid].get("class"),
                "mates": mates,
                "shard": path.name,
            }
    missing = sorted(set(comps) - set(merged))
    for cid in missing:
        errors.append(f"missing component {cid}")
    # write dedicated file regardless so a partial run is visible
    OUT.write_text(json.dumps({
        "format": "cj-mate-points/1",
        "count": len(merged),
        "missing": missing,
        "components": {k: v for k, v in sorted(merged.items())},
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # catalog gets only validated points; leave previous mates if this shard
    # set is partial? For now assign all merged, and mark missing count.
    for cid, c in comps.items():
        if cid in merged:
            c["mates"] = merged[cid]["mates"]
    catalog["mates"] = {
        "format": "cj-mate-points/1",
        "count": len(merged),
        "points": sum(len(v["mates"]) for v in merged.values()),
        "total_components": len(comps),
        "missing": missing,
        "shards": [p.name for p in shard_files],
    }
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "shards": [p.name for p in shard_files],
        "merged_components": len(merged),
        "missing": len(missing),
        "errors": errors[:40],
        "error_count": len(errors),
    }, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
