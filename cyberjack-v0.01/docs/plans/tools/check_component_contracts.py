#!/usr/bin/env python3
"""Validate component contracts and phase-coupled kinematics without editing models."""
from __future__ import annotations
import json, math, re, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "public/models/machine-modules"
CATALOG = BASE / "component-catalog.json"
CONTRACTS = BASE / "component-contracts.json"
REPORT = ROOT / "docs/plans/component-contract-report.json"
MD = ROOT / "docs/plans/component-contract-report.md"

VALID_OPS = {"eq", "neq", "gte", "lte", "gt", "lt", "range", "in"}
VALID_JOINTS = {"revolute", "prismatic", "scale", "material", "fixed"}
VALID_LAYERS = {"drive", "base", "form", "effect", "preset", "rig"}
REJECT_KINDS = {"forbid", "degrade"}


def glb_nodes(path: Path) -> list[str]:
    b = path.read_bytes()
    clen, ctype = struct.unpack("<II", b[12:20])
    j = json.loads(b[20:20 + clen])
    return [n.get("name", "") for n in j.get("nodes", [])]


def finite_num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))


def eval_driver(d: dict, phase: float) -> float:
    law = d.get("law", "phase")
    ratio = float(d.get("ratio", 1.0))
    if law == "phase":
        return phase * ratio
    if law == "sine":
        return float(d.get("amplitude_m", d.get("amplitude_rad", 1.0))) * math.sin(phase)
    if law == "screw_lead":
        return float(d.get("lead_m", 0.01)) * ratio * phase / (2 * math.pi)
    if law == "screw_lead_symmetric":
        return float(d.get("lead_m", 0.01)) * ratio * phase / (2 * math.pi)
    if law == "cam_cosine":
        p = d.get("profile", {})
        return float(p.get("r_lift_m", 0.0)) * 0.5 * (1.0 - math.cos(phase))
    if law == "cam_profile":
        p = d.get("profile", {})
        tab = p.get("r_m", [])
        if not tab:
            return 0.0
        step = math.radians(float(p.get("step_deg", 5.0)))
        x = (phase % (2 * math.pi)) / step
        i = int(math.floor(x)) % len(tab)
        j = (i + 1) % len(tab)
        f = x - math.floor(x)
        return (tab[i] * (1 - f) + tab[j] * f) - float(p.get("r0_m", tab[0]))
    if law == "crank_slider":
        return float(d.get("crank_radius_m", 0.0)) * math.sin(phase)
    if law == "crank_slider_full":
        r = float(d.get("crank_radius_m", 0.02))
        l = float(d.get("rod_length_m", 0.204))
        return (float(d.get("base_x_m", 0.0)) + r * math.cos(phase)
                + math.sqrt(max(0.0, l * l - (r * math.sin(phase)) ** 2))
                - math.sqrt(max(0.0, l * l - r * r)))
    if law == "link_two_point":
        return 0.0
    if law == "drum_rope":
        return float(d.get("drum_radius_m", 0.0)) * ratio * phase
    if law == "staged":
        return float(d.get("fraction", 0.0))
    if law == "pulse":
        return 0.5 + 0.5 * math.sin(phase)
    return phase


def main():
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    con = json.loads(CONTRACTS.read_text(encoding="utf-8"))
    ids = [c["id"] for c in cat["components"]]
    findings = []
    checks = 0

    def add(sev, cid, code, msg, detail=None):
        findings.append({"severity": sev, "component": cid, "code": code,
                         "message": msg, "detail": detail})

    if set(ids) != set(con.get("components", {})):
        add("error", "*", "contract_ids", "Набор ID контрактов не совпадает с каталогом",
            {"missing": sorted(set(ids) - set(con.get("components", {}))),
             "extra": sorted(set(con.get("components", {})) - set(ids))})

    for c in cat["components"]:
        cid = c["id"]
        k = con["components"].get(cid)
        if not k:
            continue
        checks += 1
        model = c.get("model", {})
        prefix = model.get("prefix") or ""
        motion = model.get("motion", {"type": "none"})
        mstatus = model.get("status", "confirmed")
        glb = (BASE / model["file"]) if model.get("file") else None
        names = glb_nodes(glb) if (glb is not None and glb.exists()) else []
        if glb is None or not glb.exists():
            if mstatus == "pending":
                add("warn", cid, "glb_pending", "3D-блок-аут ещё не собран",
                    model.get("pending_reason"))
            else:
                add("error", cid, "glb_missing", "GLB не найден", str(glb))
        if names and prefix and not any(n.startswith(prefix + "__") for n in names):
            add("error", cid, "prefix_mismatch", "В GLB нет узлов с префиксом каталога",
                {"prefix": prefix, "sample": names[:3]})

        # --- interface shape and concrete conditions ---
        for group in ("mechanical", "power", "pneumatic", "fluid", "signal"):
            g = k.get("interfaces", {}).get(group, {})
            ports = list(g.get("inputs", [])) + list(g.get("outputs", []))
            seen = set()
            for p in ports:
                pid = p.get("id")
                if not pid or pid in seen:
                    add("error", cid, "port_id", f"Пустой/повторный порт в {group}", p)
                seen.add(pid)
                if not p.get("direction") in ("in", "out"):
                    add("error", cid, "port_direction", f"Некорректное направление порта {pid}", p)
                if not p.get("kind"):
                    add("error", cid, "port_kind", f"Не указан kind порта {pid}", p)
                if "conditions" in p and not p["conditions"]:
                    add("warn", cid, "port_conditions", f"Порт {pid} без условий совместимости", p)
        all_port_ids = set()
        for group in ("mechanical", "power", "pneumatic", "fluid", "signal"):
            grp = k.get("interfaces", {}).get(group, {})
            for pp in list(grp.get("inputs", [])) + list(grp.get("outputs", [])):
                if pp.get("id"):
                    all_port_ids.add(pp["id"])
        for prov in k.get("compatibility", {}).get("provides", []):
            if prov.get("port") and prov["port"] not in all_port_ids:
                add("error", cid, "provides_dangling_port",
                    f"provides ссылается на несуществующий порт {prov['port']}", prov)
        req = k.get("compatibility", {}).get("requires", [])
        if not req:
            add("error", cid, "no_requires", "Нет структурированных условий совместимости")
        for r in req:
            if not isinstance(r, dict) or "target" not in r or "op" not in r or "value" not in r:
                add("error", cid, "bad_rule", "Правило совместимости не структурировано", r)
                continue
            if r["op"] not in VALID_OPS:
                add("error", cid, "bad_op", f"Неизвестный оператор {r['op']}", r)
            if isinstance(r["value"], bool) or r["value"] in (None, ""):
                add("error", cid, "boolean_rule", "Условие сведено к boolean/пустому значению", r)
            if r["op"] in ("eq", "neq", "gte", "lte", "gt", "lt") and not isinstance(r["value"], (int, float, str)):
                add("error", cid, "bad_value", "Некорректное значение правила", r)
            if "tol" in r and not finite_num(r["tol"]):
                add("error", cid, "bad_tol", "Некорректный допуск", r)
        for p in ports if 'ports' in locals() else []:
            pass

        # --- motion / DOF ---
        mt = motion.get("type", "none")
        dofs = k.get("dof", [])
        if mt in ("spin", "slide", "scale", "swing", "vibrate") and not dofs:
            add("error", cid, "no_dof", f"Для motion={mt} нет DOF")
        for d in dofs:
            if d.get("joint") not in VALID_JOINTS:
                add("error", cid, "bad_joint", f"Неизвестный joint {d.get('joint')}", d)
            if d.get("axis") not in (None, "x", "y", "z", "yz"):
                add("error", cid, "bad_axis", f"Неизвестная ось {d.get('axis')}", d)
            for f in ("range_m", "range_rad"):
                if f in d and (not isinstance(d[f], list) or len(d[f]) != 2
                               or not all(finite_num(x) for x in d[f])
                               or d[f][0] > d[f][1]):
                    add("error", cid, "bad_range", f"Некорректный {f}", d)
            if "stroke_m" in d and not finite_num(d["stroke_m"]):
                add("error", cid, "bad_stroke", "Некорректный stroke_m", d)

        # --- layer model: movement, feeling and physics are owned separately ---
        layer = c.get("layer")
        if c["class"] in ("WORK", "MOTION"):
            if layer not in VALID_LAYERS:
                add("error", cid, "layer_missing", f"Некорректный слой: {layer}")
            else:
                if k.get("layer") != layer:
                    add("error", cid, "layer_mirror", "Слой в контракте не совпадает с каталогом",
                        {"catalog": layer, "contract": k.get("layer")})
                if c["class"] == "MOTION" and layer != "drive":
                    add("error", cid, "motion_layer", "Класс MOTION должен быть слоем drive")
                if c["class"] == "WORK" and layer in ("drive",):
                    add("error", cid, "work_layer", "Класс WORK не может быть слоем drive")
                if layer in ("form", "effect"):
                    for d in dofs:
                        if not d.get("passive"):
                            add("warn", cid, "active_form_dof",
                                "Движение формы или эффекта должно быть пассивным",
                                {"dof": d.get("id")})
                if layer in ("base", "form", "effect", "rig", "preset") and not c.get("slots"):
                    add("warn", cid, "no_slots", "У компонента слоя нет описания стыка")
                if layer == "base" and c.get("subtype") in ("linear", "rotary", "combined"):
                    outs = {p.get("id") for p in k.get("interfaces", {})
                            .get("mechanical", {}).get("outputs", [])}
                    if "form_socket" not in outs:
                        add("error", cid, "no_form_socket", "У базы нет стыка формы")

        # --- reject rules: what must not be combined ---
        for r in (k.get("compatibility", {}).get("rejects") or []):
            if not isinstance(r, dict) or not {"target", "op", "value"} <= set(r):
                add("error", cid, "bad_reject", "Правило несовместимости не структурировано", r)
                continue
            if r["op"] not in VALID_OPS:
                add("error", cid, "reject_op", f"Неизвестный оператор {r['op']}", r)
            if r.get("kind") not in REJECT_KINDS:
                add("warn", cid, "reject_kind", "У правила нет вида forbid/degrade", r)
            if not r.get("reason"):
                add("warn", cid, "reject_reason", "У правила нет причины", r)

        # --- kinematics phase coupling ---
        kin = k.get("kinematics", {})
        if kin.get("parameter") != "phase":
            add("error", cid, "phase_parameter", "Кинематика не использует единый phase")
        drivers = kin.get("drivers", [])
        drv_ids = [d.get("id") for d in drivers]
        if len(drv_ids) != len(set(drv_ids)):
            add("error", cid, "driver_ids", "Повторяющиеся id драйверов", drv_ids)
        for d in drivers:
            if d.get("phase") != "phase":
                add("error", cid, "driver_phase", f"Драйвер {d.get('id')} не привязан к phase", d)
            if d.get("joint") not in VALID_JOINTS:
                add("error", cid, "driver_joint", f"Некорректный joint драйвера {d.get('id')}", d)
            if d.get("axis") not in (None, "x", "y", "z", "yz"):
                add("error", cid, "driver_axis", f"Некорректная ось драйвера {d.get('id')}", d)
            node = d.get("node")
            if node and names and node not in ("anim",) and prefix + "__" + node not in names:
                add("error", cid, "driver_node", f"Узел драйвера не найден: {node}", d)
            if d.get("law") not in ("phase", "sine", "screw_lead", "screw_lead_symmetric",
                                    "cam_cosine", "cam_profile", "crank_slider",
                                    "crank_slider_full", "link_two_point",
                                    "drum_rope", "staged", "pulse"):
                add("error", cid, "driver_law", f"Неизвестный закон {d.get('law')}", d)
            # Every driver must have a matching DOF record; otherwise the
            # contract describes a motion that the component schema cannot expose.
            match = [x for x in dofs if x.get("id") == d.get("id")]
            if not match:
                add("error", cid, "driver_without_dof",
                    f"Драйвер {d.get('id')} не имеет соответствующего DOF", d)
            elif match[0].get("joint") != d.get("joint") or match[0].get("axis") != d.get("axis"):
                add("error", cid, "driver_dof_mismatch",
                    f"DOF {d.get('id')} не совпадает с драйвером",
                    {"driver": d, "dof": match[0]})
        if mt in ("spin", "slide", "scale", "swing", "vibrate", "pulse") and not drivers:
            add("error", cid, "no_driver", f"Для motion={mt} нет драйвера phase")
        if len(drivers) >= 2:
            members = set()
            for cst in kin.get("constraints", []):
                if cst.get("type") == "shared_phase":
                    members.update(cst.get("members", []))
            if not members:
                add("error", cid, "no_shared_phase", "Несколько драйверов без shared_phase")
            if not members.issuperset(set(drv_ids)):
                add("error", cid, "shared_phase_members", "shared_phase не покрывает все драйверы",
                    {"drivers": drv_ids, "members": sorted(members)})
        # coupled checks
        kind = kin.get("kind")
        if kind in ("cam_follower", "screw_nut", "screw_carriage", "crank_slider",
                    "drum_rope", "symmetric_screw", "shared_spindle",
                    "staged_extension"):
            if len(drivers) < 2:
                add("error", cid, "coupled_drivers", f"{kind} требует ≥2 драйверов")
            if not kin.get("constraints"):
                add("error", cid, "coupled_constraints", f"{kind} без ограничений")
            # sample laws within phase range; check finite and limits
            limits = {}
            for cst in kin.get("constraints", []):
                if cst.get("type") == "limit":
                    limits[cst["member"]] = (float(cst["min_m"]), float(cst["max_m"]))
            for d in drivers:
                vals = []
                for i in range(73):
                    v = eval_driver(d, 2 * math.pi * i / 72)
                    if not finite_num(v):
                        add("error", cid, "nonfinite_law", f"Закон {d.get('id')} даёт нечисло", d)
                        break
                    vals.append(v)
                if d.get("id") in limits and vals:
                    lo, hi = limits[d["id"]]
                    if min(vals) < lo - 1e-9 or max(vals) > hi + 1e-9:
                        add("error", cid, "law_out_of_limit",
                            f"Ход {d.get('id')} выходит за предел", {"min": min(vals), "max": max(vals), "limit": [lo, hi]})
                if d.get("law") == "staged" and d.get("fraction") is None:
                    add("error", cid, "staged_fraction", "Нет fraction у ступени", d)

        # generic slide semantics: amount should be total stroke, not amplitude
        if mt == "slide":
            amount = float(motion.get("amount", 0.0))
            if dofs:
                stroke = dofs[0].get("stroke_m")
                if stroke is not None and abs(float(stroke) - amount) > 1e-9:
                    add("error", cid, "slide_stroke_mismatch",
                        "ДОФ хода не совпадает с motion.amount", {"amount": amount, "stroke": stroke})
            if not any(d.get("law") in ("sine", "screw_lead", "screw_lead_symmetric",
                                        "crank_slider", "drum_rope", "staged",
                                        "cam_cosine", "cam_profile") for d in drivers):
                add("warn", cid, "slide_law", "Slide без явного закона движения")

        # existing component compatibility must reference real IDs
        for ref in c.get("compatibility", []) or []:
            if ref not in ids:
                add("error", cid, "compat_ref", f"compatibility ссылается на неизвестный ID {ref}")

    # report
    counts = {}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    report = {
        "format": "cj-contract-check/1",
        "generated_at": "2026-11-10",
        "components_checked": checks,
        "findings": findings,
        "counts": counts,
        "status": "pass" if not any(f["severity"] == "error" for f in findings) else "fail",
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# Проверка контрактов компонентов", "",
             f"Проверено: **{checks}** компонентов. Ошибок: **{counts.get('error', 0)}**, предупреждений: **{counts.get('warn', 0)}**.", "",
             "| severity | code | component | message |", "|---|---|---|---|"]
    for f in findings:
        lines.append(f"| {f['severity']} | `{f['code']}` | `{f['component']}` | {f['message']} |")
    MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"checked": checks, "counts": counts, "report": str(REPORT)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
