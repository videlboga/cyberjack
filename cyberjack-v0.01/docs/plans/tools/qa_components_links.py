"""QA: все deep-link'и components.html?id=… — 0 JS-ошибок, 0 HTTP 4xx/5xx.

Запуск:
  python3 docs/plans/tools/qa_components_links.py [--only motion_winch,...]
"""
import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
BASE = "http://127.0.0.1:8088/models/machine-modules/components.html?id="
CATALOG = ROOT / "public/models/machine-modules/component-catalog.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--json", default=str(ROOT / "docs/plans/checks/winch-deeplinks.json"))
    args = ap.parse_args()

    # Компоненты без собранного GLB (model.status=pending) не открывают вьюер:
    # deep-link проверяет только те, у кого есть файл модели.
    ids = [c["id"] for c in json.loads(CATALOG.read_text())["components"]
           if (c.get("model") or {}).get("file")]
    if args.only:
        wanted = {x.strip() for x in args.only.split(",") if x.strip()}
        ids = [i for i in ids if i in wanted]

    results = {"total": len(ids), "ok": 0, "failed": [], "items": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                  "--disable-dev-shm-usage"],
        )
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        for n, cid in enumerate(ids, 1):
            page = ctx.new_page()
            errs, http = [], []
            glb = []

            def on_response(r, http=http, glb=glb):
                if r.status >= 400:
                    http.append(f"HTTP {r.status} {r.url}")
                if r.url.endswith(".glb"):
                    glb.append(r.status)

            page.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            page.on("requestfailed", lambda r, http=http: http.append(f"FAILED {r.url} :: {r.failure}"))
            page.on("response", on_response)
            ready = False
            try:
                page.goto(BASE + cid, wait_until="load", timeout=30000)
                page.wait_for_function(
                    "() => { const v = window.__COMPONENT_VIEWER;"
                    " return v && v.canvas && v.canvas.classList.contains('ready') && v.model; }",
                    timeout=20000,
                )
                ready = True
            except Exception as exc:  # noqa: BLE001
                errs.append(f"timeout/goto: {exc}")
            item = {"id": cid, "ready": ready, "glb_status": glb, "js_errors": errs,
                    "http_errors": http}
            results["items"].append(item)
            if ready and not errs and not http:
                results["ok"] += 1
            else:
                results["failed"].append(item)
            print(f"[{n:02d}/{len(ids)}] {cid} ready={ready} glb={glb} js={len(errs)} http={len(http)}",
                  flush=True)
            page.close()
        browser.close()

    Path(args.json).write_text(json.dumps(results, ensure_ascii=False, indent=1))
    print(json.dumps({k: results[k] for k in ("total", "ok")}, ensure_ascii=False))
    for f in results["failed"]:
        print(json.dumps(f, ensure_ascii=False))
    return 0 if not results["failed"] else 1


if __name__ == "__main__":
    sys.exit(main())
