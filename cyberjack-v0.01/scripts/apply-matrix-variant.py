#!/usr/bin/env python3
"""Integrate restraint_matrix_universal (Mk-II) as a *variant* of restraint_matrix.

Sources of truth (read-only inputs):
  docs/plans/checks/restraint-hard-mount-spec.json
      matrix.universal.mates        — 29 точек приёма (гнёзда CJ-LATCH-30R + рельсы)
      matrix.mk1                    — legacy-флаги Mk-I
  docs/plans/blockout/component-library/restraint_matrix_universal/report.json
      nodes / glb_bytes / envelope / checks / carriage positions
  public/models/machine-modules/components/restraint_matrix_universal.glb
      фактический центр пальца каждого гнезда (по вершинам, read-only)

What it writes into component-catalog.json (component restraint_matrix only):
  variants          += "универсальная матрица"
  model.variants     = [ flexible Mk-I (default), universal Mk-II ]
  mates             += 29 точек варианта (variant="universal", position = центр
                       пальца по GLB); существующие точки Mk-I помечаются
                       variant="flexible" и не меняются по существу

Ни GLB, ни contracts, ни другие компоненты не изменяются. Идемпотентно.
"""
import json
import os
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MM = os.path.join(ROOT, "public/models/machine-modules")
CAT = os.path.join(MM, "component-catalog.json")
SPEC = os.path.join(ROOT, "docs/plans/checks/restraint-hard-mount-spec.json")
REP_REL = "docs/plans/blockout/component-library/restraint_matrix_universal/report.json"
REP = os.path.join(ROOT, REP_REL)
GLB_REL = "components/restraint_matrix_universal.glb"
GLB = os.path.join(MM, GLB_REL)

COMP_ID = "restraint_matrix"
UNI_LABEL = "Универсальная Mk-II"
UNI_VARIANT_LABEL = "универсальная матрица"
POS_TOL = 0.0005          # 0,5 мм: меньше — позиция спека считается совпавшей


# --------------------------------------------------------------------- GLB
def _trs(node):
    if "matrix" in node:
        m = node["matrix"]                     # column-major
        return [[m[0], m[4], m[8], m[12]],
                [m[1], m[5], m[9], m[13]],
                [m[2], m[6], m[10], m[14]],
                [m[3], m[7], m[11], m[15]]]
    tx, ty, tz = node.get("translation", [0, 0, 0])
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx],
            [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty],
            [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz],
            [0.0, 0.0, 0.0, 1.0]]


def _mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def _apply(m, p):
    return [sum(m[i][k] * p[k] for k in range(3)) + m[i][3] for i in range(3)]


def glb_reader(path):
    data = open(path, "rb").read()
    assert data[:4] == b"glTF", "not a GLB: %s" % path
    off, js = 12, None
    while off < len(data):
        ln, ty = struct.unpack_from("<II", data, off)
        if ty == 0x4E4F534A:
            js = json.loads(data[off + 8:off + 8 + ln].decode("utf-8"))
        off += 8 + ln
    return js


def node_centres(path, name_part):
    """{имя узла: (центр bbox в мировых координатах)} для узлов, содержащих name_part."""
    js = glb_reader(path)
    nodes, meshes, accs = js.get("nodes", []), js.get("meshes", []), js.get("accessors", [])
    out = {}

    def rec(idx, parent):
        n = nodes[idx]
        m = _mul(parent, _trs(n))
        nm = n.get("name", "")
        if "mesh" in n and name_part in nm:
            lo = [float("inf")] * 3
            hi = [float("-inf")] * 3
            for prim in meshes[n["mesh"]].get("primitives", []):
                a = accs[prim["attributes"]["POSITION"]]
                if "min" not in a:
                    continue
                for xi in (0, 1):
                    for yi in (0, 1):
                        for zi in (0, 1):
                            p = _apply(m, [a["min"][0] if xi else a["max"][0],
                                           a["min"][1] if yi else a["max"][1],
                                           a["min"][2] if zi else a["max"][2]])
                            for k in range(3):
                                lo[k] = min(lo[k], p[k])
                                hi[k] = max(hi[k], p[k])
            if lo[0] != float("inf"):
                out[nm] = [round((lo[k] + hi[k]) / 2.0, 5) for k in range(3)]
        for ch in n.get("children", []):
            rec(ch, m)

    ident = [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]
    for r in js.get("scenes", [{}])[js.get("scene", 0)].get("nodes", []):
        rec(r, ident)
    return out


def pin_for(mate_id, pins):
    """Гнездо s01 → socket_pin_01; каретка c05 → recv_pin_05."""
    if mate_id.startswith("latch_socket_"):
        tag = mate_id[len("latch_socket_"):]          # s01
        stem = "socket_pin_" + tag[1:]
    elif mate_id.startswith("latch_c"):
        stem = "recv_pin_" + mate_id[len("latch_c"):]
    else:
        return None, None
    for name, c in pins.items():
        if stem + "_" in name or name.endswith(stem):
            return name, c
    return None, None


# --------------------------------------------------------------------- main
def main():
    cat = json.load(open(CAT, encoding="utf-8"))
    spec = json.load(open(SPEC, encoding="utf-8"))
    rep = json.load(open(REP, encoding="utf-8"))
    uni = spec["matrix"]["universal"]
    mk1 = spec["matrix"]["mk1"]
    comp = next(c for c in cat["components"] if c["id"] == COMP_ID)
    model = comp["model"]

    pins = {}
    pins.update(node_centres(GLB, "socket_pin_"))
    pins.update(node_centres(GLB, "recv_pin_"))

    # ---- 1. model.variants: flexible Mk-I (default) + universal Mk-II -----
    flex_entry = {
        "id": "flexible",
        "label": "Гибкий Mk-I",
        "file": model["file"],
        "prefix": model["prefix"],
        "nodes": model.get("nodes"),
        "bytes": os.path.getsize(os.path.join(MM, model["file"])),
        "quality": model.get("quality"),
        "default": True,
        "note": "Mk-I сдан: 7 кареток, рельс 56×28, манжеты вклеены — legacy, не пересобирается",
    }
    uni_entry = {
        "id": "universal",
        "label": UNI_LABEL,
        "file": GLB_REL,
        "prefix": "restraint_matrix_universal",
        "variant_of": COMP_ID,
        "code": rep.get("code"),
        "nodes": rep["nodes"],
        "bytes": os.path.getsize(GLB),
        "quality": "universal-mk2",
        "report": REP_REL,
        "standard": "CJ-LATCH-30R + CJ-RAIL-15",
        "carriage_count": rep.get("carriage_count"),
        "sockets": rep.get("sockets"),
        "envelope_new_m": rep.get("bbox_size"),
        "envelope_fits": bool(rep.get("bbox_ok")),
        "checks": rep.get("checks"),
    }
    model["variants"] = [flex_entry, uni_entry]
    model["variant_default"] = "flexible"

    # ---- 2. human-readable variants list ----------------------------------
    variants = list(comp.get("variants") or [])
    if UNI_VARIANT_LABEL not in variants:
        variants.append(UNI_VARIANT_LABEL)
    comp["variants"] = variants

    # ---- 3. mates: Mk-I точки = variant "flexible", += 29 точек Mk-II ----
    # Общие точки (mount_in / level_feet) не дублируются: они остаются одной
    # записью с "variants": [flexible, universal]; при повторном прогоне метка
    # снимается и точка возвращается к виду variant="flexible".
    mates, base_by_id = [], {}
    for m in comp.get("mates") or []:
        if m.get("variant") == "universal":
            continue
        m = dict(m)
        if m.pop("variants", None):
            m["variant"] = "flexible"
        m.setdefault("variant", "flexible")
        mates.append(m)
        base_by_id[m["id"]] = m

    def same_point(a, sm):
        pa, pb = a.get("position_m") or [], sm.get("position_m") or []
        na, nb = a.get("normal") or [0, 1, 0], sm.get("normal") or [0, 1, 0]
        if len(pa) != 3 or len(pb) != 3 or a.get("kind") != sm.get("kind"):
            return False
        return (max(abs(pa[i] - pb[i]) for i in range(3)) <= POS_TOL
                and max(abs(na[i] - nb[i]) for i in range(3)) <= 1e-6)

    added, shared = [], []
    for sm in uni["mates"]:
        node, centre = pin_for(sm["id"], pins)
        pos = list(sm["position_m"])
        source = "spec: docs/plans/checks/restraint-hard-mount-spec.json → matrix.universal.mates.%s" % sm["id"]
        note = "Точка приёма Mk-II (гнездо CJ-LATCH-30R)."
        if centre:
            dx = max(abs(centre[i] - pos[i]) for i in range(3))
            if dx > POS_TOL:
                if dx > 0.05:
                    note += (" Позиция спека %s устарела: по вершинам GLB палец %s стоит в %s "
                             "(Δ %.0f мм)." % (pos, node, centre, dx * 1000.0))
                else:
                    note += (" Центр пальца Ø12 по GLB %s = %s, в спеке %s (Δ %.1f мм): "
                             "корпус гнезда сдвинут от линии рельса." % (node, centre, pos, dx * 1000.0))
            else:
                note += " Совпадает со спеком (центр пальца %s)." % node
            pos = centre
            source += "; pin:%s (bbox по вершинам)" % node

        # --- общая точка Mk-I/Mk-II: одна запись, два варианта --------------
        base = base_by_id.get(sm["id"])
        if base is not None:
            if same_point(base, sm):
                base.pop("variant", None)
                base["variants"] = ["flexible", "universal"]
                shared.append(sm["id"])
                continue
            note += (" id %s_mk2: у Mk-I то же имя с другим ложем/размером — "
                     "запись Mk-I не перезаписывается." % sm["id"])

        if sm["id"] in ("latch_c05", "latch_c06"):
            note += (" Каретка перенесена с z ±0,44 на ±0,24 (report.deviations): "
                     "на наружных рельсах стоят 6 фиксированных гнёзд.")
        if sm["id"] == "latch_c08":
            note += (" Каретка c08 (шея) стоит на z = −0,24; в спеке указано +0,24 — "
                     "знак в спеке ошибочен, по GLB принято −0,24.")
        entry = {
            "id": sm["id"] if base is None else sm["id"] + "_mk2",
            "role": sm.get("role"),
            "kind": sm.get("kind"),
            "standard": sm.get("standard"),
            "gender": sm.get("gender"),
            "position_m": [round(v, 4) for v in pos],
            "normal": sm.get("normal"),
            "axis": sm.get("axis"),
            "load_n": sm.get("load_n"),
            "connector": sm.get("connector") or "custom",
            "source": source,
            "confidence": "high",
            "note": note,
            "variant": "universal",
            "report": REP_REL,
        }
        if sm.get("connector_note"):
            entry["connector_note"] = sm["connector_note"]
        if sm.get("size_m") is not None:
            entry["size_m"] = sm["size_m"]
        if sm.get("count") is not None:
            entry["count"] = sm["count"]
        if sm.get("pitch_x_m") is not None:
            entry["pitch_x_m"] = sm["pitch_x_m"]
        if sm.get("pitch_z_m") is not None:
            entry["pitch_z_m"] = sm["pitch_z_m"]
        mates.append(entry)
        added.append((entry["id"], entry["position_m"], bool(centre)))

    comp["mates"] = mates

    # ---- 4. traceability: variant_models + legacy flags -------------------
    comp["variant_models"] = [{
        "id": "universal",
        "label": UNI_LABEL,
        "component": "restraint_matrix_universal",
        "code": rep.get("code"),
        "file": GLB_REL,
        "report": REP_REL,
        "source": "docs/plans/checks/restraint-hard-mount-spec.json → matrix.universal",
    }]
    comp["legacy_flags"] = mk1.get("legacy_flags") or []

    with open(CAT, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("updated", os.path.relpath(CAT, ROOT), os.path.getsize(CAT), "bytes")
    print("model.variants:", [(v["id"], v["nodes"], v["bytes"]) for v in model["variants"]])
    print("component.variants:", comp["variants"])
    print("mates: Mk-I %d + Mk-II %d = %d (общих: %s)"
          % (len(mates) - len(added), len(added), len(mates), ", ".join(shared) or "—"))
    print("pins found in GLB:", len(pins))
    ids = [m["id"] for m in mates]
    assert len(ids) == len(set(ids)), "duplicate mate ids: %s" % [
        i for i in ids if ids.count(i) > 1]
    for mid, pos, by_pin in added:
        print("  %-18s %-26s %s" % (mid, str(pos), "pin" if by_pin else "spec"))


if __name__ == "__main__":
    main()
