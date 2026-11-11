# Архив, батч 1: 12 компонентов без удаления

**Проект:** cyberjack-v0.01 · **Дата:** 2026-11-10 · **Основание:** `docs/plans/checks/archive-candidates.md` (§3, 12 строк с вердиктом `archive`)
**Режим:** архивирование без удаления. GLB, mates, контракты, устройства и киты не изменялись.
**Проверено в браузере:** Chromium headless (Playwright), `python3 -m http.server 8088 -d public`.

## Итог

- **12 компонентов переведены в `status: "archived"`**: 96 записей остались, 84 видимых по умолчанию, 12 в архиве.
- Каталог: `components.html` по умолчанию показывает **84 / 96**, чип **«Архив 12»** включает архив → **96 / 96**.
- Карточка и модалка показывают статус **«архив»**, `archivedFromStatus` («был: концепт»), `replacedBy` и причину; модалка — ещё `archivedAt` и `batch`.
- 3D и паспорт архивных работают: GLB на месте (`canvasReady: true`, `detail-visual has-3d`), контракт и mates тоже.
- **Ни одно устройство не ссылается на архивные** (41 устройство, 96 модулей — 0 пересечений), входящих ссылок `compatibility[]` — 0.
- 0 ошибок JS, 0 ответов ≥400 на `components.html`, `devices.html`, `mating-map.html`, `index.html`.
- Откат — одна команда: `python3 docs/plans/tools/archive-batch1-rollback.py` (проверен `--dry-run`).

## 1. Что заархивировано

| id | класс | было | `replacedBy` | короткая причина | уст. | вх. ссылок |
|---|---|---|---|---|---|---|
| `motion_turntable` | MOTION | concept | `motion_rotary` | разворот ложа по азимуту не нужен ни одному устройству | 0 | 0 |
| `work_probe_textured` | WORK | concept | `work_attach_smooth`, `_ribbed`, `_spiral` | не отдельный зонд, а база зонда + три существующие насадки | 0 | 0 |
| `work_thermal_pad` | WORK | concept | `work_probe_thermal`, `surface_heated`, `surface_cooled` | дубль связки «локальный нагрев + ложе» | 0 | 0 |
| `service_cleaner` | SERVICE | concept | `service_dock` | мойка не входит ни в одно устройство | 0 | 0 |
| `motion_piston_hydraulic` | MOTION | concept | `motion_piston_servo` | 500 Н перекрыты servo (400 Н); насос/380 В/дренаж | 0 | 0 |
| `motion_piston_telescopic` | MOTION | concept | `motion_piston_rod`, `motion_piston_servo` | ход 250 мм перекрыт rod/servo, 150 Н — слабейшее усилие | 0 | 0 |
| `motion_piston_cam` | MOTION | concept | `motion_oscillating` | дубль ритма 0,5–5 Гц; `cam_profile` + QA-кейс сохранены | 0 | 0 |
| `work_attach_nodular` | WORK | concept | `work_attach_smooth`, `_ribbed`, `_spiral` | профиль-пресет той же базы насадок | 0 | 0 |
| `work_attach_tapered` | WORK | concept | `work_attach_smooth`, `_ribbed`, `_spiral` | профиль-пресет (конус) той же базы | 0 | 0 |
| `work_attach_bulbous` | WORK | concept | `work_attach_smooth`, `_ribbed`, `_spiral` | дубль nodular/tapered по геометрии (+20–40 % объёма) | 0 | 0 |
| `work_attach_dual_density` | WORK | concept | `work_attach_sterile_liner`, `_smooth`, `_ribbed` | оболочка = гильза + профиль | 0 | 0 |
| `work_attach_sleeve` | WORK | concept | `work_attach_sterile_liner` | дубль одноразовой гильзы (натяжной чехол) | 0 | 0 |

Полные имена: `replacedBy` в JSON хранит **id**, UI подставляет названия («Осциллятор», «Стерильная гильза» и т. д.).

**Не архивировались (по указанию):** `motion_piston_servo`, `work_probe_inflatable` (рекомендация merge — нужна правка `device-catalog`), `motion_piston_rod`, `motion_piston_pneumatic`, `motion_oscillating`, `work_attach_adapter`, `utility_water`, `utility_drain`, `utility_routing`; `work_attach_curved` / `work_attach_vibrating` остаются в hold.

## 2. Схема записи (применено)

К каждой из 12 записей добавлено, `status` заменён; порядок ключей — сразу после `status`:

```json
{
  "id": "motion_piston_cam",
  "status": "archived",
  "archivedFromStatus": "concept",
  "archivedAt": "2026-11-10",
  "archiveReason": "Дубль ритма motion_oscillating (0,5–5 Гц, 0–50 мм против 0–60 мм); профиль cam_profile и QA-кейс сохранены в архиве, порт в осциллятор — отдельный шаг.",
  "replacedBy": ["motion_oscillating"],
  "archiveBatch": "batch1"
}
```

- `replacedBy` — **массив** (у части компонентов 2–3 преемника; единый тип во всех 12 записях). UI склеивает названия через ` · `.
- `archiveBatch: "batch1"` — маркер для скрипта отката, чтобы не тронуть будущие батчи.
- Записи `model`, `mates`, `specs`, `compatibility`, `variants` и т. д. не изменялись и не удалялись.

## 3. Зависимости: что проверено перед правкой

| проверка | результат |
|---|---|
| вхождение в `devices[].modules` (41 устройство) | 0 совпадений у всех 12 |
| входящие ссылки `compatibility[]` других компонентов | 0 у всех 12 |
| `kits[].devices` | не менялись, 41 устройство на месте |
| `model.file` + GLB на диске | 12/12 на месте (`motion_piston_cam.glb` 971 736 б и др.) |
| `component-contracts.json` | все 12 id присутствуют |
| `component-mates.json` | все 12 id присутствуют, `mates` внутри каталога нетронуты |
| `components-viewer.js` `directModels` (`:342`, включает `motion_piston_cam`) | запись и GLB на месте → 3D открывается |
| `replacedBy`-цели | все существуют и сами не архивные (проверено ассертом) |

## 4. Что изменено в файлах

| файл | изменение |
|---|---|
| `public/models/machine-modules/component-catalog.json` | 12 записей → `archived` + 6 полей архива; больше ничего |
| `public/models/machine-modules/components.html` | фильтр архива, чип «Архив N», счётчик `N / 96`, метки на карточке и в модалке, блок «Архив», ссылки на карту, `CATALOG_V` → `20261110-archive1` |
| `public/models/machine-modules/index.html` | 4-я карточка «Карта стыковки» → `mating-map.html`, сетка `auto-fit`, meta «4 catalogues» |
| `public/models/machine-modules/mating-map.html` | бейдж `архив` (`p-arch`, пунктир) для узлов со статусом archived; данные не фильтруются |
| `public/models/machine-modules/mating-map.json` | регенерирован `scripts/build-mating-map.py`: **изменились только 12 полей `status` + `generated`; `summary` идентична прежней** (96 / 487 / 19 без устройств / 0 проверенных стыков) |
| `docs/plans/tools/archive-batch1-rollback.py` | новый скрипт отката (dry-run проверен) |

Не менялись: GLB (`components/*.glb`), `component-contracts.json`, `component-mates.json`, `component-models.json`, `device-catalog.json`, `devices.html`, `catalog.json`, `demo.html`.

### UI детали (`components.html`)

- `state.showArchived` (по умолчанию `false`), `matches()` отсекает `status === 'archived'` первым условием.
- Чип `#archive-toggle` в тулбаре: пунктирный в покое, тёмный в включённом состоянии, `aria-pressed`, счётчик `#archive-count`.
- `#count` = `84 / 96 · 12 в архиве` (скрытый архив виден в тексте, но не в сетке); при включении — `96 / 96`.
- `#top-count` = `84 активных · 12 архив · 10 классов`; `#foot-meta` = `96 components · 84 active · 12 archived · 10 classes · 41 devices · 96 GLB`; `stat-components` оставлен 96 (всего записей), в `stat-note` — «12 записей в архиве».
- Карточка архивного: `class="card is-archived"`, пунктирная рамка, приглушённый визуал, статус `архив`, блок `архив · был: concept → <названия замен>`.
- Модалка: статус `архив`, `d-status-text` = `архив (был: концепт)`, блок «Архив» (`archiveReason`, чипы `replacedBy` — кликабельные, ведут на преемника, `archivedAt`, `batch`, пометка «данные (GLB / контракт / mates) сохранены»).
- Счётчики классовых чипов считаются по видимым: например WORK 26 / 33, MOTION 10 / 14, SERVICE 2 / 3.
- Глубокие ссылки: `components.html?archive=1` открывает каталог с архивом; `?id=<id>` работает и для архивных.
- Слушатель классовых фильтров перенесён с `addEventListener` внутрь `renderFilters()` на `onclick` — иначе повторный рендер чипов после переключения архива дублировал обработчик.
- `CATALOG_V` и версия `components-viewer.js` обновлены (`20261110-archive1`), чтобы не отдать закэшированный каталог.

### Карта стыковки

- `mating-map.json` регенерирован тем же генератором, без правок скрипта: узлы получили `status: "archived"` (12), `summary` не изменилась — счётчик `components_without_usage: 19` по-прежнему включает архивные, поэтому статистику сирот менять не пришлось.
- `mating-map.html`: в карточке узла статус `archived` рендерится бейджем **«архив»** (пунктирная рамка, `p-arch`); узлы не скрываются и не удаляются.
- Ссылка на карту добавлена в шапку и hero `components.html` (2 ссылки) и карточкой на `index.html`.

## 5. Проверки (фактические результаты)

| проверка | результат |
|---|---|
| карточек в ALL без архива | **84** (`#count` = `84 / 96 · 12 в архиве`) |
| карточек с включённым архивом | **96**, из них `.is-archived` = **12** (`96 / 96`) |
| метки статуса в архиве | 12 × «архив» |
| состав архива | ровно 12 ожидаемых id (сверка списков — совпадение) |
| фильтр класса | WORK 26 → 33, MOTION 10 → 14, SERVICE 2 → 3, ALL 84 → 96 |
| фильтр использования | UNUSED 7 → 19, USED не меняется |
| поиск | «поршень» с архивом → 6 (включая hydraulic/telescopic/cam); без архива «гидравлика» → 0 + подсказка «включите Архив» |
| модалка архивного (`motion_piston_cam`) | статус «архив», причина, `replacedBy` = «Осциллятор», `archivedAt: 2026-11-10`, GLB-ссылка, `canvasReady: true` |
| модалка архивного (`work_attach_sleeve`) | блок «Архив» + чип «Стерильная гильза», 3D-канвас рисуется |
| устройства | `devices.html`: 41 карточка, `stat-modules` = 96, 0 ошибок JS/HTTP |
| карта | `mating-map.html`: 96 узлов, статистика 96 / 487 / 3/25 / 0, бейдж «архив» в карточке `motion_piston_cam`, 0 ошибок |
| главная | `index.html`: 4 карточки, `mating-map.html` в списке, 0 ошибок |
| JS-ошибки / HTTP ≥400 | 0 / 0 на всех четырёх страницах |
| guard: `devices[].modules` ∩ archived | пусто |
| guard: `compatibility[]` → archived | пусто |

Скриншоты: `docs/plans/checks/archive-batch1-default.png` (по умолчанию), `-on.png` (архив включён), `-cards.png` (архивные карточки), `-modal.png` (блок «Архив»), `-index.png` (4 карточки), `-mating-map.png` (бейдж в карте).

## 6. Откат

```bash
# 1. посмотреть, что будет откачено
python3 docs/plans/tools/archive-batch1-rollback.py --dry-run
# 2. откатить
python3 docs/plans/tools/archive-batch1-rollback.py
```

Скрипт берёт только записи с `status: "archived"` **и** `archiveBatch: "batch1"`, возвращает `status = archivedFromStatus` (`concept`) и удаляет 6 полей архива. GLB, mates, контракты и устройства не затрагивались, поэтому откат полный.

Вручную: у 12 записей `status` → `archivedFromStatus`, удалить `archivedFromStatus`, `archivedAt`, `archiveReason`, `replacedBy`, `archiveBatch`. UI откатывать не нужно — при отсутствии `status: archived` чип покажет «Архив 0», карточки вернутся в общий список, блок «Архив» в модалке скрыт.

Карта: если нужен прежний снапшот — `mating-map.json` регенерируется `python3 scripts/build-mating-map.py` (после отката каталога вернёт `concept`).

## 7. Что осталось (вне батча, не делалось)

- `device-catalog.json → modules[]` по-прежнему хранит `status: "concept"` для 12 архивных (синхронизация `modules[]` — отдельный шаг, устройства не трогались; `devices.html` показывает свои данные без изменений).
- `mating-map.json → summary.components_without_usage` = 19: архивные считаются «без устройств». Чтобы счётчик стал 7, нужно добавить фильтр статуса в `scripts/build-mating-map.py` (описано в `archive-candidates.md` §6).
- `docs/plans/station-device-catalog.md` (§4.7 «Поршни (6)», «Насадки (14)», §4.8 «96 моделей», стр. 861) не правился — документация ещё говорит о 96/6/14.
- Слияния `motion_piston_servo → motion_piston_rod` и `work_probe_inflatable → work_attach_inflatable` не делались (требуют правки `device-catalog`).
- Перенос `cam_profile` в `motion_oscillating` не выполнен: `cam` заархивирован с сохранением профиля и QA-кейса, порт остаётся отдельной задачей.
- `work_attach_curved`, `work_attach_vibrating` — по-прежнему hold (0 устройств, но уникальная функция / продуктовое решение).
