# Проверка интерфейсных контрактов — партия 1

Дата: 2026-11-10. Режим: только чтение, ничего не исправлялось.

Охват: 3 компонента — `motion_piston_pneumatic`, `work_attach_adapter`, `structure_base`.
Источники: `public/models/machine-modules/component-contracts.json`, `component-catalog.json`, `components/<id>.glb`.

## Итог

| severity | кол-во |
|---|---|
| error | 13 |
| warn | 12 |
| info | 2 |
| **всего** | **27** |

Общий валидатор `docs/plans/tools/check_component_contracts.py` по всем 96 контрактам даёт `pass`, 0 находок: он проверяет только форму (наличие портов, допустимые op/joint/axis, привязку к phase) и не сверяет значения с паспортами, модели и семантику сторон. Все находки ниже — за пределами его проверок. Машинно-читаемая версия: `docs/plans/checks/interface-batch1.json` (27 записей, у каждой — путь и команда проверки).

Снимок: `component-contracts.json` sha256 `5bc8dfa7…`, 352 768 байт. Во время проверки (15:51) файл был перезаписан параллельным процессом — у `motion_piston_pneumatic` удалён `power_in`. Все значения ниже сверены с текущей версией, факт правки отражён в PWR-03.

## Находки

### motion_piston_pneumatic

| id | sev | поле | ожидалось → фактически |
|---|---|---|---|
| PNEU-01 | error | `interfaces.pneumatic.outputs` | второй пневмопорт/выпуск → `[]` |
| ENC-01 | error | `compatibility.requires[3]`, `.provides[1]` | без энкодера (паспорт) → `EtherCAT` + `encoder_out` |
| PROV-01 | error | `compatibility.provides[1].port` | существующий порт → `encoder_out` (нет такого) |
| MECH-01 | error | `interfaces.mechanical.inputs[0]` | шаг под собственный корпус → `4×M12 @ 0,6 м` |
| MOT-01 | error | `dof[0].speed_si`, `catalog.model.motion.speed` | 0…0,3 м/с → `1.2` |
| PWR-03 | error | `interfaces.power` | вход питания клапана → `inputs=[]` |
| PATH-01 | warn | `compatibility.requires[*].target` | одна грамматика → три разные |
| MECH-02 | warn | `requires[0..1]` | `mate…mount_out` → `mate…mount_in` |
| COND-01 | warn | `interfaces.mechanical.outputs[0].conditions` | числовые поля → строки |
| FLOW-01 | info | `pneumatic.inputs[0].flow_l_min` | согласовано с Ø25–40 → только Ø25 |
| DOF-01 | info | `dof[0].range_m` | 0…0,1 → `[-0.05, 0.05]` |

1. **PNEU-01.** Паспорт: «Цилиндр двустороннего действия», limits «обязательный выпуск воздуха». В контракте один вход `air_in` и пустые `pneumatic.outputs`. В GLB есть два порта (`port_boss_rear`/`port_nipple_rear` x=−0,072 и `port_boss_front`/`port_nipple_front` x=+0,028) и узлы `fitting_exhaust`, `hose_exhaust`. То есть модель и паспорт описывают выпуск, контракт — нет. Пневматика по значениям при этом верна: 6–8 бар, `G1/4`.
2. **ENC-01.** `requires[3]` требует от партнёра `EtherCAT`-энкодер, `provides[1]` обещает `encoder_out EtherCAT / 1 kHz`, а собственные сигнальные порты — `bus_in`/`bus_out` c `IO-Link`, и паспорт прямо говорит «без датчика положения». Порт `encoder_in` в библиотеке есть только у 4 поворотных компонентов (`motion_oscillating`, `motion_spreader`, `motion_winch`, `motion_turntable`).
3. **PROV-01.** `provides` ссылается на `encoder_out`, которого нет среди портов (`mount_in, tool_out, air_in, bus_in, bus_out`). Класс ошибки системный: 77 висячих `provides` по библиотеке.
4. **MECH-01.** `mount_in` заявляет 4×M12 с шагом 0,6 м и 800 Н, но габарит узла — 0,206×0,131×0,0505 м (паспорт Ø25–40×200 мм), а площадки модели `mount_pad_rear`/`mount_pad_front` стоят через 0,072 м. Шаблон крепежа скопирован со станины.
5. **MOT-01.** `speed_si=1.2` (и `catalog.model.motion.speed=1.2`, и `extras` узла `__anim`) против паспортных «0–300 мм/с». Расхождение в двух файлах и в модели — не опечатка.
6. **PATH-01.** В одном `requires` три формы адреса: `mate.mechanical.mount_in.standard` (group.port.field), `mate.power.voltage_v` (group.field), `mate.bus_in.protocol` (port.field). Одним резолвером не разбирается.
7. **MECH-02.** Правило установки смотрит на `mate…mount_in`, хотя у станины есть и `mount_in` (анкеровка к полу), и `mount_out` (верхняя плита). Такое правило валидируется против входа к полу и проходит ложно. Так оформлены 22 компонента.
8. **COND-01.** Пределы `tool_mass_kg<=1.2`, `torque_nm<=8`, `axial_runout_mm<=0.05` живут строками в `conditions`, числовых полей у порта нет.
9. **FLOW-01 / DOF-01** — неоднозначности, не ошибки: 120 л/мин хватает для Ø25 при 1,2 м/с, но не для Ø40 (≈260 л/мин ANR); `range_m` биполярный при однополярном паспортном ходе 0–100 мм (полный ход 0,1 м сходится).
10. **PWR-03.** В текущей версии файла у компонента вообще нет порта питания (`power.inputs=[]`), хотя `requires[2]` требует от партнёра 230 В (`tol: 23`), а модель содержит соленоидный клапан с катушками и светодиодами (`valve_coil_rear/front`, `valve_led_*`). Питание клапана либо должно быть в контракте (24 В DC или 230 В AC, с разъёмом и током), либо правило `mate.power.voltage_v` лишнее. Правка выполнена не мной: `power_in` (230 В / 10 А / IEC C14) присутствовал в версии от 15:44 и был удалён параллельным процессом в 15:51.

### work_attach_adapter

| id | sev | поле | ожидалось → фактически |
|---|---|---|---|
| SEAT-01 | error | `interfaces.mechanical.inputs[0].standard` | `20/25/30 mm` → `20/25 mm` |
| ADAPT-01 | error | `interfaces.mechanical.outputs` | выходная посадка → `[]` |
| ADAPT-02 | error | `interfaces.mechanical.inputs` | вход `ISO 9409-1-50-4-M6` → только bayonet |
| PROV-02 | error | `compatibility.provides[0].port` | `tool_in` → `work_surface` |
| ADAPT-03 | warn | `requires[0..2]` | требования к фланцу модуля → к собственному входу |
| ADAPT-04 | warn | `interfaces.signal` | канал контроля фиксатора → пусто |
| COND-02 | warn | `inputs[0].conditions` | числовые поля → строки |

1. **SEAT-01.** Паспорт: «Посадка 20/25/30 мм», варианты 20/25/30, габарит Ø20–30×40. В контракте `20/25 mm`. Модель тоже двусторонняя, но только на два размера: `cang_rear` Ø21 мм и `cang_front` Ø26 мм — 30 мм нет ни в контракте, ни в геометрии. Усечение системное: `20/25 mm` стоит у всех 33 WORK-компонентов.
2. **ADAPT-01 + ADAPT-02.** Переходник описан как обычная насадка: один механический вход `tool_in`, выходов нет. При этом 14 motion-модулей отдают `tool_out` со `ISO 9409-1-50-4-M6`, а 33 насадки требуют от партнёра `tool_in` со `20/25 mm`; ни один компонент библиотеки не выдаёт `20/25 mm` на выходе (проверено: стандарты всех механических выходов = `ISO 9409-1-50-4-M6`, `M12`, `None`). Итог: цепь «модуль → переходник → насадка» не замыкается ни с одной стороны, хотя геометрия переходника двусторонняя.
3. **PROV-02.** `provides[0].port='work_surface'` — такого порта нет (есть только `tool_in`).
4. **ADAPT-03.** `requires` требует от партнёра ту же посадку `20/25 mm`, что объявлена у себя, плюс `retention_force_n >= 120` — хотя фиксатор является свойством самого переходника, а не насадки. Требования описывают не партнёра, а собственную деталь.
5. **ADAPT-04.** `signal` пуст, хотя паспорт требует проверять фиксатор перед сессией; канала состояния нет (в модели только `index_pin`, `size_mark`).
6. **COND-02.** Числовые пределы (масса 1,2 кг, биение 0,15 мм, усилие 120 Н) — только строки.

### structure_base

| id | sev | поле | ожидалось → фактически |
|---|---|---|---|
| PWR-01 | error | `interfaces.power.inputs[0]` | ≤10 А для C14 → 16 А |
| PROV-03 | error | `compatibility.provides[2]` | `bus_out` + битрейт → `eth_out` |
| MECH-03 | error | `interfaces.mechanical.inputs[0].pitch_m` | шаг по опорам 1,195×0,755 → 0,6 |
| MECH-04 | warn | `load_n` вход/выход | 1471,5 / 1471,5 → 1471,5 / 1471 |
| MECH-05 | warn | `requires[2]` | ≥1471,5 → ≥1200 |
| DOCK-01 | warn | `interfaces` (док) | порт дока → отсутствует |
| PWR-02 | warn | `power.outputs[0]` | защита ветви → только `max_continuous_load_a<=6` |
| ENV-01 | warn | схема контракта | поле габарита → отсутствует у всех 96 |
| PATH-02 | warn | `requires[*].target` | одна грамматика → 4- и 3-сегментные |

1. **PWR-01.** `power_in`: 230 В, 16 А, `IEC C14`. C14 по IEC 60320 — 10 А. Системно: ещё `structure_gantry` (16 А) и `structure_stall_row` (32 А) на том же разъёме.
2. **PROV-03.** `provides` перечисляет `eth_out`, реальный порт — `bus_out`. Спецификация «Ethernet 100 Mbit/s» не подтверждена полем битрейта в порту.
3. **MECH-03.** Вход `mount_in` (анкеровка к полу) заявляет 4×M12 с шагом 0,6 м, но опоры модели `foot_pad_{00,01,10,11}` стоят в (±0,5975; ±0,3775) → 1,195×0,755 м. Шаг 0,6 м соответствует верхним `bolt_hole_{00..11}` в (±0,3; ±0,3), то есть **выходу** `mount_out`. Вход унаследовал выходной шаблон.
4. **MECH-04.** 150 кг × 9,81 = 1471,5 Н. Вход 1471,5, выход 1471 — расхождение 0,5 Н даёт ложные отказы на границе `gte`.
5. **MECH-05.** Станина требует от основания ≥1200 Н, будучи сама рассчитана на 1471 Н: монтаж на основание на 18% слабее допускается.
6. **DOCK-01.** Паспорт: «Интерфейс: док, 230 В, Ethernet». В модели есть `dock_plate`, `dock_well`, `dock_pin_0/1`, `dock_connector` (x≈0,44…0,558). В контракте нет ни механического порта дока, ни сигнального канала — стыковка со `structure_dock`/`service_dock` машинно не выражена.
7. **PWR-02.** 6 А на выходе из 16 А на входе, поле защиты ответвления отсутствует (`breaker_curve=C` есть только у входа).
8. **ENV-01.** Габарит живёт только в паспортной строке; поля размеров нет ни у одного из 96 контрактов. Сам габарит при этом верен: bbox GLB = 1,28 × 0,24 × 0,84 м (X/Y/Z).
9. **PATH-02.** `mate.mechanical.mount_in.standard` / `mate.frame.flatness_mm` / `mate.bus_in.protocol` — снова три формы.

## Что проверено и сошлось

- Пневматика: 6–8 бар, порт `G1/4`, фильтрация 5 мкм, точка росы ≤3 °C — совпадает с паспортом.
- Станина: 4×M12, шаг 0,6 м на верхней плите (`bolt_hole_00..11` в ±0,3) — совпадает; 230 В / Ethernet (RJ45) — совпадает; 150 кг = 1471,5 Н — совпадает; bbox 1,28×0,24×0,84 м — совпадает.
- Переходник: длина 40 мм, диаметр ≤30 мм — совпадает с габаритом паспорта; посадка 20 и 25 мм подтверждена геометрией цанг (21 и 26 мм).
- DOF: у `motion_piston_pneumatic` один `prismatic` по X, `amount` = `stroke_m` = 0,1, амплитуда 0,05 — согласовано с драйвером и каталогом. У `work_attach_adapter` и `structure_base` `motion.type='none'`, DOF пуст — корректно.
- direction/ports не перепутаны по питанию: ни один `output` не требует питания; `air_in` помечен `in`; `power_out` станины — `out`. Перепутаны не направления флагов, а адресация сторон в `requires`/`provides` (MECH-02, ADAPT-03) и полнота сторон (ADAPT-01/02, PNEU-01).
- Условия `compatibility.requires` структурированы (`target`/`op`/`value`/`tol`), операторы только `eq`/`gte`/`lte`, boolean-заглушек в библиотеке нет (0 из 96).

## Как воспроизвести

```bash
cd /home/cyberkitty/Projects/cyberjack/cyberjack-v0.01
python3 docs/plans/tools/check_component_contracts.py        # общий валидатор: 96 проверено, 0 находок

# все 27 проверок из отчёта
python3 - <<'PY'
import json, subprocess
d = json.load(open("docs/plans/checks/interface-batch1.json"))
for f in d["findings"]:
    r = subprocess.run(["bash", "-c", f["verify"]], capture_output=True, text=True)
    print(f['id'], f['severity'], 'rc=', r.returncode, r.stdout.strip()[:160])
PY
```

Каждая запись в JSON содержит `path` (JSON-путь в контракте) и `verify` (готовая команда). Проверка GLB-габаритов — по `accessors[].min/max` с учётом `translation`/`rotation` узлов, без рендера.

## Системные наблюдения (за пределами трёх компонентов)

- 77 `compatibility.provides[].port` ссылаются на несуществующие порты (`eth_out`, `encoder_out`, `work_surface`, `service_out`).
- 795 условий портов заданы строками вместо структуры.
- 267 правил используют 3-сегментные `target`, 66 — 4-сегментные (52 `mechanical` + 14 `signal`), 6 — 2-сегментные; грамматика не зафиксирована в формате `cj-component-contract/1`.
- `IEC C14` с током >10 А — 3 компонента; `20/25 mm` вместо `20/25/30` — 33 WORK-компонента; `mate…mount_in` вместо `mount_out` — 22 компонента.

Ни один из перечисленных файлов (контракты, каталог, GLB, страницы, build-скрипты) не изменялся.
