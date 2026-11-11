# Бриф: 3D-блок-аут пяти новых компонентов

Вымышленное оборудование Cyberjack. Блок-аут — интерактивная концепт-геометрия,
не инженерная модель.

## Что нужно получить на каждый компонент

| Артефакт | Путь |
|---|---|
| скрипт сборки | `docs/plans/tools/build_<id>.py` |
| GLB | `public/models/machine-modules/components/<id>.glb` |
| 4 ракурса | `docs/plans/blockout/component-library/<id>/<id>_{3q,front,side,closeup}.png` |
| превью карточки | `public/models/machine-modules/renders/<id>.webp` |
| отчёт | `docs/plans/blockout/component-library/<id>/report.json` |

## Конвенции (нарушение = брак)

- Метры, Blender Z-up, экспорт `export_yup=True`.
- Имя каждого объекта начинается с `<id>__`. Посторонних объектов в GLB нет.
- Пустышка `<id>__anim` стоит ровно на реальной оси вращения/хода: её дети —
  только движущиеся детали, статичный корпус — вне. Pivot-тест: поворот на 90°
  не смещает центр bbox (допуск 1,5 мм).
- Пользовательские свойства `anim`: `motion` (`spin`/`slide`/`vibrate`/`none`),
  `amount`, `speed` — те же, что в каталоге.
- Материалов минимум 4, имена `CJ_<role>_<номер>`. Палитра: корпус
  `#F1EFEA`, графит `#34363B`, сталь `#B9BAB7`, рабочая зона `#E8B9BF`,
  циан `#E4F4F5`, янтарь `#D9A24A`, прозрачное — `CJ_glass`.
- Никаких плит, полов, декоративных решёток и болтов без функции.
- Габарит — по паспорту компонента, с допуском ±5 %.
- В скрипте обязательна функция `check()`, которая проверяет bbox, ось `anim`,
  смещение pivot, число материалов, префикс имён — и пишет `report.json`.
- `render_<id>.py` делает 4 ракурса: 3/4, фронт по оси, бок, close-up узла.

## Команды

```bash
blender -b --factory-startup -noaudio --python docs/plans/tools/build_<id>.py
blender -b --factory-startup -noaudio --python docs/plans/tools/render_<id>.py
blender -b --factory-startup -P docs/plans/tools/render_catalog_previews.py \
  -- --ids <id> --out /tmp/prev_<id> --res 700 --samples 32
python3 docs/plans/tools/make_catalog_renders.py /tmp/prev_<id> public/models/machine-modules/renders
```

`blender` есть в PATH (4.2 LTS). Шаблоны для копирования структуры:
`build_work_attach_vibrating.py` (мелкий наконечник с осью),
`build_motion_piston_servo.py` (механизм с валом и кареткой),
`build_work_electro_pad.py` (плоская площадка),
`build_work_air_jet.py` (сопло с корпусом).

## Чего делать нельзя

- Править `component-catalog.json`, `component-contracts.json`,
  `component-models.json`, `device-catalog.json`, `*.html`, чужие
  `build_*.py`. Каталог подключается отдельным шагом после приёмки.
- Пересобирать соседние компоненты «заодно».
- Оставлять в GLB камеры, свет, плоскости пола.

## Приёмка

1. `report.json`: `bbox_ok=true`, `pivot_ok=true`, `material_count>=4`,
   `bad_names=[]`, число узлов ≥ 8.
2. GLB ≥ 10 КБ, открывается, узлы имеют префикс.
3. Четыре PNG в папке blockout и один webp в `renders/`.
4. В отчёте — список движущихся/статичных узлов и одна строка, что читается
   в 3D (какой узел главный).
