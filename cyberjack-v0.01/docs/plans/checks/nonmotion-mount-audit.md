# Аудит посадок: 44 non-motion компонента (STRUCTURE / SURFACE / RESTRAINT / SERVICE / SENSORY / CONTROL / UTILITY)

Дата: 2026-11-10. Режим: **только чтение**. Модели, каталог, контракты и viewer не менялись;
изменён только этот файл.

## Что и как проверялось

Объект: 315 точек в 44 компонентах вне MOTION/WORK-голов
(STRUCTURE 8/76, SURFACE 8/55, RESTRAINT 11/76, SERVICE 3/24, SENSORY 4/23,
CONTROL 4/23, UTILITY 6/38). Источники: `public/models/machine-modules/components/*.glb`,
`component-mates.json`, `component-catalog.json`, `component-contracts.json`.

Каждая точка сверялась с настоящими треугольниками GLB (не с bbox accessor'ами):

1. **Треугольники в мировых координатах.** Обход дерева узлов, `matrix`/TRS,
   декодирование POSITION+indices из BIN-чанка; геометрическая нормаль грани
   `n = (v1−v0)×(v2−v0)/|…|`. 5–40 тыс. треугольников на компонент.
2. **Расстояние точка→поверхность** (closest-point-on-triangle, Ericson), узел и
   нормаль ближайшей грани.
3. **Проверка ссылок `source`**: каждое имя узла из `source` (с разворотом
   диапазонов `00..11`, `nn..pp`) искалось в `nodes` GLB. Неразрешённых ссылок,
   кроме четырёх косметических (`tab_ne` → `tab_ne_pos`, `power_screw_` → `power_screw_-79`,
   `lift_1..4_ring`, `bolt_1..4_washer`), нет — слой данных честный.
4. **Посадочная плоскость vs bbox.** Для подозрительных точек брался срез узла
   (±8..30 мм по двум осям) и сравнивался с координатой точки: так отделялись
   «точка на грани» от «точка в середине толщины» и «точка в центре проёма».
5. **Тест стороны**: `inside(p ± n·1.5 мм)` лучом-чётностью — материал должен быть
   со стороны −n. Использовался только как подтверждение, шум у отверстий велик.
6. **Шаблон болтов**: углы `pos ± pitch/2` в плоскости нормали, поиск отверстий/
   бобышек/лап в радиусе; отдельно — центры узлов `bolt_*`, `boss_*`, `foot_*`,
   `anchor_*`, `stud_*` и фактический межцентровой шаг.
7. **Пивоты**: ось должна проходить через ось пальца (bbox узла `*_pin`/`*_dring`).
8. **Кросс-слой**: id/kind/standard/gender/count точек против портов контракта;
   поиск ответного выхода по всему каталогу (96 компонентов) по kind + номиналу.

Порог «на поверхности»: 2 мм. Всё, что ниже, считалось посадкой; расхождения
указаны в мм.

## Итог

| Категория | Кол-во |
|---|---|
| Точек проверено | 315 |
| P0 — точка не на посадочной поверхности / неверная ось (ломает сборку или логику) | 6 |
| P1 — неверный шаг/количество поля, точка в проёме, ошибка стороны | 30 (8 pitch + 16 позиция + 6 сторона/ось) |
| P2 — контракт↔каталог, отсутствующий ответный порт | 7 системных блоков (10 + 7 + 118 портов + 8 + 3 пары + 81 номинал) |
| Точек на реальной поверхности (ближайший треугольник ≤2 мм) | 287 из 315 |
| Из них с нормалью, согласованной с гранью (≤30°) | 172 |

Главный вывод: координаты в основном честные — 287 из 315 точек лежат на реальных
гранях с точностью ≤2 мм (у 172 из них и нормаль совпадает с гранью ≤30°; у
остальных ближайшая грань — стенка отверстия или шов, что для портов нормально). Систематическая ошибка одна и та же: **поля `pitch_*_m`
заполнены внешним габаритом крепёжного поля, а не межцентровым расстоянием
отверстий**, и часть точек поставлена в геометрический центр кольца/рамки/проёма,
где материала нет. Именно эти два класса дают почти все P0/P1.

---

## P0 — точка не на поверхности или неверная ось

| id | mate | Проблема | Доказательство (узел/грань) | Предлагаемое значение |
|---|---|---|---|---|
| structure_cage | mount_in | `pitch_z_m = 0.068` — ошибка на порядок: шаблон целиком уходит с лап на `vent_sill_4` и `ring_bottom` | foot_1..4 в (±0.582, 0.015, ±0.582) → межцентровой 1.164 × 1.164; `pitch_x = 1.2323` = внешний габарит лап (0.5481…0.6161 ×2) | `pitch_x_m = 1.164`, `pitch_z_m = 1.164` |
| structure_gantry | mount_in | Шаблон 3.0 × 2.0 = габарит плит; углы шаблона в 549 мм от металла | `anchor_plate_mm/mp/pm/pp` центры x = ±1.36, z = ±0.86 → 2.72 × 1.72 | `pitch_x_m = 2.72`, `pitch_z_m = 1.72` |
| structure_cage | inner_rail | `axis = normal = (0,1,0)`: ось рельса направлена по нормали, т.е. каретка «врезается» в рельс; плюс y = 1.345 — середина профиля | `inner_rail` y 1.335…1.355 (верх 1.355), кольцо r = 0.6163 в плоскости XZ; касательная в точке (0.6163, y, 0) — это (0,0,1) | `axis = (0,0,1)`, `position_m.y = 1.355` |
| structure_cage | dome_seat | Точка в центре кольца: 639 мм до `ring_top`, при этом внутри стеклянного купола (его верх 2.046) | `ring_top` — аннулус (bbox ±0.7, но материал только по кольцу); `glass_dome` z…y 1.935…2.046 | `(0.66, 1.970, 0)` — на кольце; либо `pcd_m = 1.32`, `count = 1` |
| restraint_matrix | level_feet | Точка в центре 4 винтовых опор, 971 мм до ближайшей; kind `surface` на пустом полу | `foot_pad_fl/fr/rl/rr` в (±0.93, 0.006…0.012, ±0.44) | 4 точки на подошвах, либо `pcd_x = 1.86/pcd_z = 0.88` |
| surface_cooled | grommet_bed | 958 мм до ближайшего люверса: точка в центре мата, а люверсы идут по периметру | `grommets` bbox x ±0.894, z −0.418…0.432, плоские полосы по краю | `(0.0, 0.0367, −0.417)` — на кромке, или на угловой люверс |

---

## P1 — болтовые поля: `pitch` = внешний габарит, а не шаг отверстий

Одна и та же ошибка в 8 из 31 bolt_pattern (девятая строка таблицы — эталон для
сравнения). Контракт в 6 случаях содержит
правильный межцентровой шаг — расходится именно слой `mates`.

| id | mate | Проблема | Доказательство (узел/грань) | Предлагаемое значение |
|---|---|---|---|---|
| structure_base | mount_in | pitch 1.275 × 0.835 = внешний габарит подошв | `foot_pad_00` x −0.6375…−0.5575 (центр −0.5975), z 0.3375…0.4175 (центр 0.3775); 4 опоры ±0.5975/±0.3775 → 1.195 × 0.755. Контракт: 1.195/0.755; `note` тоже «1.195 x 0.755» | `pitch_x_m = 1.195`, `pitch_z_m = 0.755` |
| structure_portal | mount_in | pitch 1.2 × 0.32 = габарит лап; углы шаблона в 526 мм от металла | `anchor_bolts_m12` x ±0.4905, z ±0.1225 → 0.981 × 0.245; `foot_m/foot_p` x ±0.5225 | `pitch_x_m = 0.981`, `pitch_z_m = 0.245` |
| structure_bed_frame | mount_in | pitch 1.9256 × 0.8258 = габарит анкерных стоек | `foot_anchor_fl/fr/rl/rr` x ±0.955, z ±0.405 → 1.91 × 0.81 | `pitch_x_m = 1.91`, `pitch_z_m = 0.81` |
| structure_suspension_frame | mount_in | pitch_x 2.085 не совпадает с центрами плит | `anchor_plate_m/p` x −1.065…−0.895 (центр −0.98) и +0.895…+1.065 → 1.96; верх y = 0.62 в точке верный | `pitch_x_m = 1.96` |
| structure_dock | mount_in | 0.548 вместо 0.516: шаблонные точки ложатся на **кромку** шайбы (d = 0.000 у `bolt_*_washer`) | `bolt_1..4_washer` центры ±0.258 → 0.516 | `pitch_x_m = 0.516`, `pitch_z_m = 0.516` |
| control_telemetry | mount_in | `pitch_m = 0.256` подставлен в обе оси, а винты по Y идут 0.030/0.170 | `back_screws`: 4 кластера x ±0.128, y 0.030/0.170, z −0.0292 (это же и в `note`) | `pitch_x_m = 0.256`, `pitch_z_m = 0.14` |
| utility_routing | mount_in | `count 3 + pitch_m 0.42` — это шаг **кронштейнов**, а не болтов; у каждого 2 болта | `bracket_bolts_1..3` в (−0.42, 0.009, 0) / (0, 0.009, 0) / (+0.42, 0.009, 0) | 3 отдельные точки по кронштейнам, либо `pitch_m` = шаг болтов кронштейна |
| sensory_light | mount_in | 3 × M4 заявлены, отверстий в плите нет; шаблон 57.6 мм при плите 100 × 100 — правдоподобен, но недоказуем | `ceiling_plate` — сплошная плита, узлов `hole/boss` нет | оставить, `confidence: "low"`, `note: «отверстия не смоделированы»` |
| restraint_matrix | mount_in | **ОК**, для контраста: 1.756 × 0.776 = `anchor_bolt_*` ±0.878/±0.388 | — | без изменений |

## P1 — точка не на поверхности: bbox-центр, середина толщины, центр проёма

| id | mate | Проблема | Доказательство (узел/грань) | Предлагаемое значение |
|---|---|---|---|---|
| structure_cage | door_frame | Точка в проёме дверного полотна: ближайшая стойка 342 мм | `door_frame` x ±0.342, y 0.148…1.867, z 0.62…0.664 (рамка полая) | `(−0.33, 1.007, 0.664)` — на стойке петель |
| structure_cage | lift_eyes | Центр 4 рым-болтов, 153 мм до ближайшей площадки | `lift_1..4_ring` x/z ±0.582, `lift_1_plate` 0.515…0.649 | 4 точки, либо `count: 4`, `pitch_m: 1.164` |
| structure_gantry | rail_x_pos | y = 2.4995 — середина профиля рельса, а не беговая поверхность (+27 мм) | `rail_x_m` y 2.472…2.527 | `y = 2.527` |
| structure_gantry | rail_x_neg | то же | `rail_x_p` y 2.472…2.527 | `y = 2.527` |
| structure_gantry | rail_y | x = 0.302 — середина профиля (6 мм) | `rail_y_m` x 0.296…0.308 | `x = 0.308` |
| support_cradle | cradle_left | y = 0.66 — **низ** подкладки (по ней же лежит `saddle_plate` 0.64…0.676); истинное ложе выше | `pad_lining_left` при x = −0.29: y 0.667…0.6683 | `y = 0.668` |
| support_cradle | cradle_right | то же | `pad_lining_right` | `y = 0.668` |
| restraint_neck_yoke | side_pad_left | x = −0.0746 (bbox max), реальная поверхность подушки в этом сечении −0.0966…−0.1115, т.е. точка в 22 мм в полости шеи | срез `pad_left` \|y−0.0202\|<8 мм, \|z−0.0104\|<8 мм | `x = −0.0966` |
| restraint_neck_yoke | side_pad_right | зеркально | срез `pad_right` | `x = +0.0966` |
| restraint_neck_yoke | neck_surface | z = 0.0544 (bbox min), а поверхность подушки при x ≈ 0 — z = 0.0669 (12.5 мм) | срез `pad_back` \|x\|<0.03: z 0.0669…0.0809 | `z = 0.0669` |
| structure_base | rail_in_left | y = 0.228 на 1.8 мм **внутри** рельса | `mount_rail_left` верх 0.2298 (`mount_slot` 0.2262…0.2298) | `y = 0.2298` |
| structure_base | rail_in_right | то же | `mount_rail_right` | `y = 0.2298` |
| structure_bed_frame | mount_out | Точка в 30-мм щели между двумя слайнами палубы: 10.5 мм до металла | `deck_slat_neg` z 0.185…0.215, `deck_slat_pos` z −0.215…−0.185; при z = 0 материала нет | `z = +0.2` (на слайн); либо добавить центральную планку |
| restraint_head_frame | occiput_surface | Точка в центральном отверстии подушки, 26.4 мм до материала | `pad_occiput`: нет треугольников при \|x\|<0.03, y ≈ 0.098; z 0.063…0.1015 | `(±0.045, 0.098, 0.063)` — по телу подушки |
| restraint_head_frame | brow_surface | то же, 11.3 мм | `pad_brow`: нет треугольников при \|x\|<0.03, y ≈ 0.133 | `(±0.03, 0.133, −0.0587)` |
| structure_stall_row | mount_in | 4 болта на 6.6-метровый ряд, узлов крепления нет вовсе | в GLB нет узлов `bolt/foot/anchor`; есть `pod_shoes`/`pod_pads` под 3 подами | 3 отдельные точки (по поду) или `count: 12`, `pitch_m: 3.3` |

---

## P1 — сторона, нормаль, ось (точечно)

| id | mate | Проблема | Доказательство | Предлагаемое значение |
|---|---|---|---|---|
| support_cradle | cable_in | Нормаль +Y, а гермоввод смотрит −Y (угол 180° к грани) | `grommet_left` в 5 мм, нормаль ближайшей грани −Y | `normal = (0,−1,0)` |
| control_interlock | mount_in | `kind: rail`, но контракт объявляет `panel 4×Ø pitch 0.1`; точка при этом в середине толщины DIN-рейки | `din_rail` z −0.0755…−0.0672 | `kind: rail` оставить, `standard: "DIN 35 TS35"`; в контракте `panel → rail` |
| utility_air | mount_in | `kind: dock` при контракте `wall` | `dock_plate` + 4 × Ø | `standard: "док-плита 4×Ø"`; в контракте `wall → dock` |
| utility_water | mount_in | `kind: bolt_pattern` на док-плите, болтовых бобышек нет | `dock_plate` 0.135 × 0.052; единственный босс — `inlet_boss` | `kind: dock` (как у `utility_air`), `count` убрать |
| pivot-класс, 17 из 32 | `normal == axis` | Для пивотов нормаль совпала с осью пальца, т.е. не задаёт сторону и дублирует ось; viewer рисует две одинаковые стрелки | `dring_a..d` (ось Z), `cup_pivot_l/r`, `tilt_hinge_*`, `suspension_ring` | `normal` = направление тяги/нагрузки (⊥ оси) либо опустить поле для `kind: pivot` |
| structure_dock | dock_out_pins ↔ service_dock/locating_pins | Одна пара описана разными пальцами: Ø23 против 4 × Ø10 × 42.5 | `pin_a_tip` (Ø23) против `locating_pins` 4 × Ø10 | выровнять номинал на одной стороне (предлагаю `4 × Ø10 × 42.5`, как у service_dock) |

---

## Контракт ↔ каталог ↔ геометрия

### 1. 10 RESTRAINT-компонентов с контрактным `mount_in M12 4×`, которого нет в геометрии

Контракт выдаёт болтовое поле M12 манжетам, стременам и рамке головы — там
стропы, кам-замки и липучки, ни одной бобышки:

`restraint_wrist_cuff`, `restraint_ankle_cuff`, `restraint_thigh_clamp`,
`restraint_waist_belt`, `restraint_neck_yoke`, `restraint_head_frame`,
`restraint_stirrup`, `restraint_spreader`, `restraint_suspension_cuff`,
`restraint_quick_release`.

Минимальная правка: `mount_in.kind → "surface"` (манжета/стропа),
`standard → "манжета … мм"`, `count/pitch` удалить. Геометрию менять не нужно.

### 2. `restraint_surface` — потерянный id в 7 контрактах

Контракт каждого RESTRAINT объявляет выход `restraint_surface`, а в каталоге
он назван по-своему: `foot_surface`/`heel_surface` (stirrup),
`bed_surface` (matrix), `neck_surface`, `occiput_surface`, `cradle_left/right`,
`cuff_left/right`, `point_*`. Сопоставление по id (каталог, viewer, пары) не
сработает. Правка — только в каталоге/контракте: `mate.id` привести к
`restraint_surface` (или наоборот), координаты не трогать.

### 3. Шаблонные порты контракта: 118 без точки, 216 точек без порта

| Порт | Без mate | Пример |
|---|---|---|
| `power_out` | 13 | `structure_base` IEC C19, `structure_cage` IEC C13 |
| `bus_out` | 11 | `structure_portal` RJ45 при наличии только `bus_in` |
| `mount_in` | 10 | все манжеты (см. п. 1) |
| `power_in` | 9 | `surface_*` IEC C14 у пассивного мата |
| `eth_in` / `eth_out` | 9 / 9 | `utility_*` RJ45 без единого разъёма Ethernet |
| `air_in` / `air_out` | 8 / 7 | `utility_data`, `utility_drain` — пневматики нет |
| `fluid_in` / `fluid_out` | 7 / 8 | `service_dock`, `service_cleaner` без второго контура |
| `data_in` | 8 | все 8 SURFACE |

Это не ошибка геометрии, а генератор контрактов, раздающий фиксированный набор
портов по классу. Предложение: либо `mate` на каждый порт, либо в контракте
пометить порт `"modelled": false` — иначе пары «вход без выхода» будут
возникать всегда.

### 4. 81 расхождение `standard`/`connector` между точкой и контрактом

Не все равны по важности. Критичные (kind меняется, а не только название):

- `support_cradle/mount_in`: точка `bolt_pattern M12`, контракт `kind: dock`
- `utility_air/mount_in`: точка `dock`, контракт `wall`
- `utility_data/mount_in`: точка `rail DIN 35`, контракт `wall 4×Ø pitch 0.3`
- `utility_power/mount_in`: точка `bolt_pattern` (стена, 4 болта), контракт `wall` (совпадает по смыслу)
- `service_dock/mount_in`, `service_cleaner/mount_in`: точка `mount` (4 опоры/цоколь), контракт `dock`
- `structure_bed_frame/bus_in`: точка `M12 gland` (низковольтный гермоввод), контракт `RJ45`
- `surface_*/mount_in`: точка `bolt_pattern 6 × M8 pitch 0.3`, контракт `deck` — **и болтов в геометрии нет** (см. п. 5)

Остальные 74 — уточнение номинала («IEC C20» → «гермоввод Ø18»), геометрия в них
права, править нужно контракт.

### 5. 8 SURFACE: болтовое поле без отверстий

`surface_soft`, `surface_anti_slip`, `surface_heated`, `surface_cooled`,
`surface_fluid_channel`, `surface_liner`, `surface_sensor`, `surface_contour`:
`mount_in = bolt_pattern 6 × pitch_m 0.3` при полном отсутствии узлов
`hole/boss/stud`. Реальный интерфейс уже описан отдельными точками —
`mount_straps`/`mount_tabs` в углах (±0.95, ±0.39).

Минимальная правка: `kind → "clamp"`, `standard → "стропа/липучка"`,
`count/pitch` удалить; `mount_in` свести к `mount_straps`, чтобы в паспорте не
было двух конкурирующих креплений.

---

## Пары: входы без ответного выхода (по всему каталогу 96)

| Вход | Проблема | Доказательство | Предложение |
|---|---|---|---|
| `structure_base/rail_in_left`, `rail_in_right` — `rail T-slot 15` | Ни один компонент каталога не отдаёт рельс с номиналом 15. У совместимого `motion_linear_x` вообще нет `rail`-выхода: только `mount_in_l/r` (M12) и `tool_out` (ISO 9409-1-50-4-M6) | 20 rail-точек в каталоге: `guide 10×30`, `rail 55×42`, `rail 50×22`, `ring rail Ø1233`, `rail 24×48`, `rail 1540×24` — 15 нет | либо переклассифицировать в `guide 10×30` (как у `structure_portal/rail_left/right`), либо удалить и оставить `dock_in` |
| `structure_base/dock_in` — `dock "2 guides + 2x8"` | Нет ответного dock-выхода с таким разъёмом: единственные dock-выходы — `structure_dock/dock_out_pins` (Ø23) и `work_attach_carousel/tool_out_1..3` (стандарт не задан) | `structure_base.compatibility` включает `motion_linear_x`, но у него нет dock | добавить `dock_out` на каретку или перевести `dock_in` на 4 × Ø10 (как у `service_dock`) |
| `structure_dock/dock_out_pins` — `Ø23 pin` | Парный `service_dock/dock_bay` = «лоток 438 × 515, 2 рельса» + `locating_pins` 4 × Ø10 × 42.5 | `pin_a_tip` Ø23; `locating_pins` bbox x ±0.413, y 0.612…0.6545 | выровнять: `4 × Ø10 × 42.5` на обеих сторонах |

Остальные 25 «сиротских» входов в 44 компонентах — на стороне WORK-насадок
(`bayonet 20/25`, `быстросъём qr_block`, `zip 1300`) и к моей зоне не относятся.

---

## Что проверено и в порядке (не требует правок)

Чтобы список ошибок не читался как «всё сломано» — 287 точек легли на реальные
грани с точностью ≤2 мм, у 172 нормаль к грани ≤30°, ось по смыслу:

- **structure_base**: `mount_out` (0.6 × 0.6, бобышки ±0.3, верх 0.2243),
  `dock_in`, `surface_deck` (0.2148), `power_in`, `bus_in`, `earth_stud`,
  `cable_tray`, `power_out` (гланд 0.2308).
- **structure_portal**: `mount_out`, `beam_seat`, `power_in`, `bus_in`,
  `power_out`, `cable_chain` (5 мм — кабельная цепь рядом).
- **structure_gantry**: `anchor_ceiling` (2 × 2.72 ✓), `tool_flange_a/b`,
  `power_in`, `bus_in`, `cable_tray`, `rail_x_clamp_bed`.
- **structure_bed_frame**: `lift_actuator_lower/upper` (оси Ø10 ✓),
  `tilt_hinge`, `power_in`, `bus_in`, `cable_outlet`, `surface_support` (0.8 мм).
- **structure_cage**: `vent_back`, `power_in` (низкая достоверность, но на кабеле).
- **structure_suspension_frame**: `rail` (низ головки 0.238 ✓), `mount_out_M/P`,
  `carriage_hook`, `carriage_bolts` (0.177 × 0.131), `power_in`, `cable_inlet`,
  `end_stop_m`.
- **structure_dock**: `base_bottom`, `support_pads`, `fluid_in/out`, `clamp`,
  `indicator`, `grommet_power`, `bus_in`.
- **support_cradle**: `mount_in` (0.58 × 0.552 ✓), `strap_left/right`, `height_lock`.
- **restraint_***: `wrist_cuff/qr_latch`, `anchor_dring`; `ankle_cuff` все 3;
  `waist_belt/dring_a..d` (ось пина Z ✓), `buckle_qr`, `length_lock`;
  `head_frame/dock_left/right` (точка в теле пальца Ø8.4 ✓), `tilt_hinge_*`,
  `dring_out`, `chin_surface`; `stirrup/foot_surface` (0.0422 ✓), `heel_surface`,
  `dock_out`, `foot_hinge`; `spreader` все 7; `suspension_cuff` все 5;
  `quick_release` все 5; `matrix/rail_long_*`, `rail_cross_*`, `bed_surface`.
- **surface_***: `support` (низ, n = −Y), `surface_out` (верх), `mount_straps`
  (±0.95/±0.39 — на стропах), `mount_tabs`, `grommet`, `studs`, `frame_clips`,
  `leak_sensor`.
- **sensory_***: `hood/breath_port`, `hood/frame_link`; `visor/head_strap`,
  `media_in`, `power_in` (низкая достоверность — ввод не смоделирован);
  `audio/media_in` (jack tip), `headband_slider`, `cup_pivot_*` (точка на оси
  между цапфами z = ±0.045 ✓); `light/tilt_pivot`, `swivel`.
- **control_***: `console/power_in`, `bus_in`, `operator_face` (9.7 мм — панель
  утоплена), `handle`; `telemetry/mount_rail`, `terminal_out`, `bus_in/out`,
  `usb_in`, `power_in`; `estop/contact_out`, `push_face`, `power_in`, `bus_in`;
  `interlock/terminal_out`, `bus_in`, `power_in`, `key_interface`, `relay_bay`.
- **utility_***: все `air_in`, `air_out`, `fluid_in`, `fluid_out_a/b`,
  `condensate_drain`, `power_entry`, `signal_entry`, `hose_port`, `cable_clamp`,
  `fluid_in` (фланец Ø96), `fluid_out` (bayonet DN32), `spray_field`
  (точно в центре `nozzle_mouth_1`), `coupler_out`, `fill_in`, `drain_out`.

## Приоритеты правок

**P0 (сборка/логика, 6 правок, только данные точки):**

1. `structure_cage/mount_in.pitch_z_m` 0.068 → 1.164 (+ pitch_x 1.2323 → 1.164).
2. `structure_gantry/mount_in` 3.0/2.0 → 2.72/1.72.
3. `structure_cage/inner_rail`: `axis` → (0,0,1), `y` → 1.355.
4. `structure_cage/dome_seat` → (0.66, 1.97, 0).
5. `restraint_matrix/level_feet` → 4 точки на подошвах (±0.93, ±0.44).
6. `surface_cooled/grommet_bed` → на кромку (0, 0.0367, −0.417).

**P1 (30 правок pitch/позиции/стороны):** таблицы выше, все — изменение
координаты, шага или нормали в `component-mates.json` + пересборка каталога
штатным merge-скриптом; GLB не трогаются.

**P2 (документ/контракт):** 10 манжет без M12, 7 потерянных `restraint_surface`,
118 шаблонных портов, 8 SURFACE с фиктивным болтовым полем, `T-slot 15` и
`dock 2×8` без пары.

## Ограничения метода

- Резьба/Ø отверстий и `gender` из треугольников не доказываются (в GLB нет
  метаданных отверстий) — проверялась только посадка точки на грань и
  согласованность нормали/оси.
- Тест стороны лучом шумит у сквозных отверстий и пазов; выводы о стороне
  сделаны только там, где есть явная грань нужного узла (указана в таблице).
- Расхождения «в 1–2 мм» (усадка геометрии, скругления) в отчёт не включались.
- Проверялись 44 компонента; MOTION/WORK-головы (52 компонента) — вне зоны, но
  использовались как партнёры для поиска ответных выходов.
