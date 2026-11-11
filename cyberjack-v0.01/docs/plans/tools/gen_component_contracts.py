#!/usr/bin/env python3
"""Generate machine-readable component contracts for the 96-component library.

The contract is a *concept* interface model: concrete ports, DOF, phase-coupled
kinematics and structured compatibility rules. It is intentionally data-only;
the catalog viewer and the passport remain the source of prose and appearance.
"""
from __future__ import annotations
import json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CATALOG = ROOT / "public/models/machine-modules/component-catalog.json"
OUT = ROOT / "public/models/machine-modules/component-contracts.json"

PITCH = 0.6
M12_LOAD = 1471.0  # N, conservative fiction value for one M12 anchor
CAM_PROFILE = [0.06011, 0.064348, 0.067157, 0.071285, 0.075237, 0.078935, 0.081221, 0.084333, 0.087008, 0.089194, 0.090847, 0.091635, 0.092331, 0.092464, 0.092331, 0.091635, 0.090847, 0.089194, 0.087008, 0.084333, 0.081221, 0.078935, 0.075237, 0.071285, 0.067157, 0.064348, 0.06011, 0.05592, 0.05186, 0.048011, 0.045602, 0.042274, 0.039349, 0.036885, 0.035523, 0.033932, 0.032911, 0.032479, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032464, 0.032479, 0.032911, 0.033932, 0.035523, 0.036885, 0.039349, 0.042274, 0.045602, 0.048011, 0.05186, 0.05592]  # m, 5-degree samples in the lobe plane, measured from GLB
CAM_R0 = 0.060110

def port(pid, direction, kind, **kw):
    d = {"id": pid, "direction": direction, "kind": kind}
    d.update({k: v for k, v in kw.items() if v is not None})
    return d

def rule(target, op, value, tol=None, reason=None):
    r = {"target": target, "op": op, "value": value}
    if tol is not None:
        r["tol"] = tol
    if reason:
        r["reason"] = reason
    return r

def mechanical_input(standard="M12", count=4, pitch=PITCH, load=1200, gender="female"):
    return port("mount_in", "in", "bolt_pattern", standard=standard, count=count,
                pitch_m=pitch, gender=gender, load_n=load,
                conditions=["flatness_mm<=2", "anchor_engagement_mm>=60",
                            "hole_pattern_tolerance_mm<=0.5"])

def mechanical_output(standard="M12", count=4, pitch=PITCH, load=1200, gender="female"):
    return port("mount_out", "out", "bolt_pattern", standard=standard, count=count,
                pitch_m=pitch, gender=gender, load_n=load,
                conditions=["mating_flatness_mm<=2", "bolt_torque_nm=55"])

def tool_input(kind="bayonet", standard="CJ-TOOL-25"):
    return port("tool_in", "in", kind, standard=standard, gender="female",
                conditions=["tool_mass_kg<=1.2", "runout_mm<=0.15",
                            "retention_force_n>=120"])

def tool_output(kind="flange", standard="ISO 9409-1-50-4-M6"):
    return port("tool_out", "out", kind, standard=standard,
                conditions=["tool_mass_kg<=1.2", "torque_nm<=8",
                            "axial_runout_mm<=0.05"])

def power_in(voltage=230, current=10, connector="IEC C14", phases=1):
    return port("power_in", "in", "ac_power", voltage_v=voltage, current_a=current,
                phases=phases, frequency_hz=50, connector=connector,
                conditions=["earth_required", "breaker_curve=C",
                            "voltage_tolerance_pct=10"])

def power_out(voltage=230, current=6, connector="IEC C13"):
    return port("power_out", "out", "ac_power", voltage_v=voltage, current_a=current,
                phases=1, frequency_hz=50, connector=connector,
                conditions=["max_continuous_load_a<=6", "earth_required"])

def air_in(pressure=(6, 8), port_name="G1/4", flow=120):
    return port("air_in", "in", "compressed_air", pressure_bar=list(pressure),
                port=port_name, flow_l_min=flow,
                conditions=["air=dry,filtered,5um", "dew_point_c<=3",
                            "oil_mg_m3<=1"])

def air_out(pressure=(0, 8), port_name="G1/4", flow=120):
    return port("air_out", "out", "compressed_air", pressure_bar=list(pressure),
                port=port_name, flow_l_min=flow,
                conditions=["exhaust_muffler_required"])

def fluid_in(pressure=(2, 4), port_name="G1/4", flow=4, media="water"):
    return port("fluid_in", "in", "fluid", pressure_bar=list(pressure),
                port=port_name, flow_l_min=flow, media=media,
                conditions=["filtration_um<=50", "temperature_c=5..40"])

def fluid_out(pressure=(0, 2), port_name="G1/2", flow=8, media="water"):
    return port("fluid_out", "out", "fluid", pressure_bar=list(pressure),
                port=port_name, flow_l_min=flow, media=media,
                conditions=["gravity_drain", "free_air_gap>=20mm"])

def signal(pid="eth_in", direction="in", protocol="Ethernet", connector="RJ45",
           latency=1.0, isolation=1.5):
    return port(pid, direction, "signal", protocol=protocol, connector=connector,
                latency_ms_max=latency, isolation_kv=isolation,
                conditions=["shielded_cable", "single_ground_reference"])

def dof(joint, axis, travel=None, speed=None, phase="phase", node=None, law="linear"):
    d = {"id": "main", "joint": joint, "axis": axis, "phase": phase,
         "law": law, "node": node}
    if travel is not None:
        d["range_m"] = [0.0, float(travel)]
        d["stroke_m"] = float(travel)
    if speed is not None:
        d["speed_si"] = float(speed)
    return d

# ---------------------------------------------------------------------------
# Class templates. Values are concept-level and deliberately conservative.
# ---------------------------------------------------------------------------
CLASS = {
    "STRUCTURE": dict(
        mech_in=lambda c: [mechanical_input(count=4, load=1471)],
        mech_out=lambda c: [mechanical_output(count=4, load=1471)],
        power=lambda c: ([power_in()], [power_out()]),
        air=lambda c: ([], []), fluid=lambda c: ([], []),
        signal=lambda c: ([signal()], [signal("eth_out", "out")]),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.mechanical.mount_in.standard", "eq", "M12"),
            rule("mate.mechanical.mount_in.pitch_m", "eq", PITCH, 0.002),
            rule("mate.mechanical.mount_in.load_n", "gte", 1200),
            rule("mate.frame.flatness_mm", "lte", 2),
        ],
        provides=lambda c: [{"port": "mount_out", "spec": "M12x4@0.6 m"},
                            {"port": "power_out", "spec": "230 V / 6 A"},
                            {"port": "eth_out", "spec": "Ethernet 100 Mbit/s"}],
    ),
    "MOTION": dict(
        mech_in=lambda c: [mechanical_input(count=4, load=800)],
        mech_out=lambda c: [tool_output()],
        power=lambda c: ([power_in()], []),
        air=lambda c: ([], []), fluid=lambda c: ([], []),
        signal=lambda c: ([signal("encoder_in", "in", "EtherCAT", "M12 D-coded", 1.0, 1.5)],
                          [signal("encoder_out", "out", "EtherCAT", "M12 D-coded", 1.0, 1.5)]),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.mechanical.mount_in.standard", "eq", "M12"),
            rule("mate.mechanical.mount_in.load_n", "gte", 800),
            rule("mate.power.voltage_v", "eq", 230, 23),
            rule("mate.signal.encoder_in.protocol", "eq", "EtherCAT"),
        ],
        provides=lambda c: [{"port": "tool_out", "spec": "ISO 9409-1-50-4-M6"},
                            {"port": "encoder_out", "spec": "EtherCAT / 1 kHz"}],
    ),
    "WORK": dict(
        mech_in=lambda c: [tool_input()],
        mech_out=lambda c: [],
        power=lambda c: ([], []),
        air=lambda c: ([], []), fluid=lambda c: ([], []),
        signal=lambda c: ([], []),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.tool_in.standard", "eq", "CJ-TOOL-25"),
            rule("mate.tool_in.retention_force_n", "gte", 120),
            rule("mate.tool_in.runout_mm", "lte", 0.15),
        ],
        provides=lambda c: [{"port": "work_surface", "spec": "replaceable contact surface"}],
    ),
    "RESTRAINT": dict(
        mech_in=lambda c: [mechanical_input(count=4, load=900)],
        mech_out=lambda c: [],
        power=lambda c: ([], []), air=lambda c: ([], []), fluid=lambda c: ([], []),
        signal=lambda c: ([], []),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.anchor.standard", "eq", "M8"),
            rule("mate.anchor.load_n", "gte", 900),
            rule("mate.body.clearance_mm", "gte", 15),
        ],
        provides=lambda c: [{"port": "restraint_surface", "spec": "padded, quick-release"}],
    ),
    "SURFACE": dict(
        mech_in=lambda c: [mechanical_input(standard="deck", count=6, pitch=0.3, load=1800)],
        mech_out=lambda c: [],
        power=lambda c: ([power_in(230, 6, "IEC C14")], []),
        air=lambda c: ([], []), fluid=lambda c: ([], []),
        signal=lambda c: ([signal("data_in", "in", "Ethernet", "RJ45", 2.0, 1.5)], []),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.deck.width_m", "gte", 0.9),
            rule("mate.deck.length_m", "gte", 2.0),
            rule("mate.power.voltage_v", "eq", 230, 23),
            rule("mate.data_in.protocol", "eq", "Ethernet"),
        ],
        provides=lambda c: [{"port": "surface_out", "spec": "2.0 x 0.9 m working area"}],
    ),
    "SENSORY": dict(
        mech_in=lambda c: [mechanical_input(standard="head_mount", count=4, pitch=0.05, load=150)],
        mech_out=lambda c: [],
        power=lambda c: ([power_in(24, 3, "DC jack", 1)], []),
        air=lambda c: ([], []), fluid=lambda c: ([], []),
        signal=lambda c: ([signal("media_in", "in", "USB-C", "USB-C", 5.0, 0.5)], []),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.head_mount.standard", "eq", "head_mount"),
            rule("mate.power.voltage_v", "eq", 24, 2.4),
            rule("mate.media_in.protocol", "eq", "USB-C"),
        ],
        provides=lambda c: [{"port": "media_out", "spec": "stereo/HDMI/USB"}],
    ),
    "CONTROL": dict(
        mech_in=lambda c: [mechanical_input(standard="panel", count=4, pitch=0.1, load=300)],
        mech_out=lambda c: [],
        power=lambda c: ([power_in(24, 4, "M12 A-coded", 1)], []),
        air=lambda c: ([], []), fluid=lambda c: ([], []),
        signal=lambda c: ([signal("bus_in", "in", "Ethernet", "RJ45", 1.0, 1.5)],
                          [signal("bus_out", "out", "Ethernet", "RJ45", 1.0, 1.5)]),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.panel.standard", "eq", "panel"),
            rule("mate.power.voltage_v", "eq", 24, 2.4),
            rule("mate.bus_in.protocol", "eq", "Ethernet"),
        ],
        provides=lambda c: [{"port": "bus_out", "spec": "Ethernet + dry contact"}],
    ),
    "UTILITY": dict(
        mech_in=lambda c: [mechanical_input(standard="wall", count=4, pitch=0.3, load=600)],
        mech_out=lambda c: [],
        power=lambda c: ([power_in(230, 16, "IEC C20")], [power_out(230, 16, "IEC C19")]),
        air=lambda c: ([air_in()], [air_out()]),
        fluid=lambda c: ([fluid_in()], [fluid_out()]),
        signal=lambda c: ([signal()], [signal("eth_out", "out")]),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.power.voltage_v", "eq", 230, 23),
            rule("mate.power.current_a", "gte", 16),
            rule("mate.earth_resistance_ohm", "lte", 0.1),
        ],
        provides=lambda c: [{"port": "power_out", "spec": "230 V / 16 A"},
                            {"port": "eth_out", "spec": "Ethernet"}],
    ),
    "FLUID": dict(
        mech_in=lambda c: [tool_input("quick_connect", "G1/4")],
        mech_out=lambda c: [fluid_out()],
        power=lambda c: ([], []),
        air=lambda c: ([], []),
        fluid=lambda c: ([fluid_in()], [fluid_out()]),
        signal=lambda c: ([], []),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.fluid_in.port", "eq", "G1/4"),
            rule("mate.fluid_in.pressure_bar", "range", [2, 4]),
            rule("mate.fluid_in.media", "eq", "water"),
        ],
        provides=lambda c: [{"port": "fluid_out", "spec": "G1/2 gravity drain"}],
    ),
    "SERVICE": dict(
        mech_in=lambda c: [mechanical_input(standard="dock", count=4, pitch=0.3, load=1000)],
        mech_out=lambda c: [],
        power=lambda c: ([power_in(230, 16, "IEC C20")], [power_out()]),
        air=lambda c: ([air_in()], [air_out()]),
        fluid=lambda c: ([fluid_in()], [fluid_out()]),
        signal=lambda c: ([signal()], [signal("eth_out", "out")]),
        dof=lambda c: [],
        requires=lambda c: [
            rule("mate.dock.standard", "eq", "dock"),
            rule("mate.power.current_a", "gte", 16),
            rule("mate.drain.free_air_gap_mm", "gte", 20),
        ],
        provides=lambda c: [{"port": "service_out", "spec": "power/air/water/data"}],
    ),
}

# Per-component overrides that matter for concrete compatibility.
OVERRIDES = {
    "structure_base": dict(load=150, pitch=0.6, power=(230, 16), signal=("Ethernet", "RJ45")),
    "structure_portal": dict(load=120, pitch=0.6, power=(230, 10), signal=("Ethernet", "RJ45")),
    "structure_gantry": dict(load=200, pitch=0.8, power=(230, 16), signal=("Ethernet", "RJ45")),
    "structure_bed_frame": dict(load=200, pitch=0.3, power=(230, 10), signal=("Ethernet", "RJ45")),
    "structure_cage": dict(load=150, pitch=0.6, power=(230, 10), signal=("Ethernet", "RJ45")),
    "structure_suspension_frame": dict(load=180, pitch=0.6, power=(230, 10), signal=("Ethernet", "RJ45")),
    "structure_stall_row": dict(load=300, pitch=0.6, power=(230, 32), signal=("Ethernet", "RJ45")),
    "structure_dock": dict(load=100, pitch=0.3, power=(230, 10), signal=("Ethernet", "RJ45")),
    "motion_linear_x": dict(load=80, power=(230, 10), signal=("EtherCAT", "M12 D-coded")),
    "motion_lift_z": dict(load=80, power=(230, 10), signal=("EtherCAT", "M12 D-coded")),
    "motion_linear_y": dict(load=80, power=(230, 10), signal=("EtherCAT", "M12 D-coded")),
    "motion_rotary": dict(load=60, power=(230, 10), signal=("EtherCAT", "M12 D-coded")),
    "motion_piston_pneumatic": dict(load=60, power=None, air=(6, 8, "G1/4"), signal=("IO-Link", "M12 A-coded")),
    "motion_piston_hydraulic": dict(load=120, power=(380, 10), fluid=(20, 60, "G1/4"), signal=("IO-Link", "M12 A-coded")),
    "motion_piston_rod": dict(load=80, power=(230, 10), signal=("EtherCAT", "M12 D-coded")),
    "motion_piston_telescopic": dict(load=70, power=(230, 10), signal=("IO-Link", "M12 A-coded")),
    "motion_piston_cam": dict(load=80, power=(230, 10), signal=("IO-Link", "M12 A-coded")),
    "motion_piston_servo": dict(load=80, power=(230, 10), signal=("EtherCAT", "M12 D-coded")),
    "work_attach_adapter": dict(tool=("bayonet", "20/25 mm")),
    "work_attach_inflatable": dict(tool=("bayonet", "20/25 mm"), air=(0, 0.4, "G1/8")),
    "work_attach_vibrating": dict(power=(24, 2)),
    "work_probe_combined": dict(load=60, power=(230, 10), signal=("EtherCAT", "M12 D-coded"),
                                air=(0, 0.4, "G1/8"), fluid=(0, 1.5, "G1/4")),
    "effect_thermal": dict(power=(24, 2)),
    "effect_pneumatic": dict(air=(6, 8, "G1/8")),
    "effect_hydraulic": dict(fluid=(0, 1.5, "G1/4")),
    "effect_electric": dict(power=(24, 1)),
}

# Effect inserts mount into a collar / quick-connect on the base body, not into
# the CJ-TOOL-25 form socket: the form and the effect must fit at the same time.
EFFECT_PORTS = {
    "vibration": dict(pid="effect_in", kind="collar", standard="CJ-EFF-VIB",
                      conditions=["coupler_d_mm=46", "runout_mm<=0.15"]),
    "thermal": dict(pid="effect_in", kind="collar", standard="CJ-EFF-THM",
                    conditions=["sleeve_d_mm=32", "axial_gap_mm>=1"]),
    "pneumatic": dict(pid="effect_in", kind="quick_connect", standard="CJ-EFF-PNE",
                      port="G1/8", conditions=["air=dry,filtered,5um", "pressure_bar<=0.4"]),
    "hydraulic": dict(pid="effect_in", kind="quick_connect", standard="CJ-EFF-HYD",
                      port="G1/4", conditions=["media=water,gel", "pressure_bar<=1.5"]),
    "electric": dict(pid="effect_in", kind="signal", standard="CJ-EFF-ELE",
                     connector="M8 4-pin", isolation_kv=4.0,
                     conditions=["dry_skin", "impedance_check_required"]),
}


def apply_layer_ports(comps, catalog):
    """Typed sockets and layer-aware ports: the base supplies, form and effect accept."""
    by_id = {c["id"]: c for c in catalog["components"]}
    for cid, k in comps.items():
        c = by_id.get(cid) or {}
        layer = c.get("layer")
        if not layer:
            continue
        slots = c.get("slots") or {}
        mech = k["interfaces"]["mechanical"]
        if layer == "base" and c.get("subtype") in ("linear", "rotary", "combined"):
            for pt in mech["inputs"]:
                if pt.get("id") == "tool_in":
                    pt["standard"] = slots.get("in", "CJ-TOOL-25")
            for r in k["compatibility"]["requires"]:
                if r.get("target") == "mate.tool_in.standard":
                    r["value"] = slots.get("in", "CJ-TOOL-25")
            if not any(x.get("id") == "form_socket" for x in mech["outputs"]):
                mech["outputs"].append(port(
                    "form_socket", "out", "bayonet",
                    standard=slots.get("form") or "CJ-TOOL-25", gender="female",
                    retention_force_n=120, torque_nm=6 if c["subtype"] != "linear" else 0,
                    conditions=["tool_mass_kg<=1.2", "runout_mm<=0.15"]))
            k["compatibility"]["provides"].append(
                {"port": "form_socket", "spec": "CJ-TOOL-25 bayonet (form side)"})
        elif layer in ("form", "rig", "preset"):
            for pt in mech["inputs"]:
                if pt.get("id") == "tool_in":
                    pt["standard"] = slots.get("in", "CJ-TOOL-25")
            if layer == "rig" and c.get("subtype") != "adapter":
                k["compatibility"]["provides"] = [
                    {"port": pt.get("id"), "spec": pt.get("standard", "")}
                    for pt in mech["inputs"] + mech["outputs"] if pt.get("id")
                ]
        elif layer == "effect":
            spec = EFFECT_PORTS.get(c.get("subtype"))
            if spec:
                kw = {k2: v for k2, v in spec.items() if k2 not in ("pid", "kind")}
                mech["inputs"] = [port(spec["pid"], "in", spec["kind"], **kw)]
                k["compatibility"]["requires"] = [
                    rule("mate.effect_in.standard", "eq", spec["standard"]),
                    rule("mate.effect_in.base_layer", "eq", "base"),
                ]
                k["compatibility"]["provides"] = [
                    {"port": "effect_in", "spec": spec["standard"]}]


def component_contract(c):
    cid = c["id"]; cls = c["class"]; m = c.get("model", {})
    ov = OVERRIDES.get(cid, {})
    t = CLASS[cls]
    mech_in = t["mech_in"](c); mech_out = t["mech_out"](c)
    p_in, p_out = t["power"](c)
    a_in, a_out = t["air"](c)
    f_in, f_out = t["fluid"](c)
    s_in, s_out = t["signal"](c)
    # Apply the few concrete overrides without pretending to model every port.
    if "load" in ov:
        for p in mech_in:
            p["load_n"] = max(p.get("load_n", 0), ov["load"] * 9.81)
    if "pitch" in ov:
        for p in mech_in:
            p["pitch_m"] = ov["pitch"]
    if "power" in ov and ov["power"] is None:
        p_in, p_out = [], []
    if ov.get("power"):
        v, a = ov["power"]
        p_in = [power_in(v, a, "IEC C14" if v == 230 else ("IEC 60309" if v == 380 else "DC jack"))]
    if ov.get("air"):
        lo, hi, pn = ov["air"]
        a_in = [air_in((lo, hi), pn)]
    if ov.get("fluid"):
        lo, hi, pn = ov["fluid"]
        f_in = [fluid_in((lo, hi), pn)]
    if ov.get("signal"):
        proto, conn = ov["signal"]
        s_in = [signal("bus_in", "in", proto, conn, 1.0, 1.5)]
        s_out = [signal("bus_out", "out", proto, conn, 1.0, 1.5)]
    if ov.get("tool"):
        mech_in = [tool_input(*ov["tool"])]

    motion = m.get("motion", {"type": "none"})
    dofs = []
    drivers = []
    constraints = []
    if motion.get("type") == "spin":
        ax = motion.get("axis", "x")
        dofs = [dof("revolute", ax, speed=motion.get("speed", 1.0), node="anim")]
        drivers = [{"id": "main", "node": "anim", "joint": "revolute", "axis": ax,
                    "law": "phase", "ratio": 1.0, "phase": "phase"}]
    elif motion.get("type") == "slide":
        ax = motion.get("axis", "x"); travel = float(motion.get("amount", 0.1))
        dofs = [{"id": "main", "joint": "prismatic", "axis": ax, "phase": "phase",
                 "law": "sine", "range_m": [-travel / 2.0, travel / 2.0],
                 "stroke_m": travel, "speed_si": motion.get("speed", 1.0), "node": "anim"}]
        drivers = [{"id": "main", "node": "anim", "joint": "prismatic", "axis": ax,
                    "law": "sine", "amplitude_m": travel / 2.0, "phase": "phase"}]
    elif motion.get("type") == "spin_slide":
        ax = motion.get("axis", "x"); travel = float(motion.get("amount", 0.08))
        dofs = [
            {"id": "spin", "joint": "revolute", "axis": ax, "phase": "phase",
             "law": "phase", "range_rad": [0.0, 2 * math.pi],
             "speed_si": motion.get("speed", 0.7), "node": "anim"},
            {"id": "stroke", "joint": "prismatic", "axis": ax, "phase": "phase",
             "law": "sine", "range_m": [-travel / 2.0, travel / 2.0],
             "stroke_m": travel, "node": "anim"},
        ]
        drivers = [
            {"id": "spin", "node": "anim", "joint": "revolute", "axis": ax,
             "law": "phase", "ratio": 1.0, "phase": "phase"},
            {"id": "stroke", "node": "stroke_slide", "joint": "prismatic", "axis": ax,
             "law": "sine", "amplitude_m": travel / 2.0, "phase": "phase"},
        ]
        constraints = [{"type": "shared_phase", "members": ["spin", "stroke"]}]
        kin = {"schema": "cj-kinematics/1", "parameter": "phase",
               "phase": {"range_rad": [0.0, 2 * math.pi], "wrap": True},
               "kind": "screw_carriage", "drivers": drivers,
               "constraints": constraints,
               "test": {"samples": 36, "tolerance_m": 0.0005}}
    elif motion.get("type") == "scale":
        ax = motion.get("axis", "yz")
        dofs = [{"id": "inflate", "joint": "scale", "axis": ax,
                 "phase": "phase", "law": "sine",
                 "factor": float(motion.get("amount", 0.1)), "node": "anim"}]
        drivers = [{"id": "inflate", "node": "anim", "joint": "scale", "axis": ax,
                    "law": "sine", "amount": float(motion.get("amount", 0.1)),
                    "phase": "phase"}]
    elif motion.get("type") == "pulse":
        part = motion.get("part", "display_face")
        dofs = [{"id": "display", "joint": "material", "axis": None,
                 "phase": "phase", "law": "pulse", "node": part}]
        drivers = [{"id": "display", "node": part,
                    "joint": "material", "law": "pulse", "frequency_hz": 2.2, "phase": "phase"}]
    elif motion.get("type") == "swing":
        ax = motion.get("axis", "z"); amount = float(motion.get("amount", 0.4))
        dofs = [{"id": "swing", "joint": "revolute", "axis": ax, "phase": "phase",
                 "law": "sine", "range_rad": [-amount, amount], "node": "anim"}]
        drivers = [{"id": "swing", "node": "anim", "joint": "revolute", "axis": ax,
                    "law": "sine", "amplitude_rad": amount, "phase": "phase"}]
    elif motion.get("type") == "vibrate":
        ax = motion.get("axis", "x"); amount = float(motion.get("amount", 0.003))
        dofs = [{"id": "vibration", "joint": "prismatic", "axis": ax, "phase": "phase",
                 "law": "sine", "range_m": [-amount, amount], "frequency_hz": float(motion.get("speed", 28)), "node": "anim"}]
        drivers = [{"id": "vibration", "node": "anim", "joint": "prismatic", "axis": ax,
                    "law": "sine", "amplitude_m": amount, "frequency_hz": float(motion.get("speed", 28)), "phase": "phase"}]

    # Coupled mechanisms: one phase drives all listed members.
    coupled = {
        "motion_piston_cam": {
            "kind": "cam_follower",
            "drivers": [
                {"id": "cam", "node": "cam_lobe", "members": ["cam_lobe", "cam_web_near", "cam_web_far", "cam_hub", "cam_bolts", "cam_angle_mark", "camshaft", "flywheel", "flywheel_rim", "flywheel_marks", "flywheel_zero", "flywheel_index", "flywheel_index_arm"], "joint": "revolute", "axis": "z",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "follower", "node": "anim", "joint": "prismatic", "axis": "x",
                 "law": "cam_profile", "profile": {"r0_m": CAM_R0, "step_deg": 5.0,
                                                  "r_m": CAM_PROFILE},
                 "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["cam", "follower"]},
                {"type": "contact", "between": ["cam_lobe", "roller"],
                 "equation": "distance(cam_center, roller_center) = r_cam(phase) + r_roller"},
                {"type": "limit", "member": "follower", "min_m": -0.027646, "max_m": 0.032354},
            ],
            "test": {"samples": 72, "tolerance_m": 0.0005},
        },
        "motion_piston_rod": {
            "kind": "screw_nut",
            "drivers": [
                {"id": "screw", "node": "screw", "joint": "revolute", "axis": "x",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "nut", "node": "screw_nut", "joint": "prismatic", "axis": "x",
                 "law": "screw_lead", "lead_m": 0.01, "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["screw", "nut"]},
                {"type": "equation", "expression": "x_nut = lead_m * phase / (2*pi)"},
                {"type": "limit", "member": "nut", "min_m": 0.0, "max_m": 0.09},
            ],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
        "motion_piston_servo": {
            "kind": "screw_nut",
            "drivers": [
                {"id": "screw", "node": "screw", "joint": "revolute", "axis": "x",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "nut", "node": "screw_nut", "joint": "prismatic", "axis": "x",
                 "law": "screw_lead", "lead_m": 0.005, "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["screw", "nut"]},
                {"type": "equation", "expression": "x_nut = lead_m * phase / (2*pi)"},
                {"type": "limit", "member": "nut", "min_m": 0.0, "max_m": 0.07},
            ],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
        "motion_linear_x": {
            "kind": "screw_carriage",
            "drivers": [
                {"id": "screw", "node": "screw", "members": ["screw", "screw_thread", "screw_ring_*"], "joint": "revolute", "axis": "x",
                 "law": "phase", "ratio": 20.0, "phase": "phase"},
                {"id": "carriage", "node": "anim", "joint": "prismatic", "axis": "x",
                 "law": "screw_lead", "lead_m": 0.01, "ratio": 20.0, "starts": 3, "visible_pitch_m": 0.03, "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["screw", "carriage"]},
                {"type": "equation", "expression": "x_carriage = lead_m * ratio * phase / (2*pi)"},
                {"type": "limit", "member": "carriage", "min_m": 0.0, "max_m": 0.20},
            ],
            "test": {"samples": 40, "tolerance_m": 0.0005},
        },
        "motion_lift_z": {
            "kind": "screw_carriage",
            "drivers": [
                {"id": "screw", "node": "screw", "joint": "revolute", "axis": "y",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "carriage", "node": "carriage_bridge", "joint": "prismatic", "axis": "y",
                 "law": "screw_lead", "lead_m": 0.01, "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["screw", "carriage"]},
                {"type": "equation", "expression": "y_carriage = lead_m * phase / (2*pi)"},
                {"type": "limit", "member": "carriage", "min_m": 0.0, "max_m": 0.10},
            ],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
        "motion_oscillating": {
            "kind": "crank_slider",
            "drivers": [
                {"id": "crank", "node": "crank_disc", "members": ["crank_disc", "crank_hub", "crank_pin", "crank_boss", "crank_gland"], "joint": "revolute", "axis": "z",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "slider", "node": "anim", "joint": "prismatic", "axis": "x",
                 "law": "crank_slider", "crank_radius_m": 0.020, "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["crank", "slider"]},
                {"type": "equation", "expression": "x_slider = crank_radius_m * sin(phase)"},
                {"type": "limit", "member": "slider", "min_m": -0.020, "max_m": 0.020},
            ],
            "test": {"samples": 72, "tolerance_m": 0.0005},
        },
        "motion_winch": {
            "kind": "drum_rope",
            "drivers": [
                {"id": "drum", "node": "drum", "joint": "revolute", "axis": "x",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "rope", "node": "rope_payout", "joint": "prismatic", "axis": "y",
                 "law": "drum_rope", "drum_radius_m": 0.060, "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["drum", "rope"]},
                {"type": "equation", "expression": "y_rope = drum_radius_m * phase"},
                {"type": "limit", "member": "rope", "min_m": 0.0, "max_m": 0.377},
            ],
            "test": {"samples": 72, "tolerance_m": 0.0005},
        },
        "motion_spreader": {
            "kind": "symmetric_screw",
            "drivers": [
                {"id": "screw", "node": "screw", "joint": "revolute", "axis": "x",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "left", "node": "carriage_body_l", "joint": "prismatic", "axis": "x",
                 "law": "screw_lead_symmetric", "lead_m": 0.01, "phase": "phase"},
                {"id": "right", "node": "carriage_body_r", "joint": "prismatic", "axis": "x",
                 "law": "screw_lead_symmetric", "lead_m": -0.01, "phase": "phase"},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["screw", "left", "right"]},
                {"type": "equation", "expression": "x_left = -x_right"},
                {"type": "limit", "member": "left", "min_m": -0.0149, "max_m": 0.0149},
                {"type": "limit", "member": "right", "min_m": -0.0149, "max_m": 0.0149},
            ],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
        "work_tickle_pair": {
            "kind": "shared_spindle",
            "drivers": [
                {"id": "spindle", "node": "anim", "joint": "revolute", "axis": "y",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "node0", "node": "node0_hub", "joint": "revolute", "axis": "y",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
                {"id": "node1", "node": "node1_hub", "joint": "revolute", "axis": "y",
                 "law": "phase", "ratio": 1.0, "phase": "phase", "offset_rad": math.pi},
            ],
            "constraints": [
                {"type": "shared_phase", "members": ["spindle", "node0", "node1"]},
                {"type": "phase_offset", "between": ["node0", "node1"], "offset_rad": math.pi},
            ],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
        "motion_turntable": {
            "kind": "indexed_rotation",
            "drivers": [
                {"id": "table", "node": "anim", "joint": "revolute", "axis": "y",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
            ],
            "constraints": [{"type": "shared_phase", "members": ["table"]},
                            {"type": "index_count", "count": 12}],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
        "work_attach_carousel": {
            "kind": "indexed_rotation",
            "drivers": [
                {"id": "carousel", "node": "anim", "joint": "revolute", "axis": "y",
                 "law": "phase", "ratio": 1.0, "phase": "phase"},
            ],
            "constraints": [{"type": "shared_phase", "members": ["carousel"]},
                            {"type": "index_count", "count": 6}],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
        "motion_piston_telescopic": {
            "kind": "staged_extension",
            "drivers": [
                {"id": "stage1", "node": "stage_1", "joint": "prismatic", "axis": "x",
                 "law": "staged", "fraction": 0.34, "phase": "phase"},
                {"id": "stage2", "node": "stage_2", "joint": "prismatic", "axis": "x",
                 "law": "staged", "fraction": 0.67, "phase": "phase"},
                {"id": "stage3", "node": "stage_3", "joint": "prismatic", "axis": "x",
                 "law": "staged", "fraction": 1.00, "phase": "phase"},
            ],
            "constraints": [{"type": "shared_phase", "members": ["stage1", "stage2", "stage3"]},
                            {"type": "sequence", "order": ["stage1", "stage2", "stage3"]}],
            "test": {"samples": 36, "tolerance_m": 0.0005},
        },
    }
    kin = {
        "schema": "cj-kinematics/1",
        "parameter": "phase",
        "phase": {"range_rad": [0.0, 2 * math.pi], "wrap": True},
        "drivers": drivers,
        "constraints": constraints,
        "test": {"samples": 36, "tolerance_m": 0.0005,
                 "check": "transform at samples, shared phase, limits, no static drift"},
    }
    if cid in coupled:
        kin.update(coupled[cid])
        limits = {}
        for cst in kin.get("constraints", []):
            if cst.get("type") == "limit":
                limits[cst["member"]] = (float(cst["min_m"]), float(cst["max_m"]))
        dofs = []
        for d in kin.get("drivers", []):
            jt = d.get("joint")
            if jt not in ("revolute", "prismatic", "scale"):
                continue
            item = {"id": d["id"], "joint": jt, "axis": d.get("axis"),
                    "phase": "phase", "law": d.get("law"), "node": d.get("node")}
            if jt == "revolute":
                item["range_rad"] = [0.0, 2 * math.pi]
            elif jt == "prismatic":
                if d["id"] in limits:
                    lo, hi = limits[d["id"]]
                elif d.get("law") == "staged":
                    lo, hi = 0.0, 0.12
                else:
                    lo, hi = 0.0, float(motion.get("amount", 0.1))
                item["range_m"] = [lo, hi]
                item["stroke_m"] = hi - lo
            elif jt == "scale":
                item["factor"] = float(d.get("amount", 0.1))
            dofs.append(item)
    # Every motion component gets one explicit phase even if no driver.
    kin.setdefault("drivers", [])
    kin.setdefault("constraints", [])

    requires = list(t["requires"](c))
    if ov.get("signal"):
        proto, conn = ov["signal"]
        requires.append(rule("mate.bus_in.protocol", "eq", proto))
    if ov.get("air"):
        requires.append(rule("mate.air_in.port", "eq", ov["air"][2]))
    if ov.get("fluid"):
        requires.append(rule("mate.fluid_in.port", "eq", ov["fluid"][2]))

    if c.get("layer") in ("form", "effect"):
        for d in dofs:
            d["passive"] = True
            d["driven_by"] = "base"

    return {
        "id": cid, "code": c["code"], "class": cls,
        "layer": c.get("layer"), "subtype": c.get("subtype"),
        "contact": c.get("contact"),
        "slots": c.get("slots") or {},
        "accepts": c.get("accepts") or {},
        "supplies": c.get("supplies") or {},
        "modes": c.get("modes") or {},
        "interfaces": {
            "mechanical": {"inputs": mech_in, "outputs": mech_out},
            "power": {"inputs": p_in, "outputs": p_out},
            "pneumatic": {"inputs": a_in, "outputs": a_out},
            "fluid": {"inputs": f_in, "outputs": f_out},
            "signal": {"inputs": s_in, "outputs": s_out},
        },
        "dof": dofs,
        "kinematics": kin,
        "compatibility": {
            "requires": requires,
            "provides": t["provides"](c),
            "rejects": list(c.get("rejects") or []),
        },
        "provenance": {"source": "class-template+passport", "confidence": "concept",
                       "note": "Fictional concept data; not a manufacturing or safety specification."},
    }

def apply_special(comps):
    """Concrete corrections found by the independent interface audit."""
    p = comps["motion_piston_pneumatic"]
    p["interfaces"]["mechanical"] = {
        "inputs": [port("mount_in", "in", "bolt_pattern", standard="M8", count=4,
                        pitch_m=0.04, gender="female", load_n=300,
                        conditions=["flatness_mm<=1", "thread_depth_mm>=10"])],
        "outputs": [port("rod_out", "out", "clevis", standard="pin 8 mm",
                         load_n=300, conditions=["radial_load_n<=150"])],
    }
    p["interfaces"]["power"] = {"inputs": [power_in(24, 2, "M12 A-coded")], "outputs": []}
    p["interfaces"]["pneumatic"] = {
        "inputs": [air_in((6, 8), "G1/4", 80)],
        "outputs": [air_out((0, 8), "G1/4", 80)],
    }
    p["interfaces"]["signal"] = {
        "inputs": [signal("valve_cmd", "in", "IO-Link", "M12 A-coded", 2.0, 1.0)],
        "outputs": [signal("valve_state", "out", "IO-Link", "M12 A-coded", 2.0, 1.0)],
    }
    for d in p["dof"]:
        if d.get("id") == "main":
            d["range_m"] = [-0.05, 0.05]; d["stroke_m"] = 0.1
            d["max_speed_m_s"] = 0.3; d["coordinate"] = "center"
    p["compatibility"]["requires"] = [
        rule("mate.mechanical.mount_out.standard", "eq", "M8"),
        rule("mate.air_in.port", "eq", "G1/4"),
        rule("mate.air_in.pressure_bar", "range", [6, 8]),
        rule("mate.power.power_in.voltage_v", "eq", 24, 2.4),
    ]
    p["compatibility"]["provides"] = [
        {"port": "rod_out", "spec": "clevis, pin 8 mm"},
        {"port": "air_out", "spec": "G1/4 exhaust"},
        {"port": "valve_state", "spec": "IO-Link"},
    ]

    a = comps["work_attach_adapter"]
    a["interfaces"]["mechanical"] = {
        "inputs": [port("flange_in", "in", "flange", standard="ISO 9409-1-50-4-M6",
                        gender="female", load_n=400,
                        conditions=["axial_runout_mm<=0.05", "bolt_torque_nm=8"])],
        "outputs": [port("tool_out", "out", "bayonet", standard="20/25/30 mm",
                         gender="female", load_n=200,
                         conditions=["retention_force_n>=120", "tool_mass_kg<=1.2"])],
    }
    a["interfaces"]["signal"] = {
        "inputs": [signal("retention_fb", "in", "discrete", "M8 3-pin", 10.0, 0.5)],
        "outputs": [],
    }
    a["compatibility"]["requires"] = [
        rule("mate.mechanical.flange_in.standard", "eq", "ISO 9409-1-50-4-M6"),
        rule("mate.tool_out.standard", "eq", "20/25/30 mm"),
        rule("mate.tool_out.retention_force_n", "gte", 120),
        rule("mate.tool_out.tool_mass_kg", "lte", 1.2),
    ]
    a["compatibility"]["provides"] = [
        {"port": "flange_in", "spec": "ISO 9409-1-50-4-M6"},
        {"port": "tool_out", "spec": "bayonet 20/25/30 mm"},
        {"port": "retention_fb", "spec": "discrete closed/open"},
    ]

    b = comps["structure_base"]
    b["interfaces"]["mechanical"]["inputs"] = [
        port("mount_in", "in", "bolt_pattern", standard="M12", count=4,
             pitch_x_m=1.195, pitch_y_m=0.755, gender="female", load_n=1471.5,
             conditions=["flatness_mm<=2", "anchor_engagement_mm>=60"]),
        port("dock_in", "in", "dock", standard="dock", gender="female",
             load_n=500, conditions=["two_guides", "connector_2x8"]),
    ]
    b["interfaces"]["power"] = {
        "inputs": [power_in(230, 16, "IEC C20")],
        "outputs": [power_out(230, 10, "IEC C19")],
    }
    b["interfaces"]["signal"] = {
        "inputs": [signal("bus_in", "in", "Ethernet", "RJ45", 1.0, 1.5)],
        "outputs": [signal("bus_out", "out", "Ethernet", "RJ45", 1.0, 1.5),
                    signal("dock_state", "out", "discrete", "M8 3-pin", 10.0, 0.5)],
    }
    b["envelope_m"] = {"x": 1.28, "y": 0.84, "z": 0.24}
    b["compatibility"]["requires"] = [
        rule("mate.mechanical.mount_out.pitch_x_m", "eq", 1.195, 0.005),
        rule("mate.mechanical.mount_out.pitch_y_m", "eq", 0.755, 0.005),
        rule("mate.mechanical.mount_out.load_n", "gte", 1471.5),
        rule("mate.power.power_in.voltage_v", "eq", 230, 23),
        rule("mate.power.power_in.current_a", "gte", 16),
    ]
    b["compatibility"]["provides"] = [
        {"port": "mount_out", "spec": "M12x4 @ 1.195 x 0.755 m"},
        {"port": "power_out", "spec": "230 V / 10 A, breaker 10 A"},
        {"port": "bus_out", "spec": "Ethernet 100 Mbit/s"},
        {"port": "dock_in", "spec": "2 guides + 2x8 connector"},
    ]


def normalize_provides(comps, catalog=None):
    """Make every provided port point at an actually declared output."""
    for cid, c in comps.items():
        ifaces = c["interfaces"]
        def add(group, p):
            if not any(x.get("id") == p["id"] for x in ifaces[group]["outputs"]):
                ifaces[group]["outputs"].append(p)
        if c["class"] == "WORK":
            comp = (catalog or {}).get(cid, {})
            if comp.get("contact") and comp.get("layer") not in ("effect", "rig"):
                add("mechanical", port("work_surface", "out", "contact_surface",
                                       conditions=["replaceable", "cleanable"]))
            else:
                c["compatibility"]["provides"] = [
                    p for p in c["compatibility"]["provides"] if p.get("port") != "work_surface"]
        if c["class"] == "RESTRAINT":
            add("mechanical", port("restraint_surface", "out", "padded_surface",
                                   conditions=["quick_release", "load_n>=900"]))
        if c["class"] == "SURFACE":
            add("mechanical", port("surface_out", "out", "working_surface",
                                   conditions=["2.0x0.9_m", "cleanable"]))
        if c["class"] == "SENSORY":
            add("signal", signal("media_out", "out", "USB-C", "USB-C", 5.0, 0.5))
        if c["class"] == "MOTION":
            proto = "EtherCAT"
            conn = "M12 D-coded"
            for x in ifaces["signal"]["outputs"]:
                if x.get("id") == "bus_out":
                    proto = x.get("protocol", proto); conn = x.get("connector", conn)
            add("signal", signal("encoder_out", "out", proto, conn, 1.0, 1.5))
        new = []
        for prov in c["compatibility"]["provides"]:
            pid = prov.get("port")
            if pid == "eth_out" and any(x.get("id") == "bus_out" for x in ifaces["signal"]["outputs"]):
                prov = dict(prov); prov["port"] = "bus_out"
            elif pid == "service_out":
                for g in ("power", "pneumatic", "fluid", "signal"):
                    for out in ifaces[g]["outputs"]:
                        new.append({"port": out["id"], "spec": out.get("kind", "service")})
                continue
            new.append(prov)
        # drop duplicates, keep order
        seen = set(); cleaned = []
        for x in new:
            if x["port"] in seen: continue
            seen.add(x["port"]); cleaned.append(x)
        c["compatibility"]["provides"] = cleaned


def main():
    cc = json.loads(CATALOG.read_text(encoding="utf-8"))
    out = {
        "format": "cj-component-contract/1",
        "revision": "2026-11-10",
        "status": "concept",
        "units": {"length": "m", "force": "N", "pressure": "bar",
                  "angle": "rad", "voltage": "V", "current": "A"},
        "phase": {"id": "phase", "unit": "rad", "period_rad": 2 * math.pi},
        "components": {c["id"]: component_contract(c) for c in cc["components"]},
    }
    apply_special(out["components"])
    apply_layer_ports(out["components"], cc)
    normalize_provides(out["components"], {c["id"]: c for c in cc["components"]})
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(out['components'])} contracts)")

if __name__ == "__main__":
    main()
