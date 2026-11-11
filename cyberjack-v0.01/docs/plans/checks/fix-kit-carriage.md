# CJ-FIX-KIT: приёмка `fix_carriage`

Дата: 2026-11-11.  
Статус: **принят**.

## Геометрия

- bbox **120 × 90 × 50 мм**;
- канал под рельс: **45.5 мм**, зазор 0.25 мм на сторону, 0.25 мм до потолка;
- 4 графитовых башмака;
- верхняя площадка 60 × 120 × 4.75 мм;
- 4×Ø9 M8 на ±15 мм + центральный Ø6;
- боковой эксцентриковый фиксатор: ход 35°, ход башмака 1.082 мм, контакт 546 мм²;
- 5 материалов;
- масса 0.679 кг (алюминий).

## Проверки

- `non_manifold=0`, `degenerate=0`, `loose=0`;
- `transforms_applied=true`;
- `opening_45_5_ok=true`;
- `top_pattern_ok=true`;
- `lock_ok=true`;
- `all_ok=true`;
- GLB 280 284 Б, 14 узлов.

## Посадка на реальный рельс

`docs/plans/checks/fix-carriage-fit.json`:

- каретка опущена на `fix_rail_1000`;
- зазор до потолка канала **0.25 мм**;
- `bvh_overlap_pairs=0`;
- `drops_onto_rail=true`;
- `no_bvh_overlap=true`.

Рендеры:

- `docs/plans/checks/fix-carriage-fit.png`;
- `docs/plans/checks/fix-carriage-fit-closeup.png`.

## Файлы

- `docs/plans/blockout/component-library/fix_carriage/fix_carriage.glb`;
- `report.json`, `3q.png`, `front.png`, `side.png`, `closeup.png`;
- `docs/plans/tools/build_fix_carriage.py`;
- `docs/plans/tools/check_fix_carriage.py`.

## Ограничения

- ход 500 мм заявлен, но в статической модели не анимирован;
- упоры хода внешние;
- прочностной расчёт не выполнялся;
- в каталог/metadata пока не внесён.
