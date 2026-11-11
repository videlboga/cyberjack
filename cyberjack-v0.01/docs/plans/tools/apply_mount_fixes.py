#!/usr/bin/env python3
"""Data-only mount fixes, batch 1 (mates layer).

Applies the corrections from
  docs/plans/checks/mounting-audit.json
  docs/plans/checks/nonmotion-mount-audit.md
to docs/plans/mates/*.json. Never touches GLBs, contracts or the viewer.

Idempotent: every entry is a field override, so a second run is a no-op.
Run order: this script -> assign_connectors.py -> merge_mate_points.py.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SHARDS = ROOT / "docs" / "plans" / "mates"

KINDS = {"bolt_pattern", "flange", "bayonet", "dock", "rail", "clamp",
         "surface", "hose", "cable", "pivot", "mount"}
ROLES = {"input", "output", "support", "mount", "fluid", "signal", "power"}

DELETE = object()

# ---------------------------------------------------------------- patches ---
# (component_id, mate_id) -> {field: value}; value DELETE removes the key.
PATCH = {
    # ===== motion_oscillating: реальный выход — плита ползуна 32x106 =====
    ("motion_oscillating", "tool_out"): {
        "kind": "clamp",
        "standard": "CJ-OSC-PLATE 32×106",
        "gender": "female",
        "position_m": [0.053, 0.139, 0.012],
        "normal": [0.0, 1.0, 0.0],
        "axis": [1.0, 0.0, 0.0],
        "size_m": 0.032,
        "confidence": "high",
        "source": ("node:motion_oscillating__crosshead bbox top face y=0.1390 "
                   "(плита 0.032 × 0.106 м, z -0.044…0.062); палец slider_pin Ø12 "
                   "выходит выше, до y=0.1755"),
        "note": ("инструмент крепится хомутом к плите ползуна (crosshead 32 × 106 мм, "
                 "верх y=0.139); в центре плиты проходит палец шатуна Ø12 "
                 "(slider_pin → rod_eye_small), ISO-фланец Ø50 на площадке 32 мм "
                 "физически не размещается. axis — ось хода ползуна X (stroke 0.04 м), "
                 "normal — вверх. Способ фиксации (хомут) — конструктивное решение, "
                 "а не элемент геометрии"),
    },

    # ===== motion_lift_z: выход на движущуюся плиту моста =====
    ("motion_lift_z", "tool_out"): {
        "kind": "clamp",
        "standard": "CJ-TOOL-PLATE 264×42",
        "gender": "female",
        "position_m": [0.0, 0.708, 0.103],
        "normal": [0.0, 1.0, 0.0],
        "axis": [0.0, 1.0, 0.0],
        "size_m": 0.042,
        "count": DELETE,
        "pitch_x_m": DELETE,
        "pitch_z_m": DELETE,
        "confidence": "high",
        "source": ("node:motion_lift_z__carriage_bridge bbox top face y=0.7080 "
                   "(x ±0.132, z 0.082…0.124); узел в movers — движется вместе с гайкой"),
        "note": ("выход переставлен со статичного top_flange (y 1.245…1.278, болты "
                 "flange_bolt_0..3 на поле 200 × 100 — неподвижная колонна) на "
                 "движущуюся плиту моста carriage_bridge 264 × 156 × 126 (y 0.552…0.708). "
                 "Свободная верхняя полоса 264 × 42 мм; 4 болта моста bridge_bolt_0..3 "
                 "стоят на задней грани z ≈ -0.127 (поле ≈ 236 × 104) и верхнюю "
                 "плоскость не занимают. Отверстий под инструмент нет — крепление "
                 "хомутом/струбциной. ISO 9409 в геометрии отсутствует"),
    },

    # ===== motion_linear_x: сплошная плита carriage_top, без отверстий =====
    ("motion_linear_x", "tool_out"): {
        "kind": "surface",
        "standard": "CJ-TOOL-PLATE 208×252",
        "gender": "female",
        "position_m": [0.0, 0.2, 0.0],
        "normal": [0.0, 1.0, 0.0],
        "axis": [0.0, 1.0, 0.0],
        "size_m": 0.208,
        "count": DELETE,
        "pitch_m": DELETE,
        "confidence": "high",
        "source": ("node:motion_linear_x__carriage_top bbox top face y=0.2000 "
                   "(0.208 × 0.252 м, толщина 0.024 м, сплошная плита)"),
        "note": ("верхняя плита каретки без отверстий, бобышек и бурта — инструмент "
                 "фиксируется хомутом/струбциной по контуру 208 × 252. "
                 "ISO 9409-1-50-4-M6 (Ø50, 4×M6 PCD 40) в геометрии отсутствует; "
                 "motor_flange (x=+0.505) — привод, не посадочное место. "
                 "normal/axis — ввод инструмента по +Y, ход каретки — X"),
    },

    # ===== motion_linear_y: быстросъёмная плита с кулачками =====
    ("motion_linear_y", "tool_out"): {
        "kind": "clamp",
        "standard": "CJ-TOOL-PLATE 150×150 (quick_plate 210×210)",
        "gender": "female",
        "position_m": [0.0, 0.198, -0.004],
        "normal": [0.0, 1.0, 0.0],
        "axis": [0.0, 1.0, 0.0],
        "size_m": 0.15,
        "count": DELETE,
        "pitch_m": DELETE,
        "confidence": "high",
        "source": ("node:motion_linear_y__tool_pad bbox top face y=0.1980 "
                   "(150 × 150 мм) на плите quick_plate 210 × 210 с quick_cam_L/R"),
        "note": ("быстросъёмная плита: площадка 150 × 150 на quick_plate 210 × 210, "
                 "зажим двумя кулачками quick_cam_L/R с рычагами quick_lever. "
                 "Болтовых отверстий и ISO-площадки нет. Ось хода Y (stroke 0.08 м)"),
    },

    # ===== motion_rotary: выход — 3-кулачковый патрон Ø43 =====
    ("motion_rotary", "tool_out"): {
        "kind": "clamp",
        "standard": "CJ-TOOL-CHUCK-43",
        "gender": "female",
        "position_m": [0.145, 0.15, 0.0],
        "normal": [1.0, 0.0, 0.0],
        "axis": [1.0, 0.0, 0.0],
        "size_m": 0.043,
        "count": 3,
        "pitch_m": DELETE,
        "confidence": "high",
        "source": ("nodes motion_rotary__chuck_body (Ø120, x 0.118…0.140), "
                   "chuck_bore (расточка Ø43), jaw_1..3 + jaw_*_step (до x=0.150)"),
        "note": ("реальный выход — трёхкулачковый патрон: расточка Ø43 (chuck_bore), "
                 "кулаки выходят до x=0.150, ось +X. ISO 9409-1-50-4-M6 не размещается: "
                 "патрон Ø120 перекрывает центр фланца. count — число кулаков"),
    },

    # ===== motion_turntable: диск Ø900 с 4 T-пазами =====
    ("motion_turntable", "tool_out"): {
        "kind": "surface",
        "standard": "CJ-TABLE-T900",
        "gender": "female",
        "position_m": [0.2121, 0.1447, 0.2121],
        "normal": [0.0, 1.0, 0.0],
        "axis": [0.0, 1.0, 0.0],
        "size_m": 0.9,
        "count": 4,
        "pitch_m": DELETE,
        "confidence": "high",
        "source": ("nodes motion_turntable__disc (Ø900, верх y=0.1445), disc_slots "
                   "(4 радиальных T-паза 210 × 12,5 на r=0.300, азимут 45°+90°k), "
                   "disc_boss Ø230 / disc_spigot Ø144 (до y=0.150), "
                   "disc_bolts 8 × Ø13,6 PCD 340"),
        "note": ("посадочное поле — сам диск: 4 радиальных T-паза на радиусе 300 мм "
                 "(первый на 45°), точка — центр первого паза. 8 болтов диска на "
                 "PCD 340 крепят диск к кольцу (внутренний стык, не инструмент). "
                 "Концентрично выступают буртик Ø230 и шпиндель Ø144; "
                 "ISO 9409 Ø50 геометрией не подтверждён. Вращение вокруг Y"),
    },

    # ===== поршни: вилка/палец, ось Z, count 1 =====
    ("motion_piston_rod", "tool_out"): {
        "kind": "pivot",
        "standard": "CJ-CLEVIS-8 (палец Ø7,6)",
        "gender": "female",
        "normal": [1.0, 0.0, 0.0],
        "axis": [0.0, 0.0, 1.0],
        "pin_axis": DELETE,
        "count": 1,
        "confidence": "high",
        "note": ("передний конец штока: вилка (щеки 0.239…0.250) + палец Ø7,6 по Z. "
                 "Контрактный flange ISO 9409-1-50-4-M6 в геометрии отсутствует; "
                 "насадка садится на палец или на быстросъёмную муфту rod_coupling"),
    },
    ("motion_piston_pneumatic", "tool_out"): {
        "kind": "pivot",
        "standard": "палец Ø6,4 (вне CJ-CLEVIS-8)",
        "gender": "female",
        "normal": [1.0, 0.0, 0.0],
        "axis": [0.0, 0.0, 1.0],
        "pin_axis": DELETE,
        "count": 1,
        "confidence": "high",
        "note": ("передний конец штока: вилка fork_body + палец Ø6,4 по Z. "
                 "Это подразмер CJ-CLEVIS-8 (Ø8): нужна переходная серьга, "
                 "иначе насадки с проушиной Ø8 не сядут"),
    },
    ("motion_piston_hydraulic", "tool_out"): {
        "kind": "pivot",
        "standard": "CJ-CLEVIS-8 (палец Ø8,8)",
        "gender": "female",
        "normal": [1.0, 0.0, 0.0],
        "axis": [0.0, 0.0, 1.0],
        "pin_axis": DELETE,
        "count": 1,
        "confidence": "high",
        "note": ("передний конец штока: вилка rod_clevis_l/r + web, палец Ø8,8 по Z; "
                 "резьба rod_thread перед вилкой. Контрактный ISO 9409 не подтверждён"),
    },
    ("motion_piston_telescopic", "tool_out"): {
        "kind": "pivot",
        "standard": "CJ-CLEVIS-8 (палец Ø7,5)",
        "gender": "female",
        "normal": [1.0, 0.0, 0.0],
        "axis": [0.0, 0.0, 1.0],
        "pin_axis": DELETE,
        "count": 1,
        "confidence": "high",
        "note": ("передний конец последней ступени: вилка + палец Ø7,5 по Z, "
                 "крайняя точка x=0.200; 3 ступени, ход 0…0.250 м. "
                 "Контрактный ISO 9409 не подтверждён"),
    },
    ("motion_piston_cam", "tool_out"): {
        "kind": "flange",
        "standard": "фланец Ø50 + площадка Ø30, 4×Ø6 PCD 34",
        "gender": "female",
        "position_m": [0.268, 0.158, 0.03],
        "normal": [1.0, 0.0, 0.0],
        "axis": [1.0, 0.0, 0.0],
        "size_m": 0.05,
        "count": 4,
        "pitch_m": 0.034,
        "confidence": "high",
        "source": ("nodes motion_piston_cam__tool_flange (Ø50, x 0.250…0.264), "
                   "tool_face (Ø30, x 0.264…0.268), tool_bolts (4 × Ø6 на r=0.017)"),
        "note": ("торец толкателя по +X: фланец Ø50 с площадкой Ø30 и 4 болтами Ø6 "
                 "на PCD 34. Это не ISO 9409-1-50-4-M6 (там PCD 40, 4×M6): "
                 "болтовое поле меньше, крепёж Ø6. Ход follower_rod 0.06 м по X"),
    },
    ("motion_piston_servo", "tool_out"): {
        "kind": "pivot",
        "standard": "CJ-CLEVIS-8 (палец Ø8,4)",
        "gender": "female",
        "normal": [1.0, 0.0, 0.0],
        "axis": [0.0, 0.0, 1.0],
        "pin_axis": DELETE,
        "count": 1,
        "confidence": "high",
        "note": ("передний конец штока: вилка 0.278…0.300 + палец Ø8,4 по Z, "
                 "крайняя точка x=0.300; перед вилкой быстросъёмная муфта "
                 "rod_coupling Ø44 с контргайкой. Контрактный ISO 9409 не подтверждён"),
    },

    # ===== зонды: фактический вход вместо ложного байонета 20/25 =====
    ("work_probe_linear", "tool_in"): {
        "kind": "clamp",
        "standard": "быстросъёмная муфта Ø42 + цанга Ø35",
        "gender": "female",
        "axis": [0.0, 0.0, 1.0],
        "normal": [0.0, 0.0, -1.0],
        "size_m": 0.042,
        "confidence": "high",
        "note": ("вход — стальная быстросъёмная муфта Ø42 с накаткой и рычагом "
                 "release_lever, далее разрезная цанга Ø35 (collet). Паспортного "
                 "байонета 20/25 мм в геометрии нет. Ввод по +Z, ось зонда Z"),
        "mounts_on": ["CJ-TOOL-B40 (переходная втулка Ø42→Ø40)", "CJ-TOOL-ISO50 (ADP-ISO50-B40)"],
        "tool_function": ("линейный зонд: осевое нажатие/пальпация 0…120 мм по +Z, "
                          "сменный наконечник Ø13,6; насадка привода, не самостоятельная машина"),
    },
    ("work_probe_rotary", "tool_in"): {
        "kind": "dock",
        "standard": "ротационный док Ø58, 4 усика до Ø66,8, 2 паза",
        "gender": "female",
        "axis": [1.0, 0.0, 0.0],
        "normal": [-1.0, 0.0, 0.0],
        "size_m": 0.058,
        "count": 4,
        "confidence": "high",
        "note": ("вход — док-фланец Ø58 с 4 усиками (до Ø66,8) и 2 пазами под штифты, "
                 "сзади dock_body/dock_ring. Паспортного байонета 20/25 мм нет; "
                 "ввод по +X, ось вращения X"),
        "mounts_on": ["CJ-TOOL-D90 (кольцо D58→D90)", "work_rotary_drum (D-серия)"],
        "tool_function": ("ротационный зонд: вращение оболочки Ø51,8 с 5 рёбрами и "
                          "4 спиралями вокруг оси X; насадка привода, не самостоятельная машина"),
    },
    ("work_probe_inflatable", "tool_in"): {
        "kind": "bayonet",
        "standard": "байонетное гнездо Ø54, 2 усика до Ø65,5, обойма Ø59",
        "gender": "female",
        "axis": [0.0, 1.0, 0.0],
        "normal": [0.0, -1.0, 0.0],
        "size_m": 0.054,
        "count": 2,
        "confidence": "high",
        "note": ("вход снизу (-Y): гнездо socket Ø52 с буртиком Ø54,4, два байонетных "
                 "усика до Ø65,5 на кольце collar Ø59 с рычагом release_lever. "
                 "Усики реальные, размер — не паспортные 20/25 мм; B50 требует "
                 "пересборки обоймы (Ø59 → Ø50)"),
        "mounts_on": ["CJ-TOOL-B50 (пересборка обоймы Ø59→Ø50)"],
        "tool_function": ("надувной зонд 0…0,4 бар через обратный клапан safety_valve, "
                          "датчик давления; насадка привода, не самостоятельная машина"),
    },
    ("work_probe_thermal", "tool_in"): {
        "kind": "bayonet",
        "standard": "байонетная плита Ø38, 2 уха до Ø51,6, кольцо Ø32,4",
        "gender": "female",
        "axis": [0.0, 1.0, 0.0],
        "normal": [0.0, -1.0, 0.0],
        "size_m": 0.0516,
        "count": 2,
        "confidence": "high",
        "note": ("вход снизу (-Y): плита base_plate Ø38 с буртиком, байонетное кольцо "
                 "Ø32,4 и два уха до Ø51,6 по ±X с рычагом release_lever. "
                 "Паспортного байонета 20/25 мм нет; B40 требует пересборки кольца"),
        "mounts_on": ["CJ-TOOL-B40 (пересборка кольца Ø38→Ø40)"],
        "tool_function": ("термозонд: нагревательная гильза Ø9,4 + датчик на кончике "
                          "(y=0.1775), питание 230 В; насадка привода, не самостоятельная машина"),
    },
    ("work_probe_textured", "tool_in"): {
        "kind": "clamp",
        "standard": "QR-обойма Ø48 с фиксатором и штифтом",
        "gender": "female",
        "axis": [1.0, 0.0, 0.0],
        "normal": [-1.0, 0.0, 0.0],
        "size_m": 0.048,
        "confidence": "high",
        "note": ("вход (-X): быстросъёмная обойма qr_collar Ø48 с кольцевым пазом "
                 "qr_groove, фиксатором qr_latch и антипроворотным штифтом qr_pin, "
                 "далее фланец Ø28. Байонетных усиков нет; ввод по +X"),
        "mounts_on": ["CJ-TOOL-B50"],
        "tool_function": ("текстурированный зонд: силиконовый чулок Ø48,4 с 5 рёбрами "
                          "и 4 спиралями; насадка привода, не самостоятельная машина"),
    },

    # ===== переходник: гнездо Ø20 / Ø25, буртик Ø30, шестигранник 24 =====
    ("work_attach_adapter", "flange_in"): {
        "kind": "clamp",
        "standard": "гнездо Ø20 H8 + разрезная цанга, буртик Ø30",
        "gender": "female",
        "position_m": [-0.02, 0.0152, 0.0],
        "normal": [-1.0, 0.0, 0.0],
        "axis": [1.0, 0.0, 0.0],
        "size_m": 0.02,
        "confidence": "high",
        "note": ("задний торец x=-0.020: гнездо Ø20 под хвостовик привода, разрезная "
                 "цанга cang_rear, кольцо oring_rear; корпус Ø30 (буртик) и "
                 "шестигранник 24 под ключ (hex_nut 27,5 по вершинам). "
                 "Фланца ISO 9409-1-50-4-M6 (Ø50, 4×M6) в геометрии нет"),
        "mounts_on": ["CJ-TOOL-ISO50 (через ADP-ISO50-B25)", "CJ-TOOL-B25 (втулка Ø20→Ø25)"],
        "tool_function": ("переходник привода на насадку: гнездо Ø20 → посадка Ø25, "
                          "сквозной канал Ø8,4, уплотнения с двух сторон"),
    },
    ("work_attach_adapter", "tool_out"): {
        "kind": "clamp",
        "standard": "посадка Ø25 H8 + разрезная цанга, канал Ø8,4",
        "gender": "female",
        "position_m": [0.02, 0.0152, 0.0],
        "normal": [1.0, 0.0, 0.0],
        "axis": [1.0, 0.0, 0.0],
        "size_m": 0.025,
        "confidence": "high",
        "note": ("передний торец x=+0.020: посадка Ø25 под насадку, разрезная цанга "
                 "cang_front, oring_front, канал Ø8,4. Паспортный ряд 20/25/30 мм "
                 "подтверждён только по Ø25"),
    },
    ("work_attach_adapter", "index_pin"): {
        "standard": "штифт Ø1,6 против проворота",
        "note": ("единственный элемент фиксации углового положения (index_pin Ø1,6 "
                 "на наружной поверхности, y=0.0296); сигнального разъёма M8 3-pin "
                 "(контракт signal.retention_fb) в геометрии нет"),
    },

    # ==================== P0 non-motion ====================
    ("structure_cage", "mount_in"): {
        "pitch_x_m": 1.164,
        "pitch_z_m": 1.164,
        "note": ("4 лапы foot_1..4 (68 × 68 мм, подошвы foot_*_pad 86 × 86) в "
                 "x=±0.5821, z=±0.5821 → межцентровой 1.164 × 1.164. "
                 "Прежние 1.2323 × 0.068 — внешний габарит лап и ошибка на порядок "
                 "(шаблон уходил с лап). Контракт по-прежнему заявляет поле 0.6 м (P2)"),
    },
    ("structure_cage", "inner_rail"): {
        "position_m": [0.6163, 1.355, 0.0],
        "axis": [0.0, 0.0, 1.0],
        "normal": [0.0, 1.0, 0.0],
        "note": ("беговая поверхность кольцевого рельса — верх y=1.355 (inner_rail "
                 "y 1.335…1.355). Кольцо r=0.6163 лежит в плоскости XZ, касательная "
                 "в точке (0.6163, y, 0) равна (0,0,1) — ось качения по кольцу, "
                 "а не по нормали: axis=(0,1,0) означал «врезание» каретки в рельс"),
    },
    ("structure_cage", "dome_seat"): {
        "position_m": [0.66, 1.97, 0.0],
        "normal": [0.0, 1.0, 0.0],
        "axis": [0.0, 1.0, 0.0],
        "note": ("точка перенесена с центра кольца (там 639 мм пустоты и стеклянный "
                 "купол glass_dome y 1.935…2.046) на тело аннулуса ring_top "
                 "(r 0.58…0.70, верх 1.970). Посадочное кольцо купола: диаметр "
                 "1.32 м, один контур"),
    },
    ("structure_gantry", "mount_in"): {
        "pitch_x_m": 2.72,
        "pitch_z_m": 1.72,
        "note": ("4 анкерные плиты anchor_plate_mm/mp/pm/pp 280 × 280 с центрами "
                 "x=±1.36, z=±0.86 → 2.72 × 1.72. Прежние 3.0 × 2.0 — габарит плит, "
                 "углы шаблона лежали в 549 мм от металла"),
    },
    ("restraint_matrix", "level_feet"): {
        "position_m": [-0.93, 0.012, -0.44],
        "count": 4,
        "pitch_x_m": 1.86,
        "pitch_z_m": 0.88,
        "note": ("винтовые опоры стоят подошвами foot_pad_fl/fr/rl/rr в "
                 "x=±0.93, z=±0.44 (pitch 1.86 × 0.88), верх подошвы y=0.012. "
                 "Точка — на первой подошве; прежняя (0,0,0) была в центре поля, "
                 "971 мм до ближайшей опоры"),
    },
    ("surface_cooled", "grommet_bed"): {
        "position_m": [0.0, 0.0367, -0.417],
        "note": ("точка на кромке мата: люверсы grommets идут по периметру "
                 "(x ±0.8936, z -0.4175…0.4315, верх 0.0367), в центре полотна "
                 "люверса нет — прежняя точка была в 958 мм от ближайшего"),
    },

    # ==================== P1: pitch полей ====================
    ("structure_base", "mount_in"): {
        "pitch_x_m": 1.195,
        "pitch_z_m": 0.755,
        "note": ("4 подошвы foot_pad_00.. с центрами x=±0.5975, z=±0.3775 → "
                 "1.195 × 0.755 (контракт совпадает). Прежние 1.275 × 0.835 — "
                 "внешний габарит подошв"),
    },
    ("structure_portal", "mount_in"): {
        "pitch_x_m": 0.981,
        "pitch_z_m": 0.245,
        "note": ("анкерные болты anchor_bolts_m12 в x=±0.4905, z=±0.1225 → "
                 "0.981 × 0.245 (лапы foot_m/foot_p x=±0.5225 — внешний габарит). "
                 "Прежние 1.2 × 0.32 — габарит лап, углы шаблона в 526 мм от металла"),
    },
    ("structure_bed_frame", "mount_in"): {
        "pitch_x_m": 1.91,
        "pitch_z_m": 0.81,
        "note": ("4 анкерные стойки foot_anchor_fl/fr/rl/rr в x=±0.955, z=±0.405 → "
                 "1.91 × 0.81. Прежние 1.9256 × 0.8258 — внешний габарит стоек"),
    },
    ("structure_suspension_frame", "mount_in"): {
        "pitch_x_m": 1.96,
        "note": ("центры плит anchor_plate_m/p: x -1.065…-0.895 (центр -0.98) и "
                 "+0.895…+1.065 (центр +0.98) → pitch_x 1.96; верх y=0.62 в точке "
                 "верный. Прежние 2.085 — внешний габарит плит"),
    },
    ("structure_dock", "mount_in"): {
        "pitch_x_m": 0.516,
        "pitch_z_m": 0.516,
        "note": ("4 болта bolt_1..4 с шайбами (Ø32) в x=±0.258, z=±0.258 → "
                 "0.516 × 0.516. Прежние 0.548 ставили углы шаблона на кромку шайбы"),
    },
    ("control_telemetry", "mount_in"): {
        "pitch_x_m": 0.256,
        "pitch_z_m": 0.14,
        "pitch_m": DELETE,
        "note": ("4 винта back_screws кластерами x=±0.128, y=0.030/0.170, z=-0.0292 → "
                 "0.256 × 0.14. Прежний pitch_m 0.256 подставлялся в обе оси"),
    },
    ("utility_routing", "mount_in"): {
        "count": 3,
        "pitch_m": 0.42,
        "pitch_kind": "bracket_spacing",
        "note": ("3 кронштейна bracket_*_1..3 в x=-0.42 / 0 / +0.42, в каждом 2 болта "
                 "(bracket_bolts_N слиты в один mesh, поле 43 × 73 мм). pitch_m 0.42 — "
                 "шаг кронштейнов, а не болтов; болтовый шаг внутри кронштейна "
                 "геометрией не читается"),
    },
    ("sensory_light", "mount_in"): {
        "confidence": "low",
        "note": ("плита ceiling_plate 100 × 100 сплошная; винты plate_screws слиты в "
                 "один mesh (bbox 66 × 53 мм), отдельных отверстий и бобышек нет — "
                 "3 × M4 и шаблон 57,6 мм правдоподобны, но недоказуемы"),
    },

    # ==================== P1: позиции ====================
    ("structure_cage", "door_frame"): {
        "position_m": [-0.33, 1.007, 0.664],
        "note": ("точка на стойке петель (тело рамки x 0…±0.342, z 0.620…0.664); "
                 "в центре проёма дверного полотна материала нет — прежняя точка "
                 "была в 342 мм от ближайшей стойки"),
    },
    ("structure_cage", "lift_eyes"): {
        "position_m": [-0.5623, 2.042, -0.5623],
        "count": 4,
        "pitch_x_m": 1.164,
        "pitch_z_m": 1.164,
        "note": ("4 рым-болта: кольца lift_1..4_ring в x=±0.5623, z=±0.5623 (площадки "
                 "lift_*_plate x/z ±0.5128…±0.6514), центр кольца y=2.042. "
                 "Точка — на первом кольце; прежняя была в центре поля, 153 мм до "
                 "ближайшей площадки"),
    },
    ("structure_gantry", "rail_x_pos"): {
        "position_m": [0.0, 2.527, 0.86],
        "note": ("беговая поверхность рельса rail_x_m: y 2.472…2.527 (накладка "
                 "rail_x_wear_m до 2.531). Прежняя y=2.4995 — середина профиля, "
                 "на 27 мм ниже рабочей грани"),
    },
    ("structure_gantry", "rail_x_neg"): {
        "position_m": [0.0, 2.527, -0.86],
        "note": ("зеркальный рельс rail_x_p: беговая поверхность y=2.527 "
                 "(накладка rail_x_wear_p до 2.531); прежняя точка была в середине профиля"),
    },
    ("structure_gantry", "rail_y"): {
        "position_m": [0.308, 2.1745, 0.0],
        "note": ("рабочая грань рельса rail_y_m: x 0.296…0.308; прежняя x=0.302 — "
                 "середина 12-мм профиля"),
    },
    ("support_cradle", "cradle_left"): {
        "position_m": [-0.29, 0.668, 0.0],
        "note": ("ложе: подкладка pad_lining_left при x=-0.29 имеет верх 0.668 "
                 "(bbox 0.660…0.691 по кривой). Прежняя y=0.66 — низ подкладки, "
                 "по ней же лежит saddle_plate 0.640…0.676"),
    },
    ("support_cradle", "cradle_right"): {
        "position_m": [0.29, 0.668, 0.0],
        "note": ("зеркальное ложе: верх подкладки pad_lining_right при x=+0.29 — "
                 "y=0.668; прежняя точка лежала на низу подкладки"),
    },
    ("restraint_neck_yoke", "side_pad_left"): {
        "position_m": [-0.0966, 0.0202, 0.0104],
        "note": ("рабочая поверхность подушки pad_left в сечении |y-0.0202|<8 мм, "
                 "|z-0.0104|<8 мм: x -0.1115…-0.0966. Прежняя x=-0.0746 (bbox max) "
                 "лежала в полости шеи, в 22 мм от подушки"),
    },
    ("restraint_neck_yoke", "side_pad_right"): {
        "position_m": [0.0966, 0.0202, 0.0104],
        "note": ("зеркальная подушка pad_right: рабочая поверхность x=+0.0966 "
                 "(bbox 0.0746…0.1118); прежняя точка была на внутренней грани bbox"),
    },
    ("restraint_neck_yoke", "neck_surface"): {
        "position_m": [0.0, 0.024, 0.0669],
        "note": ("поверхность подушки pad_back при |x|<0.03: z 0.0669…0.0809. "
                 "Прежняя z=0.0544 (bbox min) — в 12,5 мм от материала"),
    },
    ("structure_base", "rail_in_left"): {
        "position_m": [-0.155, 0.2298, 0.165],
        "note": ("верх рельса mount_rail_left y=0.2298 (паз mount_slot 0.2262…0.2298). "
                 "Прежняя y=0.228 лежала на 1,8 мм внутри рельса. Номинал T-slot 15 "
                 "ответной части в каталоге не имеет (P2)"),
    },
    ("structure_base", "rail_in_right"): {
        "position_m": [-0.155, 0.2298, -0.165],
        "note": ("верх рельса mount_rail_right y=0.2298; прежняя точка была внутри профиля"),
    },
    ("structure_bed_frame", "mount_out"): {
        "position_m": [-0.0003, 0.3025, 0.2],
        "note": ("точка на слайне палубы deck_slat_neg (z 0.185…0.215, верх y=0.3025). "
                 "При z=0 между слайнами щель 30 мм — материала нет (прежняя точка "
                 "была в 10,5 мм от металла)"),
    },
    ("restraint_head_frame", "occiput_surface"): {
        "position_m": [0.045, 0.098, 0.063],
        "note": ("тело подушки pad_occiput в обход центрального отверстия: при "
                 "|x|<0.03 треугольников нет; z 0.063…0.1015, точка на передней "
                 "грани (нормаль -Z). Прежняя (0, 0.098, 0.06304) была в отверстии"),
    },
    ("restraint_head_frame", "brow_surface"): {
        "position_m": [0.03, 0.133, -0.0587],
        "note": ("тело подушки pad_brow в обход центрального отверстия (|x|<0.03): "
                 "z -0.0875…-0.0587, точка на грани +Z. Прежняя была в отверстии, "
                 "11,3 мм до материала"),
    },
    ("structure_stall_row", "mount_in"): {
        "kind": "surface",
        "standard": "плита-цоколь 6800 × 891, подошвы pod_shoes",
        "count": 7,
        "pitch_x_m": 0.9714,
        "pitch_z_m": DELETE,
        "confidence": "high",
        "note": ("ряд стоит на цоколе plinth_core 6800 × 891 (y 0…0.072) и подошвах "
                 "pod_shoes 6746 × 1000; болтовых узлов bolt/foot/anchor в GLB нет. "
                 "7 подов pod_frame_00..06 с шагом 0.9714 м — это шаг подов, "
                 "а не болтовое поле; прежние «4 × M12, pitch 0.86» были фикцией"),
    },

    # ==================== P1: сторона / нормаль / kind ====================
    ("support_cradle", "cable_in"): {
        "normal": [0.0, -1.0, 0.0],
        "confidence": "medium",
        "note": ("гермоввод grommet_left смотрит -Y (нормаль ближайшей грани -Y), "
                 "точка в 5 мм от него; прежняя нормаль +Y была направлена в тело "
                 "на 180° от грани. Точка по-прежнему в 5 мм — ввод не смоделирован "
                 "как отверстие"),
    },
    ("control_interlock", "mount_in"): {
        "position_m": [0.0, 0.0365, -0.0755],
        "standard": "DIN 35 TS35 (паспорт panel 4×Ø, pitch 0.1)",
        "note": ("DIN-рейка din_rail z -0.0755…-0.0672: точка на наружной грани "
                 "-0.0755 (прежняя -0.0713 — середина толщины). kind rail верен; "
                 "в контракте порт объявлен panel — расхождение (P2)"),
    },
    ("utility_air", "mount_in"): {
        "standard": "док-плита 4×Ø (паспорт wall, pitch 0.3)",
        "note": ("док-плита dock_plate с 4 отверстиями; в контракте порт объявлен "
                 "wall — править контракт (P2), kind dock в данных верен"),
    },
    ("utility_water", "mount_in"): {
        "kind": "dock",
        "standard": "док-плита 4×Ø (паспорт wall, pitch 0.3)",
        "count": DELETE,
        "pitch_m": DELETE,
        "note": ("док-плита dock_plate 135 × 52 мм: болтовых бобышек нет, "
                 "единственный босс — inlet_boss. kind dock как у utility_air; "
                 "count/pitch сняты (были фиктивными)"),
    },
    ("structure_dock", "dock_out_pins"): {
        "standard": "2 × Ø23 pin + 2 × Ø32 pad (ответ: 4 × Ø10 × 42.5)",
        "count": 2,
        "pitch_x_m": 0.3,
        "note": ("в геометрии два пальца pin_a/pin_b Ø22,9 (x=±0.15, z=+0.13, "
                 "y 0.036…0.088) и две подушки pad_1/pad_2 Ø32 (z=-0.14). "
                 "Ответная часть service_dock объявляет locating_pins 4 × Ø10 × 42.5 — "
                 "пара не закрывается без переделки одной из сторон; номинал "
                 "оставлен по геометрии, расхождение зафиксировано"),
    },
}

# ------------------------------------------------------------ add / remove --
ADD = {
    "motion_lift_z": [
        {
            "id": "tool_boss_out",
            "role": "output",
            "kind": "flange",
            "standard": "CJ-TOOL-BOSS-60",
            "gender": "female",
            "position_m": [0.0, 0.63, 0.146],
            "normal": [0.0, 0.0, 1.0],
            "axis": [0.0, 0.0, 1.0],
            "size_m": 0.06,
            "load_n": 11.772,
            "source": ("node:motion_lift_z__carriage_bridge bbox front face z=0.1460 "
                       "(бобышка tool_boss Ø60 в составе моста, x/y центр 0 / 0.630)"),
            "confidence": "medium",
            "note": ("бобышка Ø60 на передней грани моста — альтернативная посадка "
                     "инструмента с центрированием по +Z (в GLB слита с мостом, "
                     "координата из build_motion_lift_z.py: cyl tool_boss Ø30 R)"),
        },
    ],
    "motion_rotary": [
        {
            "id": "flange_out",
            "role": "output",
            "kind": "flange",
            "standard": "фланец Ø144, 6 × Ø8,8 PCD 116",
            "gender": "female",
            "position_m": [0.112, 0.15, 0.0],
            "normal": [1.0, 0.0, 0.0],
            "axis": [1.0, 0.0, 0.0],
            "size_m": 0.144,
            "count": 6,
            "pitch_m": 0.116,
            "load_n": 11.772,
            "source": ("node:motion_rotary__output_flange front face x=0.112 (Ø144) + "
                       "flange_bolt_0..5 (PCD ≈116)"),
            "confidence": "high",
            "note": ("альтернативная посадка: фланец Ø144 с 6 болтами на PCD 116. "
                     "Инструмент с осевым хвостовиком садится в патрон Ø43, "
                     "кольцевой фланец — на эти болты"),
        },
    ],
}

REMOVE = {
    ("motion_rotary", "tool_chuck"),
}


def main() -> int:
    shard_files = sorted(p for p in SHARDS.glob("*.json") if p.is_file())
    docs = {}
    index = {}
    for path in shard_files:
        doc = json.loads(path.read_text(encoding="utf-8"))
        docs[path] = doc
        for cid, entry in doc.get("components", {}).items():
            index[cid] = (path, entry)

    changed = 0
    missing = []
    errors = []

    for path, doc in docs.items():
        dirty = False
        for cid, entry in doc.get("components", {}).items():
            mates = entry.get("mates") or []
            new_mates = []
            for m in mates:
                key = (cid, m.get("id"))
                if key in REMOVE:
                    dirty = True
                    continue
                patch = PATCH.get(key)
                if patch:
                    for field, value in patch.items():
                        if value is DELETE:
                            if field in m:
                                m.pop(field)
                                dirty = True
                        elif m.get(field) != value:
                            m[field] = value
                            dirty = True
                new_mates.append(m)
            for extra in ADD.get(cid, []):
                if any(x.get("id") == extra["id"] for x in new_mates):
                    continue
                new_mates.append(json.loads(json.dumps(extra)))
                dirty = True
            if new_mates and new_mates != mates:
                entry["mates"] = new_mates
            elif new_mates:
                entry["mates"] = new_mates
            # duplicate id guard
            ids = [x.get("id") for x in new_mates]
            if len(ids) != len(set(ids)):
                errors.append(f"{cid}: duplicate mate ids {ids}")
        if dirty:
            path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
            changed += 1

    # every patch must have landed on an existing mate
    for cid, mid in PATCH:
        if cid not in index:
            missing.append(f"{cid}/{mid}: component not found")
            continue
        entry = index[cid][1]
        if not any(m.get("id") == mid for m in entry.get("mates", [])):
            missing.append(f"{cid}/{mid}: mate not found")

    # schema sanity after the edit
    for cid, (_, entry) in index.items():
        for m in entry.get("mates", []):
            if m.get("kind") not in KINDS:
                errors.append(f"{cid}/{m.get('id')}: bad kind {m.get('kind')!r}")
            if m.get("role") not in ROLES:
                errors.append(f"{cid}/{m.get('id')}: bad role {m.get('role')!r}")
            if m.get("confidence") not in {"high", "medium", "low"}:
                errors.append(f"{cid}/{m.get('id')}: bad confidence")
            if not m.get("source"):
                errors.append(f"{cid}/{m.get('id')}: missing source")
            if len(m.get("position_m") or []) != 3:
                errors.append(f"{cid}/{m.get('id')}: bad position_m")
            for key in ("normal", "axis"):
                if key in m and len(m[key]) != 3:
                    errors.append(f"{cid}/{m.get('id')}: bad {key}")

    print(json.dumps({
        "shards_written": changed,
        "patched_points": len(PATCH),
        "added": sum(len(v) for v in ADD.values()),
        "removed": len(REMOVE),
        "missing": missing,
        "errors": errors[:20],
        "error_count": len(errors),
    }, ensure_ascii=False, indent=1))
    return 1 if (errors or missing) else 0


if __name__ == "__main__":
    sys.exit(main())
