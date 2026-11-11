#!/usr/bin/env python3
"""Copy validated kinematics into the component catalog for the runtime viewer.

Only coupled mechanisms are copied for now; simple spin/slide/scale continue to
use the compact `model.motion` path.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "public/models/machine-modules"
CAT = BASE / "component-catalog.json"
CON = BASE / "component-contracts.json"
COUPLED = {"motion_piston_cam", "motion_linear_x", "motion_oscillating"}


def main():
    cat = json.loads(CAT.read_text(encoding="utf-8"))
    con = json.loads(CON.read_text(encoding="utf-8"))["components"]
    changed = []
    for c in cat["components"]:
        cid = c["id"]
        if cid in COUPLED:
            c["model"]["kinematics"] = con[cid]["kinematics"]
            changed.append(cid)
    CAT.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wired", len(changed), changed)


if __name__ == "__main__":
    main()
