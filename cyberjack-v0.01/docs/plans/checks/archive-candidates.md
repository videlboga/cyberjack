# Кандидаты на архив: компонентный каталог

**Проект:** cyberjack-v0.01 · **Дата:** 2026-11-10 · **Режим:** только чтение (каталог, модели и вьюер не изменялись)
**Данные:** `public/models/machine-modules/component-catalog.json` (96), `device-catalog.json` (41 устройство, 9 китов), `connector-registry.json`, `docs/plans/checks/mounting-audit.json`, `mating-map.json` (производный)
**Машиночитаемая версия:** `docs/plans/checks/archive-candidates.json`

## Итог

- 96 компонентов, 41 устройство, **19 компонентов не используются ни в одном устройстве**; из них только один — `core` (`utility_routing`).
- **12 кандидатов на архив** (96 → 84 видимых), из них 7 — нулевого риска (0 устройств, 0 входящих ссылок совместимости).
- **Поршни: 6 → 4 сейчас, 6 → 3 после слияния** (`rod` + вариант `servo`, `pneumatic`); архив `hydraulic`, `telescopic`, `cam`.
- **2 слияния отложены** (`servo → rod`, `probe_inflatable → attach_inflatable`): оба компонента используются, нужна правка `device-catalog`.
- **2 компонента — в hold** (`attach_curved`, `attach_vibrating`): дублей нет, но и потребителей нет — решение продуктовое.
- **5 компонентов «не трогать» без потребителя**: `oscillating` (владелец функции «ритм»), `attach_adapter` (хаб), `utility_water` и `utility_drain` (хабы), `utility_routing` (`core` без применения — отдельная аномалия).
- Ни один кандидат не входит в `devices[].modules`, ни на один не ссылается `compatibility[]` используемого компонента → **архивирование не ломает ни одно устройство**.
- Механизм: `status: "archived"` в JSON + фильтр в каталоге. Записи, контракты, mates и GLB остаются на месте.

## Метод

1. **Использование** = вхождение id в `devices[].modules` по всем 41 устройству (+ проверка, что все 96 id из `components` совпадают с 96 в `device-catalog.modules` — совпали, 0 расхождений).
2. **Входящие ссылки** = сколько компонентов перечисляют id в своём `compatibility[]`. Это критично: хаб (`work_attach_adapter`, 10 ссылок) при нулевом использовании всё равно нельзя архивировать без переписывания правила стыковки.
3. **Сверка с `mating-map.json`**: `components_without_usage: 19` — совпало с моим подсчётом; `components_iso50: 0`, `orphan_points: 282`, `verified_joints: 0`.
4. **Ядро** (`status: core`, 10): структурная база, портал, ложементы, X-каретка, подъём Z, парные щётки, линейный зонд, ротационный диск, пульт, кабельный контур.
5. Дубли определялись не по «похожести названий», а по совпадению **функции + посадки (mates) + рабочего диапазона**, с проверкой, кто ещё на компонент ссылается.

Шкала приоритета: **P1** — архивировать сразу (нулевой риск, очевидный дубль), **P2** — архивировать (дубль подтверждён), **P3** — архивировать после подготовки (перенос данных/правка зависимостей), **P4** — решение продуктовое/сценарное.

## 1. Поршни — главный фокус

Все шесть сидят в одном семействе `MOT-PIS-01…06`, все имеют GLB, контракт и mates, все — `concept`. Различаются приводом и ходом, а не интерфейсом: у пяти из шести выход — вилка/быстросъём под одну и ту же насадку.

| id | привод | ход | усилие | скорость | питание | масса | уст. | вердикт |
|---|---|---|---|---|---|---|---|---|
| `motion_piston_rod` | шарико-винтовой, датчик усилия | 0–150 мм (варианты до 200) | 300 Н | 0–150 мм/с | 230 В | 6 кг | 1 (`lab_pen_piston`) | **keep** — базовая точная ось |
| `motion_piston_pneumatic` | воздух 6–8 бар, дроссель | 0–100 мм | 300 Н | 0–300 мм/с | воздух + клапан | 3 кг | 1 (`lab_pen_pneumatic`) | **keep** — единственный пневмопривод, податливая механика |
| `motion_piston_servo` | серво + винт + энкодер | 0–200 мм | 400 Н | 0–500 мм/с | 230/380 В | 8 кг | 1 (`lab_pen_carousel`) | **merge → rod** (отложено): функциональный суперсет |
| `motion_piston_hydraulic` | гидравлика 20–60 бар, насос | 0–120 мм | 500 Н | — | 380 В | 12 кг | 0 | **archive (P1)** |
| `motion_piston_telescopic` | 2–4 выдвижные ступени | 0–250 мм | 150 Н | — | 230 В | 5 кг | 0 | **archive (P1)** |
| `motion_piston_cam` | кулачок/кривошип, 0,5–5 Гц | 0–60 мм | 100 Н | — | 230 В | 8 кг | 0 | **archive после переноса (P3)** |

**Обоснование по каждому**

- `rod` **keep.** Используется `lab_pen_piston`, на него есть глубокая сборка (`docs/plans/checks/assemblies/lab_pen_piston/`), единственный поршень с обратной связью по усилию при умеренной цене. Варианты хода 50/100/150/200 мм уже покрывают «длинный ход».
- `pneumatic` **keep.** Единственный привод на воздухе: другая физика (податливость, естественное ограничение усилия), завязан на `utility_air`, используется `lab_pen_pneumatic`. Замечание аудита mates: выход Ø6,4 — подразмер `CJ-CLEVIS-8` (Ø8), нужна переходная серьга; это дефект геометрии, а не повод к архиву.
- `servo` **merge → rod, отложено.** Тот же шарико-винтовой привод, что у `rod`, плюс энкодер и профили скорости; 400 Н и 500 мм/с перекрывают `rod` (300 Н / 150 мм/с), ход 200 мм попадает в варианты `rod`. Уникального потребителя нет — `lab_pen_carousel` возит насадки и обошёлся бы `rod` 200 мм. Но: компонент используется, а `work_attach_carousel` ссылается на него в `compatibility` → слияние требует правки `device-catalog` (`lab_pen_carousel.modules`) и ссылки в `work_attach_carousel`, поэтому это отдельный P3-шаг, а не архив сейчас. Разумная форма — оставить `servo` вариантом `rod` («200/300 мм, серво + энкодер»).
- `hydraulic` **archive.** Сложность кратно выше остальных: насос, 380 В, 12 кг, дренаж, контроль утечек, поддон. Единственное преимущество — 500 Н, но 400 Н уже даёт `servo`, а ни одно устройство не требует >400 Н. 0 использования, 0 входящих ссылок.
- `telescopic` **archive.** Слабейшее усилие в семействе (150 Н) при самом длинном ходе (250 мм); ход перекрыт вариантами `rod` (200 мм) и `servo` (300 мм). 0 использования, 0 входящих ссылок.
- `cam` **archive после переноса.** Функционально это ритмический возвратно-поступательный ход 0,5–5 Гц — та же функция, что у `motion_oscillating` (0,5–5 Гц, 0–50 мм против 0–60 мм), который уже владеет ей и имеет проверенную кинематику `cj-kinematics-oscillating/2`. При этом `cam` — носитель уникальных данных: law `cam_profile`, 720-биновый профиль `cam_profile_motion_piston_cam.json` и единственный QA-кейс на этот закон. Поэтому сначала порт `cam_profile` в осциллятор как альтернативного profile-law, затем архив. Дополнительный хук: `components-viewer.js:342` (`directModels`) явно перечисляет `motion_piston_cam`.

**Целевой набор: 6 → 3 (+1 вариант).** `rod` (база, вариант «серво»), `pneumatic` (воздух), ритм — за `motion_oscillating`. Освобождается 4 записи, ~2,7 МБ GLB остаются в архиве как есть.

## 2. Другие семейства

### 2.1. Зонды (5)

| id | ось | ход / параметр | уст. | вердикт |
|---|---|---|---|---|
| `work_probe_linear` | линейная | 0–120 мм | 6 (core) | keep — база проникновения |
| `work_probe_rotary` | вращение | 0–60 об/мин, 3 Н·м | 2 | keep |
| `work_probe_inflatable` | воздух | 0–0,4 бар, обхват +30 % | 1 | merge → `work_attach_inflatable` (отложено) |
| `work_probe_thermal` | температура | 28–42 °C | 1 | keep |
| `work_probe_textured` | сменные текстуры | «гладкая/ребристая/спиральная» | 0 | **archive (P2)** |

`work_probe_textured` — не отдельный зонд, а база зонда с тремя насадками, которые уже существуют как `work_attach_smooth/ribbed/spiral`. `work_probe_inflatable` построчно совпадает с `work_attach_inflatable` (0–0,4 бар, +30 % обхвата, силикон/полиуретан, воздух), но оба используются → слияние отложено до правки устройств.

### 2.2. Насадки (14) — один интерфейс, разные профили

Все 14 — байонет, габарит Ø20–60 × 70–220 мм, силикон Shore 15–25A. То есть это **вариант-пресеты одного компонента**, а не 14 разных деталей.

| id | профиль | уст. | вердикт |
|---|---|---|---|
| `work_attach_smooth` | ровный, низкое трение | 2 | keep (базовый профиль) |
| `work_attach_ribbed` | кольца 3–8 | 2 | keep (базовый профиль) |
| `work_attach_spiral` | 1–3 спирали | 1 | keep (базовый профиль) |
| `work_attach_inflatable` | камера 0–0,4 бар | 1 | keep |
| `work_attach_sterile_liner` | одноразовая гильза | 1 | keep |
| `work_attach_carousel` | магазин на 6 мест | 1 | keep |
| `work_attach_adapter` | переходник 20/25/30 H8 | 0 | **keep — хаб** (10 входящих ссылок) |
| `work_attach_nodular` | выступы | 0 | **archive (P2)** |
| `work_attach_tapered` | конус | 0 | **archive (P2)** |
| `work_attach_bulbous` | +20–40 % объёма | 0 | **archive (P2)** |
| `work_attach_sleeve` | натяжной чехол | 0 | **archive (P2)** — дубль `sterile_liner` |
| `work_attach_dual_density` | 2 слоя 10A+40A | 0 | **archive (P3)** |
| `work_attach_curved` | 15–30° | 0 | hold (уникальная функция) |
| `work_attach_vibrating` | 0,5–6 Гц, 1–3 мм | 0 | hold (активная функция) |

`adapter` — единственный нулевой компонент семейства, который нельзя архивировать: на него ссылаются `motion_piston_rod` и 9 насадок, он и есть правило «поршень/зонд → насадка» из `station-device-catalog.md:390`. После архива четырёх профильных пресетов его входящих ссылок станет 6 (было 10) — роль не меняется.

### 2.3. Тепло (4 → 3)

`work_thermal_pad` (0) дублирует связку `work_probe_thermal` (локальный нагрев наконечника) + `surface_heated` / `surface_cooled` (ложе). **archive (P3)**.

### 2.4. Вращение (5 → 4)

`motion_rotary` (2 устройства) — вращение головки; `work_rotary_disc` (1) и `work_rotary_drum` (1) — сменные головки на нём; `work_probe_rotary` (2) — зонд на ротационном доке. `motion_turntable` (0) — разворот ложа по азимуту: 35 кг, 380 В, ни одного потребителя, ни одной входящей ссылки. **archive (P4)** — вернуть, если появится сценарий поворота комнаты.

### 2.5. Что проверено и не трогается

| семейство | вывод |
|---|---|
| SURFACE (8) | все используются (1–5 устройств); `soft` / `liner` / `contour` — разные роли (подложка / расходный чехол / профиль), не дубли |
| SENSORY (4) | все используются (1–3), разные каналы (капюшон, визор, звук, свет) |
| CONTROL (4) | `console` 34, `telemetry` 12, `estop` 1, `interlock` 1 — разные функции; консолидация `estop+interlock` возможна, но это не дубль, а продуктовый вопрос |
| RESTRAINT (11) | все используются (1–9); `restraint_spreader` (пассивная штанга) и `motion_spreader` (привод) не дубли, а пара |
| FLUID (5) | все используются (1–2); `spray` (нанесение) и `irrigation` (подача/промывка) — разные режимы |
| UTILITY (6) | `power` 4, `data` 2, `air` 1; `water` / `drain` — хабы по 4 входящие ссылки (keep); `routing` — `core` с 0 использования (см. ниже) |
| STRUCTURE (8) | все используются (1–11) |
| SERVICE (3) | `support_cradle` core 2, `service_dock` 1, `service_cleaner` 0 → **archive (P3)** |

**Аномалия:** `utility_routing` имеет `status: core`, но 0 устройств и 0 ссылок. Это единственное «ядро без применения». Архивировать нельзя (ядро Mk-I) — либо подключить к станции (`lab_diagnostic_table` или `structure_base`), либо понизить статус отдельным решением.

## 3. Полная таблица решений (21 строка с ненулевым решением)

| id | класс | исп. | статус | рекомендация | причина | зависимости |
|---|---|---|---|---|---|---|
| `motion_piston_hydraulic` | MOTION | 0 | concept | **archive P1** | 500 Н не нужны, `servo` даёт 400 Н; насос/380 В/дренаж | 0 устройств, 0 входящих ссылок |
| `motion_piston_telescopic` | MOTION | 0 | concept | **archive P1** | ход 250 мм перекрыт rod/servo, 150 Н — слабейший | 0 устройств, 0 входящих ссылок |
| `motion_piston_cam` | MOTION | 0 | concept | **archive P3** | дубль функции `oscillating` (0,5–5 Гц) | viewer:342, QA-кейс, `cam_profile_*.json` |
| `motion_turntable` | MOTION | 0 | concept | **archive P4** | разворот ложа не нужен ни одному устройству | 0 устройств, 0 ссылок |
| `work_probe_textured` | WORK | 0 | concept | **archive P2** | = база + `attach_smooth/ribbed/spiral` | 0 устройств, 0 ссылок |
| `work_attach_nodular` | WORK | 0 | concept | **archive P2** | профиль-пресет той же базы | 0 устройств, 0 ссылок |
| `work_attach_tapered` | WORK | 0 | concept | **archive P2** | профиль-пресет (конус) | 0 устройств, 0 ссылок |
| `work_attach_bulbous` | WORK | 0 | concept | **archive P2** | дубль nodular/tapered по геометрии | 0 устройств, 0 ссылок |
| `work_attach_sleeve` | WORK | 0 | concept | **archive P2** | дубль `sterile_liner` | 0 устройств, 0 ссылок |
| `work_attach_dual_density` | WORK | 0 | concept | **archive P3** | оболочка = sleeve + профиль | 0 устройств, 0 ссылок |
| `work_thermal_pad` | WORK | 0 | concept | **archive P3** | дубль `probe_thermal` + `surface_heated/cooled` | 0 устройств, 0 ссылок |
| `service_cleaner` | SERVICE | 0 | concept | **archive P3** | мойка не входит в устройства, сервис — `service_dock` | 0 устройств, 0 ссылок |
| `motion_piston_servo` | MOTION | 1 | concept | **merge → rod P3** | функциональный суперсет rod | `lab_pen_carousel`, `work_attach_carousel` |
| `work_probe_inflatable` | WORK | 1 | concept | **merge → attach_inflatable P4** | совпадение параметров построчно | 1 устройство |
| `motion_oscillating` | MOTION | 0 | concept | **keep P0** | владелец функции «ритм», QA pass, 4 входящие ссылки | 4 входящие ссылки |
| `work_attach_adapter` | WORK | 0 | concept | **keep P0** | хаб стыковки насадок | 10 входящих ссылок |
| `utility_water` | UTILITY | 0 | concept | **keep P0** | хаб fluid-ветки | 4 входящие ссылки |
| `utility_drain` | UTILITY | 0 | concept | **keep P0** | хаб fluid-ветки | 4 входящие ссылки |
| `utility_routing` | UTILITY | 0 | core | **keep P1** | ядро Mk-I; 0 использования — аномалия | подключить к устройству или понизить статус |
| `work_attach_curved` | WORK | 0 | concept | **hold P4** | уникальная функция, нет потребителя | 0 ссылок |
| `work_attach_vibrating` | WORK | 0 | concept | **hold P4** | вибрация уже есть у `oscillating` | 0 ссылок |

## 4. Что не трогать: 75 используемых компонентов

Все перечисленные используются в устройствах; архивирование любого из них ломает сборку. Полные списки устройств — в `archive-candidates.json` (`components[].usage.devices`).

| id | класс | уст. | устройства |
|---|---|---|---|
| `structure_base` | STRUCTURE | 11 | `lab_sex_machine_tickling`, `lab_foot_cradle`, `lab_sex_machine_anal`, `lab_pen_rotary`, `lab_pen_thermal`, `lab_attachment_drum`, `lab_irrigation_station`, `lab_fluid_collector`, `lab_stirrup_stand`, `lab_pen_piston`, `lab_pen_pneumatic` |
| `structure_portal` | STRUCTURE | 10 | `lab_sensitivity_arch`, `lab_feather_pod`, `lab_firm_brush_rig`, `lab_sex_machine_vaginal`, `lab_sex_machine_circularsaw`, `lab_impact_bench`, `lab_x_cross`, `lab_neck_yoke`, `lab_posture_chair`, `lab_mental_correction_chair` |
| `structure_gantry` | STRUCTURE | 5 | `lab_tickle_arch`, `lab_pen_dual`, `lab_spray_station`, `lab_gantry`, `lab_pen_carousel` |
| `structure_bed_frame` | STRUCTURE | 7 | `lab_diagnostic_table`, `lab_data_collector`, `lab_electro_bench`, `lab_restraint_matrix`, `lab_thermal_bed`, `lab_sensor_bed`, `lab_contour_bed` |
| `structure_cage` | STRUCTURE | 2 | `lab_baseline_cell`, `lab_deprivation_pod` |
| `structure_suspension_frame` | STRUCTURE | 1 | `lab_suspension_frame` |
| `structure_stall_row` | STRUCTURE | 1 | `lab_stall_row` |
| `structure_dock` | STRUCTURE | 1 | `lab_service_dock` |
| `support_cradle` | SERVICE | 2 | `lab_sex_machine_tickling`, `lab_sex_machine_vaginal` |
| `service_dock` | SERVICE | 1 | `lab_service_dock` |
| `motion_linear_x` | MOTION | 12 | `lab_sensitivity_arch`, `lab_feather_pod`, `lab_tickle_arch`, `lab_firm_brush_rig`, `lab_sex_machine_vaginal`, `lab_sex_machine_anal`, `lab_pen_dual`, `lab_impact_bench`, `lab_spray_station`, `lab_roller_applicator`, `lab_gantry`, `lab_portable_unit` |
| `motion_linear_y` | MOTION | 8 | `lab_foot_cradle`, `lab_tickle_arch`, `lab_pen_rotary`, `lab_pen_dual`, `lab_pen_thermal`, `lab_spray_station`, `lab_gantry`, `lab_pen_piston` |
| `motion_lift_z` | MOTION | 4 | `lab_sex_machine_vaginal`, `lab_pen_rotary`, `lab_sex_machine_circularsaw`, `lab_impact_bench` |
| `motion_rotary` | MOTION | 2 | `lab_pen_rotary`, `lab_attachment_drum` |
| `motion_spreader` | MOTION | 1 | `lab_restraint_matrix` |
| `motion_winch` | MOTION | 1 | `lab_suspension_frame` |
| `motion_piston_rod` | MOTION | 1 | `lab_pen_piston` |
| `motion_piston_pneumatic` | MOTION | 1 | `lab_pen_pneumatic` |
| `work_tickle_soft` | WORK | 1 | `lab_tickle_arch` |
| `work_tickle_firm` | WORK | 2 | `lab_tickle_arch`, `lab_firm_brush_rig` |
| `work_tickle_radial` | WORK | 2 | `lab_tickle_arch`, `lab_firm_brush_rig` |
| `work_feather_fan` | WORK | 1 | `lab_feather_pod` |
| `work_air_jet` | WORK | 1 | `lab_feather_pod` |
| `work_foot_cradle` | WORK | 1 | `lab_foot_cradle` |
| `work_tickle_pair` | WORK | 1 | `lab_sex_machine_tickling` |
| `work_probe_linear` | WORK | 6 | `lab_sex_machine_vaginal`, `lab_sex_machine_anal`, `lab_pen_dual`, `lab_portable_unit`, `lab_pen_piston`, `lab_pen_pneumatic` |
| `work_probe_rotary` | WORK | 2 | `lab_pen_rotary`, `lab_pen_dual` |
| `work_probe_thermal` | WORK | 1 | `lab_pen_thermal` |
| `work_rotary_disc` | WORK | 1 | `lab_sex_machine_circularsaw` |
| `work_rotary_drum` | WORK | 1 | `lab_attachment_drum` |
| `work_impact_paddle` | WORK | 1 | `lab_impact_bench` |
| `work_impact_roller` | WORK | 1 | `lab_impact_bench` |
| `work_electro_pad` | WORK | 4 | `lab_sensitivity_arch`, `lab_electro_bench`, `lab_posture_chair`, `lab_mental_correction_chair` |
| `work_electro_collar` | WORK | 1 | `lab_electro_bench` |
| `work_attach_smooth` | WORK | 2 | `lab_pen_piston`, `lab_pen_carousel` |
| `work_attach_ribbed` | WORK | 2 | `lab_pen_pneumatic`, `lab_pen_carousel` |
| `work_attach_spiral` | WORK | 1 | `lab_pen_carousel` |
| `work_attach_inflatable` | WORK | 1 | `lab_pen_pneumatic` |
| `work_attach_sterile_liner` | WORK | 1 | `lab_pen_piston` |
| `work_attach_carousel` | WORK | 1 | `lab_pen_carousel` |
| `restraint_wrist_cuff` | RESTRAINT | 2 | `lab_restraint_matrix`, `lab_x_cross` |
| `restraint_ankle_cuff` | RESTRAINT | 4 | `lab_foot_cradle`, `lab_tickle_arch`, `lab_restraint_matrix`, `lab_x_cross` |
| `restraint_thigh_clamp` | RESTRAINT | 2 | `lab_sex_machine_anal`, `lab_stirrup_stand` |
| `restraint_waist_belt` | RESTRAINT | 2 | `lab_restraint_matrix`, `lab_stirrup_stand` |
| `restraint_neck_yoke` | RESTRAINT | 1 | `lab_neck_yoke` |
| `restraint_head_frame` | RESTRAINT | 1 | `lab_neck_yoke` |
| `restraint_stirrup` | RESTRAINT | 5 | `lab_pen_rotary`, `lab_pen_thermal`, `lab_stirrup_stand`, `lab_pen_piston`, `lab_pen_carousel` |
| `restraint_spreader` | RESTRAINT | 1 | `lab_x_cross` |
| `restraint_suspension_cuff` | RESTRAINT | 1 | `lab_suspension_frame` |
| `restraint_quick_release` | RESTRAINT | 1 | `lab_restraint_matrix` |
| `restraint_matrix` | RESTRAINT | 9 | `lab_baseline_cell`, `lab_firm_brush_rig`, `lab_impact_bench`, `lab_electro_bench`, `lab_posture_chair`, `lab_mental_correction_chair`, `lab_deprivation_pod`, `lab_stall_row`, `lab_pen_pneumatic` |
| `surface_soft` | SURFACE | 1 | `lab_contour_bed` |
| `surface_anti_slip` | SURFACE | 1 | `lab_thermal_bed` |
| `surface_heated` | SURFACE | 1 | `lab_thermal_bed` |
| `surface_cooled` | SURFACE | 1 | `lab_thermal_bed` |
| `surface_fluid_channel` | SURFACE | 3 | `lab_spray_station`, `lab_irrigation_station`, `lab_thermal_bed` |
| `surface_liner` | SURFACE | 3 | `lab_roller_applicator`, `lab_thermal_bed`, `lab_contour_bed` |
| `surface_sensor` | SURFACE | 5 | `lab_diagnostic_table`, `lab_baseline_cell`, `lab_data_collector`, `lab_thermal_bed`, `lab_sensor_bed` |
| `surface_contour` | SURFACE | 2 | `lab_sensor_bed`, `lab_contour_bed` |
| `work_spray` | FLUID | 1 | `lab_spray_station` |
| `work_roller` | FLUID | 2 | `lab_spray_station`, `lab_roller_applicator` |
| `work_irrigation` | FLUID | 1 | `lab_irrigation_station` |
| `work_suction` | FLUID | 1 | `lab_fluid_collector` |
| `fluid_mixer` | FLUID | 1 | `lab_fluid_collector` |
| `sensory_hood` | SENSORY | 1 | `lab_deprivation_pod` |
| `sensory_visor` | SENSORY | 2 | `lab_mental_correction_chair`, `lab_vision_rig` |
| `sensory_audio` | SENSORY | 3 | `lab_mental_correction_chair`, `lab_deprivation_pod`, `lab_vision_rig` |
| `sensory_light` | SENSORY | 1 | `lab_deprivation_pod` |
| `control_console` | CONTROL | 34 | `lab_data_collector`, `lab_sex_machine_tickling`, `lab_foot_cradle`, `lab_feather_pod`, `lab_tickle_arch`, `lab_firm_brush_rig`, `lab_sex_machine_vaginal`, `lab_sex_machine_anal`, `lab_pen_rotary`, `lab_pen_dual`, `lab_pen_thermal`, `lab_sex_machine_circularsaw`, `lab_attachment_drum`, `lab_impact_bench`, `lab_electro_bench`, `lab_spray_station`, `lab_roller_applicator`, `lab_irrigation_station`, `lab_fluid_collector`, `lab_restraint_matrix`, `lab_x_cross`, `lab_suspension_frame`, `lab_stirrup_stand`, `lab_neck_yoke`, `lab_posture_chair`, `lab_thermal_bed`, `lab_mental_correction_chair`, `lab_deprivation_pod`, `lab_vision_rig`, `lab_stall_row`, `lab_portable_unit`, `lab_pen_piston`, `lab_pen_pneumatic`, `lab_pen_carousel` |
| `control_telemetry` | CONTROL | 12 | `lab_diagnostic_table`, `lab_sensitivity_arch`, `lab_baseline_cell`, `lab_data_collector`, `lab_irrigation_station`, `lab_fluid_collector`, `lab_suspension_frame`, `lab_posture_chair`, `lab_sensor_bed`, `lab_deprivation_pod`, `lab_vision_rig`, `lab_service_dock` |
| `control_estop` | CONTROL | 1 | `lab_diagnostic_table` |
| `control_interlock` | CONTROL | 1 | `lab_electro_bench` |
| `utility_power` | UTILITY | 4 | `lab_gantry`, `lab_service_dock`, `lab_stall_row`, `lab_portable_unit` |
| `utility_data` | UTILITY | 2 | `lab_gantry`, `lab_service_dock` |
| `utility_air` | UTILITY | 1 | `lab_pen_pneumatic` |

## 5. Зависимости архивирования

**Общая проверка для всех 12 кандидатов:** 0 вхождений в `devices[].modules` (41 устройство), 0 вхождений в `compatibility[]` других компонентов, 0 вхождений в `kits[].devices` (киты ссылаются на устройства, не на компоненты — 41 устройство распределено по 9 китам без пересечений).

| кандидат | устройства | контракт | mates | GLB | доп. зависимости |
|---|---|---|---|---|---|
| `motion_piston_hydraulic` | — | есть | есть | 535 КБ | `station-device-catalog.md:366`, `tools/build_motion_piston_hydraulic.py` |
| `motion_piston_telescopic` | — | есть | есть | 716 КБ | `station-device-catalog.md:367`, build/render-скрипты |
| `motion_piston_cam` | — | есть | есть | 972 КБ | **viewer `components-viewer.js:342`**, QA-кейс `qa_kinematics_runtime.py`, `kinematics-batch1.json`, `cam_profile_motion_piston_cam.json` |
| `motion_turntable` | — | есть | есть | есть | `tools/build_motion_turntable.py` |
| `work_probe_textured` | — | есть | есть | есть | `station-device-catalog.md:405`, build/render-скрипты |
| `work_attach_nodular` | — | есть | есть | есть | `station-device-catalog.md:378,436` |
| `work_attach_tapered` | — | есть | есть | есть | `station-device-catalog.md:379` |
| `work_attach_bulbous` | — | есть | есть | есть | `station-device-catalog.md:380` |
| `work_attach_dual_density` | — | есть | есть | есть | `station-device-catalog.md:382` |
| `work_attach_sleeve` | — | есть | есть | есть | `station-device-catalog.md:385` |
| `work_thermal_pad` | — | есть | есть | есть | `station-device-catalog.md:409` |
| `service_cleaner` | — | есть | есть | есть | `tools/build_service_cleaner.py` |

**Производные артефакты (регенерируются, не удаляются):** `mating-map.json` (96 компонентов, 487 точек, `components_without_usage: 19`), `component-contracts.json`, `component-mates.json`, `component-models.json`, `mounting-audit.json`, `mate-bounds.json`, `mechanical-consistency.json`.

**Что важно не потерять:** архив не удаляет GLB, контракт и mate-точки. Для `cam` дополнительно сохраняются профиль кулачка и QA-кейс — иначе после архива пропадёт единственное проверенное покрытие закона `cam_profile`.

**Документация, которую придётся обновить (не сейчас):** `docs/plans/station-device-catalog.md` §4.7 (таблица «Поршни (6)» → 4, после слияния `servo` → 3; «Насадки (14)» → 9), §4.8 (список 96 моделей → 84), строка 861 (`lab_pen_piston` — состав не меняется).

## 6. Механизм `status: "archived"`

**Принцип:** запись остаётся в `component-catalog.json` целиком (плюс `component-contracts.json`, `component-mates.json`, `component-models.json` и GLB). Меняется только статус; всё остальное — фильтрация потребителей. Никаких удалений, никакого переноса файлов.

```json
{
  "id": "motion_piston_hydraulic",
  "status": "archived",
  "archivedAt": "2026-11-10",
  "archiveReason": "0 устройств, 0 входящих ссылок; 500 Н перекрыты servo 400 Н при кратно большей сложности",
  "replacedBy": "motion_piston_servo"
}
```

Для слияний: `"status": "archived", "mergedInto": "motion_piston_rod"` — резолвер каталога и проверки могут подставлять целевой id.

**Потребители и точечные правки (не применены):**

| файл | что менять |
|---|---|
| `components.html` | `matches()` ~стр.346: `if (c.status === 'archived' && state.usage !== 'ARCHIVED') return false;`; `#usage-filter` ~стр.221: `<option value="ARCHIVED">Архив</option>`; `card()` ~стр.365 и `openComp()` ~стр.412–419: метка через словарь `STATUS_RU = {core:'в игре', concept:'концепт', archived:'архив'}` вместо тернарника; `boot()` ~стр.504–514: `stat-components`, `top-count`, `foot-meta` считать по неархивным + отдельный счётчик архива; CSS ~стр.82: `.status.archived{color:#8A8D90;opacity:.55}` |
| `devices.html` | `STATUS` ~стр.334: добавить `archived: 'архив'` (сейчас `STATUS[d.status] \|\| d.status` покажет сырой id); module chips ~стр.481: гасить архивные; `stat-modules` ~стр.519: не считать архивные |
| `components-viewer.js` | правок не требует: `directModels` (:342) работает, пока в каталоге есть запись и GLB |
| `scripts/build-mating-map.py` | исключать `status == "archived"` из `components_without_usage` и статистики сирот (~стр.186–200, 649), иначе счётчики поедут |
| `device-catalog.json` | `modules[]` (96 записей) дублирует `status` из каталога; сейчас синхронны (0 расхождений). После введения `archived` либо синхронизировать, либо генерировать `modules[]` из `component-catalog.json` |

**Guard (проверка перед коммитом):**
1. ни один `devices[].modules` не содержит id со `status: archived`;
2. ни один `compatibility[]` не ссылается на archived id без `mergedInto`;
3. для каждого archived id на месте GLB, контракт и mates (архив не удаляет данные);
4. `kits[].devices` не изменились.

**Откат:** обратная замена `status` на `concept` одной правкой JSON. Модели, контракты и mates не затрагивались, поэтому откат полный.

**Порядок внедрения (предложение):**
1. **P1** — добавить поле `status: archived` и фильтр в каталог (сначала механизм, на 0 компонентов), прогнать вьюер.
2. **P1** — `hydraulic`, `telescopic` (поршни, нулевой риск).
3. **P2** — `textured`, `nodular`, `tapered`, `bulbous`, `sleeve` (насадки/зонды).
4. **P3** — порт `cam_profile` в `oscillating`, затем `cam`; `dual_density`, `thermal_pad`, `cleaner`; слияние `servo → rod` с правкой `lab_pen_carousel`.
5. **P4** — `turntable` (сценарное решение), `curved`/`vibrating` (продуктовое), `probe_inflatable` (слияние с правкой устройств).

## 7. Дубли на уровне файлов

| файл | что это | рекомендация |
|---|---|---|
| `public/models/machine-modules/catalog.json` | легаси-каталог: 10 модулей и 4 сборки, из них 6 id отсутствуют в `component-catalog` (`motion_linear`, `motion_lift`, `work_probe`, `work_rotary`, `work_brush_pair`, `interface_console`). Читается только `demo.html:1538` | не архивировать без решения владельца: либо перевести `demo.html` на `component-catalog.json`, либо архивировать оба файла вместе |
| `component-models.partial.json` | 1 запись (`work_probe_rotary`), дублирует `component-models.json` | мусор сборки, удалить отдельным патчем |
| `machine_modules.blend1` | 7,05 МБ, полная копия `machine_modules.blend` | удалить после проверки, что blend не входит в поставку |
| `cyberjack.sqlite.bak_*` | 11 файлов, ~1,5 ГБ | вынести из рабочего дерева (вне компонентного каталога) |
| `device-catalog.json → modules[]` | 96 записей `id/class/name/purpose/status`, дублируют `component-catalog` | либо генерировать, либо синхронизировать при изменении статусов |

## 8. Риски и ограничения

- **Не проверялась геометрия стыков:** по `mounting-audit.json` `verifiable_mechanical_joints: 0`, `orphan_points: 282`, `components_iso50: 0`. Выводы о дублях опираются на паспортные specs и mates-декларации, а не на замеры.
- **Вьюер не запускался** (задача — только чтение и отчёт): правки каталога и `components.html` не применялись, поведение фильтра не проверено в браузере.
- **3D-визуал не сравнивался:** решение по `cam`/`oscillating` — функциональное, не визуальное.
- **`lab_pen_carousel`** — единственное устройство, зависящее от `servo`; при слиянии нужен пересчёт хода (200 мм у `servo` против 150 мм у базового `rod`) — использовать вариант `rod` 200 мм.
- **`utility_routing`** — `core` без применения: если решено понижать, это отдельное решение, не архив.
- Счётчики в `mating-map.json` (`components_without_usage: 19`) после внедрения архива изменятся; это ожидаемо, если фильтр статуса добавлен в `build-mating-map.py`.
