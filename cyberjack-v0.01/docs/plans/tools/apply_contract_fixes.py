#!/usr/bin/env python3
"""Contract layer for mount fixes, batch 1 (data-only).

Brings `component-contracts.json` in line with the corrected mate points:
mechanical outputs/inputs, `provides` specs and self-referential `requires`
values. Only the ports touched in batch 1 change; nothing else is rewritten.

Run after apply_mount_fixes.py + assign_connectors.py, before
check_component_contracts.py.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "public" / "models" / "machine-modules" / "component-contracts.json"

# (component, port id) -> full replacement body (id/direction preserved)
PORTS = {
    # ---- motion: реальные выходы вместо ISO 9409-1-50-4-M6 ----
    ("motion_oscillating", "tool_out"): {
        "kind": "clamp", "standard": "CJ-OSC-PLATE 32×106", "gender": "female",
        "load_n": 120, "connector": "CJ-OSC-PLATE",
        "conditions": ["tool_mass_kg<=1.5", "clamp_force_n>=200",
                       "axial_runout_mm<=0.30", "no_through_bore_needed"],
    },
    ("motion_lift_z", "tool_out"): {
        "kind": "clamp", "standard": "CJ-TOOL-PLATE 264×42", "gender": "female",
        "load_n": 120, "connector": "CJ-TOOL-PLATE",
        "conditions": ["tool_mass_kg<=3.0", "clamp_force_n>=300",
                       "flatness_mm<=0.2", "axial_runout_mm<=0.30"],
    },
    ("motion_linear_x", "tool_out"): {
        "kind": "surface", "standard": "CJ-TOOL-PLATE 208×252", "gender": "female",
        "load_n": 120, "connector": "CJ-TOOL-PLATE",
        "conditions": ["tool_mass_kg<=3.0", "flatness_mm<=0.2",
                       "clamp_span_mm<=252", "axial_runout_mm<=0.30"],
    },
    ("motion_linear_y", "tool_out"): {
        "kind": "clamp", "standard": "CJ-TOOL-PLATE 150×150 (quick_plate 210×210)",
        "gender": "female", "load_n": 120, "connector": "CJ-TOOL-PLATE",
        "conditions": ["tool_mass_kg<=2.0", "clamp_force_n>=300",
                       "plate_square_mm=210", "axial_runout_mm<=0.30"],
    },
    ("motion_rotary", "tool_out"): {
        "kind": "clamp", "standard": "CJ-TOOL-CHUCK-43", "gender": "female",
        "count": 3, "load_n": 120, "connector": "CJ-TOOL-CHUCK-43",
        "conditions": ["tool_shank_d_mm=40..43", "tool_mass_kg<=2.0",
                       "torque_nm<=12", "runout_mm<=0.05"],
    },
    ("motion_turntable", "tool_out"): {
        "kind": "surface", "standard": "CJ-TABLE-T900", "gender": "female",
        "count": 4, "load_n": 1471.5, "connector": "CJ-TABLE-T900",
        "conditions": ["tool_mass_kg<=40", "slot_width_mm=12.5",
                       "slot_radius_mm=300", "axial_runout_mm<=0.50"],
    },

    # ---- поршни: вилка/палец, ось Z, count 1 ----
    ("motion_piston_rod", "tool_out"): {
        "kind": "pivot", "standard": "CJ-CLEVIS-8 (палец Ø7,6)", "gender": "female",
        "count": 1, "load_n": 300, "connector": "CJ-CLEVIS-8",
        "conditions": ["radial_load_n<=300", "pin_d_mm=7.5..8.0",
                       "clevis_width_mm<=22"],
    },
    ("motion_piston_pneumatic", "rod_out"): {
        "kind": "pivot", "standard": "палец Ø6,4 (вне CJ-CLEVIS-8)", "gender": "female",
        "count": 1, "load_n": 300, "connector": "custom",
        "conditions": ["radial_load_n<=150", "pin_d_mm=6.4",
                       "adapter_clevis_required"],
    },
    ("motion_piston_hydraulic", "tool_out"): {
        "kind": "pivot", "standard": "CJ-CLEVIS-8 (палец Ø8,8)", "gender": "female",
        "count": 1, "load_n": 500, "connector": "CJ-CLEVIS-8",
        "conditions": ["radial_load_n<=500", "pin_d_mm=8.5..9.0",
                       "clevis_width_mm<=28"],
    },
    ("motion_piston_telescopic", "tool_out"): {
        "kind": "pivot", "standard": "CJ-CLEVIS-8 (палец Ø7,5)", "gender": "female",
        "count": 1, "load_n": 150, "connector": "CJ-CLEVIS-8",
        "conditions": ["radial_load_n<=150", "pin_d_mm=7.5..8.0",
                       "clevis_width_mm<=20"],
    },
    ("motion_piston_cam", "tool_out"): {
        "kind": "flange", "standard": "фланец Ø50 + площадка Ø30, 4×Ø6 PCD 34",
        "gender": "female", "count": 4, "pitch_m": 0.034, "load_n": 100,
        "connector": "custom",
        "conditions": ["axial_force_n<=100", "bolt_d_mm=6", "pcd_mm=34"],
    },
    ("motion_piston_servo", "tool_out"): {
        "kind": "pivot", "standard": "CJ-CLEVIS-8 (палец Ø8,4)", "gender": "female",
        "count": 1, "load_n": 400, "connector": "CJ-CLEVIS-8",
        "conditions": ["radial_load_n<=400", "pin_d_mm=8.0..8.5",
                       "clevis_width_mm<=24"],
    },

    # ---- зонды: фактический вход вместо байонета 20/25 ----
    ("work_probe_linear", "tool_in"): {
        "kind": "clamp", "standard": "быстросъёмная муфта Ø42 + цанга Ø35",
        "gender": "female", "connector": "custom",
        "conditions": ["tool_mass_kg<=1.2", "runout_mm<=0.15",
                       "retention_force_n>=120", "coupler_d_mm=42"],
    },
    ("work_probe_rotary", "tool_in"): {
        "kind": "dock", "standard": "ротационный док Ø58, 4 усика до Ø66,8, 2 паза",
        "gender": "female", "count": 4, "connector": "custom",
        "conditions": ["tool_mass_kg<=1.5", "runout_mm<=0.15",
                       "retention_force_n>=250", "dock_d_mm=58"],
    },
    ("work_probe_inflatable", "tool_in"): {
        "kind": "bayonet", "standard": "байонетное гнездо Ø54, 2 усика до Ø65,5, обойма Ø59",
        "gender": "female", "count": 2, "connector": "custom",
        "conditions": ["tool_mass_kg<=1.2", "runout_mm<=0.15",
                       "retention_force_n>=250", "socket_d_mm=52..54.5"],
    },
    ("work_probe_thermal", "tool_in"): {
        "kind": "bayonet", "standard": "байонетная плита Ø38, 2 уха до Ø51,6, кольцо Ø32,4",
        "gender": "female", "count": 2, "connector": "custom",
        "conditions": ["tool_mass_kg<=1.2", "runout_mm<=0.15",
                       "retention_force_n>=250", "plate_d_mm=38"],
    },
    ("work_probe_textured", "tool_in"): {
        "kind": "clamp", "standard": "QR-обойма Ø48 с фиксатором и штифтом",
        "gender": "female", "connector": "CJ-TOOL-B50",
        "conditions": ["tool_mass_kg<=1.2", "runout_mm<=0.15",
                       "retention_force_n>=120", "collar_d_mm=48"],
    },

    # ---- переходник: гнездо Ø20 / Ø25, буртик Ø30, шестигранник 24 ----
    ("work_attach_adapter", "flange_in"): {
        "kind": "clamp", "standard": "гнездо Ø20 H8 + разрезная цанга, буртик Ø30",
        "gender": "female", "load_n": 400, "connector": "CJ-TOOL-B25",
        "conditions": ["shank_d_mm=20", "runout_mm<=0.05",
                       "bushing_20_to_25_required"],
    },
    ("work_attach_adapter", "tool_out"): {
        "kind": "clamp", "standard": "посадка Ø25 H8 + разрезная цанга, канал Ø8,4",
        "gender": "female", "load_n": 200, "connector": "CJ-TOOL-B25",
        "conditions": ["tool_shank_d_mm=25", "retention_force_n>=120",
                       "tool_mass_kg<=1.2"],
    },
}

# extra output ports that exist in geometry but were missing from the contract
NEW_OUTPUTS = {
    "motion_lift_z": [{
        "id": "tool_boss_out", "direction": "out", "kind": "flange",
        "standard": "CJ-TOOL-BOSS-60", "gender": "female", "load_n": 120,
        "connector": "CJ-TOOL-BOSS-60",
        "conditions": ["tool_mass_kg<=2.0", "centring_d_mm=60",
                       "axial_runout_mm<=0.30"],
    }],
    "motion_rotary": [{
        "id": "flange_out", "direction": "out", "kind": "flange",
        "standard": "фланец Ø144, 6 × Ø8,8 PCD 116", "gender": "female",
        "count": 6, "pitch_m": 0.116, "load_n": 120, "connector": "custom",
        "conditions": ["tool_mass_kg<=2.0", "bolt_d_mm=8.8", "pcd_mm=116"],
    }],
}

# provides[].spec for a port
PROVIDES = {
    ("motion_oscillating", "tool_out"): "CJ-OSC-PLATE 32×106 (хомут, ось хода X)",
    ("motion_lift_z", "tool_out"): "CJ-TOOL-PLATE 264×42 (плита моста, ход Y)",
    ("motion_lift_z", "tool_boss_out"): "CJ-TOOL-BOSS-60 (бобышка Ø60, ось +Z)",
    ("motion_linear_x", "tool_out"): "CJ-TOOL-PLATE 208×252 (плита carriage_top)",
    ("motion_linear_y", "tool_out"): "CJ-TOOL-PLATE 150×150 на quick_plate 210×210",
    ("motion_rotary", "tool_out"): "CJ-TOOL-CHUCK-43 (3 кулака, ось +X)",
    ("motion_rotary", "flange_out"): "фланец Ø144, 6 × Ø8,8 PCD 116",
    ("motion_turntable", "tool_out"): "CJ-TABLE-T900 (Ø900, 4 T-паза r=300)",
    ("motion_piston_rod", "tool_out"): "CJ-CLEVIS-8, палец Ø7,6 по Z",
    ("motion_piston_pneumatic", "rod_out"): "вилка + палец Ø6,4 по Z (подразмер CJ-CLEVIS-8)",
    ("motion_piston_hydraulic", "tool_out"): "CJ-CLEVIS-8, палец Ø8,8 по Z",
    ("motion_piston_telescopic", "tool_out"): "CJ-CLEVIS-8, палец Ø7,5 по Z",
    ("motion_piston_cam", "tool_out"): "фланец Ø50 + площадка Ø30, 4×Ø6 PCD 34",
    ("motion_piston_servo", "tool_out"): "CJ-CLEVIS-8, палец Ø8,4 по Z",
    ("work_attach_adapter", "flange_in"): "гнездо Ø20 H8 + цанга, буртик Ø30, шестигранник 24",
    ("work_attach_adapter", "tool_out"): "посадка Ø25 H8 + цанга, канал Ø8,4",
}

# self-referential compatibility values that carried the old standards
REQUIRES_VALUE = {
    ("work_probe_linear", "mate.tool_in.standard"): "быстросъёмная муфта Ø42 + цанга Ø35",
    ("work_probe_rotary", "mate.tool_in.standard"): "ротационный док Ø58, 4 усика до Ø66,8, 2 паза",
    ("work_probe_inflatable", "mate.tool_in.standard"): "байонетное гнездо Ø54, 2 усика до Ø65,5, обойма Ø59",
    ("work_probe_thermal", "mate.tool_in.standard"): "байонетная плита Ø38, 2 уха до Ø51,6, кольцо Ø32,4",
    ("work_probe_textured", "mate.tool_in.standard"): "QR-обойма Ø48 с фиксатором и штифтом",
    ("work_attach_adapter", "mate.mechanical.flange_in.standard"): "гнездо Ø20 H8 + разрезная цанга, буртик Ø30",
    ("work_attach_adapter", "mate.tool_out.standard"): "посадка Ø25 H8 + разрезная цанга, канал Ø8,4",
}


def main() -> int:
    doc = json.loads(CONTRACTS.read_text(encoding="utf-8"))
    comps = doc["components"]
    touched = set()
    missing = []
    errors = []

    for (cid, pid), body in PORTS.items():
        c = comps.get(cid)
        if not c:
            missing.append(f"{cid}/{pid}: no contract")
            continue
        mech = c["interfaces"].setdefault("mechanical", {"inputs": [], "outputs": []})
        found = None
        for grp in ("inputs", "outputs"):
            for port in mech.get(grp, []):
                if port.get("id") == pid:
                    found = port
                    break
            if found:
                break
        if not found:
            missing.append(f"{cid}/{pid}: no port")
            continue
        direction = found.get("direction")
        found.clear()
        found.update({"id": pid, "direction": direction})
        found.update(body)
        touched.add(cid)

    for cid, ports in NEW_OUTPUTS.items():
        c = comps[cid]
        mech = c["interfaces"].setdefault("mechanical", {"inputs": [], "outputs": []})
        outs = mech.setdefault("outputs", [])
        for port in ports:
            if any(p.get("id") == port["id"] for p in outs):
                continue
            outs.append(json.loads(json.dumps(port)))
        touched.add(cid)
        # add matching provides entry
        provs = c["compatibility"].setdefault("provides", [])
        for port in ports:
            if not any(p.get("port") == port["id"] for p in provs):
                provs.append({"port": port["id"],
                              "spec": PROVIDES.get((cid, port["id"]), port["standard"])})

    for (cid, pid), spec in PROVIDES.items():
        c = comps.get(cid)
        if not c:
            continue
        for prov in c["compatibility"].get("provides", []):
            if prov.get("port") == pid:
                if prov.get("spec") != spec:
                    prov["spec"] = spec
                break
        else:
            c["compatibility"].setdefault("provides", []).append({"port": pid, "spec": spec})

    for (cid, target), value in REQUIRES_VALUE.items():
        applied = False
        for rule in comps[cid]["compatibility"].get("requires", []):
            if rule.get("target") == target:
                rule["value"] = value
                applied = True
        if not applied:
            missing.append(f"{cid}: requires rule {target} not found")

    # sanity: no ISO 9409 / 20-25 claims left on the batch-1 ports
    for (cid, pid) in PORTS:
        for grp in ("inputs", "outputs"):
            for port in comps[cid]["interfaces"]["mechanical"].get(grp, []):
                if port.get("id") == pid:
                    s = json.dumps(port, ensure_ascii=False)
                    if "ISO 9409" in s or "20/25 mm" in s:
                        errors.append(f"{cid}/{pid}: stale standard in contract")

    CONTRACTS.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")
    print(json.dumps({
        "components_touched": len(touched),
        "ports_replaced": len(PORTS),
        "ports_added": sum(len(v) for v in NEW_OUTPUTS.values()),
        "provides_updated": len(PROVIDES),
        "requires_updated": len(REQUIRES_VALUE),
        "missing": missing,
        "errors": errors,
    }, ensure_ascii=False, indent=1))
    return 1 if (missing or errors) else 0


if __name__ == "__main__":
    sys.exit(main())
