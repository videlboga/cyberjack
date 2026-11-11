# Механические совмещения: батч 1

Дата: 2026-11-10. Проверяются только узлы, которые физически контактируют
или передают движение. `CONTROL`, `SENSORY`, `UTILITY` и декоративные
пульты/панели в этот батч не входят.

> **Важно:** первые снимки этого батча — не приёмка композиции.
> `assemble_device_check.py` ставит компоненты по bbox (центр X/Y и
> нижняя точка Z), а не по посадочным точкам. Поэтому часть кадров
> показывает «упаковку» деталей рядом, а не реальное совмещение.
> Такие кейсы ниже помечены `invalid composition` и не считаются
> пройденными, даже если у них `interference=0`.

## Метод

- Спецификации: `docs/plans/mechanical-combination-specs.json`.
- Геометрия: `docs/plans/tools/assemble_device_check.py` — импорт GLB,
  BVH-пересечения, sweep движущихся деталей, footprint.
- Для инструмента на каретке добавлено поле `attached_to`: adapter и
  рабочая головка считаются движущимися вместе с приводом; иначе harness
  давал ложный sweep «инструмент стоит, привод едет в него».
- Отдельно проверены механические порты: flange/bayonet/M12/dock.

## Геометрия

Геометрический harness дал `interference = 0, sweep = 0, footprint = ok`
на части схем, но это **не приёмка композиции**. После визуальной проверки
4 схемы оставлены, 10 отбракованы.

Приняты как визуально валидные после ручной проверки кадра:

| схема | статус | примечание |
|---|---|---|
| `mech_drive_tool_chain` | pass | инструмент на каретке, adapter примыкает |
| `mech_piston_tool_chain` | pass | adapter и насадка на штоке |
| `mech_turntable_carousel_adapter` | pass | карусель по центру стола |
| `mech_base_piston` | pass | поршень на станине |

**Отбракованы как invalid composition** (скрин показывает не совмещение,
а bbox-упаковку):

- `mech_rotary_probe` — probe не посажен на выход rotary;
- `mech_turntable_carousel` — карусель не на выходе стола;
- `mech_cradle_pair` — пара не лежит на ложементе, а висит над ним;
- `mech_bed_sensor` — сенсорная плита не привязана к раме, лежит сверху;
- `mech_spreader_stirrup` — стремя не посажено на выход разведения;
- `mech_rotary_probe_adapter` — adapter и probe пересекаются;
- `mech_linear_y_probe` — probe не на выходе оси;
- `mech_rotary_disc` — диск не на выходе rotary;
- `mech_linear_y_probe_adapter` — композиция не проверена по посадочной точке;
- `mech_rotary_disc_adapter` — диск пересекает adapter/rotary.

Эти кейсы остаются в наборе как **negative/geometry-only**, но не как
доказательство совместимости. Для них нужен `mate_node` / `mate_point`
и отдельная компоновка.

Два случая потребовали уточнить спецификацию, а не модель: у
`mech_cradle_pair` footprint по Y 0,792 м вместо 0,6 м; у
`mech_linear_y_probe` probe был выставлен на 0,2 м выше каретки.
Это исправление положения, но не доказательство посадки.

## Механические порты

| связка | порт A → порт B | статус |
|---|---|---|
| linear X → adapter | flange ISO 9409 → flange ISO 9409 | pass |
| piston → adapter | flange ISO 9409 → flange ISO 9409 | pass |
| adapter → smooth | bayonet 20/25/30 → bayonet 20/25 | pass |
| linear Y → probe | flange ISO 9409 → bayonet 20/25 | **fail: нужен adapter** |
| rotary → probe | flange ISO 9409 → bayonet 20/25 | **fail: нужен adapter** |
| rotary → disc | flange ISO 9409 → bayonet 20/25 | **fail: нужен adapter** |
| turntable → carousel | flange ISO 9409 → bayonet 20/25 | **fail: нужен adapter** |
| base → piston | M12, шаг 0,6, 1471 Н → M12, 0,6, 800 Н | pass |
| bed frame → sensor | M12 → deck | **fail: разные стандарты** |
| spreader → stirrup | flange ISO 9409 → M12 | **fail: разные стандарты** |
| cradle → pair | у ложемента нет механического output | support-only, не защёлка |

Итог: **4 схемы приняты визуально**, 10 не считаются проверенными;
из них часть имеет несовпадение портов, часть — неверную компоновку.
Это не ошибки GLB, а отсутствие mate-точек в harness.

## Что ещё не проверено

- `structure_portal + motion_lift_z + motion_linear_x` — вертикальный
  стек, нужен отдельный расчёт посадки на верхнюю балку.
- `structure_suspension_frame + motion_winch + suspension_cuff` —
  подвес, нужна проверка нагрузки и зазора троса.
- `structure_base + structure_portal` — болтовой pattern и фактическая
  опорная плоскость.
- `support_cradle + work_tickle_pair` — сейчас проверен только
  геометрический контакт; нужна проверка зажима/опирания.
- Harness не доказывает, что болт входит в отверстие: он проверяет
  AABB/BVH, а не посадку крепежа.

## Артефакты

- `docs/plans/blockout/assemblies/mech_*/report.json` и `assembly.png`.
- `docs/plans/mechanical-combination-specs.json`.
- `docs/plans/tools/assemble_device_check.py` — добавлен `attached_to`.
