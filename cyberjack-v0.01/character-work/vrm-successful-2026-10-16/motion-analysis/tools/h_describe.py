"""Описание действия клипа: кто, кому, чем, куда, как и где.

Зачем: акт (`toy_play`, `masturbation`, `fingering`) слишком груб — в поиске все клипы
мастурбации схлопываются в один. Нужны оси:
  actor    — кто действует: self / partner / mutual
  receiver — на кого: self / partner
  means    — чем: hand, fingers, tongue, mouth, breast, foot, toy:<name>
  target   — куда: crotch, breast, butt, anus, mouth, glans, balls
  motion   — как: press, stroke, circle, knead, rub, insert, tease, piston, hold
  place    — где: standing, chair, desk, wall, floor, shower, toilet, net, pool, corner…
  phase    — фаза движения (из имени клипа)

Источники: имя клипа (ромадзи-токены слоя) + названия сцен, где слой проигрывается
(`layer-links.json`), потому что «себе или другому» определяется сценой, а не слоем.
"""

# --- чем воздействуют (токены имени клипа) ---
MEANS = {
    'denma': 'toy:vibrator', 'rotor': 'toy:rotor', 'vibe': 'toy:vibe', 'dildo': 'toy:dildo',
    'sita': 'tongue', 'yubi': 'fingers', 'te': 'hand', 'oral': 'mouth',
}
# --- куда (токены имени) ---
TARGET = {
    'kokan': 'crotch', 'anal': 'anus', 'siri': 'butt',
    'munel': 'breast', 'munem': 'breast', 'munes': 'breast', 'mune': 'breast',
}
# --- как (глаголы) ---
MOTION = {
    'ositukeru': 'press', 'nademawasu': 'stroke', 'namemawasu': 'stroke',
    'nameru': 'lick', 'momu': 'knead', 'kosuru': 'rub', 'kakimawasu': 'circle',
    'sawari': 'touch', 'hipparu': 'pull', 'ireru': 'insert', 'ijiru': 'tease',
    'tutuku': 'poke',
}

# --- кто/кому/чем по названию сцены (японские термины) ---
SCENE_ROLES = [
    ('オナニー', {'actor': 'self', 'receiver': 'self'}),
    ('覗き', {'actor': 'self', 'receiver': 'self', 'note': 'подглядывание'}),
    ('互い弄り', {'actor': 'mutual', 'receiver': 'mutual'}),
    ('具合わせ', {'actor': 'mutual', 'receiver': 'mutual'}),
    ('Wフェラ', {'actor': 'mutual', 'receiver': 'partner', 'means': 'mouth'}),
    ('クンニ', {'actor': 'partner', 'receiver': 'self', 'means': 'tongue', 'target': 'crotch'}),
    ('手マン', {'actor': 'partner', 'receiver': 'self', 'means': 'fingers', 'target': 'crotch'}),
    ('フェラ', {'actor': 'self', 'receiver': 'partner', 'means': 'mouth', 'target': 'glans'}),
    ('手コキ', {'actor': 'self', 'receiver': 'partner', 'means': 'hand', 'target': 'glans'}),
    ('足コキ', {'actor': 'self', 'receiver': 'partner', 'means': 'foot', 'target': 'glans'}),
    ('パイズリ', {'actor': 'self', 'receiver': 'partner', 'means': 'breast', 'target': 'glans'}),
    ('亀頭いじり', {'actor': 'self', 'receiver': 'partner', 'means': 'fingers', 'target': 'glans'}),
    ('玉舐め', {'actor': 'self', 'receiver': 'partner', 'means': 'tongue', 'target': 'balls'}),
    ('愛撫', {'actor': 'mutual', 'receiver': 'mutual'}),
]
# --- где (место из названия сцены) ---
PLACE = [
    ('シャワー', 'shower'), ('トイレ', 'toilet'), ('椅子', 'chair'), ('机', 'desk'),
    ('壁', 'wall'), ('床', 'floor'), ('ネット', 'net'), ('プール', 'pool'),
    ('角', 'corner'), ('本棚', 'shelf'), ('ソファ', 'sofa'), ('ベンチ', 'bench'),
    ('卓球台', 'table'), ('フェンス', 'fence'), ('箱', 'box'), ('バナナボート', 'float'),
    ('ビーチボール', 'float'), ('浮き輪', 'float'), ('立ち', 'standing'),
]

# --- фаза → характер движения ---
PHASE_MOTION = {
    'Idle': 'hold', 'Loop': 'loop', 'WLoop': 'loop_rhythmic', 'SLoop': 'loop_slow',
    'MLoop': 'loop_medium', 'OLoop': 'loop_oral', 'SLoop1': 'loop_slow', 'WLoop1': 'loop_rhythmic',
    'Insert': 'insert', 'InsertIdle': 'hold_inserted', 'OUT': 'withdraw',
    'Start': 'begin', 'Stop': 'stop', 'Drop': 'drop', 'Pull': 'pull_out',
}

RU_MEANS = {'hand': 'рукой', 'fingers': 'пальцами', 'tongue': 'языком', 'mouth': 'ртом',
            'breast': 'грудью', 'foot': 'стопой', 'toy:vibrator': 'вибратором',
            'toy:rotor': 'ротором', 'toy:vibe': 'вибромассажёром', 'toy:dildo': 'фаллоимитатором'}
RU_TARGET = {'crotch': 'по промежности', 'breast': 'по груди', 'butt': 'по ягодицам',
             'anus': 'по анусу', 'mouth': 'по рту', 'glans': 'по головке', 'balls': 'по яйцам'}
RU_MOTION = {'press': 'прижимая', 'stroke': 'поглаживая', 'lick': 'облизывая', 'knead': 'разминая',
             'rub': 'растирая', 'circle': 'круговыми движениями', 'touch': 'касаясь', 'pull': 'оттягивая',
             'insert': 'вводя', 'tease': 'дразня', 'poke': 'тыкая'}
RU_PLACE = {'shower': 'в душе', 'toilet': 'в туалете', 'chair': 'на стуле', 'desk': 'на столе',
            'wall': 'у стены', 'floor': 'на полу', 'net': 'на сетке', 'pool': 'в бассейне',
            'corner': 'в углу', 'shelf': 'у полки', 'sofa': 'на диване', 'bench': 'на скамье',
            'table': 'на столе для пинг-понга', 'fence': 'у ограды', 'box': 'в коробке',
            'float': 'на плавсредстве', 'standing': 'стоя'}
RU_ACTOR = {'self': 'сама', 'partner': 'партнёр', 'mutual': 'вместе'}
RU_ACT = {'vaginal': 'вагинальный акт', 'oral': 'орально', 'cunnilingus': 'куннилингус',
          'fingering': 'пальцами', 'handjob': 'рукой', 'paizuri': 'между грудей',
          'toy_play': 'с игрушкой', 'footjob': 'стопой', 'masturbation': 'мастурбация',
          'foreplay': 'ласки', 'mutual': 'взаимные ласки', 'double_fellatio': 'двойной минет',
          'peeping': 'подглядывание', 'suck_clean': 'облизывание после', 'climax': 'кульминация',
          'reaction_negative': 'негативная реакция', 'glans_play': 'игра с головкой',
          'ball_licking': 'облизывание яиц', 'self_touch': 'сама себя', 'breast_play': 'ласки груди',
          'butt_play': 'ласки ягодиц', 'genital_play': 'ласки гениталий'}
# сторона: B — сзади, F — спереди (последний токен имени)
SIDE_RU = {'b': 'со спины', 'f': 'спереди'}


def side_of(name):
    toks = [t.lower() for t in __import__('re').split(r'[_\s]+', name) if t]
    if not toks:
        return None
    return SIDE_RU.get(toks[-1])


def _digits_strip(token):
    import re
    return re.sub(r'\d+$', '', token.lower())


def from_name(name):
    """Чем/куда/как — из токенов имени клипа."""
    import re
    toks = [_digits_strip(t) for t in re.split(r'[_\s]+', name) if t]
    out = {}
    for t in toks:
        if t in MEANS and 'means' not in out:
            out['means'] = MEANS[t]
        if t in TARGET and 'target' not in out:
            out['target'] = TARGET[t]
        if t in MOTION and 'motion' not in out:
            out['motion'] = MOTION[t]
    return out


def from_scene(scene_name):
    """Кто/кому/чем/где — из названия сцены."""
    out = {}
    for key, roles in SCENE_ROLES:
        if key in (scene_name or ''):
            out.update({k: v for k, v in roles.items() if k != 'note'})
            if roles.get('note'):
                out['note'] = roles['note']
            break
    for key, place in PLACE:
        if key in (scene_name or ''):
            out['place'] = place
            break
    return out


def describe(name, scenes, phase=None, position=None, scene_acts=None):
    """Описание клипа.

    Слой, который проигрывается в одной сцене, описывается конкретно (кто, чем, где).
    Слой, общий для многих сцен (медиана — 134), не получает одного «где»: вместо этого
    перечисляются контексты и роли, иначе описание врёт (всеобщий цикл получал «на сетке»,
    просто потому что эта сцена была первой в списке).
    """
    base = from_name(name)
    scenes = [x for x in (scenes or []) if x]
    contexts = []
    for sc in scenes[:8]:
        roles = from_scene(sc)
        contexts.append({'scene': sc, **roles, **{k: v for k, v in base.items() if k not in roles}})
    actor_set = sorted({c['actor'] for c in contexts if c.get('actor')})
    place_set = sorted({c['place'] for c in contexts if c.get('place')})

    phase_motion = PHASE_MOTION.get(phase or '')
    single = len(scenes) == 1

    if single:
        primary = contexts[0]
        parts = []
        if primary.get('actor'):
            parts.append(RU_ACTOR.get(primary['actor'], primary['actor']))
        if primary.get('means'):
            parts.append(RU_MEANS.get(primary['means'], primary['means']))
        if primary.get('target'):
            parts.append(RU_TARGET.get(primary['target'], primary['target']))
        if primary.get('motion'):
            parts.append(RU_MOTION.get(primary['motion'], primary['motion']))
        if phase_motion:
            parts.append('движение: ' + phase_motion.replace('_', ' '))
        if primary.get('place'):
            parts.append(RU_PLACE.get(primary['place'], primary['place']))
        if position:
            parts.append('позиция: ' + position)
        if primary.get('note'):
            parts.append(primary['note'])
        if scenes:
            parts.append('сцена: ' + translate_scene(scenes[0]))
        text = ', '.join(parts)
        return {'actor': primary.get('actor'), 'receiver': primary.get('receiver'),
                'means': primary.get('means'), 'target': primary.get('target'),
                'motion': primary.get('motion'), 'place': primary.get('place'),
                'places': place_set, 'actVariants': scene_acts or [],
                'phaseMotion': phase_motion, 'contexts': contexts,
                'actorVariants': actor_set, 'placeVariants': place_set,
                'sceneCount': len(scenes), 'description': text or (phase_motion or ''), 'specific': True}

    # общий слой: описываем сам слой + диапазон контекстов
    parts = []
    if base.get('means'):
        parts.append(RU_MEANS.get(base['means'], base['means']))
    if base.get('target'):
        parts.append(RU_TARGET.get(base['target'], base['target']))
    if base.get('motion'):
        parts.append(RU_MOTION.get(base['motion'], base['motion']))
    if phase_motion:
        parts.append('движение: ' + phase_motion.replace('_', ' '))
    if actor_set:
        parts.append('роли: ' + '/'.join(RU_ACTOR.get(a, a) for a in actor_set))
    if scene_acts:
        parts.append('используется в: ' + ', '.join(RU_ACT.get(a, a) for a in scene_acts[:5]))
    if place_set:
        parts.append('места: ' + ', '.join(RU_PLACE.get(p, p) for p in place_set[:4]))
    # до 12 сцен перечисляем их по-русски: так поиск различает «мастурбация в душе» и «на стуле»;
    # для универсальных слоёв (десятки-сотни сцен) честно пишем, что слой общий
    if 0 < len(scenes) <= 12:
        parts.append('сцены: ' + ' / '.join(translate_scene(x) for x in scenes[:6]))
    else:
        parts.append(f'общий слой для {len(scenes)} сцен' if scenes else 'общий слой')
    text = ', '.join(parts)
    return {'actor': actor_set[0] if len(actor_set) == 1 else None,
            'receiver': None, 'means': base.get('means'), 'target': base.get('target'),
            'motion': base.get('motion'), 'place': place_set[0] if len(place_set) == 1 else None,
            'places': place_set,
            'phaseMotion': phase_motion, 'contexts': contexts,
            'actorVariants': actor_set, 'placeVariants': place_set, 'actVariants': scene_acts or [],
            'sceneCount': len(scenes), 'description': text, 'specific': False}


# --- перевод названий сцен на русский (композиционно) ---
SCENE_RU = [
    ('Wフェラ', 'двойной минет'), ('フェラ', 'минет'), ('クンニ', 'куннилингус'),
    ('手マン', 'пальцами'), ('手コキ', 'рукой'), ('足コキ', 'стопой'), ('パイズリ', 'между грудей'),
    ('亀頭いじり', 'игра с головкой'), ('玉舐め', 'облизывание яиц'), ('オナニー', 'мастурбация'),
    ('愛撫', 'ласки'), ('互い弄り', 'взаимные ласки'), ('具合わせ', 'трение гениталиями'),
    ('覗き', 'подглядывание'), ('正常位', 'миссионерская'), ('後背位', 'сзади'),
    ('騎乗位', 'наездница'), ('側位', 'на боку'), ('立位', 'стоя'), ('駅弁', 'на весу'),
    ('対面座位', 'сидя лицом к лицу'), ('背面座位', 'сидя спиной'), ('机寝位', 'лёжа на столе'),
    ('種付けプレス', 'прижим сверху'), ('杭打ちピストン', 'пистон сверху'),
    ('寝バック', 'лёжа на животе'), ('伏せ', 'лёжа'), ('正座', 'сэйза'), ('膝立て', 'на коленях'),
    ('手つなぎ', 'за руки'), ('腕引っ張り', 'с натягом рук'), ('膝抱え', 'держа колени'),
    ('腰抱え', 'держа за бёдра'), ('大股開き', 'широко раздвинув ноги'), ('開脚', 'раздвинув ноги'),
    ('マングリ', 'с поднятыми ногами'), ('ブリッジ', 'мостиком'), ('手付き', 'с опорой на руки'),
    ('押し付け', 'прижимаясь'), ('密着', 'вплотную'), ('お姫様抱っこ', 'на руках'),
    ('足抱え', 'держа ноги'), ('足掛け', 'зацепив ноги'), ('乳首', 'соски'), ('またがり', 'верхом'),
    ('対面片足上げ', 'лицом к лицу с поднятой ногой'), ('手つき背面', 'со спины с опорой на руки'),
    ('片足上げバック', 'сзади с поднятой ногой'), ('ちんぐり返し', 'ноги за голову'), ('ちんぐり', 'ноги за голову'),
    ('腕はさみ', 'зажав руками'), ('潜望鏡', 'перископ'), ('オナホ', 'мастурбатор'),
    ('四つん這い', 'на четвереньках'), ('仰向け', 'на спине'), ('入れ替え', 'с чередованием'),
    ('玉いじり', 'игра с яйцами'), ('いじり', 'игра'), ('責め', 'ласка'), ('掴まり', 'держась'),
    ('しゃがみ', 'на корточках'), ('いたずら', 'шалости'),
    ('先舐め', 'облизывание головки'), ('竿舐め', 'облизывание ствола'),
    ('バック', 'сзади'), ('背面', 'со спины'), ('舐め', 'облизывание'), ('咥え', 'и ртом'),
    ('座り', 'сидя'), ('対面', 'лицом к лицу'), ('片足上げ', 'с поднятой ногой'),
    ('両手', 'двумя руками'), ('片手', 'одной рукой'), ('両', 'обе'), ('片', 'одна'),
    ('先', 'кончик'), ('竿', 'ствол'), ('＋', ' и '), ('＆', ' и '), ('+', ' и '),
    ('ディルド', 'фаллоимитатор'), ('ローター', 'ротор'), ('ノーハンド', 'без рук'),
    ('両手', 'двумя руками'), ('片手', 'одной рукой'), ('先舐め', 'облизывание головки'),
    ('竿舐め', 'облизывание ствола'), ('キス', 'поцелуи'), ('椅子', 'на стуле'), ('机', 'на столе'),
    ('壁', 'у стены'), ('床', 'на полу'), ('シャワー', 'в душе'), ('トイレ', 'в туалете'),
    ('ネット', 'на сетке'), ('プール', 'в бассейне'), ('角', 'в углу'), ('本棚', 'у полки'),
    ('ソファ', 'на диване'), ('ベンチ', 'на скамье'), ('卓球台', 'на столе для пинг-понга'),
    ('フェンス', 'у ограды'), ('箱', 'в коробке'), ('バナナボート', 'на банане-лодке'),
    ('ビーチボール', 'на пляжном мяче'), ('浮き輪', 'на круге'), ('立ち', 'стоя'),
]


def translate_scene(scene_name):
    """Японское название сцены → русская фраза (или пустая строка)."""
    if not scene_name:
        return ''
    parts = []
    rest = scene_name
    for ja, ru in SCENE_RU:
        if ja in rest:
            parts.append(ru)
            rest = rest.replace(ja, '')
    text = ' '.join(parts)
    # падежи для игрушек и одиночных терминов
    text = text.replace('мастурбация фаллоимитатор', 'мастурбация с фаллоимитатором')
    text = text.replace('мастурбация ротор', 'мастурбация с ротором')
    text = text.replace('минет одной рукой', 'минет с помощью руки')
    import re as _re
    text = _re.sub(r'\s+', ' ', text).strip(' и').strip()
    return text
