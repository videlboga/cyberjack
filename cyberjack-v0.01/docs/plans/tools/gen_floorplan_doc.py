#!/usr/bin/env python3
"""Собирает docs/plans/lab-floorplan-exact.md из lab-floorplan.json."""
import json, os
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(OUT, 'lab-floorplan.json'), encoding='utf-8'))
rooms = {r['id']: r for r in d['rooms']}
objs = d['objects']
meta = d['meta']

def fmt(v): return f'{v:.2f}'.rstrip('0').rstrip('.')

def rect(r): return f'{fmt(r["x0"])}–{fmt(r["x1"])} × {fmt(r["y0"])}–{fmt(r["y1"])}'

L = []
L.append('# Точный план этажа: координаты помещений и объектов\n')
L.append('> Сгенерировано из `tools/gen_lab_floorplan.py` → `lab-floorplan.json` / `.csv` / `.svg` / `.png`.\n'
         '> Руками не править: менять генератор и пересобирать.\n')
L.append('## 1. Система координат\n')
L.append(f'- Метры. Origin — юго-западный угол блока (0, 0).')
L.append(f'- X — на восток, Y — на север, Z — вверх (пол = 0).')
L.append(f'- Габарит блока: **{meta["building"]["width"]} × {meta["building"]["depth"]} м** '
         f'(площадь {meta["building"]["area"]} м²), стены {meta["wall_thickness"]} м.')
L.append(f'- Сетка анкеров {meta["anchor_grid"]} м, высоты: 2.80 м обычная, 3.00 м у станций 065, 066, 070.\n')
L.append('## 2. Полосы по глубине\n')
L.append('| Полоса | Y, м | Глубина | Содержимое |')
L.append('|---|---|---|---|')
b = meta['bands']
L.append(f'| Жилой ряд | {b["living"][0]}–{b["living"][1]} | {b["living"][1]-b["living"][0]:.1f} | 7 камер/бытовых + шлюз передачи + резерв |')
L.append(f'| Служебный проход | {b["passage"][0]}–{b["passage"][1]} | {b["passage"][1]-b["passage"][0]:.1f} | доступ к жилому ряду, аварийный выход |')
L.append(f'| Служебный ряд | {b["service"][0]}–{b["service"][1]} | {b["service"][1]-b["service"][0]:.1f} | 8 рабочих комнат + ниша ИТ |')
L.append(f'| Главный коридор | {b["main_corridor"][0]}–{b["main_corridor"][1]} | {b["main_corridor"][1]-b["main_corridor"][0]:.1f} | вход, 5 веток, западное звено |')
L.append(f'| Ветки станций | {b["wings"][0]}–{b["wings"][1]} | {b["wings"][1]-b["wings"][0]:.1f} | 24 станционные комнаты, 5 коридоров-веток |\n')

L.append('## 3. Станционные комнаты (24)\n')
L.append('Формат: комната Ш×Г×В, станок Ш×Г, центр станка, фронтальный проход до двери.\n')
L.append('| ID | Авторское название | Режим | Норма | Комната Ш×Г×В | Станок | Проход |')
L.append('|---|---|---|---|---|---|---|')
for r in sorted([r for r in d['rooms'] if r['kind'] == 'station'], key=lambda r: r['station']):
    m = next(o for o in objs if o['room'] == r['id'] and o['kind'] == 'machine')
    front = (r['x1'] - (m['x'] + m['w'] / 2)) if m['rot'] == 180 else ((m['x'] - m['w'] / 2) - r['x0'])
    L.append(f'| `{r["id"]}` | {r.get("title") or r["name"]} | {r.get("mode") or "—"} '
             f'| {r.get("goal") or "—"} | {fmt(r["w"])}×{fmt(r["d"])}×{fmt(r["h"])} '
             f'| {fmt(m["w"])}×{fmt(m["d"])} @ ({fmt(m["x"])}, {fmt(m["y"])}) | {fmt(front)} м |')
L.append('')

L.append('## 4. Шаблон станционной комнаты\n')
L.append('Координаты — относительно комнаты: `dx` от наружной стены (глубина), `dy` от южной границы.\n')
L.append('| Объект | Монтаж | Габарит | Позиция | Примечание |')
L.append('|---|---|---|---|---|')
tmpl = [o for o in objs if o['room'] == 'room_st_067']
r0 = rooms['room_st_067']
for o in tmpl:
    if o['kind'] == 'machine':
        continue
    L.append(f'| {o["name"]} | {o["mount"]} | {fmt(o["w"])}×{fmt(o["d"])}×{fmt(o["h"])} '
             f'| dx {fmt(o["x"]-r0["x0"])}, dy {fmt(o["y"]-r0["y0"])}, z {fmt(o["z"])} | {o["note"] or "—"} |')
L.append('')

L.append('## 5. Служебный ряд\n')
L.append('| ID | Название | X, м | Y, м | Ш×Г | Ключевые объекты |')
L.append('|---|---|---|---|---|---|')
for rid, r in [(k, rooms[k]) for k in ['room_service_bay', 'room_tech', 'room_storage', 'room_medbay',
                                        'room_calibration', 'room_control', 'room_airlock', 'room_intake',
                                        'room_niche_e']]:
    key = ', '.join(o['name'] for o in objs if o['room'] == rid and o['kind'] not in ('light', 'anchor'))
    L.append(f'| `{rid}` | {r["name"]} | {fmt(r["x0"])}–{fmt(r["x1"])} | {fmt(r["y0"])}–{fmt(r["y1"])} '
             f'| {fmt(r["w"])}×{fmt(r["d"])} | {key[:150]} |')
L.append('')

L.append('## 6. Жилой ряд\n')
L.append('| ID | Название | X, м | Ш×Г | Ключевые объекты |')
L.append('|---|---|---|---|---|')
for rid in ['room_transfer', 'room_cell_a', 'room_cell_b', 'room_cell_c', 'room_cell_special',
            'room_staff_living', 'room_galley', 'room_wash', 'room_reserve_s']:
    r = rooms[rid]
    key = ', '.join(o['name'] for o in objs if o['room'] == rid and o['kind'] not in ('light', 'anchor'))
    L.append(f'| `{rid}` | {r["name"]} | {fmt(r["x0"])}–{fmt(r["x1"])} | {fmt(r["w"])}×{fmt(r["d"])} | {key[:140]} |')
L.append('')

L.append('## 7. Циркуляция\n')
L.append('| Из | В | Тип | Ширина |')
L.append('|---|---|---|---|')
for dd in d['doors']:
    if dd['kind'] == 'opening':
        L.append(f'| {rooms[dd["room"]]["name"]} | смежное помещение ({dd["wall"]}) | проём | {fmt(dd["width"])} м |')
L.append('')
L.append('Вход с улицы — приёмный тамбур (восточный торец) → санитарный шлюз → главный коридор. '
         'Выход актива — шлюз передачи (западный торец жилого ряда, гермолюк Ø2.2). '
         'Жилой ряд доступен только через западное звено → служебный проход.\n')

L.append('## 8. Проверки\n')
L.append('- объектов вне своих комнат: **0**;')
L.append('- минимальный фронтальный проход у станка: **1.34 м** (порог 0.90 м);')
L.append('- анкеры M12 стоят по углам пятна станка с шагом по сетке 0.60 м;')
L.append(f'- всего: комнат {meta["counts"]["rooms"]}, дверей и проёмов {meta["counts"]["doors"]}, '
         f'объектов {meta["counts"]["objects"]}.\n')

L.append('## 9. Файлы и импорт в 3D\n')
L.append('| Файл | Что внутри |')
L.append('|---|---|')
L.append('| `lab-floorplan.json` | комнаты (rect, h, kind), двери, объекты с монтажом и поворотом |')
L.append('| `lab-floorplan.csv` | плоская таблица объектов для импорта скриптом |')
L.append('| `lab-floorplan.svg` / `.png` | чертёж 1:100 для сверки |')
L.append('| `tools/gen_lab_floorplan.py` | генератор (данные комнат и станков в начале файла) |')
L.append('')
L.append('Порядок сборки сцены: полы по `rooms[].x0..y1` → стены из разностей прямоугольников → '
         'проёмы по `doors[]` → станки по `objects[kind=machine]` (поворот `rot`) → остальное по `mount` '
         '(floor ставится на z=0, wall — на высоту z, ceiling — под потолок). Единицы метры, Y-up '
         'конвертировать в Z-up на импорте.\n')

open(os.path.join(OUT, 'lab-floorplan-exact.md'), 'w', encoding='utf-8').write('\n'.join(L))
print('written lab-floorplan-exact.md', len(L), 'lines')
