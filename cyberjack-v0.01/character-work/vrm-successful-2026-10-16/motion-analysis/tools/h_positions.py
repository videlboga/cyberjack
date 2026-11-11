"""Нормализация японских названий сцен в позиции и позы.

Общий модуль: используется и при разборе названий сцен (`scene-act-map.py`),
и при разметке слоёв (`build-h-layer.py`), чтобы таблицы не расходились.
"""

# позиция — от частного к общему
POSITION = [
    ('マングリ正常位', 'missionary_legs_up'), ('膝抱え正常位', 'missionary_knees_held'),
    ('大股開き正常位', 'missionary_wide'), ('腰抱え正常位', 'missionary_waist_held'),
    ('ブリッジ正常位', 'missionary_bridge'), ('開脚正常位', 'missionary_spread'),
    ('正常位', 'missionary'),
    ('腕引っ張り後背位', 'doggy_arms_pulled'), ('寝バック', 'prone_doggy'), ('伏せ後背位', 'prone_doggy'),
    ('立ちバック', 'standing_doggy'), ('後背位', 'doggy'),
    ('背面騎乗位', 'reverse_cowgirl'), ('騎乗位', 'cowgirl'),
    ('背面側位', 'spooning'), ('側位', 'spooning'),
    ('駅弁', 'standing_carry'), ('立位', 'standing'),
    ('対面座位', 'face_to_face_seated'), ('背面座位', 'rear_seated'),
    ('種付けプレス', 'breeding_press'), ('机寝位', 'desk_lying'),
    ('杭打ちピストン', 'cowgirl'),
    ('椅子バック', 'doggy'), ('椅子対面', 'face_to_face_seated'), ('椅子背面', 'rear_seated'),
    ('机バック', 'doggy'), ('壁バック', 'doggy'), ('机側位', 'spooning'),
    ('椅子座り愛撫', 'seated'), ('座り愛撫', 'seated'), ('机しゃがみ愛撫', 'crouching'),
    ('立ち愛撫', 'standing'), ('壁対面片足上げ', 'standing'),
    ('椅子クンニ', 'seated'), ('椅子フェラ', 'seated'),
]

POSITION_TO_POSTURE = {
    'missionary': 'lying', 'missionary_spread': 'lying', 'missionary_legs_up': 'lying',
    'missionary_knees_held': 'lying', 'missionary_wide': 'lying', 'missionary_waist_held': 'lying',
    'missionary_bridge': 'lying', 'breeding_press': 'lying', 'desk_lying': 'lying',
    'doggy': 'kneeling', 'doggy_arms_pulled': 'kneeling',
    'prone_doggy': 'lying', 'spooning': 'lying',
    'cowgirl': 'seated', 'reverse_cowgirl': 'seated',
    'rear_seated': 'seated', 'face_to_face_seated': 'seated', 'seated': 'seated',
    'standing': 'standing', 'standing_doggy': 'standing', 'standing_carry': 'standing',
    'crouching': 'crouching',
}


def position_of(scene_name):
    """Японское название сцены → нормализованная позиция (или None)."""
    for key, value in POSITION:
        if key in (scene_name or ''):
            return value
    return None
