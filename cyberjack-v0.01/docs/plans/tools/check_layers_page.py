#!/usr/bin/env python3
"""Проверка страницы компонентов после миграции слоёв.

Открывает каталог, собирает консольные ошибки, счётчики слоёв, проваливается
в новый компонент (база комбинированная) и делает два скриншота.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8088/models/machine-modules/components.html"
OUT = Path("/home/cyberkitty/.hermes/profiles/qwen8/cache/scratch")
OUT.mkdir(parents=True, exist_ok=True)


def main() -> int:
    errors, http = [], []
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                               args=["--no-sandbox", "--use-angle=swiftshader",
                                     "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
        page = br.new_page(viewport={"width": 1440, "height": 1100})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(f"console:{m.text}") if m.type == "error" else None)
        page.on("response", lambda r: http.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        page.goto(BASE, wait_until="load", timeout=30000)
        page.wait_for_selector(".card", timeout=20000)
        data = page.evaluate("""() => ({
            count: document.querySelector('#count').textContent,
            top: document.querySelector('#top-count').textContent,
            foot: document.querySelector('#foot-meta').textContent,
            layers: Array.from(document.querySelectorAll('#layer-filters .filter')).map(b => b.textContent.trim()),
            cards: document.querySelectorAll('.card').length,
        })""")
        page.screenshot(path=str(OUT / "cj-components-layers.png"), full_page=False)

        # фильтр по слою «Эффект»
        page.click("#layer-filters [data-layer='effect']")
        page.wait_for_timeout(300)
        eff = page.evaluate("""() => ({
            n: document.querySelectorAll('.card').length,
            names: Array.from(document.querySelectorAll('.card h3')).map(x => x.textContent),
        })""")

        # карточка новой базы: слой, возможности, несовместимости
        page.goto(BASE + "?id=work_probe_combined", wait_until="load", timeout=30000)
        page.wait_for_selector("#modal.open", timeout=20000)
        page.wait_for_timeout(600)
        modal = page.evaluate("""() => ({
            layer: document.querySelector('#d-layer-badge').textContent,
            caps: Array.from(document.querySelectorAll('#d-caps .chip')).map(x => x.textContent),
            rejects: Array.from(document.querySelectorAll('#d-rejects .chip')).map(x => x.textContent),
            composeHidden: document.querySelector('#d-compose-block').hidden,
            download: document.querySelector('#d-download').hidden,
            title: document.querySelector('#d-title').textContent,
        })""")
        page.screenshot(path=str(OUT / "cj-components-modal.png"), full_page=False)

        # пресет: состав сборки
        page.goto(BASE + "?id=work_probe_inflatable", wait_until="load", timeout=30000)
        page.wait_for_selector("#modal.open", timeout=20000)
        page.wait_for_timeout(500)
        preset = page.evaluate("""() => ({
            layer: document.querySelector('#d-layer-badge').textContent,
            composeHidden: document.querySelector('#d-compose-block').hidden,
            compose: Array.from(document.querySelectorAll('#d-compose .chip')).map(x => x.textContent),
        })""")
        br.close()

    print(json.dumps({"page": data, "effectFilter": eff, "modal": modal, "preset": preset,
                      "errors": errors[:12], "http4xx5xx": http[:12]}, ensure_ascii=False, indent=1))
    return 0 if not errors and not http else 1


if __name__ == "__main__":
    sys.exit(main())
