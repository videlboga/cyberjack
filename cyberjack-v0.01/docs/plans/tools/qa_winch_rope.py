"""QA: непрерывный процедурный трос motion_winch.

Открывает components.html?id=motion_winch в headless chromium (swiftshader),
снимает состояния L = 0 / 0.15 / 0.30 через window.__COMPONENT_VIEWER.winch.setLength,
проверяет непрерывность витков, монотонность и отсутствие покадровых
visible-переключений у старых витков.

Запуск:
  python3 docs/plans/tools/qa_winch_rope.py
"""
import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8088/models/machine-modules/components.html?id=motion_winch"
ROOT = Path(__file__).resolve().parents[3]
LEGACY_RE = r"/rope_turn_|rope_branch$|rope_coil$/"


def run(out_dir: Path, states=(0.0, 0.15, 0.30)):
    out_dir.mkdir(parents=True, exist_ok=True)
    page_errors, http_errors, console_errors = [], [], []
    shots, samples = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                  "--disable-dev-shm-usage"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("requestfailed", lambda r: http_errors.append(f"FAILED {r.url} :: {r.failure}"))
        page.on("response", lambda r: http_errors.append(f"HTTP {r.status} {r.url}") if r.status >= 400 else None)

        page.goto(BASE, wait_until="load")
        page.wait_for_function(
            "() => window.__COMPONENT_VIEWER && window.__COMPONENT_VIEWER.winch && "
            "window.__COMPONENT_VIEWER.canvas.classList.contains('ready')",
            timeout=30000,
        )
        page.wait_for_timeout(800)

        canvas = page.locator("#detail-visual canvas")
        for L in states:
            info = page.evaluate(
                """(L) => {
                  const v = window.__COMPONENT_VIEWER;
                  v.winch.setLength(L);
                  v.renderer.render(v.scene, v.camera);
                  const w = v.winch;
                  const s = w.state();
                  let legacyVisible = 0, legacyTotal = 0;
                  v.model.traverse((o) => {
                    if (/rope_turn_|rope_branch$|rope_coil$/.test(o.name || '')) {
                      legacyTotal++; if (o.visible) legacyVisible++;
                    }
                  });
                  const a = w.rope.mesh.geometry.getAttribute('position');
                  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,minz=1e9,maxz=-1e9;
                  for (let i=0;i<a.count;i++){
                    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
                    if(x<minx)minx=x; if(x>maxx)maxx=x;
                    if(y<miny)miny=y; if(y>maxy)maxy=y;
                    if(z<minz)minz=z; if(z>maxz)maxz=z;
                  }
                  const V3 = v.camera.position.constructor;
                  const endY = w.end.getWorldPosition(new V3()).y;
                  return { ...s, legacy_total: legacyTotal, legacy_visible: legacyVisible,
                           rope_bbox: { min:[+minx.toFixed(4),+miny.toFixed(4),+minz.toFixed(4)],
                                        max:[+maxx.toFixed(4),+maxy.toFixed(4),+maxz.toFixed(4)] },
                           rope_end_world_y: +endY.toFixed(4),
                           cap_x: +w.rope.cap.position.x.toFixed(4) };
                }""",
                L,
            )
            samples.append(info)
            path = out_dir / ("winch-rope-L%0.2f.png" % L)
            canvas.screenshot(path=str(path))
            shots.append(str(path.relative_to(ROOT)))

        # непрерывность: 21 состояние через всё поле L
        cont = page.evaluate(
            """() => {
              const v = window.__COMPONENT_VIEWER;
              const out = [];
              for (let i = 0; i <= 20; i++) {
                const L = 0.30 * i / 20;
                v.winch.setLength(L);
                out.push({ L: +L.toFixed(3), ...v.winch.state() });
              }
              v.winch.setLength(0);
              return out;
            }"""
        )

        # доказательство отсутствия покадровых visible-переключений:
        # перехватываем запись visible у старых витков/ветви и гоняем 200 кадров.
        visible_writes = page.evaluate(
            """() => {
              const v = window.__COMPONENT_VIEWER;
              const legacy = [];
              v.model.traverse((o) => {
                if (/rope_turn_|rope_branch$|rope_coil$/.test(o.name || '')) legacy.push(o);
              });
              let writes = 0;
              for (const o of legacy) {
                let val = o.visible;
                Object.defineProperty(o, 'visible', {
                  configurable: true,
                  get() { return val; },
                  set(x) { writes++; val = x; }
                });
              }
              for (let i = 0; i < 200; i++) {
                v.winch.setLength(0.30 * (0.5 - 0.5 * Math.cos(i / 200 * Math.PI * 2)));
              }
              return { frames: 200, visible_writes: writes, legacy_count: legacy.length,
                       legacy_all_hidden: legacy.every(o => o.visible === false) };
            }"""
        )

        # живая анимация: 90 кадров, следим, меняется ли visible у старых витков
        page.evaluate("() => window.__COMPONENT_VIEWER.winch.release()")
        page.evaluate(
            """() => {
              const v = window.__COMPONENT_VIEWER;
              const legacy = [];
              v.model.traverse((o) => {
                if (/rope_turn_|rope_branch$|rope_coil$/.test(o.name || '')) legacy.push(o);
              });
              window.__VIS_LOG = [];
              const check = () => {
                window.__VIS_LOG.push(legacy.map(o => o.visible ? 1 : 0).join(''));
                if (window.__VIS_LOG.length < 90) requestAnimationFrame(check);
              };
              requestAnimationFrame(check);
            }"""
        )
        page.wait_for_timeout(2400)
        vis_log = page.evaluate("() => window.__VIS_LOG") or []
        visibility = {
            "frames": len(vis_log),
            "distinct_visible_patterns": sorted(set(vis_log)),
            "legacy_visible_any": any("1" in x for x in vis_log),
        }

        live = page.evaluate(
            """() => {
              const v = window.__COMPONENT_VIEWER;
              return { ...v.winch.state(), rope_vertices:
                v.winch.rope.mesh.geometry.getAttribute('position').count,
                rope_meshes: v.scene.children.length };
            }"""
        )
        browser.close()

    return {
        "url": BASE,
        "states": samples,
        "continuity": cont,
        "screenshots": shots,
        "legacy_visibility": visibility,
        "legacy_visible_writes": visible_writes,
        "live": live,
        "page_errors": page_errors,
        "http_errors": http_errors,
        "console_errors": console_errors,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "docs/plans/checks"))
    ap.add_argument("--json", default=str(ROOT / "docs/plans/checks/winch-continuous-rope.json"))
    args = ap.parse_args()
    data = run(Path(args.out))
    Path(args.json).write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(json.dumps({"page_errors": data["page_errors"],
                      "console_errors": data["console_errors"],
                      "http_errors": data["http_errors"]}, ensure_ascii=False))
    for s in data["states"]:
        print(json.dumps(s, ensure_ascii=False))
    print("visibility:", data["legacy_visibility"])
    print("visible writes:", data["legacy_visible_writes"])
    print("continuity:", [(c["payout_m"], c["turns"], c["coil_span_m"], c["rope_len_m"])
                          for c in data["continuity"]])
    print("live:", data["live"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
