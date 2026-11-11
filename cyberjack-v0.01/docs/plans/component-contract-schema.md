# Контракты компонентов: интерфейсы и кинематика

Статус: концепт для вымышленного оборудования Cyberjack. Не является
производственной, медицинской или инженерной документацией.

## Файлы

- `public/models/machine-modules/component-contracts.json` — 96 контрактов.
- `docs/plans/component-contract-report.json` — машинная проверка схемы.
- `docs/plans/component-contract-report.md` — краткий отчёт.
- `docs/plans/kinematics-runtime-report.json` — проверка фактического
  phase-движения в браузере для трёх пилотов.
- `docs/plans/tools/gen_component_contracts.py` — генератор контрактов.
- `docs/plans/tools/check_component_contracts.py` — валидатор без права
  исправлять модели.
- `docs/plans/tools/qa_kinematics_runtime.py` — рантайм-проверка связанных
  степеней свободы.

## Схема `cj-component-contract/1`

У каждого компонента:

```json
{
  "interfaces": {
    "mechanical": {"inputs": [], "outputs": []},
    "power":      {"inputs": [], "outputs": []},
    "pneumatic":  {"inputs": [], "outputs": []},
    "fluid":      {"inputs": [], "outputs": []},
    "signal":     {"inputs": [], "outputs": []}
  },
  "dof": [],
  "kinematics": {},
  "compatibility": {
    "requires": [],
    "provides": [],
    "rejects": []
  }
}
```

### Порт

```json
{
  "id": "air_in",
  "direction": "in",
  "kind": "compressed_air",
  "pressure_bar": [6, 8],
  "port": "G1/4",
  "flow_l_min": 120,
  "conditions": [
    "air=dry,filtered,5um",
    "dew_point_c<=3",
    "oil_mg_m3<=1"
  ]
}
```

Обязательны `id`, `direction`, `kind`, конкретные параметры и условия.
`compatible: true` не используется как замена условиям.

### Условие совместимости

```json
{"target": "mate.mechanical.mount_in.pitch_m", "op": "eq", "value": 0.6, "tol": 0.002}
```

Допустимые операторы: `eq`, `neq`, `gte`, `lte`, `gt`, `lt`, `range`, `in`.
`value` не может быть boolean или пустым; для размеров задаётся `tol`.
Именно эти правила проверяет валидатор, а не флаг «совместимо».

### Степень свободы

```json
{
  "id": "carriage",
  "joint": "prismatic",
  "axis": "x",
  "phase": "phase",
  "law": "screw_lead",
  "range_m": [0, 0.2],
  "stroke_m": 0.2
}
```

Для вращения — `joint: "revolute"`, `range_rad`; для надувания —
`joint: "scale"`, `factor`; для индикатора — `joint: "material"`.

## Кинематика: один параметр фазы

`parameter` всегда `phase`; фаза — угол в радианах, период `2π`. Ни один
драйвер не имеет собственного независимого времени или скорости.

Связанные механизмы:

| компонент | тип | драйверы | ограничение |
|---|---|---|---|
| `motion_piston_cam` | cam_follower | кулачок + толкатель | контакт ролика, ход 0–0,06 м |
| `motion_linear_x` | screw_carriage | винт + каретка | lead 0,01 м, ход 0–0,20 м |
| `motion_lift_z` | screw_carriage | винт + каретка | lead 0,01 м, ход 0–0,10 м |
| `motion_oscillating` | crank_slider | кривошип + ползун | x = r·sin(phase), ±0,07 м |
| `motion_piston_rod` | screw_nut | винт + гайка | lead 0,01 м, ход 0–0,09 м |
| `motion_piston_servo` | screw_nut | винт + гайка | lead 0,005 м, ход 0–0,07 м |
| `motion_winch` | drum_rope | барабан + трос | R = 0,05 м, ход 0–0,32 м |
| `motion_spreader` | symmetric_screw | винт + две каретки | x_left = −x_right |
| `work_tickle_pair` | shared_spindle | общий шпиндель + два узла | offset π |
| `motion_piston_telescopic` | staged_extension | три ступени | 0,34 / 0,67 / 1,00 |

Валидатор проверяет: все драйверы используют `phase`; у каждого драйвера
есть DOF; `shared_phase` покрывает все драйверы; законы конечны и не
выходят за пределы; узлы драйверов существуют в GLB.

## Рантайм

`components-viewer.js` для трёх пилотов (`motion_piston_cam`,
`motion_linear_x`, `motion_oscillating`) читает `model.kinematics` и
двигает связанные узлы от одной `phase`. Старые `motion`-ветки для них не
применяются, поэтому нет двойного движения.

Проверка `qa_kinematics_runtime.py` сэмплирует реальные transforms и
восстанавливает закон:

- кулачок: `x = x0 + 0,03·(1−cos θ)`, остаток 0;
- X-ось: `x = x0 + 0,00159155·θ`, остаток 0;
- осциллятор: `x = x0 + 0,035·sin θ`, остаток 0.

Все три случая `pass`.

## Ограничение

Контракты — концепт-уровень. Они задают проверяемые условия и фазовую
связь, но не заменяют прочностной расчёт, сертификацию, электрическую
схему или медицинскую оценку. Для реального оборудования значения
нагрузок, давлений и допусков должен подтвердить инженер.
