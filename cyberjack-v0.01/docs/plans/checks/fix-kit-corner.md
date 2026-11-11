# Пилот CJ-FIX-KIT: рельс + угловой узел

Дата: 2026-11-11.  
Статус: **пилотный стык принят**. Это не серия и не каталог.

## Модули

### `fix_rail_1000`

- стандарт: `CJ-RAIL-45`;
- bbox: **1.000 × 0.045 × 0.045 м**;
- 4 T-паза: устье 10, полость 20, глубина 12 мм;
- торцы: 4×Ø9 M8 на ±15 мм + центральное Ø6;
- 5 материалов;
- `non_manifold=0`, `degenerate=0`, `all_ok=true`;
- GLB: `docs/plans/blockout/component-library/fix_rail_1000/fix_rail_1000.glb`;
- рендеры: `3q.png`, `front.png`, `side.png`, `closeup.png`.

### `fix_corner_node`

- стандарт: `CJ-NODE-45`;
- L-кронштейн **120 × 120 × 60 мм**, полки 12 мм, косынка 6 мм;
- две монтажные плоскости 90°;
- на каждой 4×Ø9 M8 на ±15 мм + центральный Ø6;
- 4 материала;
- `non_manifold=0`, `degenerate=0`, `holes_ok=true`, `all_ok=true`;
- GLB: `public/models/machine-modules/components/fix_corner_node.glb`;
- рендеры: `docs/plans/blockout/component-library/fix_corner_node/`.

## Стык

Собраны два рельса в L-узел:

- rail 1 → `face_a`;
- rail 2 → `face_b`;
- монтажный зазор **0.3 мм** (для проверки без coplanar-контакта).

Результаты `docs/plans/checks/fix-kit-corner-fit.json`:

- отклонение 4×M8: **0.000104 мм** max на face_a, **0.000008 мм** на face_b;
- отклонение штифта: **0.000105 мм** / **0.000000 мм**;
- `hole_pattern_matches=true`;
- `pin_matches=true`;
- `bvh_overlap_pairs=0`;
- `no_bvh_overlap=true`.

Рендеры:

- `docs/plans/checks/fix-kit-corner-assembly.png`;
- `docs/plans/checks/fix-kit-corner-closeup.png`.

## Что это подтверждает

- стандарт `CJ-RAIL-45` читается;
- паттерн M8/Ø6 совпадает между рельсом и узлом;
- узел реально принимает два рельса под 90°;
- 0.3 мм зазора достаточно, чтобы не было наложения;
- можно переходить к следующей паре модулей.

## Ограничения

- Это статический пилот, без нагрузки и без болтового момента.
- `fix_corner_node.glb` лежит в `public/.../components`, но в каталог/metadata ещё не внесён.
- `fix_rail_1000.glb` пока остаётся в blockout.
- Проверка на прочность и усталость не выполнялась.
- 4 рендера и отчёты модулей — единственные визуальные доказательства; сборка проверена в отдельном read-only скрипте.
