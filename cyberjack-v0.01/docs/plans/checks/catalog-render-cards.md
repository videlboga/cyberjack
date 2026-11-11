# Каталог компонентов: рендер-превью в карточках

Дата: 2026-11-11 · Файл: `public/models/machine-modules/components.html` (единственный изменённый файл)
Проверка: headless Chromium через CDP → http://127.0.0.1:8088/models/machine-modules/components.html (сервер `python3 -m http.server 8088 -d public`, уже запущен).

## Что изменено

1. `card(c, i)` — центральная SVG-иконка обёрнута в превью:

```html
<div class="shot-wrap">
  <img class="shot" loading="lazy" decoding="async" alt=""
       src="renders/${esc(c.id)}.webp?v=${CATALOG_V}"
       onerror="this.parentNode.classList.add('is-svg');this.remove()">
  <div class="icon">${ICONS[c.class] || ICONS.WORK}</div>
</div>
```

2. CSS (рядом с `.icon`):

```css
.shot-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;pointer-events:none}
.shot-wrap .icon{display:none}
.shot-wrap.is-svg .icon{display:block}
.shot{height:78%;width:auto;max-width:92%;aspect-ratio:1/1;object-fit:contain;display:block;pointer-events:none;filter:drop-shadow(0 10px 20px rgba(47,49,53,.18))}
```

3. `CATALOG_V`: `20261111-hard1` → `20261111-renders1` (сброс кэша HTML/JSON/`renders/*.webp`).

SVG остаётся fallback: при 404/ошибке декодирования `<img>` сам удаляется, на `.shot-wrap` вешается `.is-svg`, иконка класса снова видима. `.card-visual` (16:9), `.grid`, mobile-медиазапросы 1080/720, `.card.is-archived` (grayscale), `.vbadge`, 3D-модалка не тронуты.

## Данные

- `component-catalog.json`: 96 компонентов (core 10, concept 74, archived 12).
- `renders/`: 96 WebP 600×600, имена ровно совпадают с `id` (0 лишних, 0 пропусков).
- Прямая проверка сервера: **96/96 URL → HTTP 200, Content-Type `image/webp`**.

| Проверка | Результат |
|---|---|
| Дефолтный вид (архив скрыт) | 84 карточки, счётчик «84 / 96 · 12 в архиве», 84 `<img>`, 84 loaded, 0 broken |
| Архив включён | 96 карточек, 12 `.is-archived`, 96 `<img>`, 96 loaded, 0 broken |
| `renders/*.webp` | 96/96 HTTP 200, все 600×600, 0 failed requests |
| JS-ошибки / исключения | 0 (чистая загрузка: `console: []`, `exceptions: []`) |
| Горизонтальный скролл | нет: docW=winW на 1440 / 720 / 390 |
| Переполнение превью за `.card-visual` | 0 карточек (img 143×143 при visual 329×185) |
| Hard-бейдж | 10 карточек `.vbadge` (в каталоге 10 компонентов с вариантом `hard`), превью и подписи на месте (`restraint_wrist_cuff` и др.) |
| Архивная карточка | пунктир, «АРХИВ», приглушённое превью, `arch-note` — на месте |
| SVG-fallback | принудительный битый `src` → `.is-svg`, `<img>` удалён, иконка 125×100 видима |
| 3D-модалка | открывается («Станина», GLB рендерится на canvas), регрессии нет |
| Мобилка 390 / планшет 720 | сетка в одну колонку, превью по центру, подписи не перекрыты |

Единственный 404 и единственная запись в console — искусственный `renders/__definitely_missing__.webp` из теста fallback.

## Скриншоты

`desktop-default.png`, `desktop-hard-badges.png`, `desktop-archive-on.png`, `mobile-390.png`, `tablet-720.png`, `svg-fallback.png`, `modal-3d.png`.

Сырые метрики: `qa-desktop.json`, `qa-breakpoints.json`. Скрипты воспроизведения: `cdp_cards_qa.py` (дефолт/архив/модалка), `cdp_cards_qa2.py` (390/720/архив/lazy/fallback).

## Замечания

- `loading="lazy"`: на первом экране грузятся только видимые превью; полный прогресс 96/96 достигается прокруткой (проверено) и подтверждён прямой HTTP-проверкой всех 96 файлов.
- `components-viewer.js` подключается со своим `?v=20261111-hard1` — не менялся, т.к. вне скоупа задачи.
- GLB, mates, contracts, device-файлы не изменялись.
