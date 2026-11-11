# Koikatsu-анимации — библиотека для AI-агента

Нативная библиотека анимаций Koikatsu Sunshine EX BetterRepack R6 (в разговоре «котацу» = Koikatsu), декодированная из Unity-бандлов в кривые. **Идентификация готова и верифицирована** — агент ищет клипы через `catalog.json` + `query.py`, ничего вскрывать руками не нужно.

## Файлы

| Файл | Что это |
|---|---|
| `catalog.json` | Основной индекс: 54 571 клип, 396 бандлов. Формат `koikatsu-library-v1` |
| `catalog-0..7.json` | Тот же каталог, разбитый на 8 частей (для редакторов с limit'ом) |
| `query.py` | CLI-поиск по каталогу (см. ниже) |
| `mod_map.json` | Расшифровка хэш-папок `sources/__mods/<guid>` → настоящий мод |
| `glossary.json` | RU-глоссарий стемов: поиск по-русски + описания клипов |
| `find_duplicates.py` | Поиск полных дублей (байт-хэш + хэш контента кривых) |
| `duplicates_report.json` | Результат: группы дублей, карта дедупликации keep→dups |
| `clips/<id>.json.gz` | Каждый клип целиком: нативные кривые `koikatsu-native-v1` (~55–300 КБ) |
| `import.jsonl`, `import-0..7.jsonl` | Сырые записи импорта (проверка полноты) |
| `sources/` | 396 исходных бандлов: `h/anim/{male,female,parts}`, `h/common`, `__mods/*` |
| `../tools/animation/ANIMATION_PROVENANCE.md` | Правила декодирования и конвертации координат |

## Поля каталога

`id` (24-hex, файл в clips/), `name` (оригинальное имя Unity AnimationClip), `source` (бандл), `pathId`, `category`, `duration` (сек), `fps` (30), `rig` (female/male/shared/object), `playable`, `bindings`/`resolved`/`channels`/`expectedChannels`, `asset` (путь к json.gz).

## Категории (числа проверены 2026-10-16)

| Категория | Клипов | Что внутри |
|---|---|---|
| h | 23 279 | Нативные H-сцены (папки `sources/h/anim/female|male`) |
| mods | 24 434 | Моды-бандлы (23 GUID-папки; расшифровка в `mod_map.json`): khs/khh, kkstub, BetterPenetration-семейство, map-моды (Sakura's room, bath, BFW Apartment, Map Suite, pdhm003) |
| studio | 5 434 | Studio-анимации (anime tachidukai, map, base) |
| action | 1 015 | Повседневные действия (Idle, WLoop, Walk…, `sources/action`) |
| adv | 216 | ADV-сцены (ходьба/эмоции, `sources/adv`) |
| map | 96 | Объекты карт (beacon и т.п.) |
| custom | 74 | Позы игрока (GSit, GSleep, Fmannequin, `custompose*.unity3d`) |
| esthetic | 12 | Позы укладки (aomuke, utubuse) |
| chara | 7 | Анимации аксессуаров/питомцев персонажа |
| vr | 4 | VR-варианты |

Rig: **female/male** — анимации для «женских/мужских» костей KKS-скелета; **shared** — для общего рига; **object** — мобблы карт (playable:false на 1 653 объектах).

## Соглашения имён

- Префикс `f_` / `m_` — женская/мужская сторона (f_suwari = сидящая).
- Суффиксы `L/M/S` — варианты под размер тела (Low/Mid/Short...): `L_WLoop`, `M_WLoop`.
- `WLoop / OLoop / SLoop / ILoop / Idle / Insert` — петли/фазы H-анимации; `__NN` — варианты.
- `ptn01…` — клипы BetterPenetration-модов; `khs_f_/khs_m_` — контейнеры аниматоров H-сцен; `khh_f/khh_m` — позиция 94.
- Имена — оригинальный ромадзи от Illusion: aruki (ходьба), suwari (сидение), suiei (плавание), kagami, denma и т.д.

## Как агенту искать

```bash
cd <…>/vrm-successful-2026-10-16/animations

python3 query.py --stats                          # сводка библиотеки (+число дублей)
python3 query.py -q suwari --limit 10             # латинский стем
python3 query.py -q сидение --limit 10            # РУССКИЙ запрос через glossary.json
python3 query.py -q грудь --category h --limit 20 # стемы (suwari/mune/...) подбираются сами
python3 query.py -q стояние --rig shared --json   # JSON с полем description
python3 query.py --stats-like поглаживать         # сгруппированный список имён + описания
python3 query.py -q WLoop --rig female --no-dupes # исключить клипы-дубликаты
python3 query.py -q Idle --min-duration 1 --max-duration 4
python3 query.py -q beacon --category map --json  # полные метаданные JSON
```

В выводе каждой строки есть `desc:` — короткое RU-описание, собранное из глоссария (`вибратор` → denma, `пах` → kokan, `прижимать` → ositukeru...). Незнакомые токены остаются латиницей — невыясненное не выдумывается.

Прямой доступ: `jq '.clips[] | select(.category=="h" and .rig=="female" and .duration>1 and .duration<5 and (.name|test("suwari"))) | {id,name,duration}' catalog-0.json` (по частям).

## Как использовать найденный клип

1. Взять `clips/<id>.json.gz` — внутри нативные кривые (`m_RotationCurves` и др., локальные повороты, 30 fps).
2. Координаты — Unity (левосторонние). Конвертация на целевой риг: **не** назначать кватернионы напрямую; считать мировые дельты через иерархию (описание в `tools/animation/ANIMATION_PROVENANCE.md`): generic → mirror-Z `[-x,-y,z,w]`; риг Rin KKBP/PMX → mirror-X `[x,-y,-z,w]`.
3. Готовые экспорты в формате студии уже лежат в `control-room/dashboard-frontend/vrm_studio_assets/`: `koikatsu-idles.json` (7 idle), `koikatsu-h.json` (5 H-петель), `bone-map.json`.

## Статус целостности (2026-10-16)

- Покрытие: **396/396** бандлов есть в каталоге (сверка списком) ✓
- Спот-чек: `h/anim/female/01_01_00` — 2 735 = 2 735 клипов; `__mods/85984cc…/02a40b3b…` — 312 = 312 ✓
- Ошибок декодирования: 0 (`errors: []`)
- Флаг `complete: false` в каталоге — застрявший флаг билдера, **не** признак недокачки (см. verified coverage); `query.py --stats` это напоминает.

## Дубли (проверено 2026-10-16, `find_duplicates.py`)

Проверка по каждому клипу: sha1 сырого gzip + sha1 канонического JSON кривых (без `m_Name`). Итог на 54 571 клип:

| Метрика | Значение |
|---|---|
| Байт-идентичные файлы | **0** |
| Полные дубли (то же имя + те же кривые) | **2 963 группы**, ~839 MiB излишка |
| Алиасы (те же кривые под другим именем) | **678 групп** |
| Уникальных мошенов | **43 292** (11 279 клипов — removable копии) |

Содержательные выводы:
- **Суффиксы размера L/M/S — бит-в-бит одна и та же анимация** (`L_OLoop`=`M_OLoop`=`S_OLoop`): размер тела не меняет кривые. Это главный источник дублей.
- Один и тот же clip-ассет копируется в несколько бандлов (action/animator 00 и 70 = «женский» и «мужской» наборы — кривые идентичны).
- Khs-аниматоры дублируют петли по позициям.

Как использовать:
- `query.py --no-dupes` — исключает removable-копии по карте из отчёта (keep → dups).
- `duplicates_report.json` → `dedupe.keep`: 3 641 представитель, `keep[representative_id] = [дубли]`; для чистой выдачи агента фильтровать по нему.
- Пересчёт: `python3 find_duplicates.py --top 30` (~5 мин, 8 процессов, читает все 4.7 ГБ clips/).

## Семантика (RU-поиск и описания)

`glossary.json` — словарь стемов, извлечённых из реальных имён (2 482 уникальных имён, переведены только уверенные). `query.py`:
- RU-слово → стемы автоматически (`-q сидение` → suwari; `-q сон` → sleep/gsleep; `-q вибратор` → denma/rotor/vibe);
- каждая строка выдачи получает `desc:` — RU-описание из токенов имени;
- скобочные пояснения в глоссарии в поиске игнорируются, однобуквенные токены (`W`, `S` из «петля W») матчатся только как латинские подстроки имён;
- расширять: добавить пару `"стем": "ру-описание"` в `stems` — поиск и desc подхватят сами.