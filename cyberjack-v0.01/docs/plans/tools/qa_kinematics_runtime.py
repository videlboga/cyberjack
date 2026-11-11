#!/usr/bin/env python3
"""Runtime kinematic QA: verify that coupled DOFs share one phase in the viewer.

Samples the actual page for the three phase-coupled pilot components and fits
the declared law to the observed transforms. This catches animation that merely
"changes" while the cam/screw/crank and follower/carriage are independent.
"""
from __future__ import annotations
import json, math, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8088/models/machine-modules/components.html?id="
OUT = Path("/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/kinematics-runtime-report.json")

CASES = {
    "motion_piston_cam": {"driver": "cam", "axis": "z", "follower": "follower", "law": "cam_profile", "expect": 1.0},
    "motion_linear_x": {"driver": "screw", "axis": "x", "follower": "carriage", "law": "screw_lead", "expect": 0.00159154943},
    "motion_oscillating": {"driver": "crank", "axis": "z", "follower": "slider", "law": "crank_slider", "expect": 0.020},
}


def fit(xs, ys):
    n = len(xs)
    mx = sum(xs) / n; my = sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    if den < 1e-12:
        return 0.0, my
    k = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
    return k, my - k * mx


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                    args=["--no-sandbox", "--use-angle=swiftshader",
                                          "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        for cid, case in CASES.items():
            page.goto(BASE + cid, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_function("document.getElementById('detail-visual').classList.contains('has-3d')", timeout=20000)
            samples = []
            for _ in range(28):
                v = page.evaluate("""() => {
                  const v = window.__COMPONENT_VIEWER;
                  if (!v || !v.kin) return null;
                  const get = (id) => (v.kin.drivers || []).find(d => d.id === id);
                  const drv = get(%r), fol = get(%r);
                  const theta = drv && drv.pivot ? drv.pivot.rotation[%r] : null;
                  const pos = fol && fol.obj ? fol.obj.position.toArray() : null;
                  return {theta, pos};
                }""" % (case["driver"], case["follower"], case["axis"]))
                if v:
                    samples.append(v)
                page.wait_for_timeout(80)
            if len(samples) < 8:
                results.append({"component": cid, "status": "fail", "reason": "too few samples", "samples": len(samples)})
                continue
            # unwrap theta if necessary (viewer phase is bounded, but be tolerant)
            th = [s["theta"] for s in samples]
            xs = [s["pos"][0] for s in samples]
            law = case["law"]
            if law == "cam_cosine":
                basis = [1 - math.cos(t) for t in th]
            elif law == "cam_profile":
                con = json.loads((Path(__file__).resolve().parents[3] / "public/models/machine-modules/component-contracts.json").read_text(encoding="utf-8"))
                p = con["components"][cid]["kinematics"]["drivers"][1]["profile"]
                tab = p["r_m"]; step = math.radians(p.get("step_deg", 5)); r0 = p.get("r0_m", tab[0])
                def camr(a):
                    x = ((a % (2 * math.pi)) + 2 * math.pi) % (2 * math.pi) / step
                    i = int(x) % len(tab); j = (i + 1) % len(tab); f = x - int(x)
                    return tab[i] * (1 - f) + tab[j] * f
                basis = [camr(t) - r0 for t in th]
            elif law == "screw_lead":
                basis = list(th)
            else:
                basis = [math.sin(t) for t in th]
            k, b = fit(basis, xs)
            resid = max(abs(y - (k * q + b)) for q, y in zip(basis, xs))
            ok = abs(k - case["expect"]) < max(0.002, case["expect"] * 0.08) and resid < 0.003
            results.append({"component": cid, "status": "pass" if ok else "fail",
                            "law": law, "fit_gain_m": k, "expected_gain_m": case["expect"],
                            "intercept_m": b, "max_residual_m": resid, "samples": len(samples)})
        browser.close()
    report = {"format": "cj-kinematics-runtime/1", "cases": results,
              "js_errors": errors,
              "status": "pass" if all(r["status"] == "pass" for r in results) else "fail"}
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
