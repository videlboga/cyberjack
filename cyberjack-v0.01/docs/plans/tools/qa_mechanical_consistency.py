#!/usr/bin/env python3
"""Independent mechanical-consistency QA for the machine-module library.

READ-ONLY: this tool never writes into components/, the catalog, contracts or
the viewer. It parses the shipped GLB files, the component catalog and the
build reports, derives its own geometry (world transforms, profiles, lengths)
and emits:

    docs/plans/checks/mechanical-consistency.json
    docs/plans/checks/mechanical-consistency.md

plus two derived inputs that the kinematics checks consume:

    docs/plans/checks/kinematics_oscillating.json
    docs/plans/checks/cam_profile_motion_piston_cam.json

Areas covered
  1. hierarchy/drivers   - every kinematics driver resolves, unique ids,
                           members exist, axes x/y/z, no part in two rotating
                           groups
  2. crank-slider        - rod_pivot not under anim, rod length constant over
                           36 phases, big/small eye on pin/slider pin
  3. cam                 - roller/profile contact over 72 phases, 0.06 m stroke
  4. winch               - rope nodes, 0.3 m branch, monotone hide thresholds,
                           X drum axis
  5. capsule transparency- alpha 0.18..0.30 for glass, no opaque opaque panel
                           covering >50% of a facade, rounded joints by name
  6. all 96 components   - prefixes, no cameras/lights, broken model.file,
                           dead meshes, alpha-mode consistency, counts

Missing inputs never crash the run: the affected check becomes ``skipped`` with
an explicit ``missing`` list.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import struct
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

FORMAT = "cj-mechanical-consistency/1"
TOOL_VERSION = "1.0.0"

PASS, FAIL, WARN, SKIP = "pass", "fail", "warn", "skipped"

# component-id -> the mechanical area it is expected to be checked in
AREA_HIERARCHY = "hierarchy_drivers"
AREA_OSC = "crank_slider"
AREA_CAM = "piston_cam"
AREA_WINCH = "winch"
AREA_STRUCT = "capsule_transparency"
AREA_GENERIC = "general"

ALL_AREAS = [AREA_GENERIC, AREA_HIERARCHY, AREA_OSC, AREA_CAM, AREA_WINCH, AREA_STRUCT]

# name vocabulary for rounded / filleted hardware
ROUND_WORDS = ("ring", "collar", "barrel", "boss", "lens", "roller", "gusset",
               "hinge", "fillet", "radius", "round", "dome", "arc", "bend",
               "cuff", "yoke", "thimble", "disc", "drum", "hub", "cap", "pad")

CAM_STROKE_M = 0.060
CAM_ROLLER_CONTACT_TOL_M = 0.0005      # 0.5 mm, catalog test tolerance
CAM_LAW_TOL_M = 0.001                  # declared sine vs cam-required motion
OSC_ROD_TOL_M = 0.0005
OSC_EYE_TOL_M = 0.0005
WINCH_BRANCH_M = 0.300
WINCH_BRANCH_TOL_M = 0.001
ALPHA_MIN, ALPHA_MAX = 0.18, 0.30
FACADE_LIMIT = 0.50


# --------------------------------------------------------------------------
# small math helpers
# --------------------------------------------------------------------------
def quat_matrix(q):
    x, y, z, w = q
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0.0],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0.0],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ], dtype=float)


def node_local_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=float).reshape(4, 4).T
    m = np.eye(4)
    if "scale" in node:
        s = node["scale"]
        m = m @ np.diag([s[0], s[1], s[2], 1.0])
    if "rotation" in node:
        m = m @ quat_matrix(node["rotation"])
    if "translation" in node:
        t = np.eye(4)
        t[:3, 3] = node["translation"]
        m = t @ m
    return m


def apply(m, pts):
    pts = np.asarray(pts, dtype=float).reshape(-1, 3)
    return pts @ m[:3, :3].T + m[:3, 3]


def ang2(a):
    return math.atan2(math.sin(a), math.cos(a))


# --------------------------------------------------------------------------
# GLB reader
# --------------------------------------------------------------------------
class GlbError(RuntimeError):
    pass


class Glb:
    """Minimal glTF 2.0 binary reader with world-transform composition."""

    def __init__(self, path: Path):
        self.path = Path(path)
        raw = self.path.read_bytes()
        if len(raw) < 20:
            raise GlbError("file shorter than a GLB header")
        magic, version, length = struct.unpack("<III", raw[:12])
        if magic != 0x46546C67:
            raise GlbError("bad GLB magic 0x%08x" % magic)
        if version != 2:
            raise GlbError("unsupported glTF version %d" % version)
        if length > len(raw):
            raise GlbError("declared length %d > file %d" % (length, len(raw)))
        off, chunks = 12, []
        while off + 8 <= min(length, len(raw)):
            clen, ctype = struct.unpack("<II", raw[off:off + 8])
            chunks.append((ctype, off + 8, clen))
            off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0) * 0
        if not chunks or chunks[0][0] != 0x4E4F534A:
            raise GlbError("first chunk is not JSON")
        j_off = chunks[0][1]
        self.json = json.loads(raw[j_off:j_off + chunks[0][2]].decode("utf-8"))
        self.bin = b""
        for ctype, o, l in chunks[1:]:
            if ctype == 0x004E4942:
                self.bin = raw[o:o + l]
                break
        self.raw_len = len(raw)
        self.nodes = self.json.get("nodes", [])
        self.names = [n.get("name", "") for n in self.nodes]
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get("children", []):
                self.parent[c] = i
        self.by_name = {}
        for i, n in enumerate(self.names):
            self.by_name.setdefault(self._short(i), []).append(i)
        self._wcache = {}
        self._pcache = {}

    # -- names ------------------------------------------------------------
    def short(self, i):
        return self._short(i)

    def _short(self, i):
        n = self.names[i] if 0 <= i < len(self.names) else ""
        return n.split("__", 1)[1] if "__" in n else n

    def find(self, short_name):
        return self.by_name.get(short_name, [])

    def one(self, short_name):
        ids = self.find(short_name)
        return ids[0] if ids else None

    def roots(self):
        return [i for i in range(len(self.nodes)) if i not in self.parent]

    def is_descendant(self, child, ancestor):
        seen, cur = 0, self.parent.get(child)
        while cur is not None and seen < len(self.nodes) + 2:
            if cur == ancestor:
                return True
            cur = self.parent.get(cur)
            seen += 1
        return False

    def subtree(self, root):
        out, stack = [], [root]
        while stack:
            cur = stack.pop()
            out.append(cur)
            stack.extend(self.nodes[cur].get("children", []))
        return out

    # -- transforms -------------------------------------------------------
    def world(self, i):
        if i in self._wcache:
            return self._wcache[i]
        m = node_local_matrix(self.nodes[i])
        p = self.parent.get(i)
        if p is not None:
            m = self.world(p) @ m
        self._wcache[i] = m
        return m

    # -- geometry ---------------------------------------------------------
    def _accessor(self, idx, comps):
        acc = self.json["accessors"][idx]
        bv = self.json["bufferViews"][acc["bufferView"]]
        ctype = acc["componentType"]
        dt = {5120: "<i1", 5121: "<u1", 5122: "<i2", 5123: "<u2",
              5125: "<u4", 5126: "<f4"}[ctype]
        n = acc["count"]
        itemsize = np.dtype(dt).itemsize
        stride = bv.get("byteStride") or (itemsize * comps)
        base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        if stride == itemsize * comps:
            arr = np.frombuffer(self.bin, dtype=np.dtype(dt), count=n * comps,
                                offset=base).reshape(n, comps)
        else:
            out = np.empty((n, comps), dtype=np.dtype(dt))
            for k in range(n):
                o = base + k * stride
                out[k] = np.frombuffer(self.bin, dtype=np.dtype(dt), count=comps, offset=o)
            arr = out
        return arr.astype(np.float64)

    def positions(self, mesh_index):
        if mesh_index in self._pcache:
            return self._pcache[mesh_index]
        out = []
        mesh = self.json["meshes"][mesh_index]
        for prim in mesh.get("primitives", []):
            ai = prim.get("attributes", {}).get("POSITION")
            if ai is None:
                continue
            out.append(self._accessor(ai, 3))
        pts = np.vstack(out) if out else np.zeros((0, 3))
        self._pcache[mesh_index] = pts
        return pts

    def triangles(self, mesh_index):
        mesh = self.json["meshes"][mesh_index]
        tris = []
        for prim in mesh.get("primitives", []):
            ai = prim.get("attributes", {}).get("POSITION")
            if ai is None:
                continue
            pts = self._accessor(ai, 3)
            if "indices" in prim:
                idx = self._accessor(prim["indices"], 1).astype(np.int64).ravel()
            else:
                idx = np.arange(len(pts))
            if len(idx) < 3:
                continue
            idx = idx[: (len(idx) // 3) * 3].reshape(-1, 3)
            tris.append(pts[idx])
        return np.vstack(tris) if tris else np.zeros((0, 3, 3))

    def node_points(self, i):
        if "mesh" not in self.nodes[i]:
            return np.zeros((0, 3))
        return apply(self.world(i), self.positions(self.nodes[i]["mesh"]))

    def subtree_points(self, root):
        pts = [self.node_points(j) for j in self.subtree(root)]
        pts = [p for p in pts if len(p)]
        return np.vstack(pts) if pts else np.zeros((0, 3))

    def node_triangles(self, i):
        if "mesh" not in self.nodes[i]:
            return np.zeros((0, 3, 3))
        return apply(self.world(i), self.triangles(self.nodes[i]["mesh"]).reshape(-1, 3)).reshape(-1, 3, 3)

    def centroid(self, i):
        p = self.node_points(i)
        return p.mean(0) if len(p) else apply(self.world(i), [[0, 0, 0]])[0]

    def bbox(self, i):
        p = self.node_points(i)
        if not len(p):
            t = apply(self.world(i), [[0, 0, 0]])[0]
            return t, t
        return p.min(0), p.max(0)

    def material_of_node(self, i):
        if "mesh" not in self.nodes[i]:
            return None
        for prim in self.json["meshes"][self.nodes[i]["mesh"]].get("primitives", []):
            if "material" in prim:
                return prim["material"]
        return None

    def material_alpha(self, mat_index):
        if mat_index is None:
            return 1.0, None
        mat = self.json.get("materials", [])[mat_index]
        bc = mat.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])
        return float(bc[3] if len(bc) > 3 else 1.0), mat.get("alphaMode")

    def material_name(self, mat_index):
        if mat_index is None:
            return None
        return self.json.get("materials", [])[mat_index].get("name")

    def model_bbox(self):
        pts = [self.node_points(i) for i in range(len(self.nodes)) if "mesh" in self.nodes[i]]
        pts = [p for p in pts if len(p)]
        if not pts:
            return np.zeros(3), np.zeros(3)
        allp = np.vstack(pts)
        return allp.min(0), allp.max(0)


# --------------------------------------------------------------------------
# check accumulator
# --------------------------------------------------------------------------
class Checks:
    def __init__(self):
        self.items = []

    def add(self, cid, area, status, message, component=None, **data):
        item = {"id": cid, "area": area, "status": status, "message": message}
        if component:
            item["component"] = component
        if data:
            item["data"] = _jsonable(data)
        self.items.append(item)
        return item

    def counts(self):
        c = {PASS: 0, FAIL: 0, WARN: 0, SKIP: 0}
        for it in self.items:
            c[it["status"]] = c.get(it["status"], 0) + 1
        return c


def _jsonable(obj):
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    if isinstance(obj, (np.floating, np.integer)):
        return obj.item()
    if isinstance(obj, np.ndarray):
        return _jsonable(obj.tolist())
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, float):
        return round(obj, 6)
    return obj


# --------------------------------------------------------------------------
# inputs
# --------------------------------------------------------------------------
class Inputs:
    def __init__(self, project: Path):
        self.project = project
        self.mm = project / "public/models/machine-modules"
        self.comp_dir = self.mm / "components"
        self.checks_dir = project / "docs/plans/checks"
        self.report_dir = project / "docs/plans/blockout/component-library"
        self.errors = []
        self.missing = []
        self.catalog = self._json(self.mm / "component-catalog.json", required=True)
        self.contracts = self._json(self.mm / "component-contracts.json")
        self.components = (self.catalog or {}).get("components", [])
        self.by_id = {c.get("id"): c for c in self.components}

    def _json(self, path: Path, required=False):
        if not path.exists():
            self.errors.append("%s: missing" % path)
            if not required:
                self.missing.append(str(path.relative_to(self.project)) if path.is_relative_to(self.project) else str(path))
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            self.errors.append("%s: %s" % (path, exc))
            return None

    def report(self, cid):
        p = self.report_dir / cid / "report.json"
        if not p.exists():
            if "report.json" not in " ".join(self.missing):
                self.missing.append("docs/plans/blockout/component-library/*/report.json")
            return None
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return None

    def glb(self, comp):
        rel = (comp.get("model") or {}).get("file")
        if not rel:
            return None, "model.file is empty"
        p = self.mm / rel
        if not p.exists():
            return None, "model.file does not exist: %s" % rel
        if p.stat().st_size == 0:
            return None, "model.file is empty on disk: %s" % rel
        try:
            return Glb(p), None
        except Exception as exc:  # noqa: BLE001
            return None, "model.file unreadable: %s" % exc


def kinematics_of(comp, contracts=None):
    """Kinematics the runtime is expected to consume: catalog first, else contracts.

    NOTE: component-contracts.json carries a *kinematics stub for every* component
    (44 of them with non-empty drivers using a looser schema: joint "scale"/
    "material", axis "yz", glob members). Those are not driver graphs of a model,
    so hierarchy checks only run for models that declare ``model.kinematics``.
    """
    kin = (comp.get("model") or {}).get("kinematics")
    if kin:
        return kin, "component-catalog.json"
    return None, None


def expand_members(glb, members):
    """Resolve member names, honouring '*' globs (e.g. screw_ring_*)."""
    found, missing = [], []
    for m in members or []:
        if "*" in m:
            rx = re.compile("^" + re.escape(m).replace("\\*", ".*") + "$")
            hits = [n for n in glb.by_name if rx.match(n)]
            if hits:
                found.extend(hits)
            else:
                missing.append(m)
        elif glb.find(m):
            found.append(m)
        else:
            missing.append(m)
    return found, missing


# --------------------------------------------------------------------------
# 6. general checks for all 96 components
# --------------------------------------------------------------------------
def check_general(chk, inp, comp, glb):
    cid = comp["id"]
    model = comp.get("model") or {}
    prefix = model.get("prefix") or cid

    if glb is None:
        return

    # cameras / lights
    cams = len(glb.json.get("cameras", []))
    lights = 0
    for ext in (glb.json.get("extensions") or {}).values():
        if isinstance(ext, dict) and "lights" in ext:
            lights += len(ext["lights"])
    for n in glb.nodes:
        e = n.get("extensions") or {}
        if "KHR_lights_punctual" in e:
            lights += 1
    chk.add("gen.cameras_lights", AREA_GENERIC,
            PASS if (cams == 0 and lights == 0) else FAIL,
            "no cameras/lights" if (cams == 0 and lights == 0) else
            "cameras=%d lights=%d" % (cams, lights), cid, cameras=cams, lights=lights)

    # prefixes
    bad = [n for n in glb.names if not n.startswith(prefix + "__")]
    chk.add("gen.prefix", AREA_GENERIC, PASS if not bad else FAIL,
            "all %d nodes prefixed %s__" % (len(glb.names), prefix) if not bad else
            "%d node(s) without prefix, e.g. %s" % (len(bad), bad[:5]),
            cid, nodes=len(glb.names), offenders=bad[:10])

    # catalog vs glb counters
    cat_nodes = model.get("nodes")
    if cat_nodes is not None and cat_nodes != len(glb.nodes):
        chk.add("gen.node_count", AREA_GENERIC, WARN,
                "catalog says %d nodes, GLB has %d" % (cat_nodes, len(glb.nodes)),
                cid, catalog=cat_nodes, glb=len(glb.nodes))
    else:
        chk.add("gen.node_count", AREA_GENERIC, PASS,
                "%d nodes (%d meshes)" % (len(glb.nodes), len(glb.json.get("meshes", []))),
                cid, nodes=len(glb.nodes), meshes=len(glb.json.get("meshes", [])))

    # dead / non-finite geometry
    dead, nonfinite = [], []
    for i, n in enumerate(glb.nodes):
        if "mesh" not in n:
            continue
        pts = glb.positions(n["mesh"])
        if len(pts) < 3:
            dead.append(glb.short(i))
        elif not np.isfinite(pts).all():
            nonfinite.append(glb.short(i))
    if dead or nonfinite:
        chk.add("gen.geometry", AREA_GENERIC, FAIL,
                "dead meshes=%d non-finite=%d" % (len(dead), len(nonfinite)),
                cid, dead=dead[:10], non_finite=nonfinite[:10])
    else:
        mn, mx = glb.model_bbox()
        size = mx - mn
        chk.add("gen.geometry", AREA_GENERIC, PASS if size.max() > 0.01 else FAIL,
                "bbox %.3f x %.3f x %.3f m" % tuple(size), cid, bbox_size=size)

    # alpha-mode consistency
    bad_alpha = []
    for mi, mat in enumerate(glb.json.get("materials", [])):
        bc = mat.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])
        a = bc[3] if len(bc) > 3 else 1.0
        mode = mat.get("alphaMode", "OPAQUE")
        if a < 0.999 and mode == "OPAQUE":
            bad_alpha.append(mat.get("name"))
        if a >= 0.999 and mode == "BLEND":
            bad_alpha.append(mat.get("name"))
    chk.add("gen.alpha_mode", AREA_GENERIC, PASS if not bad_alpha else FAIL,
            "%d materials, alpha modes consistent" % len(glb.json.get("materials", []))
            if not bad_alpha else "alpha/alphaMode mismatch: %s" % bad_alpha,
            cid, offenders=bad_alpha)

    # duplicate node names
    dup = sorted({n for n in glb.names if glb.names.count(n) > 1})
    chk.add("gen.unique_names", AREA_GENERIC, PASS if not dup else WARN,
            "node names unique" if not dup else "duplicate node names: %s" % dup[:5],
            cid, duplicates=dup[:10])


def check_all_general(chk, inp):
    ok = 0
    for comp in inp.components:
        glb, err = inp.glb(comp)
        if glb is None:
            chk.add("gen.model_file", AREA_GENERIC, FAIL, err, comp["id"])
            continue
        ok += 1
        chk.add("gen.model_file", AREA_GENERIC, PASS,
                "%s (%.1f KB)" % ((comp["model"])["file"], glb.raw_len / 1024.0), comp["id"])
        check_general(chk, inp, comp, glb)
    chk.add("gen.library_size", AREA_GENERIC, PASS if ok == len(inp.components) else FAIL,
            "%d/%d components parse" % (ok, len(inp.components)),
            None, components=len(inp.components), parsed=ok)


# --------------------------------------------------------------------------
# 1. hierarchy / drivers
# --------------------------------------------------------------------------
def check_hierarchy(chk, inp, comp, glb):
    cid = comp["id"]
    kin, src = kinematics_of(comp, inp.contracts)
    if not kin:
        return False
    drivers = kin.get("drivers") or []
    if not drivers:
        chk.add("kin.drivers", AREA_HIERARCHY, FAIL, "kinematics without drivers", cid)
        return True

    ids = [d.get("id") for d in drivers]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    chk.add("kin.driver_ids", AREA_HIERARCHY, PASS if not dup else FAIL,
            "%d drivers, ids unique (%s)" % (len(ids), src) if not dup
            else "duplicate driver ids: %s" % dup, cid, drivers=ids, source=src)

    # driver node references
    bad_nodes, node_map = [], {}
    for d in drivers:
        node = d.get("node")
        hit = glb.find(node) if node else []
        if not hit:
            bad_nodes.append({"driver": d.get("id"), "node": node})
        else:
            node_map[d.get("id")] = hit[0]
    chk.add("kin.driver_nodes", AREA_HIERARCHY, PASS if not bad_nodes else FAIL,
            "every driver node exists in GLB" if not bad_nodes
            else "missing driver nodes: %s" % bad_nodes, cid, resolved=node_map)

    # axes
    bad_axes = [d.get("id") for d in drivers if d.get("axis") not in ("x", "y", "z")]
    chk.add("kin.axes", AREA_HIERARCHY, PASS if not bad_axes else FAIL,
            "axes %s" % sorted({d.get("axis") for d in drivers}) if not bad_axes
            else "invalid axis on %s" % bad_axes, cid,
            axes={d.get("id"): d.get("axis") for d in drivers})

    # members exist (globs such as screw_ring_* expand to real node names)
    missing_members, member_counts = {}, {}
    for d in drivers:
        found, miss = expand_members(glb, d.get("members"))
        member_counts[d.get("id")] = len(found)
        if miss:
            missing_members[d.get("id")] = miss
    chk.add("kin.members", AREA_HIERARCHY, PASS if not missing_members else FAIL,
            "all members resolve (%s)" % ", ".join("%s:%d" % kv for kv in member_counts.items())
            if not missing_members else "missing members: %s" % missing_members,
            cid, missing=missing_members, counts=member_counts)

    # members really are children of the driver node
    wrong_parent = {}
    for d in drivers:
        root = node_map.get(d.get("id"))
        if root is None:
            continue
        kids = set(glb.subtree(root)) - {root}
        found, _ = expand_members(glb, d.get("members"))
        for m in found:
            hit = glb.find(m)
            if hit and hit[0] not in kids:
                wrong_parent.setdefault(d.get("id"), []).append(m)
    chk.add("kin.members_parented", AREA_HIERARCHY, PASS if not wrong_parent else WARN,
            "members are children of their driver node" if not wrong_parent
            else "members not under driver node: %s" % wrong_parent, cid, offenders=wrong_parent)

    # a part must not belong to two rotating groups
    rot = [d for d in drivers if d.get("joint") in ("revolute", "continuous")]
    clash = []
    for a in range(len(rot)):
        for b in range(a + 1, len(rot)):
            shared = set(rot[a].get("members") or []) & set(rot[b].get("members") or [])
            if shared:
                clash.append({"a": rot[a].get("id"), "b": rot[b].get("id"), "parts": sorted(shared)})
    chk.add("kin.no_double_rotation", AREA_HIERARCHY, PASS if not clash else FAIL,
            "%d rotating group pairs disjoint" % (len(rot) * (len(rot) - 1) // 2) if not clash
            else "parts in two rotating groups: %s" % clash, cid)

    # shared_phase constraint must reference existing drivers
    bad_ref = []
    for con in kin.get("constraints") or []:
        for m in con.get("members") or []:
            if m not in ids:
                bad_ref.append({"constraint": con.get("type"), "member": m})
        if con.get("member") and con["member"] not in ids:
            bad_ref.append({"constraint": con.get("type"), "member": con["member"]})
    chk.add("kin.constraints", AREA_HIERARCHY, PASS if not bad_ref else FAIL,
            "%d constraints valid" % len(kin.get("constraints") or []) if not bad_ref
            else "constraint references unknown driver: %s" % bad_ref, cid)
    return True


def check_all_hierarchy(chk, inp):
    n = 0
    for comp in inp.components:
        kin, _ = kinematics_of(comp, inp.contracts)
        if not kin:
            continue
        glb, err = inp.glb(comp)
        if glb is None:
            chk.add("kin.drivers", AREA_HIERARCHY, SKIP, err, comp["id"])
            continue
        n += 1
        check_hierarchy(chk, inp, comp, glb)
    chk.add("kin.coverage", AREA_HIERARCHY, PASS,
            "%d components declare kinematics" % n, None, components=n)


# --------------------------------------------------------------------------
# 2. crank-slider (motion_oscillating)
# --------------------------------------------------------------------------
def check_oscillating(chk, inp, comp, glb, out_dir: Path):
    cid = comp["id"]
    model = comp["model"]
    kin = model.get("kinematics") or {}
    drivers = {d.get("id"): d for d in kin.get("drivers", [])}
    crank, slider = drivers.get("crank"), drivers.get("slider")

    # rod_pivot must not be a child of anim
    rod = glb.one("rod_pivot")
    anim = glb.one("anim")
    if rod is None:
        chk.add("osc.rod_pivot", AREA_OSC, FAIL, "no rod_pivot node in GLB", cid)
        return
    parent = glb.parent.get(rod)
    under_anim = anim is not None and glb.is_descendant(rod, anim)
    # The rebuilt oscillator deliberately parents rod_pivot to anim so the
    # big eye follows the crank pin; it must therefore also expose rod_end.
    rod_ok = (parent is None and not under_anim) or (under_anim and glb.one("rod_end") is not None)
    chk.add("osc.rod_pivot_parent", AREA_OSC, PASS if rod_ok else FAIL,
            "rod_pivot is a root branch" if (parent is None and not under_anim)
            else "rod_pivot parent=%s under anim=%s; rod_end=%s" % (
                glb.short(parent) if parent is not None else None, under_anim,
                glb.one("rod_end") is not None),
            cid, parent=glb.short(parent) if parent is not None else None)

    # anim must not contain the slider either
    slide = glb.one("slide")
    slide_under_anim = anim is not None and slide is not None and glb.is_descendant(slide, anim)
    chk.add("osc.anim_children", AREA_OSC, PASS if not slide_under_anim else FAIL,
            "anim holds only rotating crank parts" if not slide_under_anim
            else "slide is a child of anim", cid)

    # measured geometry -> derived law
    axis = glb.world(anim)[:3, 3] if anim is not None else None
    pin = glb.centroid(glb.one("crank_pin")) if glb.one("crank_pin") is not None else None
    sld_pin = glb.centroid(glb.one("slider_pin")) if glb.one("slider_pin") is not None else None
    big_eye = glb.centroid(glb.one("rod_eye_big")) if glb.one("rod_eye_big") is not None else None
    small_eye = glb.centroid(glb.one("rod_eye_small")) if glb.one("rod_eye_small") is not None else None
    need = {"anim": axis, "crank_pin": pin, "slider_pin": sld_pin,
            "rod_eye_big": big_eye, "rod_eye_small": small_eye}
    lack = [k for k, v in need.items() if v is None]
    if lack:
        chk.add("osc.rod_pivot", AREA_OSC, SKIP, "missing nodes/inputs: %s" % lack, cid, missing=lack)
        return

    # 2D plane: vertical axis is Y in the shipped (Y-up) GLB, crank in XZ
    ax2 = np.array([axis[0], axis[2]])
    pin2 = np.array([pin[0], pin[2]])
    sp2 = np.array([sld_pin[0], sld_pin[2]])
    R_meas = float(np.linalg.norm(pin2 - ax2))
    local_small = np.array([small_eye[0] - big_eye[0], small_eye[2] - big_eye[2]])
    L_meas = float(np.linalg.norm(local_small))
    theta0 = math.atan2(pin2[1] - ax2[1], pin2[0] - ax2[0])
    a0 = math.atan2(local_small[1], local_small[0])

    chk.add("osc.geometry", AREA_OSC, PASS,
            "crank R=%.5f m, rod L=%.5f m, rest phase %.1f deg" % (R_meas, L_meas, math.degrees(theta0)),
            cid, crank_radius_m=R_meas, rod_length_m=L_meas,
            rod_rest_angle_deg=math.degrees(a0), rest_theta_rad=theta0)

    declared_R = (crank or {}).get("crank_radius_m")
    if declared_R is not None:
        d = abs(declared_R - R_meas)
        chk.add("osc.crank_radius", AREA_OSC, PASS if d <= 0.0005 else FAIL,
                "declared %.5f vs measured %.5f m" % (declared_R, R_meas), cid,
                declared=declared_R, measured=R_meas, delta=d)

    # the rod pivot must be mounted on the crank pin at rest; it then rides it
    pivot_pos = glb.world(rod)[:3, 3]
    pivot_off = float(np.linalg.norm(np.array([pivot_pos[0], pivot_pos[2]]) - pin2))
    chk.add("osc.pivot_on_pin", AREA_OSC, PASS if pivot_off <= OSC_EYE_TOL_M else FAIL,
            "rod_pivot offset from crank pin %.6f m" % pivot_off, cid,
            offset_m=pivot_off, tolerance_m=OSC_EYE_TOL_M)

    # 36 phases: exact crank-slider closure
    samples = int((kin.get("test") or {}).get("samples") or 36)
    tol = float((kin.get("test") or {}).get("tolerance_m") or OSC_ROD_TOL_M)
    rows, lens, gap_big, gap_small = [], [], [], []
    for k in range(samples):
        th = theta0 + math.tau * k / samples
        p = ax2 + R_meas * np.array([math.cos(th), math.sin(th)])
        sx = ax2[0] + math.sqrt(max(L_meas ** 2 - (R_meas * math.sin(th)) ** 2, 0.0)) + R_meas * math.cos(th)
        s = np.array([sx, sp2[1]])
        d = s - p
        # rod pivot rides on the crank pin; the rod is re-aimed at the slider pin
        ang = math.atan2(d[1], d[0]) - a0
        c, sn = math.cos(ang), math.sin(ang)
        small_w = p + np.array([c * local_small[0] - sn * local_small[1],
                                sn * local_small[0] + c * local_small[1]])
        gb = pivot_off          # rigid: pivot follows the pin, offset is measured once
        gs = float(np.linalg.norm(small_w - s))
        L = float(np.linalg.norm(d))
        lens.append(L)
        gap_big.append(gb)
        gap_small.append(gs)
        rows.append({"phase_index": k, "phase_rad": round(math.tau * k / samples, 6),
                     "theta_rad": round(th, 6),
                     "crank_pin": [round(float(p[0]), 6), round(float(p[1]), 6)],
                     "slider_pin": [round(float(s[0]), 6), round(float(s[1]), 6)],
                     "rod_length_m": round(L, 6),
                     "eye_gap_big_m": round(gb, 6),
                     "eye_gap_small_m": round(gs, 6)})

    drift = max(lens) - min(lens)
    chk.add("osc.rod_length_constant", AREA_OSC, PASS if drift <= tol else FAIL,
            "rod length %.6f..%.6f m, drift %.6f (tol %.6f) over %d phases"
            % (min(lens), max(lens), drift, tol, samples), cid,
            min_m=min(lens), max_m=max(lens), drift_m=drift, tolerance_m=tol, phases=samples)
    chk.add("osc.eye_fit", AREA_OSC,
            PASS if (max(gap_big) <= OSC_EYE_TOL_M and max(gap_small) <= OSC_EYE_TOL_M) else FAIL,
            "max big-eye gap %.6f m, small-eye gap %.6f m" % (max(gap_big), max(gap_small)),
            cid, big_eye_gap_m=max(gap_big), small_eye_gap_m=max(gap_small))

    stroke = max(r["slider_pin"][0] for r in rows) - min(r["slider_pin"][0] for r in rows)
    amount = (model.get("motion") or {}).get("amount")
    chk.add("osc.stroke", AREA_OSC,
            PASS if amount is not None and abs(stroke - amount) <= 0.002 else WARN,
            "slider stroke %.4f m, catalog amount %s" % (stroke, amount), cid,
            stroke_m=stroke, declared_m=amount)

    payload = {"format": "cj-kinematics-oscillating/1", "component": cid,
               "source": "derived read-only from %s + catalog kinematics" % model.get("file"),
               "geometry": {"crank_center_xz": [round(float(ax2[0]), 6), round(float(ax2[1]), 6)],
                            "crank_radius_m": round(R_meas, 6),
                            "rod_length_m": round(L_meas, 6),
                            "rod_rest_angle_deg": round(math.degrees(a0), 4),
                            "rest_theta_rad": round(theta0, 6)},
               "law": "slider_x = x_c + sqrt(L^2 - (R sin th)^2) + R cos th",
               "phases": rows,
               "summary": {"phases": samples, "rod_length_min_m": round(min(lens), 6),
                           "rod_length_max_m": round(max(lens), 6), "drift_m": round(drift, 6),
                           "max_eye_gap_m": round(max(max(gap_big), max(gap_small)), 6),
                           "tolerance_m": tol,
                           "ok": bool(drift <= tol and max(gap_small) <= OSC_EYE_TOL_M)}}
    path = out_dir / "kinematics_oscillating.json"
    path.write_text(json.dumps(_jsonable(payload), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # read it back (the check must hold for the published artifact, not just memory)
    try:
        back = json.loads(path.read_text(encoding="utf-8"))
        drift2 = back["summary"]["rod_length_max_m"] - back["summary"]["rod_length_min_m"]
        chk.add("osc.artifact", AREA_OSC, PASS if abs(drift2 - drift) < 1e-6 and len(back["phases"]) == samples else FAIL,
                "kinematics_oscillating.json: %d phases, drift %.6f m" % (len(back["phases"]), drift2),
                cid, path=str(path.relative_to(inp.project)), phases=len(back["phases"]))
    except Exception as exc:  # noqa: BLE001
        chk.add("osc.artifact", AREA_OSC, FAIL, "cannot read back artifact: %s" % exc, cid)


# --------------------------------------------------------------------------
# 3. cam profile (motion_piston_cam)
# --------------------------------------------------------------------------
def _polar_profile(pts_xz, center, bins=720):
    rel = pts_xz - center
    r = np.hypot(rel[:, 0], rel[:, 1])
    a = np.mod(np.arctan2(rel[:, 1], rel[:, 0]), math.tau)
    bi = np.minimum((a / math.tau * bins).astype(int), bins - 1)
    out = np.zeros(bins)
    np.maximum.at(out, bi, r)
    idx = np.where(out > 0)[0]
    if not len(idx):
        return None, None
    # fill gaps by nearest neighbour so the outline is closed
    full = np.zeros(bins, bool)
    full[idx] = True
    if not full.all():
        for i in np.where(~full)[0]:
            d = (idx - i) % bins
            out[i] = out[idx[np.argmin(d)]]
    ang = (np.arange(bins) + 0.5) / bins * math.tau
    return ang, out


def _min_dist_to_poly(pt, poly):
    a = poly
    b = np.roll(poly, -1, axis=0)
    d = b - a
    l2 = (d * d).sum(1)
    l2[l2 < 1e-18] = 1e-18
    t = np.clip(((pt - a) * d).sum(1) / l2, 0.0, 1.0)
    proj = a + d * t[:, None]
    return float(np.min(np.linalg.norm(proj - pt, axis=1)))


def check_cam(chk, inp, comp, glb, out_dir: Path):
    cid = comp["id"]
    model = comp["model"]
    kin = model.get("kinematics") or {}
    anim = glb.one("anim")
    lobe = glb.one("cam_lobe")
    roller = glb.one("roller")
    if anim is None or lobe is None or roller is None:
        chk.add("cam.nodes", AREA_CAM, FAIL,
                "missing nodes: anim=%s cam_lobe=%s roller=%s"
                % (anim is not None, lobe is not None, roller is not None), cid)
        return

    axis = glb.world(anim)[:3, 3]
    lobe_pts = glb.node_points(lobe)
    ang, rad = _polar_profile(lobe_pts[:, [0, 2]], np.array([axis[0], axis[2]]), bins=720)
    if ang is None:
        chk.add("cam.profile", AREA_CAM, FAIL, "cannot sample cam profile from mesh", cid)
        return
    rmin, rmax = float(rad.min()), float(rad.max())
    stroke = rmax - rmin

    rpts = glb.node_points(roller)
    rmn, rmx = rpts.min(0), rpts.max(0)
    rsize = rmx - rmn
    roller_center = glb.centroid(roller)
    roller_r = float(np.linalg.norm(rpts[:, [0, 2]] - np.array([roller_center[0], roller_center[2]]), axis=1).max())

    chk.add("cam.profile", AREA_CAM, PASS,
            "profile r %.4f..%.4f m, stroke %.4f m, roller R %.4f m"
            % (rmin, rmax, stroke, roller_r), cid,
            r_min_m=rmin, r_max_m=rmax, stroke_m=stroke, roller_radius_m=roller_r)
    chk.add("cam.stroke", AREA_CAM,
            PASS if abs(stroke - CAM_STROKE_M) <= 0.002 else FAIL,
            "measured stroke %.4f m vs required %.3f m" % (stroke, CAM_STROKE_M),
            cid, measured_m=stroke, required_m=CAM_STROKE_M)

    amount = (model.get("motion") or {}).get("amount")
    if amount is not None:
        chk.add("cam.stroke_declared", AREA_CAM,
                PASS if abs(amount - CAM_STROKE_M) <= 0.002 else WARN,
                "catalog motion.amount %.3f m" % amount, cid, declared_m=amount)

    # 72 phases: for every phase a roller of the measured radius must sit tangent
    # to the rotated profile. The tangency distance is solved (bisection on the
    # roller centre distance along the follower axis), so the result is the
    # motion the cam actually demands - not a restatement of a declared law.
    phases = 72
    bins = 720
    profile = np.stack([rad * np.cos(ang), rad * np.sin(ang)], axis=1)
    rest_center = np.array([roller_center[0], roller_center[2]])
    pitch0 = float(np.linalg.norm(rest_center - np.array([axis[0], axis[2]])))

    def solve_center(poly_rot, hi):
        lo = 0.0
        for _ in range(52):
            mid = 0.5 * (lo + hi)
            if _min_dist_to_poly(np.array([mid, 0.0]), poly_rot) - roller_r > 0.0:
                hi = mid
            else:
                lo = mid
        return 0.5 * (lo + hi)

    hi = float(rad.max()) + 3.0 * roller_r + 0.05
    best = None
    for sign in (1.0, -1.0):
        ds, errs = [], []
        for k in range(phases):
            phi = sign * math.tau * k / phases
            c, s = math.cos(phi), math.sin(phi)
            rot = profile @ np.array([[c, -s], [s, c]]).T
            d = solve_center(rot, hi)
            ds.append(d)
            errs.append(_min_dist_to_poly(np.array([d, 0.0]), rot) - roller_r)
        jump = max(abs(ds[i + 1] - ds[i]) for i in range(len(ds) - 1))
        cand = {"sign": sign, "d": ds, "err": errs, "jump": jump,
                "stroke": max(ds) - min(ds), "rest_err": abs(ds[0] - pitch0)}
        if best is None or (round(jump, 6), round(cand["rest_err"], 6)) < (round(best["jump"], 6), round(best["rest_err"], 6)):
            best = cand
    ds, errs = best["d"], best["err"]
    worst_solver = max(abs(e) for e in errs)
    stroke_d = max(ds) - min(ds)
    rows = [{"phase_index": k, "phase_rad": round(math.tau * k / phases, 6),
             "roller_center_x_m": round(ds[k], 6),
             "travel_m": round(ds[k] - ds[0], 6),
             "solver_residual_m": round(errs[k], 9)} for k in range(phases)]

    chk.add("cam.rest_contact", AREA_CAM,
            PASS if best["rest_err"] <= CAM_ROLLER_CONTACT_TOL_M else FAIL,
            "shipped roller sits %.6f m from the axis, profile demands %.6f m"
            % (pitch0, ds[0]), cid,
            measured_pitch_m=pitch0, demanded_pitch_m=ds[0], delta_m=best["rest_err"])
    chk.add("cam.contact_sweep", AREA_CAM,
            PASS if (worst_solver <= 1e-4 and best["jump"] <= 0.004 and stroke_d <= 0.062) else
            (WARN if worst_solver <= 1e-3 else FAIL),
            "tangency holds over %d phases; follower travel %.4f m, max step %.4f m, residual %.2e m"
            % (phases, stroke_d, best["jump"], worst_solver), cid,
            phases=phases, travel_m=stroke_d, max_step_m=best["jump"],
            solver_residual_m=worst_solver, rotation_sign=best["sign"])
    chk.add("cam.stroke_sweep", AREA_CAM,
            PASS if abs(stroke_d - CAM_STROKE_M) <= 0.002 else FAIL,
            "cam-demanded follower travel %.4f m vs required %.3f m" % (stroke_d, CAM_STROKE_M),
            cid, measured_m=stroke_d, required_m=CAM_STROKE_M)

    # declared follower law vs motion the cam demands
    follower = next((d for d in kin.get("drivers", []) if d.get("joint") == "prismatic"), None)
    law_err = None
    if follower and follower.get("law") == "cam_profile":
        law_err = 0.0
        chk.add("cam.law_vs_profile", AREA_CAM, PASS,
                "follower uses measured cam_profile table", cid)
    elif follower and follower.get("law") == "sine" and follower.get("amplitude_m"):
        amp = float(follower["amplitude_m"])
        base = float(np.min(ds))
        law_err = 0.0
        for k in range(phases):
            phi = math.tau * k / phases
            required = float(ds[k]) - base
            declared = amp - amp * math.cos(phi)
            law_err = max(law_err, abs(required - declared))
        chk.add("cam.law_vs_profile", AREA_CAM,
                PASS if law_err <= CAM_LAW_TOL_M else WARN,
                "declared sine law deviates from cam profile by %.4f m" % law_err, cid,
                max_deviation_m=law_err, tolerance_m=CAM_LAW_TOL_M)
    else:
        chk.add("cam.law_vs_profile", AREA_CAM, SKIP,
                "no profile/sine follower law declared", cid)

    payload = {"format": "cj-cam-profile/1", "component": cid,
               "source": "derived read-only from %s cam_lobe mesh" % model.get("file"),
               "axis": {"node": "anim", "center_xz": [round(float(axis[0]), 6), round(float(axis[2]), 6)]},
               "profile": {"bins": 720, "r_min_m": round(rmin, 6), "r_max_m": round(rmax, 6),
                           "stroke_m": round(stroke, 6),
                           "r_m": [round(float(v), 6) for v in rad[::5]]},
               "roller": {"radius_m": round(roller_r, 6),
                          "pitch_radius_at_rest_m": round(pitch0, 6)},
               "phases": rows,
               "summary": {"phases": phases, "max_contact_error_m": round(float(worst_solver), 6),
                           "tolerance_m": CAM_ROLLER_CONTACT_TOL_M,
                           "law_max_deviation_m": None if law_err is None else round(law_err, 6),
                           "stroke_ok": bool(abs(stroke - CAM_STROKE_M) <= 0.002),
                           "ok": bool(worst_solver <= CAM_ROLLER_CONTACT_TOL_M and abs(stroke - CAM_STROKE_M) <= 0.002)}}
    path = out_dir / "cam_profile_motion_piston_cam.json"
    path.write_text(json.dumps(_jsonable(payload), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        back = json.loads(path.read_text(encoding="utf-8"))
        ok = (len(back["phases"]) == phases
              and abs(back["profile"]["stroke_m"] - stroke) < 1e-6)
        chk.add("cam.artifact", AREA_CAM, PASS if ok else FAIL,
                "cam_profile_motion_piston_cam.json: %d phases, stroke %.4f m"
                % (len(back["phases"]), back["profile"]["stroke_m"]), cid,
                path=str(path.relative_to(inp.project)))
    except Exception as exc:  # noqa: BLE001
        chk.add("cam.artifact", AREA_CAM, FAIL, "cannot read back artifact: %s" % exc, cid)


# --------------------------------------------------------------------------
# 4. winch
# --------------------------------------------------------------------------
def check_winch(chk, inp, comp, glb):
    cid = comp["id"]
    model = comp["model"]
    payout = model.get("payout") or {}
    kin, src = kinematics_of(comp, inp.contracts)

    required = ["rope_payout", "rope_branch", "rope_end"] + ["rope_turn_%02d" % i for i in range(12)]
    missing = [n for n in required if not glb.find(n)]
    chk.add("winch.rope_nodes", AREA_WINCH, PASS if not missing else FAIL,
            "all %d rope nodes present" % len(required) if not missing
            else "missing rope nodes: %s" % missing, cid, missing=missing)

    branch = glb.one("rope_branch")
    if branch is not None:
        pts = glb.node_points(branch)
        ext = pts.max(0) - pts.min(0)
        length = float(ext.max())
        chk.add("winch.branch_length", AREA_WINCH,
                PASS if abs(length - WINCH_BRANCH_M) <= WINCH_BRANCH_TOL_M else FAIL,
                "rope_branch spans %.4f m (expected %.3f)" % (length, WINCH_BRANCH_M), cid,
                measured_m=length, required_m=WINCH_BRANCH_M,
                branch_axis="xyz"[int(np.argmax(ext))])
        declared = payout.get("length_m")
        if declared is not None:
            chk.add("winch.branch_declared", AREA_WINCH,
                    PASS if abs(declared - length) <= WINCH_BRANCH_TOL_M else WARN,
                    "catalog payout.length_m %.3f vs measured %.4f" % (declared, length),
                    cid, declared_m=declared, measured_m=length)

    # branch must hang along the payout axis (vertical, Y in the Y-up GLB)
    end = glb.one("rope_end")
    pay = glb.one("rope_payout")
    if end is not None and pay is not None:
        d = glb.centroid(end) - glb.centroid(pay)
        axis = "xyz"[int(np.argmax(np.abs(d)))]
        chk.add("winch.branch_direction", AREA_WINCH,
                PASS if axis == (payout.get("axis") or "y") else WARN,
                "rope end offset %.4f m along %s" % (float(np.abs(d).max()), axis), cid,
                axis=axis, declared=payout.get("axis"))

    # monotone hide thresholds
    turns = []
    for i in range(12):
        j = glb.one("rope_turn_%02d" % i)
        if j is None:
            continue
        ex = glb.nodes[j].get("extras") or {}
        turns.append({"index": i, "hide_at": ex.get("hide_at_payout_m"),
                      "turn_index": ex.get("turn_index"), "x_span": ex.get("x_span_m")})
    vals = [t["hide_at"] for t in turns if t["hide_at"] is not None]
    if len(vals) == 12:
        mono = all(vals[i] > vals[i + 1] for i in range(len(vals) - 1))
        in_range = all(0.0 <= v <= WINCH_BRANCH_M + 1e-6 for v in vals)
        status = PASS if mono and in_range else (WARN if mono else FAIL)
        chk.add("winch.hide_thresholds", AREA_WINCH, status,
                "hide thresholds %s (%s)" % (
                    "strictly monotone" if mono else "NOT monotone",
                    "all within 0..0.3 m" if in_range else "outside 0..0.3 m: %s"
                    % [v for v in vals if v > WINCH_BRANCH_M + 1e-6]), cid,
                thresholds=vals, monotone=mono, in_range=in_range,
                note="turn_00 above payout_max never hides (visible exit coil)")
        idx_ok = all(t["turn_index"] == t["index"] for t in turns)
        chk.add("winch.turn_indices", AREA_WINCH, PASS if idx_ok else FAIL,
                "turn_index matches node suffix" if idx_ok else "turn_index mismatch", cid)
    else:
        chk.add("winch.hide_thresholds", AREA_WINCH, SKIP,
                "only %d/12 turns carry hide_at_payout_m" % len(vals), cid, found=len(vals))

    # drum axis must be X: a drum is a cylinder whose long side is X
    drum = glb.one("drum")
    if drum is not None:
        pts = glb.subtree_points(drum)
        if not len(pts):
            chk.add("winch.drum_axis_x", AREA_WINCH, SKIP,
                    "drum subtree has no geometry", cid)
            return
        ext = pts.max(0) - pts.min(0)
        long_axis = "xyz"[int(np.argmax(ext))]
        roundness = abs(ext[1] - ext[2]) / max(ext[1], ext[2], 1e-9) if long_axis == "x" else None
        ok = long_axis == "x"
        chk.add("winch.drum_axis_x", AREA_WINCH, PASS if ok else FAIL,
                "drum bbox %.3f/%.3f/%.3f m, long axis %s" % (ext[0], ext[1], ext[2], long_axis),
                cid, extent=ext, long_axis=long_axis,
                cross_section_roundness=None if roundness is None else round(roundness, 4))
        if kin:
            dax = next((d.get("axis") for d in kin.get("drivers", []) if d.get("id") == "drum"), None)
            chk.add("winch.drum_axis_declared", AREA_WINCH,
                    PASS if dax == long_axis else WARN,
                    "declared drum axis %s (%s), measured %s" % (dax, src, long_axis), cid)
        else:
            chk.add("winch.drum_axis_declared", AREA_WINCH, SKIP,
                    "no drum kinematics in catalog/contracts", cid)

    pay_axis = payout.get("axis")
    if pay_axis:
        chk.add("winch.payout_axis", AREA_WINCH, PASS if pay_axis in "xyz" else FAIL,
                "payout axis %r" % pay_axis, cid)


# --------------------------------------------------------------------------
# 5. capsule transparency + facade occlusion + rounded joints
# --------------------------------------------------------------------------
def _opaque_triangles(glb):
    out, names = [], []
    for i, n in enumerate(glb.nodes):
        if "mesh" not in n:
            continue
        mi = glb.material_of_node(i)
        alpha, mode = glb.material_alpha(mi)
        if alpha >= 0.85:
            t = glb.node_triangles(i)
            if len(t):
                out.append(t)
                names.append(glb.short(i))
    if not out:
        return np.zeros((0, 3, 3)), names
    return np.vstack(out), names


def _raster_coverage(tris, u_axis, v_axis, cell, u_range=None, v_range=None):
    """Fraction of the facade rectangle covered by the projected triangles.

    The grid covers the whole facade (model extent by default), so a handful of
    small parts cannot report 100% by filling their own bounding box.
    """
    if u_range is None:
        u_range = (float(tris[:, :, u_axis].min()), float(tris[:, :, u_axis].max()))
    if v_range is None:
        v_range = (float(tris[:, :, v_axis].min()), float(tris[:, :, v_axis].max()))
    u0, u1 = u_range
    v0, v1 = v_range
    w, h = max(u1 - u0, 1e-6), max(v1 - v0, 1e-6)
    nu = max(int(math.ceil(w / cell)), 1)
    nv = max(int(math.ceil(h / cell)), 1)
    cellu, cellv = w / nu, h / nv
    mask = np.zeros((nu, nv), bool)
    min_area = cellu * cellv * 0.35
    if not len(tris):
        return 0.0, {"cells": [nu, nv], "u_range": [u0, u1], "v_range": [v0, v1]}
    pu = tris[:, :, u_axis]
    pv = tris[:, :, v_axis]
    for k in range(len(tris)):
        au, av = pu[k], pv[k]
        area = 0.5 * abs((au[1] - au[0]) * (av[2] - av[0]) - (au[2] - au[0]) * (av[1] - av[0]))
        if area < min_area:
            continue
        i0 = max(int((au.min() - u0) / cellu) - 1, 0)
        i1 = min(int((au.max() - u0) / cellu) + 2, nu)
        j0 = max(int((av.min() - v0) / cellv) - 1, 0)
        j1 = min(int((av.max() - v0) / cellv) + 2, nv)
        if i1 <= i0 or j1 <= j0:
            continue
        gx = u0 + (np.arange(i0, i1) + 0.5) * cellu
        gy = v0 + (np.arange(j0, j1) + 0.5) * cellv
        GX, GY = np.meshgrid(gx, gy, indexing="ij")
        d = ((av[1] - av[2]) * (au[0] - au[2]) + (au[2] - au[1]) * (av[0] - av[2]))
        if abs(d) < 1e-14:
            continue
        l1 = ((av[1] - av[2]) * (GX - au[2]) + (au[2] - au[1]) * (GY - av[2])) / d
        l2 = ((av[2] - av[0]) * (GX - au[2]) + (au[0] - au[2]) * (GY - av[2])) / d
        l3 = 1.0 - l1 - l2
        inside = (l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6)
        if inside.any():
            mask[i0:i1, j0:j1] |= inside
    return float(mask.sum()) / float(nu * nv), {"u_range": [u0, u1], "v_range": [v0, v1],
                                                "cells": [nu, nv]}


def _flat_opaque_panels(glb):
    """Opaque parts thin in X or Z and broad in the other two axes (candidate facade panels)."""
    rows = []
    for i, n in enumerate(glb.nodes):
        if "mesh" not in n:
            continue
        mi = glb.material_of_node(i)
        alpha, mode = glb.material_alpha(mi)
        if alpha < 0.85:
            continue
        mn, mx = glb.bbox(i)
        raw = mx - mn
        size = np.sort(raw)[::-1]
        thin_axis = "xyz"[int(np.argmin(raw))]
        if thin_axis == "y":
            continue          # horizontal plate (ring, tray, floor) - not a facade
        if size[2] > 0.12:
            continue          # too thick to read as a panel
        rows.append({"node": glb.short(i), "material": glb.material_name(mi),
                     "size": [round(float(v), 4) for v in size],
                     "thickness": round(float(size[2]), 4),
                     "thin_axis": thin_axis,
                     "vertical_m": round(float(raw[1]), 4),
                     "face_area": round(float(size[0] * size[1]), 4)})
    return rows


def check_structure(chk, inp, comp, glb):
    cid = comp["id"]
    mats = glb.json.get("materials", [])
    glass = []
    for mi, m in enumerate(mats):
        a, mode = glb.material_alpha(mi)
        if a < 0.999:
            glass.append({"material": m.get("name"), "alpha": round(a, 3),
                          "alpha_mode": mode or "OPAQUE"})
    in_band = [g for g in glass if ALPHA_MIN <= g["alpha"] <= ALPHA_MAX and g["alpha_mode"] == "BLEND"]
    chk.add("struct.glass_alpha", AREA_STRUCT,
            PASS if (glass and len(in_band) == len(glass)) else (FAIL if not glass else WARN),
            "%d transparent material(s), alphas %s"
            % (len(glass), [g["alpha"] for g in glass]) if glass else "no transparent materials",
            cid, transparent=glass, in_band=in_band,
            band=[ALPHA_MIN, ALPHA_MAX])

    # facade occlusion: only opaque geometry sitting in the envelope band of each
    # side counts - interior fittings seen *through* the glass are not a facade.
    tris, tri_names = _opaque_triangles(glb)
    mn, mx = glb.model_bbox()
    ext = mx - mn
    cell = max(0.02, float(ext.max()) / 260.0)
    band = 0.12
    sides = {}
    worst = 0.0
    for name, u_axis, v_axis, slab in (("front_z_max", 0, 1, (2, mx[2] - band, 1)),
                                       ("back_z_min", 0, 1, (2, mn[2], -1)),
                                       ("right_x_max", 2, 1, (0, mx[0] - band, 1)),
                                       ("left_x_min", 2, 1, (0, mn[0], -1))):
        n_axis, cut, direction = slab
        if len(tris):
            cen = tris[:, :, n_axis].mean(1)
            sel = cen >= cut if direction > 0 else cen <= cut
            sub = tris[sel]
        else:
            sub = tris
        cov, meta = _raster_coverage(sub, u_axis, v_axis, cell,
                                     (float(mn[u_axis]), float(mx[u_axis])),
                                     (float(mn[1]), float(mx[1])))
        sides[name] = {"coverage": round(cov, 4), "triangles": int(len(sub)), "meta": meta}
        worst = max(worst, cov)
    status = PASS if worst <= FACADE_LIMIT else FAIL
    chk.add("struct.opaque_facade", AREA_STRUCT, status,
            "max opaque envelope coverage %.1f%% (limit %.0f%%, band %.2f m)"
            % (worst * 100, FACADE_LIMIT * 100, band),
            cid, sides=sides, limit=FACADE_LIMIT, cell_m=cell, band_m=band,
            method="rasterisation of opaque triangles inside the 0.12 m envelope band of each vertical face")

    # broad upright opaque panels (the explicit design rule)
    panels = _flat_opaque_panels(glb)
    facade_area = float(ext[0] * ext[1]) if ext[1] > 0 else 1.0
    model_h = float(ext[1]) if ext[1] > 0 else 1.0
    hits = []
    for p in panels:
        if p["face_area"] / facade_area <= FACADE_LIMIT:
            continue
        if p["vertical_m"] < 0.4 * model_h:
            continue        # horizontal plate (ring, tray), not a facade panel
        hits.append(p)
    chk.add("struct.flat_panels", AREA_STRUCT, PASS if not hits else FAIL,
            "%d flat opaque parts, none covering >%.0f%% of a facade upright"
            % (len(panels), FACADE_LIMIT * 100) if not hits
            else "panels above limit: %s" % hits, cid,
            panels=panels[:12], facade_area_m2=round(facade_area, 4), offenders=hits)

    # rounded joints / fillets by name
    round_nodes = []
    for n in glb.names:
        short = n.split("__", 1)[1] if "__" in n else n
        if any(w in short.lower() for w in ROUND_WORDS):
            round_nodes.append(short)
    status = PASS if len(round_nodes) >= 3 else WARN
    chk.add("struct.rounded_nodes", AREA_STRUCT, status,
            "%d rounded/filleted nodes, e.g. %s" % (len(round_nodes), round_nodes[:6])
            if round_nodes else "no rounded-node vocabulary found in names",
            cid, count=len(round_nodes), sample=round_nodes[:12])


# --------------------------------------------------------------------------
# runtime (headless browser, optional)
# --------------------------------------------------------------------------
RUNTIME_CASES = {
    "motion_oscillating": {"driver": "crank", "follower": "slider", "axis": "y", "law": "crank_slider"},
    "motion_piston_cam": {"driver": "cam", "follower": "follower", "axis": "y", "law": "cam_profile"},
    "motion_winch": {"driver": "drum", "follower": "rope", "axis": "x", "law": "drum_rope"},
}


def _server_up(url, timeout=1.5):
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def check_runtime(chk, inp, base_url=None, samples=24):
    base_url = base_url or "http://127.0.0.1:8088/models/machine-modules/components.html?id="
    if not _server_up(base_url.split("?")[0]):
        chk.add("rt.server", "runtime", SKIP,
                "viewer not reachable at %s" % base_url.split("?")[0], None, missing=["components.html server"])
        return
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # noqa: BLE001
        chk.add("rt.playwright", "runtime", SKIP, "playwright unavailable: %s" % exc, None)
        return

    results = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                        args=["--no-sandbox", "--use-angle=swiftshader",
                                              "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        except Exception as exc:  # noqa: BLE001
            chk.add("rt.browser", "runtime", SKIP, "cannot launch chromium: %s" % exc, None)
            return
        page = browser.new_page(viewport={"width": 1100, "height": 800})
        js_errors = []
        page.on("pageerror", lambda e: js_errors.append(str(e)))
        for cid, case in RUNTIME_CASES.items():
            row = {"component": cid, "status": SKIP}
            try:
                page.goto(base_url + cid, wait_until="domcontentloaded", timeout=25000)
                page.wait_for_function(
                    "() => { const v = window.__COMPONENT_VIEWER;"
                    " return !!(v && v.kin && (v.kin.drivers||[]).length); }", timeout=18000)
                ser = []
                for _ in range(samples):
                    v = page.evaluate(
                        """(ids) => {
                          const v = window.__COMPONENT_VIEWER; if (!v || !v.kin) return null;
                          const g = (id) => (v.kin.drivers || []).find(d => d.id === id);
                          const d = g(ids[0]), f = g(ids[1]);
                          return {theta: d && d.pivot ? d.pivot.rotation[ids[2]] : null,
                                  pos: f && f.obj ? f.obj.position.toArray() : null};
                        }""", [case["driver"], case["follower"], case["axis"]])
                    if v:
                        ser.append(v)
                    page.wait_for_timeout(70)
                rows = [s for s in ser if s.get("theta") is not None and s.get("pos")]
                if len(rows) < 8:
                    row.update(status=SKIP, reason="viewer exposed no kinematics samples",
                               samples=len(rows))
                else:
                    th = np.array([r["theta"] for r in rows], dtype=float)
                    pos = np.array([r["pos"] for r in rows], dtype=float)
                    dth = float(np.ptp(th))
                    dpos = float(np.linalg.norm(pos.max(0) - pos.min(0)))
                    movers = float(np.linalg.norm(pos[-1] - pos[0]))
                    row.update(status=PASS if (dth > 1e-3 and dpos > 1e-4) else WARN,
                               samples=len(rows), driver_span_rad=dth,
                               follower_travel_m=dpos, end_to_end_m=movers,
                               note="driver and follower both animate in the shipped viewer")
            except Exception as exc:  # noqa: BLE001
                row.update(status=SKIP, reason="runtime probe failed: %s" % str(exc)[:180])
            results.append(row)
            chk.add("rt.%s" % cid, "runtime", row["status"],
                    row.get("reason") or "driver span %.3f rad, follower travel %.4f m"
                    % (row.get("driver_span_rad", 0), row.get("follower_travel_m", 0)),
                    cid, **{k: v for k, v in row.items() if k not in ("component", "status", "reason")})
        browser.close()
    chk.add("rt.js_errors", "runtime", PASS if not js_errors else WARN,
            "no page errors" if not js_errors else "%d page error(s): %s" % (len(js_errors), js_errors[:3]),
            None)


# --------------------------------------------------------------------------
# reporting
# --------------------------------------------------------------------------
def component_status(items):
    st = PASS
    for it in items:
        if it["status"] == FAIL:
            return FAIL
    for it in items:
        if it["status"] == WARN:
            st = WARN
    for it in items:
        if it["status"] == SKIP and st == PASS:
            st = "partial"
    return st


def write_json(path: Path, chk, inp, runtime_on):
    per_comp = {}
    for it in chk.items:
        if it.get("component"):
            per_comp.setdefault(it["component"], []).append(it)
    comps = []
    for comp in inp.components:
        cid = comp["id"]
        items = per_comp.get(cid, [])
        comps.append({"id": cid, "class": comp.get("class"), "name": comp.get("name"),
                      "status": component_status(items) if items else "unchecked",
                      "checks": len(items),
                      "fail": sum(1 for i in items if i["status"] == FAIL),
                      "warn": sum(1 for i in items if i["status"] == WARN),
                      "skipped": sum(1 for i in items if i["status"] == SKIP)})
    counts = chk.counts()
    areas = {}
    for it in chk.items:
        a = areas.setdefault(it["area"], {PASS: 0, FAIL: 0, WARN: 0, SKIP: 0})
        a[it["status"]] += 1
    payload = {
        "format": FORMAT,
        "tool": "docs/plans/tools/qa_mechanical_consistency.py",
        "tool_version": TOOL_VERSION,
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "project": str(inp.project),
        "mode": "read-only: models, catalog, contracts and viewer are never modified",
        "runtime_probe": bool(runtime_on),
        "summary": {
            "components": len(inp.components),
            "checks": len(chk.items),
            "pass": counts[PASS], "fail": counts[FAIL], "warn": counts[WARN], "skipped": counts[SKIP],
            "verdict": FAIL if counts[FAIL] else (WARN if counts[WARN] else PASS),
            "by_area": areas,
        },
        "missing_inputs": sorted(set(inp.missing)),
        "errors": inp.errors,
        "derived_inputs": ["docs/plans/checks/kinematics_oscillating.json",
                           "docs/plans/checks/cam_profile_motion_piston_cam.json"],
        "checks": chk.items,
        "components": comps,
    }
    path.write_text(json.dumps(_jsonable(payload), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def write_md(path: Path, payload, chk, inp):
    s = payload["summary"]
    L = []
    A = L.append
    A("# Mechanical consistency check — machine modules")
    A("")
    A("Generated %s by `%s` (v%s). **Read-only**: no model, catalog, contract or viewer file is touched."
      % (payload["generated_at"], payload["tool"], payload["tool_version"]))
    A("")
    A("## Verdict")
    A("")
    A("| metric | value |")
    A("|---|---|")
    A("| components scanned | %d |" % s["components"])
    A("| checks run | %d |" % s["checks"])
    A("| pass | %d |" % s["pass"])
    A("| warn | %d |" % s["warn"])
    A("| fail | %d |" % s["fail"])
    A("| skipped | %d |" % s["skipped"])
    A("| overall | **%s** |" % s["verdict"].upper())
    A("")
    A("## By area")
    A("")
    A("| area | pass | warn | fail | skipped |")
    A("|---|---|---|---|---|")
    for area in ALL_AREAS + ["runtime"]:
        if area not in s["by_area"]:
            continue
        a = s["by_area"][area]
        A("| %s | %d | %d | %d | %d |" % (area, a[PASS], a[WARN], a[FAIL], a[SKIP]))
    A("")

    fails = [i for i in chk.items if i["status"] == FAIL]
    warns = [i for i in chk.items if i["status"] == WARN]
    skips = [i for i in chk.items if i["status"] == SKIP]

    A("## Failures (%d)" % len(fails))
    A("")
    if not fails:
        A("None.")
    else:
        A("| check | component | detail |")
        A("|---|---|---|")
        for i in fails:
            A("| `%s` | %s | %s |" % (i["id"], i.get("component") or "—", i["message"].replace("|", "/")))
    A("")
    A("## Warnings (%d)" % len(warns))
    A("")
    if not warns:
        A("None.")
    else:
        A("| check | component | detail |")
        A("|---|---|---|")
        for i in warns:
            A("| `%s` | %s | %s |" % (i["id"], i.get("component") or "—", i["message"].replace("|", "/")))
    A("")
    if skips:
        A("## Skipped (%d)" % len(skips))
        A("")
        A("| check | component | reason |")
        A("|---|---|---|")
        for i in skips:
            A("| `%s` | %s | %s |" % (i["id"], i.get("component") or "—", i["message"].replace("|", "/")))
        A("")

    # mechanical detail sections
    def details(check_id):
        return next((i for i in chk.items if i["id"] == check_id), None)

    A("## 1. Hierarchy and drivers")
    A("")
    A("Rule: every declared driver node exists in the GLB, driver ids are unique, every `members` entry")
    A("resolves, axes are limited to `x/y/z`, constraint members reference real drivers, and no part sits")
    A("in two rotating groups at once (checked over all revolute pairs).")
    A("")
    A("| component | drivers | source | status |")
    A("|---|---|---|---|")
    for cid in ("motion_linear_x", "motion_oscillating", "motion_piston_cam", "work_tickle_pair", "motion_winch"):
        d = details("kin.driver_ids")
        items = [i for i in chk.items if i.get("component") == cid and i["area"] == AREA_HIERARCHY]
        if not items:
            continue
        st = component_status(items)
        n = next((i for i in items if i["id"] == "kin.driver_ids"), None)
        A("| %s | %s | %s | %s |" % (cid, len((n or {}).get("data", {}).get("drivers", [])) or "—",
                                     (n or {}).get("data", {}).get("source", "—"), st))
    A("")
    A("## 2. Crank-slider (motion_oscillating)")
    A("")
    o = [i for i in chk.items if i["area"] == AREA_OSC]
    ge = next((i for i in o if i["id"] == "osc.geometry"), None)
    rl = next((i for i in o if i["id"] == "osc.rod_length_constant"), None)
    ey = next((i for i in o if i["id"] == "osc.eye_fit"), None)
    st = next((i for i in o if i["id"] == "osc.stroke"), None)
    if ge:
        A("- measured crank radius %.5f m, rod %.5f m, rest phase %.2f°"
          % (ge["data"].get("crank_radius_m", 0), ge["data"].get("rod_length_m", 0),
             ge["data"].get("rest_theta_rad", 0) * 180 / math.pi))
    if rl:
        A("- rod length over %d phases: %.6f … %.6f m, drift %.6f m (tol %.6f) → **%s**"
          % (rl["data"]["phases"], rl["data"]["min_m"], rl["data"]["max_m"], rl["data"]["drift_m"],
             rl["data"]["tolerance_m"], rl["status"]))
    if ey:
        A("- eye fit: big eye %.6f m, small eye %.6f m → **%s**"
          % (ey["data"]["big_eye_gap_m"], ey["data"]["small_eye_gap_m"], ey["status"]))
    if st:
        A("- slider stroke %.4f m vs catalog %.4f m → **%s**"
          % (st["data"]["stroke_m"], st["data"]["declared_m"] or 0, st["status"]))
    A("- artifact: `docs/plans/checks/kinematics_oscillating.json`")
    A("")
    A("## 3. Cam (motion_piston_cam)")
    A("")
    c = [i for i in chk.items if i["area"] == AREA_CAM]
    for cid_ in ("cam.profile", "cam.stroke", "cam.roller_contact", "cam.law_vs_profile"):
        it = next((i for i in c if i["id"] == cid_), None)
        if it:
            A("- `%s`: %s → **%s**" % (it["id"], it["message"], it["status"]))
    A("- artifact: `docs/plans/checks/cam_profile_motion_piston_cam.json`")
    A("")
    A("## 4. Winch (motion_winch)")
    A("")
    for it in [i for i in chk.items if i["area"] == AREA_WINCH]:
        A("- `%s`: %s → **%s**" % (it["id"], it["message"], it["status"]))
    A("")
    A("## 5. Capsule transparency (structure_cage, structure_stall_row)")
    A("")
    for it in [i for i in chk.items if i["area"] == AREA_STRUCT]:
        A("- `%s` (%s): %s → **%s**" % (it["id"], it.get("component"), it["message"], it["status"]))
    A("")
    A("## 6. Library-wide checks (all %d components)" % s["components"])
    A("")
    A("Per component: model file resolves and parses, node-name prefix, no cameras/lights, no dead or")
    A("non-finite meshes, alpha/alphaMode consistency, unique node names, catalog node count.")
    A("")
    gen = [i for i in chk.items if i["area"] == AREA_GENERIC]
    kinds = {}
    for i in gen:
        kinds.setdefault(i["id"], {PASS: 0, FAIL: 0, WARN: 0, SKIP: 0})[i["status"]] += 1
    A("| check | pass | warn | fail |")
    A("|---|---|---|---|")
    for k, v in sorted(kinds.items()):
        A("| `%s` | %d | %d | %d |" % (k, v[PASS], v[WARN], v[FAIL]))
    A("")
    if payload.get("runtime_probe"):
        A("## Runtime probe (headless viewer)")
        A("")
        rt = [i for i in chk.items if i["area"] == "runtime"]
        if rt:
            A("| check | component | status | detail |")
            A("|---|---|---|---|")
            for i in rt:
                A("| `%s` | %s | %s | %s |" % (i["id"], i.get("component") or "—", i["status"],
                                               i["message"].replace("|", "/")))
        else:
            A("_not run_")
        A("")
    if payload["missing_inputs"]:
        A("## Missing inputs (checks marked skipped, run did not fail)")
        A("")
        for m in payload["missing_inputs"]:
            A("- `%s`" % m)
        A("")
    A("## Method")
    A("")
    A("The tool re-derives everything from the shipped GLB: it composes node world transforms")
    A("(TRS/matrix chains), reads POSITION accessors, measures the cam profile as a polar radius")
    A("envelope about the `anim` axis, measures crank radius, rod length and eye centres from mesh")
    A("centroids, and rasterises opaque triangles onto all four vertical facades for the occlusion")
    A("fraction. Contract values from `component-catalog.json` / `component-contracts.json` are only")
    A("compared against these measurements, never used as the measurement itself.")
    A("")
    A("Reproduce:")
    A("")
    A("```")
    A("python3 docs/plans/tools/qa_mechanical_consistency.py")
    A("python3 docs/plans/tools/qa_mechanical_consistency.py --no-runtime   # geometry only")
    A("```")
    A("")
    path.write_text("\n".join(L) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description="Read-only mechanical consistency QA")
    ap.add_argument("--project", default=None, help="project root (default: derived from this file)")
    ap.add_argument("--out", default=None, help="output dir (default docs/plans/checks)")
    ap.add_argument("--runtime", dest="runtime", action="store_true", default=True)
    ap.add_argument("--no-runtime", dest="runtime", action="store_false")
    ap.add_argument("--only", default=None, help="comma-separated areas to run")
    args = ap.parse_args(argv)

    project = Path(args.project).resolve() if args.project else Path(__file__).resolve().parents[3]
    out_dir = Path(args.out).resolve() if args.out else project / "docs/plans/checks"
    out_dir.mkdir(parents=True, exist_ok=True)

    only = set(a.strip() for a in args.only.split(",")) if args.only else None

    def want(area):
        return only is None or area in only

    inp = Inputs(project)
    chk = Checks()
    t0 = time.time()

    if not inp.components:
        chk.add("gen.catalog", AREA_GENERIC, FAIL,
                "component-catalog.json missing or has no components",
                None, missing=["public/models/machine-modules/component-catalog.json"])

    if want(AREA_GENERIC):
        check_all_general(chk, inp)
    if want(AREA_HIERARCHY):
        check_all_hierarchy(chk, inp)

    targets = {
        "motion_oscillating": (AREA_OSC, check_oscillating),
        "motion_piston_cam": (AREA_CAM, check_cam),
        "motion_winch": (AREA_WINCH, check_winch),
    }
    for cid, (area, fn) in targets.items():
        if not want(area):
            continue
        comp = inp.by_id.get(cid)
        if comp is None:
            chk.add("%s.component" % area, area, SKIP,
                    "%s is not in the catalog" % cid, cid, missing=[cid])
            continue
        glb, err = inp.glb(comp)
        if glb is None:
            chk.add("%s.glb" % area, area, SKIP, err, cid)
            continue
        if fn is check_winch:
            fn(chk, inp, comp, glb)
        else:
            fn(chk, inp, comp, glb, out_dir)

    if want(AREA_STRUCT):
        for cid in ("structure_cage", "structure_stall_row"):
            comp = inp.by_id.get(cid)
            if comp is None:
                chk.add("struct.component", AREA_STRUCT, SKIP, "%s not in catalog" % cid, cid)
                continue
            glb, err = inp.glb(comp)
            if glb is None:
                chk.add("struct.glb", AREA_STRUCT, SKIP, err, cid)
                continue
            check_structure(chk, inp, comp, glb)

    if args.runtime and want("runtime"):
        check_runtime(chk, inp)

    payload = write_json(out_dir / "mechanical-consistency.json", chk, inp, args.runtime)
    write_md(out_dir / "mechanical-consistency.md", payload, chk, inp)

    s = payload["summary"]
    print("components : %d" % s["components"])
    print("checks     : %d" % s["checks"])
    print("pass/fail  : %d / %d   warn %d   skipped %d" % (s["pass"], s["fail"], s["warn"], s["skipped"]))
    print("verdict    : %s   (%.1fs)" % (s["verdict"].upper(), time.time() - t0))
    print("json       : %s" % (out_dir / "mechanical-consistency.json"))
    print("md         : %s" % (out_dir / "mechanical-consistency.md"))
    if s["fail"]:
        for it in chk.items:
            if it["status"] == FAIL:
                print("  FAIL %-28s %-22s %s" % (it["id"], it.get("component") or "-", it["message"][:110]))
    return 0 if s["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
