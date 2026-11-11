#!/usr/bin/env python3
"""Read GLB node geometry (world bbox per node) — small helper for mate marking.

Not a general glTF loader: handles the subset our builders emit (nodes with
TRS or matrix, meshes with POSITION accessors that carry min/max).
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np


def load_glb(path: Path) -> dict:
    b = path.read_bytes()
    clen, _ = struct.unpack("<II", b[12:20])
    return json.loads(b[20:20 + clen])


def node_matrix(n: dict) -> np.ndarray:
    if "matrix" in n:
        return np.array(n["matrix"], dtype=float).reshape(4, 4).T
    t = np.eye(4)
    s = np.array(n.get("scale", [1, 1, 1]), dtype=float)
    r = np.array(n.get("rotation", [0, 0, 0, 1]), dtype=float)  # xyzw
    x, y, z, w = r
    rot = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
    t[:3, :3] = rot @ np.diag(s)
    t[:3, 3] = np.array(n.get("translation", [0, 0, 0]), dtype=float)
    return t


def world_boxes(path: Path) -> dict[str, dict]:
    """name -> {center, size, min, max} in the GLB frame (metres)."""
    g = load_glb(path)
    nodes = g.get("nodes", [])
    meshes = g.get("meshes", [])
    accessors = g.get("accessors", [])
    out: dict[str, dict] = {}

    def local_box(n: dict):
        if "mesh" not in n:
            return None
        mn = np.array([np.inf] * 3)
        mx = np.array([-np.inf] * 3)
        for prim in meshes[n["mesh"]].get("primitives", []):
            pos = prim.get("attributes", {}).get("POSITION")
            if pos is None:
                continue
            a = accessors[pos]
            if "min" not in a or "max" not in a:
                continue
            mn = np.minimum(mn, np.array(a["min"], dtype=float))
            mx = np.maximum(mx, np.array(a["max"], dtype=float))
        if not np.isfinite(mn).all():
            return None
        return mn, mx

    def walk(idx: int, parent: np.ndarray):
        n = nodes[idx]
        m = parent @ node_matrix(n)
        box = local_box(n)
        if box is not None:
            mn, mx = box
            corners = np.array([[x, y, z, 1.0] for x in (mn[0], mx[0])
                                for y in (mn[1], mx[1]) for z in (mn[2], mx[2])])
            w = (m @ corners.T).T[:, :3]
            out[n.get("name", f"node{idx}")] = {
                "min": w.min(axis=0).round(5).tolist(),
                "max": w.max(axis=0).round(5).tolist(),
                "center": ((w.min(axis=0) + w.max(axis=0)) / 2).round(5).tolist(),
                "size": (w.max(axis=0) - w.min(axis=0)).round(5).tolist(),
            }
        for ch in n.get("children", []):
            walk(ch, m)

    scene = g.get("scenes", [{}])[g.get("scene", 0)]
    for root in scene.get("nodes", []):
        walk(root, np.eye(4))
    return out


if __name__ == "__main__":
    import sys
    p = Path(sys.argv[1])
    for name, b in sorted(world_boxes(p).items()):
        print(f"{name:44} c={b['center']} s={b['size']}")
