"""Замер VRM-рига: суставы человека, радиусы сегментов, антропометрия.

Только чтение. Ничего не пишет в модель и каталог. Результат — JSON в stdout
или в файл, который потом используется как источник чисел для
`docs/plans/checks/anatomy-points-spec.json`.

Что считается:
  * humanoid-суставы (VRM 0.x `VRM.humanoid`, VRM 1.0 `VRMC_vrm.humanoid`),
    мировые позиции головок костей в rest-позе (T/A-pose из файла);
  * габарит меша (рост, размах, глубина) и направление «лицом»;
  * радиусы сегментов: каждому顶点 меша назначается ближайший сегмент
    (диагональ Вороного по сегментам), затем перцентили радиального
    расстояния до оси сегмента — это и есть «поверхность» для манжет,
    колец и ложементов;
  * высота промежности (кроп) по нижней точке меша в узкой полосе |x|<40 мм.

Запуск:
  python docs/plans/tools/body_points_probe.py \
      --vrm public/models/anna_nude.vrm \
      --heights 1.60 1.75 1.90 \
      --out docs/plans/checks/anatomy-rig-probe.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from datetime import date, datetime, timezone

import numpy as np

# --- glTF/GLB ---------------------------------------------------------------

def glb_json(path):
    data = open(path, "rb").read()
    magic, ver, length = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        raise SystemExit(f"{path}: не GLB (magic={magic:#x})")
    off, js = 12, None
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        off += 8 + clen
    if js is None:
        raise SystemExit(f"{path}: нет JSON-чанка")
    return js, hashlib.sha256(data).hexdigest()[:16], length


COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2),
        5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def accessor(js, idx, raw):
    a = js["accessors"][idx]
    bv = js["bufferViews"][a["bufferView"]]
    fmt, size = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    stride = bv.get("byteStride") or size * n
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    out = np.zeros((a["count"], n), dtype=np.float64)
    for i in range(a["count"]):
        off = base + i * stride
        out[i] = struct.unpack_from("<" + fmt * n, raw, off)
    return out[:, 0] if n == 1 else out


def read_bin(path):
    data = open(path, "rb").read()
    magic, ver, length = struct.unpack("<III", data[:12])
    off = 12
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        if ctype == 0x004E4942:
            return data[off + 8: off + 8 + clen]
        off += 8 + clen
    raise SystemExit("нет BIN-чанка")


# --- трансформы -------------------------------------------------------------

def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def qrot(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    t = (2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx))
    return (vx + w * t[0] + (y * t[2] - z * t[1]),
            vy + w * t[1] + (z * t[0] - x * t[2]),
            vz + w * t[2] + (x * t[1] - y * t[0]))


def qmat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def node_world(nodes, parent_of, idx):
    n = nodes[idx]
    t = n.get("translation", [0, 0, 0])
    r = n.get("rotation", [0, 0, 0, 1])
    s = n.get("scale", [1, 1, 1])
    p = tuple(t)
    if idx in parent_of:
        pp, pq, ps = node_world(nodes, parent_of, parent_of[idx])
        pr = qrot(pq, p)
        return ((pp[0] + pr[0], pp[1] + pr[1], pp[2] + pr[2]),
                qmul(pq, r), tuple(ps[k] * s[k] for k in range(3)))
    return p, tuple(r), tuple(s)


# --- сегменты ---------------------------------------------------------------

SEGMENTS = [
    ("hips", "spine"), ("spine", "chest"), ("chest", "upperChest"),
    ("upperChest", "neck"), ("neck", "head"),
    ("leftShoulder", "leftUpperArm"), ("leftUpperArm", "leftLowerArm"),
    ("leftLowerArm", "leftHand"), ("leftHand", "leftMiddleProximal"),
    ("rightShoulder", "rightUpperArm"), ("rightUpperArm", "rightLowerArm"),
    ("rightLowerArm", "rightHand"), ("rightHand", "rightMiddleProximal"),
    ("leftUpperLeg", "leftLowerLeg"), ("leftLowerLeg", "leftFoot"),
    ("leftFoot", "leftToes"),
    ("rightUpperLeg", "rightLowerLeg"), ("rightLowerLeg", "rightFoot"),
    ("rightFoot", "rightToes"),
]


def seg_dist(pts, a, b):
    ab = b - a
    L2 = float(ab @ ab)
    t = np.clip(((pts - a) @ ab) / L2, 0.0, 1.0)
    proj = a + t[:, None] * ab
    d = np.linalg.norm(pts - proj, axis=1)
    return d, t


def measure(vrm_path, heights):
    js, sha, size = glb_json(vrm_path)
    raw = read_bin(vrm_path)
    nodes = js["nodes"]

    vrm = (js.get("extensions", {}).get("VRMC_vrm")
           or js.get("extensions", {}).get("VRM"))
    if vrm is None:
        raise SystemExit("нет VRM-расширения")
    hb_raw = vrm["humanoid"]["humanBones"]
    if isinstance(hb_raw, dict):
        hb = {k: (v["node"] if isinstance(v, dict) else v) for k, v in hb_raw.items()}
        vrm_version = "VRM 1.0 (VRMC_vrm)"
    else:
        hb = {b["bone"]: b["node"] for b in hb_raw}
        vrm_version = "VRM 0.x (VRM)"

    parent_of = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parent_of[c] = i

    J = {}
    for name, idx in hb.items():
        J[name] = np.array(node_world(nodes, parent_of, idx)[0], dtype=float)
    missing = [s for s in SEGMENTS if s[0] not in J or s[1] not in J]

    # меши: вершины в мировых координатах (rest pose / bind space)
    verts = []
    for i, n in enumerate(nodes):
        m = n.get("mesh")
        if m is None:
            continue
        p, q, s = node_world(nodes, parent_of, i)
        M = qmat(q) @ np.diag(s)
        for pr in js["meshes"][m]["primitives"]:
            v = accessor(js, pr["attributes"]["POSITION"], raw)
            verts.append(v @ M.T + np.array(p))
    V = np.vstack(verts)
    bbox_min, bbox_max = V.min(axis=0), V.max(axis=0)
    height = float(bbox_max[1] - bbox_min[1])

    # рост без волос: только меши, не содержащие в имени Hair/Face
    body_only = []
    for i, n in enumerate(nodes):
        m = n.get("mesh")
        if m is None:
            continue
        nm = (js["meshes"][m].get("name") or "") + " " + (n.get("name") or "")
        if "hair" in nm.lower():
            continue
        p, q, s = node_world(nodes, parent_of, i)
        M = qmat(q) @ np.diag(s)
        for pr in js["meshes"][m]["primitives"]:
            body_only.append(accessor(js, pr["attributes"]["POSITION"], raw) @ M.T + np.array(p))
    VB = np.vstack(body_only)
    height_body = float(VB[:, 1].max() - VB[:, 1].min())
    facing = "+Z" if J.get("leftToes", J["hips"])[2] > J["hips"][2] else "-Z"

    # радиусы: Вороной по сегментам
    segs = [(a, b) for a, b in SEGMENTS]
    D = np.stack([seg_dist(V, J[a], J[b])[0] for a, b in segs], axis=1)  # (n, s)
    owner = D.argmin(axis=1)
    radii = {}
    for si, (a, b) in enumerate(segs):
        mask = owner == si
        if mask.sum() < 20:
            continue
        d, t = seg_dist(V[mask], J[a], J[b])
        keep = (t > 0.15) & (t < 0.85)
        if keep.sum() < 20:
            continue
        dd = d[keep]
        radii[f"{a}->{b}"] = {
            "n": int(keep.sum()),
            "r_med_m": round(float(np.median(dd)), 4),
            "r_p90_m": round(float(np.percentile(dd, 90)), 4),
            "r_max_m": round(float(dd.max()), 4),
            "d_p90_m": round(float(2 * np.percentile(dd, 90)), 4),
        }

    # срезы (горизонтальная полоса ±12 мм у сустава): ширина/глубина/радиус
    # — это то, что нужно манжетам и кольцам, а не радиус по всему сегменту.
    slices = {}
    # tag, bone, смещение по Y, окно по X (м) — только для парных/конечностей
    for tag, bone, dy, win in (
            ("neck_ring", "neck", 0.012, None), ("waist", "spine", 0.0, None),
            ("hip", "hips", 0.0, None), ("wrist_L", "leftHand", 0.0, 0.045),
            ("wrist_R", "rightHand", 0.0, 0.045), ("knee_L", "leftLowerLeg", 0.0, 0.06),
            ("knee_R", "rightLowerLeg", 0.0, 0.06), ("ankle_L", "leftFoot", 0.03, 0.06),
            ("ankle_R", "rightFoot", 0.03, 0.06), ("head_max", "head", 0.06, None)):
        if bone not in J:
            continue
        c = J[bone].copy()
        c[1] += dy
        band = V[np.abs(V[:, 1] - c[1]) < 0.014]
        if len(band) < 30:
            continue
        # только «своя» сторона: для парных — по знаку X сустава
        if bone.startswith(("left", "right")):
            sign = 1.0 if bone.startswith("left") else -1.0
            band = band[np.sign(band[:, 0]) == sign]
            if len(band) < 30:
                continue
        if win:
            band = band[np.abs(band[:, 0] - c[0]) < win]
            band = band[np.abs(band[:, 2] - c[2]) < 3 * win]
            if len(band) < 20:
                continue
        r = np.linalg.norm(band[:, [0, 2]] - np.array([c[0], c[2]]), axis=1)
        slices[tag] = {
            "center_m": [round(float(x), 4) for x in c],
            "width_m": round(float(band[:, 0].max() - band[:, 0].min()), 4),
            "depth_m": round(float(band[:, 2].max() - band[:, 2].min()), 4),
            "r_med_m": round(float(np.median(r)), 4),
            "r_max_m": round(float(r.max()), 4),
            "d_max_m": round(float(2 * r.max()), 4),
            "band_mm": 28,
        }

    # промежность: низ меша в узкой полосе по центру
    strip = V[(np.abs(V[:, 0]) < 0.04) & (V[:, 1] < J["hips"][1]) & (V[:, 1] > 0.4 * height)]
    crotch = float(strip[:, 1].min()) if len(strip) else None

    chain = {}
    for a, b in SEGMENTS:
        if a in J and b in J:
            chain[f"{a}->{b}"] = round(float(np.linalg.norm(J[b] - J[a])), 4)

    out = {
        "format": "cj-rig-probe/1",
        "generated": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "source": {"file": vrm_path, "bytes": size, "sha256_16": sha,
                   "vrm": vrm_version,
                   "meta": {k: vrm.get("meta", {}).get(k) for k in
                            ("name", "avatarPermission", "allowRedistribution", "modification")}},
        "rest": {
            "pose": "bind/T-pose из файла",
            "height_m": round(height, 4),
            "height_body_m": round(height_body, 4),
            "bbox_min_m": [round(v, 4) for v in bbox_min],
            "bbox_max_m": [round(v, 4) for v in bbox_max],
            "armspan_m": round(float(bbox_max[0] - bbox_min[0]), 4),
            "depth_m": round(float(bbox_max[2] - bbox_min[2]), 4),
            "facing": facing,
            "up": "+Y",
            "units": "m",
            "crotch_height_m": round(crotch, 4) if crotch else None,
            "hips_height_m": round(float(J["hips"][1]), 4),
            "crotch_over_hips": round(crotch / J["hips"][1], 4) if crotch else None,
        },
        "bones": {k: [round(float(x), 4) for x in v] for k, v in J.items()},
        "segments_m": chain,
        "radii_m": radii,
        "slices": slices,
        "scaled": {},
        "missing_segments": missing,
    }

    k0 = 1.75 / height
    for H in heights:
        k = H / height
        out["scaled"][f"{H:.2f}"] = {
            "k": round(k, 5),
            "bones": {b: [round(float(x) * k, 4) for x in p] for b, p in J.items()},
            "crotch_height_m": round(crotch * k, 4) if crotch else None,
        }

    # самопроверки
    checks = []
    def chk(name, ok, detail=""):
        checks.append({"check": name, "ok": bool(ok), "detail": detail})

    chk("hips выше колен", J["hips"][1] > J["leftLowerLeg"][1] > J["leftFoot"][1],
        f"{J['hips'][1]:.3f} > {J['leftLowerLeg'][1]:.3f} > {J['leftFoot'][1]:.3f}")
    chk("симметрия L/R по X", abs(abs(J["leftHand"][0]) - abs(J["rightHand"][0])) < 0.005,
        f"{J['leftHand'][0]:.4f} vs {J['rightHand'][0]:.4f}")
    chk("симметрия коленей", abs(abs(J["leftLowerLeg"][0]) - abs(J["rightLowerLeg"][0])) < 0.005)
    chk("hips/H правдоподобно (0.50–0.60)", 0.50 <= J["hips"][1] / height <= 0.60,
        f"{J['hips'][1] / height:.3f}")
    chk("кисть ниже плеча в T-pose", abs(J["leftHand"][1] - J["leftUpperArm"][1]) < 0.02,
        "T-pose: плечо и кисть на одной высоте")
    chk("нет пропущенных сегментов", not missing, str(missing))
    chk("все высоты положительны", all(h > 1.2 for h in heights))
    out["checks"] = checks
    out["summary"] = {
        "bones": len(J), "heights_m": heights,
        "segments_measured": len(radii), "checks_ok": sum(c["ok"] for c in checks),
        "checks_total": len(checks),
        "k_1_75": round(k0, 5),
    }
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--vrm", default="public/models/anna_nude.vrm")
    ap.add_argument("--heights", nargs="*", type=float, default=[1.60, 1.75, 1.90])
    ap.add_argument("--out", default=None)
    a = ap.parse_args(argv)
    res = measure(a.vrm, a.heights)
    s = json.dumps(res, ensure_ascii=False, indent=1)
    if a.out:
        open(a.out, "w").write(s + "\n")
        print(f"written {a.out} ({len(s)} bytes)")
        print(json.dumps(res["summary"], ensure_ascii=False))
        bad = [c for c in res["checks"] if not c["ok"]]
        for b in bad:
            print("FAIL", b["check"], b["detail"])
        return 0 if not bad else 1
    print(s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
