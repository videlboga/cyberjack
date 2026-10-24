#!/usr/bin/env python3
"""Генератор точного плана лабораторного блока (44.0 x 23.4 м) — v2.

Циркуляция:
  улица → приёмный тамбур → санитарный шлюз → главный коридор
  главный коридор → 5 веток станций (тупиковые), 8 служебных комнат
  главный коридор → западное звено → служебный проход → жилой ряд
  жилой ряд → шлюз передачи (гермолюк наружу, западный торец)

Координаты: метры, origin в юго-западном углу, X — восток, Y — север, Z — вверх.
Стены 0.20 м, сетка анкеров 0.60 м.

Выход: lab-floorplan.json / .csv / .svg (+ .png через rsvg-convert).
"""
import json, csv, os

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BW, BD, T = 44.0, 23.4, 0.20
H_STD, H_TALL = 2.80, 3.00

# --- полосы (юг -> север) --------------------------------------------------
YL = (0.20, 4.60)    # жилой ряд
YP = (4.80, 6.80)    # служебный проход
YS = (7.00, 11.40)   # служебный ряд
YC = (11.60, 14.00)  # главный коридор
YW = (14.20, 23.20)  # ветки станций

# --- станции ---------------------------------------------------------------
ST = {
 '065': ('Кольцо',               1.70, 0.73, 1.46, 3.2, '3x380', 'floor'),
 '066': ('Двойная стойка',       1.23, 1.16, 2.17, 2.8, '3x380', 'floor'),
 '067': ('Кресло с педалями',    1.50, 1.31, 1.19, 3.0, '230',   'floor'),
 '068': ('Наклонный блок',       1.14, 0.54, 1.13, 2.4, '230',   'floor'),
 '069': ('Рама-вис',             0.85, 0.63, 1.34, 2.4, '230',   'wall'),
 '070': ('Шкаф-кабина',          0.74, 1.16, 2.33, 1.8, '230',   'floor'),
 '071': ('Горизонтальный подвес',1.18, 0.38, 1.48, 2.6, '230',   'ceiling'),
 '072': ('Крест',                1.64, 0.27, 1.90, 2.8, '230',   'floor'),
 '073': ('Кресло с опорами',     1.04, 1.22, 1.55, 2.6, '230',   'floor'),
 '074': ('Ряд кабин',            6.90, 0.95, 1.81, 7.2, '230',   'floor'),
 '075': ('Скамья',               1.22, 0.37, 1.45, 2.4, '230',   'floor'),
 '076': ('Колонна',              0.31, 0.74, 1.54, 1.6, '230',   'floor'),
 '077': ('Узкий шкаф',           0.74, 0.71, 1.66, 1.8, '230',   'floor'),
 '078': ('П-рама',               1.60, 0.87, 1.17, 3.0, '230',   'ceiling'),
 '079': ('Стол',                 1.50, 0.84, 1.36, 3.0, '230',   'floor'),
 '080': ('Седло',                0.87, 0.51, 1.41, 2.2, '230',   'floor'),
 '081': ('Кресло-кабина',        0.48, 0.63, 0.95, 1.6, '230',   'floor'),
 '082': ('Поясной аппарат',      0.80, 0.60, 1.20, 2.2, '230',   'floor'),
 '083': ('Люлька',               2.45, 0.36, 0.78, 2.8, '230',   'floor'),   # ремонт: 0.68x0.36x0.78 + штанга 2.45
 '084': ('Диск',                 0.95, 0.63, 0.94, 2.4, '3x380', 'floor'),
 '085': ('Восьмиугольник',       1.44, 0.61, 1.29, 2.8, '230',   'floor'),
 '086': ('Тоннель',              1.10, 1.19, 1.42, 2.4, '230',   'floor'),
 '087': ('Стремена',             0.79, 0.81, 0.93, 2.2, '230',   'floor'),
 '088': ('Наклон',               0.64, 1.02, 1.35, 2.4, '230',   'floor'),
}
# Авторские названия, режим на табло и норма из refs vol-04 (stations-narrative.md)
NARR = {
 '065': ('Кольцо очистки',      'CLEANING',  'цикл 01:30'),
 '066': ('Двойная колонна',     'CLEANING',  'парная промывка 01:48'),
 '067': ('Кресло наказания',    'PUNISHING', '+5/+10/+15/+30 мин'),
 '068': ('Наклонный блок',      'TRAINING',  'короткие циклы'),
 '069': ('Камера в панели',     'LOCK',      'без вида на лицо'),
 '070': ('Кабина тренажёра',    'TRAINING',  'ORGs, CRITICAL HIT'),
 '071': ('Подвес с датчиком',   'WARNING',   'LOST SIGNAL'),
 '072': ('Рама растяжки',       'CLEANING',  'датчики стоп'),
 '073': ('Ванна-кресло',        'TRAINING',  '02:05:31'),
 '074': ('Стена кабин',         'TRAINING',  'готовность 86/102 %'),
 '075': ('Планка',              'TRAINING',  'выдержка на опоре'),
 '076': ('Кормитель',           'FEEDING',   '00:2X, пролив = тревога'),
 '077': ('Стойка повторов',     'TRAINING',  '1000 раз x 2 в день'),
 '078': ('Дорожка',             'TRAINING',  '1000 м в день, +100 за попадание'),
 '079': ('Автокушетка',         'TRAINING',  '02:44:07, капельница'),
 '080': ('Гипномашина',         'TRAINING',  'спокойное внушение'),
 '081': ('Гриндер',             'GRINDING',  'продукт без брызг'),
 '082': ('Экстрактор',          'FEEDING',   '3 л в сутки'),
 '083': ('Капсула заключения',  'LOCK',      'случайный вибратор, 46:07'),
 '084': ('Счастливый душ',      'CLEANING',  '2 часа мытья'),
 '085': ('Синхронизатор',       'SYNCING',   'обученный + новый, 79 %'),
 '086': ('Магнитный массажёр',  'LOCK',      '999 RPM, ORGs/OPM'),
 '087': ('Машина наказания',    'PUNISHING',  'держать планку в диапазоне'),
 '088': ('Машина новичка',      'TRAINING',  'мягкий режим для нового'),
}

# (сектор, x0, запад, восток)
WINGS = [
    ('A', 0.20,  ['070', '077', '081', '076'], ['074']),
    ('B', 8.80,  ['067', '073'],               ['080']),
    ('C', 17.40, ['078', '079', '086'],        ['075', '087']),
    ('D', 26.00, ['072', '071', '069'],        ['083', '085', '066']),
    ('E', 34.60, ['065', '084'],               ['082', '068', '088']),
]
WD, SP, ED = 3.0, 2.0, 3.0   # глубина запада, коридор ветки, глубина востока

rooms, doors, objects = [], [], []


def room(rid, name, kind, x0, y0, x1, y1, h=H_STD, sector='', station=None, **extra):
    rooms.append(dict(**extra, id=rid, name=name, kind=kind, sector=sector, station=station,
                      x0=round(x0, 3), y0=round(y0, 3), x1=round(x1, 3), y1=round(y1, 3),
                      w=round(x1 - x0, 3), d=round(y1 - y0, 3), h=h,
                      area=round((x1 - x0) * (y1 - y0), 2)))


def obj(rid, oid, name, kind, mount, cx, cy, w, d, z=0.0, h=0.0, rot=0, note=''):
    objects.append(dict(room=rid, id=oid, name=name, kind=kind, mount=mount,
                        x=round(cx, 3), y=round(cy, 3), w=round(w, 3), d=round(d, 3),
                        z=round(z, 3), h=round(h, 3), rot=rot, note=note))


def door(rid, wall, at, width=1.10, kind='door'):
    doors.append(dict(room=rid, wall=wall, at=round(at, 3), width=width, kind=kind))


# =========================================================================
# 1. Ветки станций
# =========================================================================
def station_room(rid_name, sid, x_side, y0, side):
    """x_side — координата наружной стены комнаты; side='w'|'e'."""
    name, mw, md, mh, fw, power, mount = ST[sid]
    rid = f'room_st_{sid}'
    if side == 'w':
        x0, x1 = x_side, x_side + WD
        door_wall = 'east'
    else:
        x0, x1 = x_side - ED, x_side
        door_wall = 'west'
    h = H_TALL if sid in ('065', '066', '070') else H_STD
    title, mode, goal = NARR.get(sid, (name, '', ''))
    room(rid, name, 'station', x0, y0, x1, y0 + fw, h, rid_name, sid,
         title=title, mode=mode, goal=goal)

    # станок у наружной стены, лицом к двери
    if side == 'w':
        mcx = x0 + 0.35 + md / 2
        rot = 180
    else:
        mcx = x1 - 0.35 - md / 2
        rot = 0
    mcy = y0 + fw / 2
    obj(rid, f'machine_{sid}', f'Станок {sid} · {name}', 'machine', mount,
        mcx, mcy, md, mw, 0, mh, rot, f'питание {power}; SexMachineModel-{sid}')

    # Дверей нет (проёмы-шлюзы), поэтому навесное НЕ ставим на стену с проёмом:
    # всё уходит на боковые стены, в створе ничего не висит.
    inner = x1 - 0.20 if side == 'w' else x0 + 0.20      # стена с проёмом
    sgn = -1 if side == 'w' else 1
    obj(rid, f'console_{sid}', 'Пульт станции', 'console', 'floor',
        inner + sgn * 0.90, y0 + 0.20, 0.40, 0.30, 0, 1.40, note='пуск/пауза/интенсивность/таймер')
    obj(rid, f'estop_{sid}', 'Аварийный стоп', 'estop', 'wall',
        inner, y0 + 0.15, 0.05, 0.10, 1.20, 0.10)
    obj(rid, f'screen_{sid}', 'Экран телеметрии', 'screen', 'wall',
        inner + sgn * 1.60, y0 + fw - 0.05, 0.45, 0.05, 1.55, 0.30)
    obj(rid, f'hook_{sid}', 'Крючок и полка', 'hook', 'wall',
        inner + sgn * 0.50, y0 + 0.05, 0.40, 0.05, 1.35, 0.25)
    obj(rid, f'disp_{sid}', 'Дозатор', 'dispenser', 'wall',
        inner + sgn * 1.35, y0 + 0.05, 0.12, 0.05, 1.10, 0.25)
    obj(rid, f'lamp_{sid}', 'Светильник станции', 'light', 'ceiling',
        mcx, mcy, 0.60, 1.20, 2.70, 0.05, note='300 лк на станке')
    obj(rid, f'exhaust_{sid}', 'Вытяжка', 'exhaust', 'ceiling',
        mcx + (0.30 if side == 'w' else -0.30), mcy, 0.30, 0.30, 2.70, 0.15)
    obj(rid, f'cam_{sid}', 'Камера', 'camera', 'ceiling',
        (x1 - 0.25) if side == 'w' else (x0 + 0.25), y0 + fw - 0.25, 0.12, 0.12, 2.65, 0.12,
        rot=225 if side == 'w' else 135)
    obj(rid, f'bin_{sid}', 'Урна', 'bin', 'floor',
        (x1 - 0.30) if side == 'w' else (x0 + 0.30), y0 + 0.30, 0.30, 0.30, 0, 0.55)
    if mount == 'floor':
        for i, (ax, ay) in enumerate([(0.1, 0.1), (0.1, 0.9), (0.9, 0.1), (0.9, 0.9)]):
            obj(rid, f'anchor_{sid}_{i+1}', f'Анкер M12 #{i+1}', 'anchor', 'floor',
                mcx - md / 2 + ax * md, mcy - mw / 2 + ay * mw, 0.06, 0.06, 0, 0)
    if mount in ('ceiling', 'wall'):
        obj(rid, f'beam_{sid}', 'Потолочная балка 150 кг', 'beam', 'ceiling',
            mcx, mcy, md + 0.6, mw + 0.6, 2.55, 0.10, note='расчётная нагрузка 150 кг на точку')
    door(rid, door_wall, y0 + fw / 2)
    return y0 + fw + T


for sector, x0, west, east in WINGS:
    xw_in = x0                                    # наружная стена запада
    xs0 = x0 + WD                                  # начало коридора ветки
    xs1 = xs0 + SP
    xe_out = x0 + WD + T + SP + T + ED             # наружная стена востока
    y = YW[0]
    for sid in west:
        y = station_room(sector, sid, xw_in, y, 'w')
    if YW[1] - y > 1.2:
        rid = f'room_sup_{sector}w'
        room(rid, 'Ниша расходников', 'support', xw_in, y, xw_in + WD, YW[1], H_STD, sector)
        obj(rid, f'shelf_{sector}w', 'Стеллаж', 'shelf', 'floor', xw_in + 0.35, (y + YW[1]) / 2, 0.50, min(1.60, YW[1] - y - 0.5), 0, 2.00)
        door(rid, 'east', (y + YW[1]) / 2, 0.90, 'opening')
    y = YW[0]
    for sid in east:
        y = station_room(sector, sid, xe_out, y, 'e')
    if YW[1] - y > 1.2:
        rid = f'room_sup_{sector}e'
        room(rid, 'Кладовая', 'support', xe_out - ED, y, xe_out, YW[1], H_STD, sector)
        obj(rid, f'shelf_{sector}e', 'Стеллаж', 'shelf', 'floor', xe_out - 0.35, (y + YW[1]) / 2, 0.50, min(1.60, YW[1] - y - 0.5), 0, 2.00)
        door(rid, 'west', (y + YW[1]) / 2, 0.90, 'opening')
    # коридор ветки
    rid = f'room_wing_{sector}'
    room(rid, f'Ветка {sector}', 'corridor', xs0, YW[0], xs1, YW[1], H_STD, sector)
    obj(rid, f'light_{sector}', 'Светильник ветки', 'light', 'ceiling',
        (xs0 + xs1) / 2, YW[0] + 2.2, 0.60, 1.20, 2.70, 0.05)
    obj(rid, f'cam_{sector}', 'Камера ветки', 'camera', 'ceiling',
        xs0 + 0.25, YW[0] + 0.30, 0.12, 0.12, 2.65, 0.12, rot=45)
    obj(rid, f'shield_{sector}', 'Пожарный щит', 'shield', 'wall',
        (xs0 + xs1) / 2, YW[1] - 0.05, 0.60, 0.05, 1.40, 0.50)
    # вход из главного коридора в ветку
    door(rid, 'south', (xs0 + xs1) / 2, 1.60, 'opening')

# =========================================================================
# 2. Главный коридор + западное звено
# =========================================================================
room('room_corridor', 'Главный коридор', 'corridor', 0.20, YC[0], 43.80, YC[1], H_STD)
for i in range(11):
    obj('room_corridor', f'light_c{i+1}', 'Светильник коридора', 'light', 'ceiling',
        2.4 + i * 4.0, (YC[0] + YC[1]) / 2, 1.20, 0.60, 2.70, 0.05)
for i, xc in enumerate([5.0, 13.0, 21.0, 29.0, 37.0]):
    obj('room_corridor', f'cam_c{i+1}', 'Камера коридора', 'camera', 'ceiling',
        xc, YC[1] - 0.25, 0.12, 0.12, 2.65, 0.12, rot=270)
obj('room_corridor', 'firepoint', 'Пожарный пост', 'shield', 'wall', 21.0, YC[0] + 0.05, 0.80, 0.05, 1.30, 0.60)

room('room_link_w', 'Западное звено', 'corridor', 0.20, YP[0], 2.20, YC[1], H_STD)
obj('room_link_w', 'light_l1', 'Светильник звена', 'light', 'ceiling', 1.20, 9.20, 0.60, 1.20, 2.70, 0.05)
door('room_link_w', 'east', (YP[0] + YP[1]) / 2, 1.60, 'opening')

room('room_passage', 'Служебный проход', 'corridor', 2.40, YP[0], 43.80, YP[1], H_STD)
for i in range(9):
    obj('room_passage', f'light_p{i+1}', 'Светильник прохода', 'light', 'ceiling',
        3.0 + i * 5.0, (YP[0] + YP[1]) / 2, 1.20, 0.60, 2.70, 0.05)
obj('room_passage', 'exit_e', 'Аварийный выход', 'hatch', 'wall', 43.80, (YP[0] + YP[1]) / 2, 0.10, 1.20, 0, 2.10, note='дверь наружу с трапом')

# =========================================================================
# 3. Служебный ряд
# =========================================================================
SRV = [
    ('room_service_bay', 'Ремонтный бокс', 4.0),
    ('room_tech', 'Техузел', 3.5),
    ('room_storage', 'Склад расходников', 4.5),
    ('room_medbay', 'Медблок', 5.5),
    ('room_calibration', 'Калибровочная', 6.0),
    ('room_control', 'Пост наблюдения', 6.5),
    ('room_airlock', 'Санитарный шлюз', 3.0),
    ('room_intake', 'Приёмный тамбур', 5.0),
]
x = 2.40
for rid, name, w in SRV:
    room(rid, name, 'service', x, YS[0], x + w, YS[1], H_STD)
    cx = x + w / 2
    if rid == 'room_service_bay':
        obj(rid, 'bench', 'Верстак', 'bench', 'floor', cx - 0.4, YS[0] + 0.45, 2.00, 0.70, 0, 0.90)
        obj(rid, 'stand', 'Стенд с разобранным станком', 'stand', 'floor', cx + 1.10, YS[1] - 0.80, 1.20, 1.20, 0, 1.40)
        obj(rid, 'shelf', 'Стеллаж запчастей', 'shelf', 'floor', x + 0.35, YS[0] + 1.90, 0.50, 1.80, 0, 2.00)
        obj(rid, 'sink', 'Мойка', 'sink', 'floor', x + w - 0.45, YS[1] - 0.42, 0.60, 0.55, 0, 0.90)
        obj(rid, 'crane', 'Кран-балка 250 кг', 'beam', 'ceiling', cx, YS[0] + 1.30, 2.00, 1.00, 2.55, 0.12)
    elif rid == 'room_tech':
        obj(rid, 'panel', 'Щит силовой', 'panel', 'wall', cx, YS[1] - 0.10, 1.60, 0.20, 1.00, 2.00)
        obj(rid, 'pump1', 'Насосная группа #1', 'pump', 'floor', x + 0.65, YS[0] + 0.60, 0.80, 0.60, 0, 1.00)
        obj(rid, 'pump2', 'Насосная группа #2', 'pump', 'floor', x + 1.95, YS[0] + 0.60, 0.80, 0.60, 0, 1.00)
        obj(rid, 'epanel', 'Аварийный пульт', 'console', 'floor', x + w - 0.50, YS[1] - 0.60, 0.50, 0.40, 0, 1.20)
        obj(rid, 'pipes', 'Трубы Ø80 ×3', 'pipe', 'ceiling', cx, YS[0] + 0.35, w - 0.4, 0.60, 2.45, 0.35)
    elif rid == 'room_storage':
        obj(rid, 'shelf1', 'Стеллаж #1', 'shelf', 'floor', x + 0.35, YS[0] + 2.30, 0.50, 1.80, 0, 2.20)
        obj(rid, 'shelf2', 'Стеллаж #2', 'shelf', 'floor', x + w - 0.35, YS[0] + 2.30, 0.50, 1.80, 0, 2.20)
        obj(rid, 'fridge', 'Холодильник препаратов', 'fridge', 'floor', x + 1.15, YS[0] + 0.45, 0.70, 0.70, 0, 1.90)
        obj(rid, 'table', 'Стол комплектации', 'table', 'floor', x + w / 2 + 0.75, YS[0] + 0.45, 1.40, 0.70, 0, 0.90)
    elif rid == 'room_medbay':
        obj(rid, 'couch', 'Кушетка', 'couch', 'floor', x + 1.60, YS[0] + 0.60, 2.00, 0.80, 0.55, 0.25)
        obj(rid, 'iv', 'Стойка-капельница', 'iv', 'floor', x + 0.55, YS[0] + 0.60, 0.40, 0.40, 0, 1.90)
        obj(rid, 'cabinet', 'Шкаф препаратов', 'cabinet', 'wall', x + 0.55, YS[1] - 0.25, 0.90, 0.45, 0, 2.00)
        obj(rid, 'monitor', 'Монитор', 'screen', 'wall', x + 1.70, YS[1] - 0.10, 0.45, 0.05, 1.50, 0.30)
        obj(rid, 'capsule', 'Ниша восстановительной капсулы', 'capsule', 'floor', x + w - 0.90, YS[1] - 1.10, 1.10, 1.10, 0, 2.10)
        obj(rid, 'bsink', 'Мойка', 'sink', 'floor', x + w - 0.40, YS[0] + 0.45, 0.60, 0.55, 0, 0.90)
    elif rid == 'room_calibration':
        obj(rid, 'dtable', 'Диагностический стол', 'dtable', 'floor', cx - 0.30, (YS[0] + YS[1]) / 2, 0.80, 2.00, 0, 0.90)
        obj(rid, 'stand', 'Стойка телеметрии', 'stand', 'floor', cx - 0.30, (YS[0] + YS[1]) / 2 + 1.20, 0.40, 0.40, 0, 1.90)
        obj(rid, 'cabinet', 'Шкаф расходников', 'cabinet', 'wall', x + 0.50, YS[0] + 1.10, 0.90, 0.40, 0, 2.00)
        obj(rid, 'sink', 'Мойка-стерилизатор', 'sink', 'floor', x + 0.45, YS[1] - 0.45, 0.60, 0.55, 0, 0.90)
        for i in range(3):
            obj(rid, f'slot_{i+1}', f'Монтажный слот #{i+1}', 'slot', 'floor',
                x + w - 0.65, YS[0] + 0.85 + i * 1.25, 0.70, 1.00, 0, 0.02,
                note='крепёж 1.2 м, 230 V + порт данных')
    elif rid == 'room_control':
        obj(rid, 'videowall', 'Видеостена 24 плитки', 'videowall', 'wall', cx, YS[0] + 0.05, 3.60, 0.05, 1.30, 0.85)
        obj(rid, 'desk', 'Стол диспетчера', 'desk', 'floor', cx, YS[0] + 0.60, 3.60, 0.80, 0, 0.75)
        obj(rid, 'chair1', 'Кресло #1', 'chair', 'floor', cx - 0.90, YS[0] + 1.35, 0.65, 0.65, 0, 1.30)
        obj(rid, 'chair2', 'Кресло #2', 'chair', 'floor', cx + 0.90, YS[0] + 1.35, 0.65, 0.65, 0, 1.30)
        obj(rid, 'bedniche', 'Кровать-ниша ассистента', 'bed', 'floor', x + w - 1.55, YS[1] - 0.65, 2.00, 0.85, 0.35, 0.30)
        obj(rid, 'glass', 'Стеклянная перегородка', 'glass', 'wall', x + 1.50, YS[1] - 0.05, 2.60, 0.05, 1.00, 1.40)
    elif rid == 'room_airlock':
        obj(rid, 'gate', 'Дез-рамка', 'gate', 'floor', cx, (YS[0] + YS[1]) / 2, 1.20, 1.20, 0, 2.20)
        obj(rid, 'lockers', 'Шкафчики', 'lockers', 'floor', x + 0.25, YS[0] + 1.90, 0.40, 1.60, 0, 1.80)
        obj(rid, 'drain', 'Слив', 'drain', 'floor', cx, YS[0] + 0.45, 0.30, 0.30, 0, 0.02)
        door(rid, 'east', (YS[0] + YS[1]) / 2, 1.20, 'door')   # в приёмный тамбур
    elif rid == 'room_intake':
        obj(rid, 'gurney', 'Каталка', 'gurney', 'floor', x + 0.75, YS[0] + 1.80, 0.70, 2.00, 0.60, 0.30)
        obj(rid, 'scanner', 'Сканер-рамка', 'scanner', 'floor', x + w - 1.00, YS[1] - 1.20, 1.00, 1.00, 0, 2.20)
        obj(rid, 'container', 'Транспортный контейнер', 'container', 'floor', x + w - 0.70, YS[0] + 0.65, 0.80, 1.20, 0, 1.00)
        obj(rid, 'intaketable', 'Стол приёмки', 'table', 'floor', x + 2.00, YS[0] + 0.45, 1.20, 0.60, 0, 0.90)
        door(rid, 'east', YS[1] - 1.20, 1.40, 'hatch')          # вход с улицы
    door(rid, 'north', cx)
    x += w + T
room('room_niche_e', 'Ниша ИТ', 'support', x, YS[0], 43.80, YS[1], H_STD)
obj('room_niche_e', 'rack', 'Стойка ИТ', 'cabinet', 'floor', (x + 43.80) / 2, YS[0] + 0.60, 0.60, 0.60, 0, 1.90)
door('room_niche_e', 'north', (x + 43.80) / 2, 0.90, 'opening')

# =========================================================================
# 4. Жилой ряд
# =========================================================================
LIV = [
    ('room_transfer',    'Шлюз передачи',              3.8),
    ('room_cell_a',      'Жилая камера A',             4.2),
    ('room_cell_b',      'Жилая камера B',             4.2),
    ('room_cell_c',      'Жилая камера C',             4.2),
    ('room_cell_special','Камера особого содержания',  3.6),
    ('room_staff_living','Комната персонала',          5.0),
    ('room_galley',      'Камбуз',                     3.8),
    ('room_wash',        'Душевая',                    4.0),
]
x = 0.20
for rid, name, w in LIV:
    room(rid, name, 'living' if rid != 'room_transfer' else 'service', x, YL[0], x + w, YL[1], H_STD)
    cx = x + w / 2
    if rid == 'room_transfer':
        obj(rid, 'hatch', 'Гермолюк Ø2.2', 'hatch', 'wall', 0.20, (YL[0] + YL[1]) / 2, 0.10, 2.20, 0, 2.20)
        obj(rid, 'platform', 'Платформа на рельсах', 'platform', 'floor', x + 1.20, (YL[0] + YL[1]) / 2, 2.20, 0.90, 0.30, 0.30)
        obj(rid, 'board', 'Табло резонанса', 'screen', 'wall', x + w - 0.60, YL[1] - 0.05, 1.20, 0.05, 1.50, 0.70)
        obj(rid, 'console', 'Пульт шлюза', 'console', 'floor', x + w - 0.50, YL[0] + 0.40, 0.40, 0.30, 0, 1.10)
    elif rid in ('room_cell_a', 'room_cell_b', 'room_cell_c'):
        obj(rid, 'bed1', 'Койка #1', 'bed', 'floor', x + 1.25, YL[0] + 0.60, 2.00, 0.90, 0.35, 0.30)
        obj(rid, 'bed2', 'Койка-ниша #2', 'bed', 'floor', x + w - 0.55, YL[0] + 1.75, 0.90, 2.00, 0.35, 0.30)
        obj(rid, 'table', 'Стол', 'table', 'floor', cx, YL[0] + 2.70, 1.10, 0.70, 0, 0.75)
        obj(rid, 'stool1', 'Табурет #1', 'stool', 'floor', cx - 0.55, YL[0] + 3.50, 0.35, 0.35, 0, 0.45)
        obj(rid, 'stool2', 'Табурет #2', 'stool', 'floor', cx + 0.55, YL[0] + 3.50, 0.35, 0.35, 0, 0.45)
        obj(rid, 'san', 'Санитарный модуль', 'san', 'floor', x + w - 0.70, YL[1] - 0.45, 1.00, 0.85, 0, 1.20)
        obj(rid, 'music', 'Панель музыки', 'panel', 'wall', x + 0.45, YL[1] - 0.05, 0.25, 0.05, 1.30, 0.15)
        obj(rid, 'lightp', 'Панель света', 'panel', 'wall', x + 0.85, YL[1] - 0.05, 0.20, 0.05, 1.30, 0.12)
        obj(rid, 'vent', 'Вентиляционная решётка', 'vent', 'wall', x + w - 0.60, YL[0] + 0.05, 0.30, 0.05, 0.20, 0.15)
    elif rid == 'room_cell_special':
        obj(rid, 'bed1', 'Койка (усиленная)', 'bed', 'floor', x + 1.30, YL[0] + 0.85, 2.00, 1.40, 0.35, 0.30)
        obj(rid, 'table', 'Стол', 'table', 'floor', cx, YL[0] + 2.85, 1.60, 0.80, 0, 0.75)
        obj(rid, 'stool1', 'Табурет', 'stool', 'floor', cx - 0.55, YL[0] + 2.85, 0.35, 0.35, 0, 0.45)
        obj(rid, 'stool2', 'Табурет', 'stool', 'floor', cx + 0.55, YL[0] + 2.85, 0.35, 0.35, 0, 0.45)
        obj(rid, 'screen', 'Экран с графиком', 'screen', 'wall', x + 0.95, YL[1] - 0.05, 0.55, 0.05, 1.50, 0.40)
        obj(rid, 'san', 'Санитарный модуль', 'san', 'floor', x + w - 0.70, YL[0] + 3.55, 1.00, 0.85, 0, 1.20)
        for i, ry in enumerate([YL[0] + 1.20, YL[0] + 2.40]):
            obj(rid, f'rail_{i+1}', 'Рельс с фиксаторами', 'rail', 'ceiling', cx, ry, 2.20, 0.10, 2.30, 0.10)
        for i, (sx, sy) in enumerate([(x + 0.35, YL[0] + 0.35), (x + w - 0.35, YL[0] + 0.35),
                                     (x + 0.35, YL[1] - 0.35), (x + w - 0.35, YL[1] - 0.35)]):
            obj(rid, f'sensor_{i+1}', 'Датчик', 'sensor', 'ceiling', sx, sy, 0.10, 0.10, 2.65, 0.08)
    elif rid == 'room_staff_living':
        obj(rid, 'bed1', 'Койка #1', 'bed', 'floor', x + 1.10, YL[0] + 0.60, 2.00, 0.90, 0.35, 0.30)
        obj(rid, 'bed2', 'Койка #2', 'bed', 'floor', x + w - 1.10, YL[0] + 0.60, 2.00, 0.90, 0.35, 0.30)
        obj(rid, 'table', 'Стол', 'table', 'floor', cx, YL[0] + 2.20, 0.90, 0.60, 0, 0.75)
        obj(rid, 'locker1', 'Шкафчик #1', 'locker', 'floor', x + 0.35, YL[1] - 0.35, 0.50, 0.40, 0, 1.80)
        obj(rid, 'locker2', 'Шкафчик #2', 'locker', 'floor', x + 0.95, YL[1] - 0.35, 0.50, 0.40, 0, 1.80)
        obj(rid, 'san', 'Санмодуль за перегородкой', 'san', 'floor', x + w - 1.10, YL[1] - 1.50, 1.40, 1.40, 0, 1.20)
        obj(rid, 'panel', 'Панель музыки и света', 'panel', 'wall', cx, YL[1] - 0.05, 0.30, 0.05, 1.30, 0.18)
    elif rid == 'room_galley':
        obj(rid, 'dispenser', 'Раздатчик белка и воды', 'dispenser', 'floor', x + 0.60, YL[1] - 0.55, 0.60, 0.60, 0, 1.90)
        obj(rid, 'table', 'Стол на два места', 'table', 'floor', cx, YL[0] + 1.70, 1.00, 0.70, 0, 0.75)
        obj(rid, 'stool1', 'Табурет', 'stool', 'floor', cx - 0.55, YL[0] + 1.70, 0.35, 0.35, 0, 0.45)
        obj(rid, 'stool2', 'Табурет', 'stool', 'floor', cx + 0.55, YL[0] + 1.70, 0.35, 0.35, 0, 0.45)
        obj(rid, 'sink', 'Раковина', 'sink', 'floor', x + w - 0.45, YL[0] + 0.50, 0.60, 0.55, 0, 0.90)
        obj(rid, 'board', 'График дежурств', 'panel', 'wall', cx, YL[1] - 0.05, 0.60, 0.05, 1.40, 0.40)
    elif rid == 'room_wash':
        for i in range(3):
            obj(rid, f'niche_{i+1}', f'Душевая ниша #{i+1}', 'shower', 'floor',
                x + 0.60, YL[0] + 0.70 + i * 1.20, 0.90, 0.90, 0, 2.10)
        obj(rid, 'bench', 'Скамья', 'bench', 'floor', x + w - 0.35, (YL[0] + YL[1]) / 2, 0.35, 1.80, 0, 0.45)
        obj(rid, 'dryer', 'Сушилка', 'dryer', 'ceiling', cx, (YL[0] + YL[1]) / 2, 0.60, 0.60, 2.60, 0.20)
    door(rid, 'north', cx)
    x += w + T
room('room_reserve_s', 'Резерв под камеры D/E', 'reserve', x, YL[0], 43.80, YL[1], H_STD)
door('room_reserve_s', 'north', (x + 43.80) / 2, 1.20, 'opening')

# =========================================================================
# 5. Экспорт
# =========================================================================
meta = dict(
    format='cyberjack-lab-floorplan-v2', units='metres', origin='south-west corner',
    axes=dict(x='east', y='north', z='up'), wall_thickness=T, anchor_grid=0.60,
    building=dict(width=BW, depth=BD, area=round(BW * BD, 1)),
    bands=dict(living=list(YL), passage=list(YP), service=list(YS),
               main_corridor=list(YC), wings=list(YW)),
    counts=dict(rooms=len(rooms), doors=len(doors), objects=len(objects)),
    legend=dict(kind=['station', 'service', 'living', 'corridor', 'support', 'reserve'],
                mount=['floor', 'wall', 'ceiling']),
)
with open(os.path.join(OUT, 'lab-floorplan.json'), 'w', encoding='utf-8') as f:
    json.dump(dict(meta=meta, rooms=rooms, doors=doors, objects=objects), f,
              ensure_ascii=False, indent=1)

rmap = {r['id']: r for r in rooms}
with open(os.path.join(OUT, 'lab-floorplan.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['room_id', 'room_name', 'object_id', 'object_name', 'kind', 'mount',
                'x_center', 'y_center', 'footprint_w', 'footprint_d', 'z_bottom', 'height',
                'rot_deg', 'note'])
    for o in sorted(objects, key=lambda o: (o['room'], o['kind'], o['id'])):
        w.writerow([o['room'], rmap[o['room']]['name'], o['id'], o['name'], o['kind'], o['mount'],
                    o['x'], o['y'], o['w'], o['d'], o['z'], o['h'], o['rot'], o['note']])

# =========================================================================
# 6. SVG
# =========================================================================
S, OX, OY = 40.0, 60, 40
def px(v): return v * S
def py(v): return (BD - v) * S
W, Hh = px(BW) + 120, px(BD) + 150
COL = dict(station='#e3efec', corridor='#d9e3e8', service='#f2ece2', living='#eef1e6',
           support='#f5f5f3', reserve='#fbfbf9')
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{Hh:.0f}" viewBox="0 0 {W:.0f} {Hh:.0f}">',
       '<rect width="100%" height="100%" fill="#ffffff"/>', f'<g transform="translate({OX},{OY})">']
for gx in range(0, int(BW) + 1, 2):
    out.append(f'<line x1="{px(gx):.1f}" y1="0" x2="{px(gx):.1f}" y2="{px(BD):.1f}" stroke="#e9eff1" stroke-width="0.6"/>')
for gy in range(0, int(BD) + 1, 2):
    out.append(f'<line x1="0" y1="{px(gy):.1f}" x2="{px(BW):.1f}" y2="{px(gy):.1f}" stroke="#e9eff1" stroke-width="0.6"/>')
for r in rooms:
    out.append(f'<rect x="{px(r["x0"])+1:.1f}" y="{py(r["y1"])+1:.1f}" width="{px(r["w"])-2:.1f}" height="{px(r["d"])-2:.1f}" fill="{COL.get(r["kind"],"#fff")}" stroke="#9aa7ad" stroke-width="1"/>')
FURN = {'bed', 'couch', 'dtable', 'desk', 'table', 'bench', 'platform', 'gate', 'scanner',
        'container', 'gurney', 'stand', 'videowall', 'cabinet', 'shelf', 'pump', 'fridge',
        'san', 'shower', 'lockers', 'capsule', 'chair', 'stool', 'locker', 'dispenser',
        'sink', 'iv', 'rail', 'slot', 'shield', 'dryer', 'console', 'estop', 'screen',
        'hook', 'bin', 'sensor', 'beam', 'pipe', 'vent', 'panel', 'anchor'}
for o in objects:
    if o['kind'] in ('light', 'machine'):
        continue
    if o['kind'] in FURN and o['mount'] != 'wall':
        out.append(f'<rect x="{px(o["x"]-o["w"]/2):.1f}" y="{py(o["y"]+o["d"]/2):.1f}" width="{px(o["w"]):.1f}" height="{px(o["d"]):.1f}" fill="none" stroke="#8e9aa0" stroke-width="0.8" stroke-dasharray="2,1.5"/>')
LIGHTS = [o for o in objects if o['kind'] == 'light']
for o in LIGHTS:
    out.append(f'<rect x="{px(o["x"]-o["w"]/2):.1f}" y="{py(o["y"]+o["d"]/2):.1f}" width="{px(o["w"]):.1f}" height="{px(o["d"]):.1f}" fill="#fff8d4" stroke="#e8dc9a" stroke-width="0.6"/>')
for o in [o for o in objects if o['kind'] == 'machine']:
    x, y = px(o['x'] - o['w'] / 2), py(o['y'] + o['d'] / 2)
    out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{px(o["w"]):.1f}" height="{px(o["d"]):.1f}" fill="#46565e" stroke="#22303a" stroke-width="0.8"/>')
    out.append(f'<text x="{x+px(o["w"])/2:.1f}" y="{y+px(o["d"])/2+3:.1f}" font-family="DejaVu Sans, sans-serif" font-size="8" font-weight="bold" fill="#ffffff" text-anchor="middle">{o["id"].split("_")[-1]}</text>')
for d in doors:
    r = rmap[d['room']]
    hw = d['width'] / 2
    if d['wall'] in ('north', 'south'):
        yw = r['y1'] - T / 2 if d['wall'] == 'north' else r['y0'] + T / 2
        out.append(f'<rect x="{px(d["at"]-hw):.1f}" y="{py(yw)-1.5:.1f}" width="{px(d["width"]):.1f}" height="3" fill="#ffffff"/>')
        if d['kind'] == 'door':
            out.append(f'<circle cx="{px(d["at"]-hw):.1f}" cy="{py(yw):.1f}" r="2.2" fill="#7f8b91"/>')
    else:
        xw = r['x1'] - T / 2 if d['wall'] == 'east' else r['x0'] + T / 2
        out.append(f'<rect x="{px(xw)-1.5:.1f}" y="{py(d["at"]+hw):.1f}" width="3" height="{px(d["width"]):.1f}" fill="#ffffff"/>')
        if d['kind'] == 'door':
            out.append(f'<circle cx="{px(xw):.1f}" cy="{py(d["at"]+hw):.1f}" r="2.2" fill="#7f8b91"/>')
for r in rooms:
    if r['kind'] in ('station', 'service', 'living', 'corridor', 'support', 'reserve'):
        fs = 6.5 if r['kind'] == 'station' else 8.5
        lbl = r['name'] if len(r['name']) < (14 if r['kind'] == 'station' else 24) else r['name'][:12] + '…'
        ty = py(r['y0']) - 6 if r['kind'] == 'corridor' else py(r['y1']) + 11
        out.append(f'<text x="{px(r["x0"])+4:.1f}" y="{ty:.1f}" font-family="DejaVu Sans, sans-serif" font-size="{fs}" fill="#33434a">{lbl}</text>')
    if r['station']:
        out.append(f'<text x="{px(r["x0"])+4:.1f}" y="{py(r["y1"])+19:.1f}" font-family="DejaVu Sans, sans-serif" font-size="7.5" font-weight="bold" fill="#245a55">{r["station"]}</text>')
out.append(f'<rect x="0" y="0" width="{px(BW):.1f}" height="{px(BD):.1f}" fill="none" stroke="#2b383e" stroke-width="3"/>')
out.append('</g>')
for i, (t, c) in enumerate([('Станок', '#46565e'), ('Мебель', '#ffffff'), ('Свет', '#fff8d4')]):
    out.append(f'<rect x="60" y="{Hh-58+i*17:.0f}" width="13" height="10" fill="{c}" stroke="#7d8b91"/>')
    out.append(f'<text x="79" y="{Hh-49+i*17:.0f}" font-family="DejaVu Sans, sans-serif" font-size="10.5" fill="#33434a">{t}</text>')
out.append(f'<text x="{W/2:.0f}" y="{Hh-22:.0f}" font-family="DejaVu Sans, sans-serif" font-size="12" fill="#33434a" text-anchor="middle">Лабораторный блок {BW:.1f} × {BD:.1f} м · комнат {len(rooms)} · объектов {len(objects)} · станций 24 · масштаб 1:100</text>')
out.append(f'<line x1="{W-260:.0f}" y1="{Hh-56:.0f}" x2="{W-60:.0f}" y2="{Hh-56:.0f}" stroke="#2b383e" stroke-width="2"/>')
out.append(f'<text x="{W-160:.0f}" y="{Hh-62:.0f}" font-family="DejaVu Sans, sans-serif" font-size="10.5" text-anchor="middle" fill="#33434a">5 м</text>')
out.append('</svg>')
with open(os.path.join(OUT, 'lab-floorplan.svg'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

# =========================================================================
# 7. Проверки
# =========================================================================
print(json.dumps(meta['counts'], ensure_ascii=False))
print('rooms by kind:', {k: sum(1 for r in rooms if r['kind'] == k) for k in sorted({r['kind'] for r in rooms})})
errs = []
for o in objects:
    r = rmap[o['room']]
    if o['kind'] in ('light', 'machine') or o['mount'] == 'wall':
        if not (r['x0'] - .21 <= o['x'] <= r['x1'] + .21 and r['y0'] - .21 <= o['y'] <= r['y1'] + .21):
            errs.append(('wall/ceiling outside', o['room'], o['id']))
        continue
    if o['x'] - o['w'] / 2 < r['x0'] - .01 or o['x'] + o['w'] / 2 > r['x1'] + .01 \
       or o['y'] - o['d'] / 2 < r['y0'] - .01 or o['y'] + o['d'] / 2 > r['y1'] + .01:
        errs.append(('outside', o['room'], o['id'], round(o['x'], 2), round(o['y'], 2)))
print('object placement errors:', len(errs))
for e in errs[:10]:
    print('  ', e)
# фронтальный проход станка
for o in [o for o in objects if o['kind'] == 'machine']:
    r = rmap[o['room']]
    if o['rot'] == 180:
        clear = r['x1'] - (o['x'] + o['w'] / 2)
    else:
        clear = (o['x'] - o['w'] / 2) - r['x0']
    if clear < 1.0:
        print('  ТЕСНЫЙ ФРОНТ', o['room'], round(clear, 2))
print('min front clearance:', round(min(
    (r['x1'] - (o['x'] + o['w'] / 2)) if o['rot'] == 180 else ((o['x'] - o['w'] / 2) - r['x0'])
    for o in objects if o['kind'] == 'machine' for r in [rmap[o['room']]]), 2))
