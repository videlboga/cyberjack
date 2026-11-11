#!/usr/bin/env python3
"""Откат archive-batch1: вернуть 12 компонентов из статуса archived.

Что делает:
  1. status := archivedFromStatus (обычно "concept");
  2. удаляет поля archivedFromStatus, archivedAt, archiveReason, replacedBy,
     mergedInto, archiveBatch;
  3. ничего больше не трогает — GLB, контракты, mates, устройства не менялись.

Использование:
  python3 docs/plans/tools/archive-batch1-rollback.py --dry-run
  python3 docs/plans/tools/archive-batch1-rollback.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
CATALOG = os.path.join(ROOT, "public/models/machine-modules/component-catalog.json")
BATCH = "batch1"
DROP = ("archivedFromStatus", "archivedAt", "archiveReason", "replacedBy", "mergedInto", "archiveBatch")


def main() -> int:
    dry = "--dry-run" in sys.argv
    data = json.load(open(CATALOG, encoding="utf-8"))
    changed = []
    for c in data.get("components", []):
        if c.get("status") != "archived" or c.get("archiveBatch") != BATCH:
            continue
        changed.append((c["id"], c.get("status"), c.get("archivedFromStatus", "concept")))
        if dry:
            continue
        c["status"] = c.get("archivedFromStatus") or "concept"
        for k in DROP:
            c.pop(k, None)
    if changed and not dry:
        with open(CATALOG, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    for cid, frm, to in changed:
        print(f"{cid}: {frm} -> {to}")
    print(f"{'[dry-run] ' if dry else ''}reverted {len(changed)} component(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
