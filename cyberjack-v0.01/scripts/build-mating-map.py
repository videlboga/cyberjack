#!/usr/bin/env python3
"""Build the mating map for machine-module components (read-only over sources).

Inputs (never modified):
  public/models/machine-modules/component-catalog.json
  public/models/machine-modules/component-contracts.json
  docs/plans/connector-registry.json
  docs/plans/checks/mounting-audit.json
  public/models/machine-modules/device-catalog.json

Output:
  public/models/machine-modules/mating-map.json

Edge semantics are deliberately conservative:
  native  — both points carry the same *registered* connector family, roles are
            complementary (out -> in) and the family is a direct-mate family.
            This is a NOMINAL family match, not a verified joint: the audit
            reports verifiable_mechanical_joints = 0 and flags socket/socket
            halves separately (gender_ok=false on the edge).
  adapter — a documented adapter part (connector-registry.adapter_matrix or
            point.mounts_on) sits between the two sides.
  custom  — no canonical family / no documented adapter: the fit is described
            only in free text, so no compatibility may be claimed.
  orphan  — a point or a whole family with no counterpart at all.
"""
import hashlib
import json
import os
from collections import Counter, OrderedDict, defaultdict
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MM = os.path.join(ROOT, "public/models/machine-modules")
OUT = os.path.join(MM, "mating-map.json")

CLASS_ORDER = [
    "STRUCTURE", "MOTION", "WORK", "RESTRAINT", "SURFACE",
    "FLUID", "SENSORY", "CONTROL", "UTILITY", "SERVICE",
]

ROLE_BY_CLASS = {
    "STRUCTURE": ("frame", "Несущая геометрия"),
    "MOTION": ("drive", "Привод / источник движения"),
    "WORK": ("tool", "Инструмент / насадка"),
    "RESTRAINT": ("restraint", "Фиксация"),
    "SURFACE": ("surface", "Поверхность"),
    "FLUID": ("fluid", "Подача жидкости"),
    "SENSORY": ("sensory", "Сенсорика"),
    "CONTROL": ("control", "Управление"),
    "UTILITY": ("utility", "Инфраструктура"),
    "SERVICE": ("service", "Сервис / док"),
}

ROLE_OVERRIDES = {
    "work_attach_adapter": ("adapter", "Переходник"),
    "work_attach_carousel": ("changer", "Смена насадок"),
    "work_rotary_drum": ("magazine", "Магазин насадок"),
    "work_attach_sleeve": ("consumable", "Расходник"),
    "work_attach_sterile_liner": ("consumable", "Расходник"),
    "surface_liner": ("consumable", "Расходник"),
    "fluid_mixer": ("fluid", "Смешивание"),
    "support_cradle": ("support", "Опоры / ложементы"),
}

# Families that describe a direct part-to-part mate (used for native edges).
TOOL_POINTS = {"tool_out", "tool_boss_out"}

# adapter_matrix talks in spec strings, the graph in family ids
ADAPTER_FAMS = [
    ("ISO 9409-1-50-4-M6", "CJ-TOOL-ISO50"),
    ("Ø84 quick-change", "CJ-TOOL-ISO50"),
    ("bayonet B25", "CJ-TOOL-B25"),
    ("bayonet B40", "CJ-TOOL-B40"),
    ("bayonet B50", "CJ-TOOL-B50"),
    ("clevis Ø8", "CJ-CLEVIS-8"),
    ("M12 pitch 0,6", "CJ-STR-M12"),
    ("rail 55×42", "CJ-RAIL-15"),
    ("dock Ø23 pin", "CJ-DOCK-M"),
]


def fams_in(text):
    text = text or ""
    out = []
    for needle, fid in ADAPTER_FAMS:
        if needle in text and fid not in out:
            out.append(fid)
    return out


DIRECT_MATE = {
    "CJ-STR-M12", "CJ-STR-M8", "CJ-DECK", "CJ-RAIL-15", "CJ-DOCK-M",
    "CJ-TOOL-ISO50", "CJ-TOOL-B25", "CJ-TOOL-B40", "CJ-TOOL-B50",
    "CJ-TOOL-D90", "CJ-TOOL-PLATE", "CJ-TOOL-CHUCK-43", "CJ-TOOL-BOSS-60",
    "CJ-OSC-PLATE", "CJ-TABLE-T900", "CJ-CLEVIS-8",
}
MEDIA = {"CJ-PWR-C20", "CJ-PWR-C14", "CJ-PWR-DC24", "CJ-SIG-RJ45",
         "CJ-SIG-USBC", "CJ-SIG-M12D", "CJ-QD-F10", "CJ-QD-F16"}
MEDIA_KIND = {"CJ-PWR": "power", "CJ-SIG": "signal", "CJ-QD": "fluid"}


def sha16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def load(rel):
    p = os.path.join(ROOT, rel)
    return json.load(open(p, encoding="utf-8")), p


def cut(s, n):
    if not isinstance(s, str):
        return s
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


# ---------------------------------------------------------------- direction
def make_direction(contracts):
    def direction(cid, mate):
        c = contracts.get(cid) or {}
        pid = mate["id"]
        for group in (c.get("interfaces") or {}).values():
            for key, d in (("inputs", "in"), ("outputs", "out")):
                for p in group.get(key) or []:
                    if p.get("id") == pid:
                        return p.get("direction") or d
        role = mate.get("role")
        if role == "output":
            return "out"
        if role == "input":
            return "in"
        if pid.endswith("_in") or pid.startswith("in_"):
            return "in"
        if pid.endswith("_out") or pid.endswith("_out_a") or pid.endswith("_out_b") \
                or pid.startswith("out_") or pid.endswith("_output"):
            return "out"
        return None
    return direction


# ---------------------------------------------------------------- main build
def main():
    catalog, cat_path = load("public/models/machine-modules/component-catalog.json")
    contracts_raw, ct_path = load("public/models/machine-modules/component-contracts.json")
    registry, reg_path = load("docs/plans/connector-registry.json")
    audit, aud_path = load("docs/plans/checks/mounting-audit.json")
    devices, dev_path = load("public/models/machine-modules/device-catalog.json")

    contracts = contracts_raw["components"]
    comps = {c["id"]: c for c in catalog["components"]}
    direction = make_direction(contracts)

    # audit: point -> family / orphan reason; component -> legacy families
    audit_point = {}
    legacy_fam = defaultdict(set)
    comp_legacy_families = defaultdict(set)
    for comp in audit["components"]:
        for p in comp["points"]:
            audit_point[(comp["id"], p["id"])] = p
            legacy_fam[p["family"]].add(comp["id"])
            comp_legacy_families[comp["id"]].add(p["family"])

    orphan_reason = {}
    for o in audit["orphans"]:
        orphan_reason[(o["component"], o["point"])] = o

    conflict_by_family = defaultdict(list)
    for c in audit["conflicts"]:
        conflict_by_family[c["family"]].append(c)

    conflict_by_comp = defaultdict(list)
    conflict_sev = {}
    for c in audit["conflicts"]:
        for cid in c.get("components") or []:
            conflict_by_comp[cid].append(c["id"])
            rank = {"error": 3, "warn": 2, "info": 1}.get(c["severity"], 0)
            if rank > conflict_sev.get(cid, 0):
                conflict_sev[cid] = rank

    usage = defaultdict(list)
    for d in devices["devices"]:
        for m in d.get("modules") or []:
            usage[m].append({"id": d["id"], "name": d["name"], "code": d.get("code")})

    fam_defs = {f["id"]: f for f in registry["families"]}
    adapters = registry["adapter_matrix"]

    # ------------------------------------------------------------- points
    points = []
    nodes = []
    for cid, c in comps.items():
        role, role_name = ROLE_OVERRIDES.get(cid, ROLE_BY_CLASS.get(c["class"], ("other", "—")))
        dof = (contracts.get(cid) or {}).get("dof") or []
        motion = ((c.get("model") or {}).get("motion") or {}).get("type") or "none"
        mate_rows = []
        fams = []
        conf_ids = set(conflict_by_comp.get(cid, []))
        orphan_pts = 0
        canon = 0
        for m in c.get("mates") or []:
            fam = m.get("connector")
            d = direction(cid, m)
            o = orphan_reason.get((cid, m["id"]))
            if o:
                orphan_pts += 1
            if fam and fam != "custom":
                canon += 1
                fams.append(fam)
            ap = audit_point.get((cid, m["id"])) or {}
            row = {
                "p": m["id"],
                "role": m.get("role"),
                "dir": d,
                "kind": m.get("kind"),
                "std": cut(m.get("standard"), 90),
                "family": fam or None,
                "gender": m.get("gender"),
                "conf": m.get("confidence"),
                "count": m.get("count"),
                "load_n": m.get("load_n"),
                "pitch": ([m.get("pitch_x_m"), m.get("pitch_z_m")]
                          if m.get("pitch_x_m") is not None or m.get("pitch_z_m") is not None
                          else ([m.get("pitch_m")] if m.get("pitch_m") is not None else None)),
                "source": cut(m.get("source"), 150),
                "note": cut(m.get("note"), 210),
                "conn_note": cut(m.get("connector_note"), 200),
                "mounts_on": m.get("mounts_on"),
                "tool_fn": cut(m.get("tool_function"), 220),
                "legacy_family": ap.get("family"),
                "orphan": ({"reason": o["reason"], "detail": cut(o["detail"], 160)} if o else None),
            }
            mate_rows.append(row)
            points.append({
                "comp": cid, "p": m["id"], "dir": d, "family": fam,
                "gender": m.get("gender"), "kind": m.get("kind"),
                "conf": m.get("confidence"), "legacy_family": ap.get("family"),
                "orphan": o["reason"] if o else None,
            })

        nodes.append({
            "id": cid,
            "code": c["code"],
            "class": c["class"],
            "cls_name": catalog["classes"][c["class"]]["name"],
            "name": c["name"],
            "role": role,
            "role_name": role_name,
            "purpose": cut(c.get("purpose"), 190),
            "status": c.get("status"),
            "motion": motion,
            "dof": [{"id": d["id"], "joint": d.get("joint"), "axis": d.get("axis"),
                     "range": d.get("range_m") or d.get("range_rad"),
                     "stroke_m": d.get("stroke_m")} for d in dof],
            "mate_count": len(mate_rows),
            "canon_count": canon,
            "custom_count": len(mate_rows) - canon,
            "families": sorted(set(fams)),
            "legacy_families": sorted(comp_legacy_families[cid]),
            "orphan_points": orphan_pts,
            "conflicts": sorted(conf_ids),
            "conflict_sev": ["", "info", "warn", "error"][conflict_sev.get(cid, 0)],
            "usage": usage.get(cid, []),
            "limits": cut(c.get("limits"), 200),
            "specs": {k: v for k, v in list((c.get("specs") or {}).items())[:6]},
            "mates": mate_rows,
            "declared_compat": c.get("compatibility") or [],
            "model": (c.get("model") or {}).get("file"),
        })

    nodes.sort(key=lambda n: (CLASS_ORDER.index(n["class"]), n["id"]))

    # ------------------------------------------------------------- families
    families = []
    for fid, f in fam_defs.items():
        fp = [p for p in points if p["family"] == fid]
        offers = [{"comp": p["comp"], "p": p["p"], "conf": p["conf"], "gender": p["gender"]}
                  for p in fp if p["dir"] == "out"]
        accepts = [{"comp": p["comp"], "p": p["p"], "conf": p["conf"], "gender": p["gender"]}
                   for p in fp if p["dir"] == "in"]
        neutral = [{"comp": p["comp"], "p": p["p"], "conf": p["conf"], "gender": p["gender"]}
                   for p in fp if p["dir"] not in ("in", "out")]
        # de-dup component ids in each bucket (a component may have 2 such points)
        def uniq(lst):
            seen, out = set(), []
            for x in lst:
                key = (x["comp"], x["p"])
                if key in seen:
                    continue
                seen.add(key)
                out.append(x)
            return out
        offers, accepts, neutral = uniq(offers), uniq(accepts), uniq(neutral)
        kind = MEDIA_KIND.get(fid.split("-")[1] if fid.startswith("CJ-") and len(fid.split("-")) > 1 else "", None)
        if fid.startswith("CJ-PWR"):
            kind = "power"
        elif fid.startswith("CJ-SIG"):
            kind = "signal"
        elif fid.startswith("CJ-QD"):
            kind = "fluid"
        is_media = fid in MEDIA
        if is_media:
            verdict = "media"
        elif not fp:
            verdict = "empty"
        elif offers and accepts:
            verdict = "two_sided"
        elif offers:
            verdict = "offer_only"
        elif accepts:
            verdict = "accept_only"
        else:
            verdict = "undirected"
        conf_ids = sorted({c["id"] for c in conflict_by_family.get(
            (registry_family_replaces(f, legacy_fam) or ""), [])})
        families.append({
            "id": fid,
            "status": f.get("status"),
            "spec": cut(f.get("spec"), 240),
            "rule": cut(f.get("rule"), 260),
            "sides": cut(f.get("sides"), 200),
            "replaces": f.get("replaces") or [],
            "geometry": f.get("geometry"),
            "points": len(fp),
            "components": sorted({p["comp"] for p in fp}),
            "offers": offers,
            "accepts": accepts,
            "neutral": neutral,
            "verdict": verdict,
            "media": is_media,
            "media_kind": kind,
            "direct_mate": fid in DIRECT_MATE,
            "legacy_covered": registry_family_replaces(f, legacy_fam),
            "conflicts": conf_ids,
        })
    families.sort(key=lambda f: (-f["points"], f["id"]))

    # ------------------------------------------------------------- edges
    edges = []
    seen_edge = set()

    def add_edge(a, ap, b, bp, family, kind, label, note, conf, gender_ok=None):
        key = (a, ap, b, bp, family, kind)
        if key in seen_edge:
            return
        seen_edge.add(key)
        edges.append({
            "id": "e%03d" % (len(edges) + 1),
            "from": a, "from_p": ap, "to": b, "to_p": bp,
            "family": family, "status": kind, "label": label,
            "note": note, "conf": conf, "gender_ok": gender_ok,
        })

    def comp_family_points(cid, fam):
        return [r for r in comps[cid]["mates"] if r.get("connector") == fam]

    # native edges: same registered family, out -> in, direct-mate families
    for fid in sorted(DIRECT_MATE):
        offs = [p for p in points if p["family"] == fid and p["dir"] == "out"]
        accs = [p for p in points if p["family"] == fid and p["dir"] == "in"]
        for o in offs:
            for a in accs:
                if o["comp"] == a["comp"]:
                    continue
                og, ag = o["gender"], a["gender"]
                gender_ok = (og == "male" and ag == "female") or (og == "female" and ag == "male")
                notes = []
                if not gender_ok:
                    if og == ag == "female":
                        notes.append("обе стороны female — ответной (male) половины в каталоге нет")
                    elif None in (og, ag):
                        notes.append("пол gender не задан у одной из сторон")
                of = fam_defs.get(fid, {})
                src = (comp_family_points(o["comp"], fid) or [{}])[0].get("note")
                add_edge(
                    o["comp"], o["p"], a["comp"], a["p"], fid, "native",
                    of.get("id", fid),
                    "номинальное совпадение семейства" + ("; " + "; ".join(notes) if notes else ""),
                    min(o["conf"] or "low", a["conf"] or "low",
                        key=lambda v: {"high": 3, "medium": 2, "low": 1}.get(v, 0)),
                    gender_ok,
                )

    # adapter edges documented by adapter_matrix: pistons -> ISO50 -> adapter
    for cid in [n["id"] for n in nodes
                if n["class"] == "MOTION" and any(m["p"] == "tool_out" and
                                                   m["family"] == "CJ-CLEVIS-8" for m in n["mates"])]:
        add_edge(cid, "tool_out", "work_attach_adapter", "flange_in", "CJ-CLEVIS-8", "adapter",
                 "ADP-CLV8-ISO50 + ADP-ISO50-B25",
                 "серьга Ø8 → фланец ISO50 → байонет Ø25; в каталоге нет ни одной ISO50-точки, "
                 "а flange_in у переходника сейчас B25 — по adapter_matrix его нужно пересобирать",
                 "medium", False)

    # custom edges: drive tool outputs that have no documented adapter path to B25
    for n in nodes:
        if n["class"] != "MOTION":
            continue
        outs = [m for m in n["mates"] if m["p"] in TOOL_POINTS]
        for m in outs:
            if m["family"] == "CJ-CLEVIS-8":
                continue
            add_edge(n["id"], m["p"], "work_attach_adapter", "flange_in", m["family"] or "custom",
                     "custom", "переходник не определён",
                     "в adapter_matrix нет перехода %s → ISO50/B25; связь показана как разрыв, "
                     "а не как совместимость" % (m["family"] or "custom"),
                     m["conf"] or "low", None)

    # custom documented: probe rotary -> rotary drum (mounts_on)
    add_edge("work_probe_rotary", "tool_in", "work_rotary_drum", "tool_in", "custom", "custom",
             "кольцо D58→D90 (mounts_on)",
             "крепление описано только текстом mounts_on; канонического семейства нет, "
             "D90-семейство не имеет ни одного выхода-привода", "high", None)

    # ------------------------------------------------------------- matrix
    drives = []
    for n in nodes:
        if n["class"] != "MOTION":
            continue
        for m in n["mates"]:
            if m["p"] in TOOL_POINTS:
                drives.append({"comp": n["id"], "name": n["name"], "p": m["p"],
                               "family": m["family"] or "custom", "std": m["std"],
                               "motion": n["motion"], "conf": m["conf"]})
    drives.sort(key=lambda d: (d["family"], d["comp"]))

    tools = []
    for n in nodes:
        for m in n["mates"]:
            if m["p"] == "tool_in":
                tools.append({"comp": n["id"], "name": n["name"], "class": n["class"],
                              "family": m["family"] or "custom", "std": m["std"],
                              "gender": m["gender"], "conf": m["conf"],
                              "mounts_on": m["mounts_on"], "p": m["p"]})
    # keep one row per component, prefer tool_in
    by_comp = OrderedDict()
    for t in tools:
        if t["comp"] not in by_comp or t["p"] == "tool_in":
            by_comp[t["comp"]] = t
    tools = list(by_comp.values())
    tools.sort(key=lambda t: (t["family"], t["comp"]))

    def adapter_path(f_from, f_to):
        """documented adapter path between two tool families (1..2 parts)."""
        if f_from == f_to:
            return None
        direct = [a for a in adapters if a["part"] != "-" and
                  ((f_from in fams_in(a["from_"]) and f_to in fams_in(a["to"])) or
                   (f_to in fams_in(a["from_"]) and f_from in fams_in(a["to"])))]
        if direct:
            return [direct[0]["part"]]
        # two-step through ISO 50
        iso = "ISO 9409-1-50-4-M6"
        a1 = [a for a in adapters if a["part"] != "-" and
              "CJ-TOOL-ISO50" in fams_in(a["to"]) and f_from in fams_in(a["from_"])]
        a2 = [a for a in adapters if a["part"] != "-" and
              "CJ-TOOL-ISO50" in fams_in(a["from_"]) and f_to in fams_in(a["to"])]
        if a1 and a2:
            return [a1[0]["part"], a2[0]["part"]]
        return None

    # matrix is family-level: 13 drive interfaces x 6 tool-socket families
    tool_fams = [f for f in ("CJ-TOOL-B25", "CJ-TOOL-B40", "CJ-TOOL-B50",
                             "CJ-TOOL-D90", "CJ-DOCK-M", "custom")
                 if any(t["family"] == f for t in tools)]
    cols = []
    for f in tool_fams:
        members = [t for t in tools if t["family"] == f]
        cols.append({
            "family": f,
            "count": len(members),
            "tools": [{"comp": t["comp"], "name": t["name"], "class": t["class"],
                       "mounts_on": t["mounts_on"]} for t in members],
        })
    cells = []
    for d in drives:
        for f in tool_fams:
            members = [t for t in tools if t["family"] == f]
            if f == "custom":
                status, parts = "custom", None
                note = "посадка описана только текстом — совместимость не заявляется"
            elif d["family"] == f:
                status, parts = "native", None
                note = "одно семейство, номинально"
            else:
                parts = adapter_path(d["family"], f)
                if parts:
                    status, note = "adapter", "через " + " + ".join(parts)
                else:
                    status, note = "custom", "переходник не определён"
            cells.append({"d": d["comp"] + "|" + d["p"], "drive": d["comp"], "family": f,
                          "status": status, "parts": parts, "note": note,
                          "count": len(members),
                          "tools": [t["comp"] for t in members]})

    # ------------------------------------------------------------- focus
    def tool_targets(fam):
        return [t for t in tools if t["family"] == fam]

    def drive_rows(fam):
        return [d for d in drives if d["family"] == fam]

    def card_for_drive(d):
        same = tool_targets(d["family"])
        others = [t for t in tools if t["family"] != d["family"]]
        fams = Counter(t["family"] for t in others)
        adapter = adapter_path(d["family"], "CJ-TOOL-B25")
        return {
            "comp": d["comp"], "name": d["name"], "motion": d["motion"],
            "iface": {"p": d["p"], "family": d["family"], "std": d["std"], "dir": "out"},
            "can": [{"comp": t["comp"], "name": t["name"], "family": t["family"],
                     "status": "native"} for t in same],
            "can_adapted": ([{"parts": adapter, "target": "CJ-TOOL-B25",
                              "count": len(tool_targets("CJ-TOOL-B25"))}] if adapter else []),
            "cannot_families": [{"family": f, "count": n} for f, n in fams.most_common()],
            "source": "component-catalog.mates + connector-registry.families",
        }

    focus_cards = {}
    osc = comps["motion_oscillating"]
    focus_cards["oscillator"] = {
        "lede": "Осциллятор отдаёт не фланец, а плиту ползуна: по правилу CJ-OSC-PLATE осевой "
                "хвостовик и ISO-фланец Ø50 в центре плиты не размещаются (там палец шатуна Ø12).",
        "cards": [{
            "comp": "motion_oscillating", "name": osc["name"], "motion": "slide",
            "iface": {"p": "tool_out", "family": "CJ-OSC-PLATE",
                      "std": [m for m in osc["mates"] if m["id"] == "tool_out"][0]["standard"],
                      "dir": "out"},
            "can": [],
            "can_adapted": [],
            "cannot_families": [{"family": "CJ-TOOL-B25", "count": len(tool_targets("CJ-TOOL-B25"))},
                                {"family": "CJ-TOOL-B40", "count": len(tool_targets("CJ-TOOL-B40"))},
                                {"family": "CJ-TOOL-B50", "count": len(tool_targets("CJ-TOOL-B50"))},
                                {"family": "CJ-TOOL-D90", "count": len(tool_targets("CJ-TOOL-D90"))}],
            "verdict": "накладной инструмент с плоской пятой; в каталоге таких насадок нет",
            "source": "connector-registry.families[CJ-OSC-PLATE].rule",
        }],
    }

    focus_cards["pistons"] = {
        "lede": "Четыре поршня отдают палец серьги (CJ-CLEVIS-8), а не фланец. Приёмников серьги "
                "в каталоге два: рама головы и перьевой веер. Ни одна насадка B25/B40/B50 так не садится.",
        "cards": [card_for_drive(d) for d in drives if d["family"] == "CJ-CLEVIS-8"],
    }

    probe_ids = ["work_probe_linear", "work_probe_rotary", "work_probe_inflatable",
                 "work_probe_textured", "work_probe_thermal"]
    probe_cards = []
    for pid in probe_ids:
        n = next(x for x in nodes if x["id"] == pid)
        t = by_comp.get(pid)
        if not t:
            continue
        same = drive_rows(t["family"]) if t["family"] != "custom" else []
        probe_cards.append({
            "comp": pid, "name": n["name"], "motion": n["motion"],
            "iface": {"p": t["p"], "family": t["family"], "std": t["std"], "dir": "in"},
            "can": [{"comp": d["comp"], "name": d["name"], "family": d["family"],
                     "status": "native"} for d in same],
            "mounts_on": t["mounts_on"] or [],
            "cannot_families": [{"family": f, "count": c} for f, c in
                                Counter(d["family"] for d in drives if d["family"] != t["family"]).most_common()],
            "source": "component-catalog.mates." + pid + ".tool_in.mounts_on",
        })
    focus_cards["probes"] = {
        "lede": "Зонды — насадки привода, но их посадки описаны только текстом mounts_on: "
                "у четырёх из пяти канонического семейства нет (connector=custom).",
        "cards": probe_cards,
    }

    ad = comps["work_attach_adapter"]
    focus_cards["adapter"] = {
        "lede": "Единственный переходник в библиотеке — B25/B25. По adapter_matrix его вход должен "
                "стать фланцем ISO 9409-1-50-4-M6, иначе он не садится ни на один привод.",
        "cards": [{
            "comp": "work_attach_adapter", "name": ad["name"], "motion": "none",
            "iface": {"p": "flange_in", "family": "CJ-TOOL-B25",
                      "std": [m for m in ad["mates"] if m["id"] == "flange_in"][0]["standard"],
                      "dir": "in"},
            "can": [{"comp": t["comp"], "name": t["name"], "family": t["family"], "status": "native"}
                    for t in tool_targets("CJ-TOOL-B25") if t["comp"] != "work_attach_adapter"],
            "mounts_on": [m["mounts_on"] for m in ad["mates"] if m.get("mounts_on")],
            "cannot_families": [{"family": "CJ-TOOL-B40", "count": len(tool_targets("CJ-TOOL-B40"))},
                                {"family": "CJ-TOOL-B50", "count": len(tool_targets("CJ-TOOL-B50"))},
                                {"family": "CJ-TOOL-D90", "count": len(tool_targets("CJ-TOOL-D90"))}],
            "verdict": "вход Ø20 (факт) против Ø50 ISO (требование реестра) — пересборка, не переходник",
            "source": "connector-registry.adapter_matrix[ADP-ISO50-B25].note",
        }],
    }

    # ------------------------------------------------------------- summary
    canon_pts = sum(1 for p in points if p["family"] and p["family"] != "custom")
    status_counts = Counter(e["status"] for e in edges)
    two_sided = [f["id"] for f in families if f["verdict"] == "two_sided"]
    mechanical_two_sided = [f for f in two_sided if f in DIRECT_MATE]
    no_connector = [n["id"] for n in nodes if n["canon_count"] == 0]
    unused = [n["id"] for n in nodes if not n["usage"]]
    with_conf = [n["id"] for n in nodes if n["conflicts"]]
    iso = [n for n in nodes if "CJ-TOOL-ISO50" in n["families"]]

    out = {
        "format": "cyberjack-mating-map/1",
        "revision": "0.1",
        "generated": datetime.now(timezone(timedelta(hours=3))).isoformat(timespec="seconds"),
        "mode": "read-only",
        "disclaimer": "Вымышленное оборудование Cyberjack. Схема совмещения, не инженерная и не "
                      "медицинская документация. Источники не изменялись.",
        "sources": [
            {"path": "public/models/machine-modules/component-catalog.json",
             "bytes": os.path.getsize(cat_path), "sha256_16": sha16(cat_path)},
            {"path": "public/models/machine-modules/component-contracts.json",
             "bytes": os.path.getsize(ct_path), "sha256_16": sha16(ct_path)},
            {"path": "docs/plans/connector-registry.json",
             "bytes": os.path.getsize(reg_path), "sha256_16": sha16(reg_path)},
            {"path": "docs/plans/checks/mounting-audit.json",
             "bytes": os.path.getsize(aud_path), "sha256_16": sha16(aud_path)},
            {"path": "public/models/machine-modules/device-catalog.json",
             "bytes": os.path.getsize(dev_path), "sha256_16": sha16(dev_path)},
        ],
        "rules": {
            "native": "одна зарегистрированная семья, роли out→in, семья прямого стыка. "
                      "Номинально: попарная геометрия не проверялась (аудит: 0 проверяемых стыков).",
            "adapter": "между сторонами стоит документированный переходник "
                       "(connector-registry.adapter_matrix или mounts_on точки).",
            "custom": "канонической семьи нет или переходник не определён — совместимость "
                      "не заявляется, связь нарисована как разрыв.",
            "orphan": "у точки или семьи нет ответной стороны (односторонняя семья, "
                      "pitch_mismatch, dialect_split, media_endpoint).",
            "geometry": "позиции точек заданы в локальных координатах GLB и не сравнивались.",
        },
        "summary": {
            "components": len(nodes),
            "points": len(points),
            "points_catalog": len(points),
            "points_audit": audit["summary"]["points"],
            "canonical_points": canon_pts,
            "custom_points": len(points) - canon_pts,
            "families": len(families),
            "families_two_sided": len(two_sided),
            "families_mechanical_two_sided": mechanical_two_sided,
            "families_one_sided": len([f for f in families if f["verdict"] in ("offer_only", "accept_only")]),
            "edges_native": status_counts.get("native", 0),
            "edges_adapter": status_counts.get("adapter", 0),
            "edges_custom": status_counts.get("custom", 0),
            "components_without_family": len(no_connector),
            "components_without_usage": len(unused),
            "components_with_conflicts": len(with_conf),
            "components_iso50": len(iso),
            "orphan_points": audit["summary"]["orphan_points"],
            "orphan_by_reason": audit["orphans_summary"],
            "verified_joints": audit["summary"]["verifiable_mechanical_joints"],
            "conflicts": len(audit["conflicts"]),
            "drives": len(drives),
            "tools": len(tools),
            "matrix": {s: sum(1 for c in cells if c["status"] == s)
                       for s in ("native", "adapter", "custom")},
            "matrix_cells": len(cells),
        },
        "classes": {k: {"name": v["name"], "purpose": v["purpose"], "accent": v["accent"]}
                    for k, v in catalog["classes"].items()},
        "class_order": CLASS_ORDER,
        "roles": {k: v[1] for k, v in ROLE_BY_CLASS.items()},
        "families": families,
        "adapters": adapters,
        "nodes": nodes,
        "edges": edges,
        "matrix": {"drives": drives, "cols": cols, "cells": cells},
        "focus": focus_cards,
        "conflicts": audit["conflicts"],
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("wrote", OUT, os.path.getsize(OUT), "bytes")
    print("summary:", json.dumps(out["summary"], ensure_ascii=False, indent=1))
    print("edges:", Counter(e["status"] for e in edges))
    print("edge list:")
    for e in edges:
        print("  %-26s %-14s -> %-24s %-14s %-8s %s" % (
            e["from"], e["from_p"], e["to"], e["to_p"], e["status"], e["label"]))
    print("\nfamily verdicts:")
    for f in families:
        print("  %-17s %-12s pts%3d off%3d acc%3d neu%3d  %s" % (
            f["id"], f["verdict"], f["points"], len(f["offers"]), len(f["accepts"]),
            len(f["neutral"]), ",".join(f["conflicts"])))


def registry_family_replaces(f, legacy_fam):
    """legacy family name a registry family replaces, if any (for conflict links)."""
    for rep in f.get("replaces") or []:
        if rep in legacy_fam:
            return rep
    return None


if __name__ == "__main__":
    main()
