#!/usr/bin/env python3
"""Independent bounds/vector check for mate points (read-only).

Uses only GLB JSON accessor min/max + node world matrices; no Blender.
Checks every mate.position_m against the component's glTF root bbox and
normal/axis unit length. Writes docs/plans/checks/mate-bounds.json.
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
MODELS = ROOT / "public" / "models" / "machine-modules"
CATALOG = MODELS / "component-catalog.json"
OUT = ROOT / "docs" / "plans" / "checks" / "mate-bounds.json"
TOL = 0.010  # 10 mm

IDENT = np.eye(4, dtype=float)


def load_glb(path):
    b = path.read_bytes()
    magic, ver, total = struct.unpack_from("<III", b, 0)
    if magic != 0x46546C67:
        raise ValueError(f"not glb: {path}")
    off = 12
    js = None
    while off < total:
        clen, ctype = struct.unpack_from("<II", b, off)
        off += 8
        chunk = b[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
    if js is None:
        raise ValueError(f"no json: {path}")
    return js


def trs(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=float).reshape(4, 4).T
    t = np.array(node.get("translation", [0, 0, 0]), dtype=float)
    r = np.array(node.get("rotation", [0, 0, 0, 1]), dtype=float)
    s = np.array(node.get("scale", [1, 1, 1]), dtype=float)
    x, y, z, w = r
    rot = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
        [0, 0, 0, 1],
    ], dtype=float)
    out = rot
    out[:3, :3] = out[:3, :3] @ np.diag(s)
    out[:3, 3] = t
    return out


def bbox(js):
    nodes = js.get("nodes", [])
    meshes = js.get("meshes", [])
    accessors = js.get("accessors", [])
    scene = js.get("scenes", [{}])[js.get("scene", 0)]
    mn = np.array([math.inf] * 3)
    mx = np.array([-math.inf] * 3)

    def walk(i, parent):
        nonlocal mn, mx
        node = nodes[i]
        m = parent @ trs(node)
        mesh = node.get("mesh")
        if mesh is not None:
            for prim in meshes[mesh].get("primitives", []):
                ai = prim.get("attributes", {}).get("POSITION")
                if ai is None:
                    continue
                acc = accessors[ai]
                lo = np.array(acc.get("min", []), dtype=float)
                hi = np.array(acc.get("max", []), dtype=float)
                if lo.size != 3 or hi.size != 3:
                    continue
                for x in (lo[0], hi[0]):
                    for y in (lo[1], hi[1]):
                        for z in (lo[2], hi[2]):
                            p = m @ np.array([x, y, z, 1.0])
                            mn = np.minimum(mn, p[:3])
                            mx = np.maximum(mx, p[:3])
        for ch in node.get("children", []):
            walk(ch, m)

    for root in scene.get("nodes", []):
        walk(root, IDENT)
    return mn, mx


def unit(v):
    a = np.array(v, dtype=float)
    n = np.linalg.norm(a)
    return n if n > 1e-9 else 0.0


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))["components"]
    errors = []
    warnings = []
    rows = []
    for comp in catalog:
        cid = comp["id"]
        mates = comp.get("mates") or []
        path = MODELS / "components" / f"{cid}.glb"
        try:
            mn, mx = bbox(load_glb(path))
        except Exception as e:
            errors.append(f"{cid}: bbox failed: {e}")
            continue
        size = mx - mn
        for m in mates:
            p = np.array(m.get("position_m", []), dtype=float)
            if p.size != 3:
                errors.append(f"{cid}/{m.get('id')}: bad position")
                continue
            outside = np.maximum(mn - p, p - mx)
            worst = float(outside.max())
            if worst > TOL:
                errors.append(
                    f"{cid}/{m.get('id')}: outside bbox by {worst:.4f} m at {p.tolist()}")
            for key in ("normal", "axis"):
                if key not in m:
                    continue
                n = unit(m[key])
                if abs(n - 1.0) > 1e-3:
                    warnings.append(f"{cid}/{m.get('id')}: {key} norm {n:.5f}")
        rows.append({
            "id": cid, "mates": len(mates),
            "bbox_min": [round(float(x), 5) for x in mn],
            "bbox_max": [round(float(x), 5) for x in mx],
            "size": [round(float(x), 5) for x in size],
        })
    OUT.write_text(json.dumps({
        "format": "cj-mate-bounds/1",
        "tolerance_m": TOL,
        "components": len(rows),
        "mates": sum(r["mates"] for r in rows),
        "errors": errors,
        "warnings": warnings,
        "rows": rows,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "components": len(rows),
        "mates": sum(r["mates"] for r in rows),
        "errors": len(errors),
        "warnings": len(warnings),
        "sample_errors": errors[:12],
        "sample_warnings": warnings[:12],
    }, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
