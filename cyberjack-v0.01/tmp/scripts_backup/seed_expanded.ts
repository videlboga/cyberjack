import { db } from './src/infrastructure/db';

console.log("Очистка базы данных...");
db.exec('DELETE FROM character_relations; DELETE FROM scene_characters; DELETE FROM characters; DELETE FROM subjects; DELETE FROM subject_point_states; DELETE FROM players; DELETE FROM scenes; DELETE FROM action_presets; DELETE FROM point_presets; DELETE FROM context_presets; DELETE FROM active_contexts;');

const subjects = [
    {
        id: 'S-01',
        name: 'Синтетик (Нейтраль/Пластика)',
        state: { sensitivity: 50, capacity: 60, openness: 50, plasticity: 80, attitude: 50 }
    },
    {
        id: 'S-02',
        name: 'Синтетик (Импульсив/Гиперчувствительная)',
        state: { sensitivity: 70, capacity: 45, openness: 60, plasticity: 65, attitude: 40 }
    }
];

console.log("Создание субъектов...");
const insertSubjectStmt = db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const subject of subjects) {
    insertSubjectStmt.run(
        subject.id,
        subject.name,
        subject.state.sensitivity,
        subject.state.capacity,
        subject.state.openness,
        subject.state.plasticity,
        subject.state.attitude,
        subject.state.sensitivity,
        subject.state.capacity,
        subject.state.openness,
        subject.state.plasticity,
        subject.state.attitude
    );
}

console.log("Добавление точек применения (point_presets)...");

const points: any[] = [
    { id: 'head', label: 'Голова/Волосы', sens: 40, att: 55, providesFunctions: ['look', 'hear'] },
    { id: 'face', label: 'Лицо', sens: 50, att: 50 },
    { id: 'lips', label: 'Губы', sens: 75, att: 50, providesFunctions: ['speak', 'kiss', 'eat'] },
    { id: 'neck', label: 'Шея', sens: 70, att: 50 },
    { id: 'shoulders', label: 'Плечи', sens: 40, att: 55 },
    { id: 'back', label: 'Спина', sens: 45, att: 50, providesFunctions: ['stabilize_posture'] },
    { id: 'chest', label: 'Грудь', sens: 50, att: 50 },
    { id: 'nipples', label: 'Соски', sens: 65, att: 45 },
    { id: 'belly', label: 'Живот', sens: 50, att: 50 },
    { id: 'arms', label: 'Руки/Предплечья', sens: 35, att: 55, providesFunctions: ['reach', 'gesture'] },
    { id: 'wrists', label: 'Запястья', sens: 50, att: 50 },
    { id: 'hands', label: 'Ладони', sens: 60, att: 55, providesFunctions: ['touch', 'manipulate'] },
    { id: 'waist', label: 'Талия', sens: 60, att: 50 },
    { id: 'hips', label: 'Бедра (спереди)', sens: 45, att: 50 },
    { id: 'groin', label: 'Пах/Гениталии', sens: 75, att: 40 },
    { id: 'buttocks', label: 'Ягодицы', sens: 50, att: 45 },
    { id: 'inner_thighs', label: 'Внутр. бедра', sens: 65, att: 45 },
    { id: 'knees', label: 'Колени', sens: 35, att: 50, providesFunctions: ['kneel', 'stand', 'shift_posture'] },
    { id: 'calves', label: 'Икры', sens: 40, att: 50 },
    { id: 'feet', label: 'Ступни', sens: 65, att: 50, providesFunctions: ['stand', 'walk'] },
    { id: 'general', label: 'Общее воздействие', sens: 50, att: 50 },
    { id: 'slot_pose', label: 'Слот: Поза', sens: 50, att: 50 },
    { id: 'slot_room', label: 'Слот: Окружение (Комната)', sens: 50, att: 50 },
    { id: 'slot_social', label: 'Слот: Социальное', sens: 50, att: 50 }
];

const insertPointStmt = db.prepare('INSERT INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) VALUES (?, ?, ?, ?, ?, ?)');
const insertSubjectPointStmt = db.prepare('INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

for (const p of points) {
    insertPointStmt.run(
        p.id,
        p.label,
        JSON.stringify({ localSensitivity: p.sens, localAttitude: p.att }),
        (p as any).parentId || null,
        JSON.stringify((p as any).providesFunctions || []),
        JSON.stringify((p as any).tags || [])
    );
    for (const subject of subjects) {
        insertSubjectPointStmt.run(subject.id, p.id, p.sens, p.att, 0, 0, p.sens, p.att);
    }
}

console.log("Создание Игрока...");
db.prepare('INSERT INTO players (id, resources) VALUES (?, ?)').run('PL-1', JSON.stringify({
    credits: 10,
    authority: 5,
    timeBudget: 5
}));

console.log("Создание персонажей и отношений...");
const insertCharacterStmt = db.prepare(`
    INSERT INTO characters (id, name, kind, subject_id, player_id)
    VALUES (?, ?, ?, ?, ?)
`);
for (const subject of subjects) {
    insertCharacterStmt.run(subject.id, subject.name, 'subject', subject.id, null);
}
insertCharacterStmt.run('PL-1', 'Калибратор', 'player', null, 'PL-1');

const npcCharacters = [
    { id: 'OBS-01', name: 'Наблюдатель Continuum Archive' },
    { id: 'VEIL-01', name: 'Связной Veil' }
];
for (const npc of npcCharacters) {
    insertCharacterStmt.run(npc.id, npc.name, 'npc', null, null);
}

const relationStmt = db.prepare(`
    INSERT INTO character_relations (from_id, to_id, knows, present, can_interact, attitude)
    VALUES (?, ?, ?, ?, ?, ?)
`);
type RelationOptions = { knows?: boolean; present?: boolean; canInteract?: boolean; attitude?: number };
const addRelation = (fromId: string, toId: string, opts: RelationOptions = {}) => {
    relationStmt.run(
        fromId,
        toId,
        opts.knows === false ? 0 : 1,
        opts.present === false ? 0 : 1,
        opts.canInteract === false ? 0 : 1,
        opts.attitude ?? 50
    );
};

for (const subject of subjects) {
    addRelation(subject.id, 'PL-1', { attitude: subject.state.attitude });
    addRelation('PL-1', subject.id, { attitude: 55 });
}

addRelation('S-01', 'S-02', { present: false, canInteract: false, attitude: 45 });
addRelation('S-02', 'S-01', { present: false, canInteract: false, attitude: 40 });

const awarenessPairs: Array<[string, string, RelationOptions]> = [
    ['S-01', 'OBS-01', { present: false, canInteract: false, attitude: 35 }],
    ['OBS-01', 'S-01', { present: false, canInteract: false, attitude: 60 }],
    ['PL-1', 'OBS-01', { attitude: 60 }],
    ['OBS-01', 'PL-1', { attitude: 65 }],
    ['S-02', 'VEIL-01', { present: false, canInteract: false, attitude: 30 }],
    ['VEIL-01', 'S-02', { present: false, canInteract: false, attitude: 55 }],
    ['PL-1', 'VEIL-01', { attitude: 45 }],
    ['VEIL-01', 'PL-1', { attitude: 50 }]
];

for (const [fromId, toId, options] of awarenessPairs) {
    addRelation(fromId, toId, options);
}

console.log("Добавление действий (action_presets)...");


const actions = [
    // Ласки и мягкий контакт
    { id: 'gentle_stroke', label: 'Мягкое поглаживание', i: 0.2, v: 0.6, c: 0.4, s: 0.1, n: 0.2 },
    { id: 'tickle', label: 'Щекотка пальцами', i: 0.4, v: 0.2, c: 0.3, s: 0.4, n: 0.5 },
    { id: 'light_kiss', label: 'Легкий поцелуй', i: 0.2, v: 0.7, c: 0.5, s: 0.05, n: 0.4 },
    { id: 'deep_kiss', label: 'Страстный поцелуй', i: 0.6, v: 0.9, c: 0.8, s: 0.2, n: 0.6 },
    { id: 'feather_stroke', label: 'Проведение перышком', i: 0.1, v: 0.5, c: 0.1, s: 0.0, n: 0.7 },
    { id: 'deep_massage', label: 'Глубокий массаж', i: 0.6, v: 0.8, c: 0.9, s: 0.1, n: 0.3 },
    { id: 'licking', label: 'Облизывание языком', i: 0.3, v: 0.6, c: 0.5, s: 0.05, n: 0.6 },

    // Физическое давление и грубость (умеренно)
    { id: 'firm_grip', label: 'Жесткий захват', i: 0.7, v: -0.2, c: 0.8, s: 0.3, n: 0.4 },
    { id: 'light_bite', label: 'Легкий укус', i: 0.4, v: 0.4, c: 0.4, s: 0.6, n: 0.5 },
    { id: 'hard_bite', label: 'Сильный укус', i: 0.7, v: -0.5, c: 0.6, s: 0.8, n: 0.5 },
    { id: 'pinch', label: 'Щипок', i: 0.5, v: -0.4, c: 0.2, s: 0.8, n: 0.3 },
    { id: 'scratching', label: 'Царапанье ногтями', i: 0.4, v: -0.2, c: 0.3, s: 0.8, n: 0.4 },

    // Наказания и Боль (Hard)
    { id: 'slap', label: 'Легкий шлепок', i: 0.5, v: -0.3, c: 0.6, s: 0.7, n: 0.4 },
    { id: 'hard_slap', label: 'Сильный удар ладонью', i: 0.8, v: -0.6, c: 0.8, s: 0.8, n: 0.5 },
    { id: 'needle_prick', label: 'Укол иглой', i: 0.4, v: -0.7, c: 0.1, s: 1.0, n: 0.6 },
    { id: 'belt_strike', label: 'Удар ремнем', i: 0.7, v: -0.7, c: 0.5, s: 0.9, n: 0.6 },
    { id: 'whip_strike', label: 'Удар хлыстом', i: 0.9, v: -0.9, c: 0.3, s: 1.0, n: 0.5 },
    { id: 'taser_shock', label: 'Разряд электрошокера', i: 0.95, v: -0.95, c: 0.4, s: 0.95, n: 0.8 },

    // Инструменты / BDSM-практики (Точечные)
    { id: 'ice_cube', label: 'Прикладывание льда', i: 0.6, v: 0.1, c: 0.4, s: 0.6, n: 0.8 },
    { id: 'hot_wax', label: 'Капля горячего воска', i: 0.7, v: -0.1, c: 0.2, s: 0.8, n: 0.8 },
    { id: 'vibrator_pulse', label: 'Импульс вибратором', i: 0.6, v: 0.8, c: 0.7, s: 0.2, n: 0.7 },
    { id: 'hair_pull', label: 'Рывок за волосы', i: 0.6, v: -0.4, c: 0.5, s: 0.7, n: 0.4 },
    { id: 'spit', label: 'Плевок', i: 0.3, v: -0.8, c: 0.2, s: 0.8, n: 0.7 },
    { id: 'breath_blow', label: 'Обдувание дыханием', i: 0.1, v: 0.4, c: 0.05, s: 0.1, n: 0.5 },

    // Психологические и бесконтактные
    { id: 'verbal_pressure', label: 'Обычная беседа (скрытое)', i: 0.1, v: 0.0, c: 0.0, s: 0.0, n: 0.1 }, // Базовый пресет для чата
    { id: 'stare', label: 'Пристальный взгляд', i: 0.3, v: -0.1, c: 0.0, s: 0.1, n: 0.2 },
    { id: 'close_inspection', label: 'Относительно близкий осмотр', i: 0.4, v: -0.3, c: 0.0, s: 0.2, n: 0.4 },
    { id: 'feint_strike', label: 'Ложный замах', i: 0.7, v: -0.5, c: 0.0, s: 0.9, n: 0.5 }
];

const insertActionStmt = db.prepare('INSERT INTO action_presets (id, label, values_json) VALUES (?, ?, ?)');
for (const a of actions) {
    insertActionStmt.run(a.id, a.label, JSON.stringify({
        intensity: a.i, valence: a.v, contact: a.c, sharpness: a.s, novelty: a.n
    }));
}

console.log("Добавление контекстов (context_presets)...");
const contexts = [
    {
        id: 'pose_lying',
        point_id: 'slot_pose',
        slot: 'pose',
        exclusiveWithinSlot: true,
        label: 'Поза: Лёжа',
        selfApplicable: true,
        selfText: 'Ты сама опускаешься и ложишься на поверхность.',
        forcedText: 'Калибратор укладывает тебя лицом вверх, не оставляя выбора.',
        removalText: 'Он разрешает приподняться и сменить позу.',
        requiredFunctions: ['shift_posture'],
        m: { intensity: -0.1, valence: 0.1, contact: 0.1, novelty: -0.1 }
    },
    {
        id: 'pose_kneeling',
        point_id: 'slot_pose',
        slot: 'pose',
        exclusiveWithinSlot: true,
        label: 'Поза: Стоя на коленях',
        selfApplicable: true,
        selfText: 'Ты опускаешься на колени и замираешь.',
        forcedText: 'Калибратор прижимает тебя к полу и ставит на колени.',
        removalText: 'Он велит подняться с колен.',
        requiredFunctions: ['kneel', 'shift_posture'],
        m: { intensity: 0.2, valence: -0.2, sharpness: 0.1, novelty: 0.1 }
    },
    {
        id: 'pose_spread_eagle',
        point_id: 'slot_pose',
        slot: 'pose',
        exclusiveWithinSlot: true,
        label: 'Поза: Звездой (привязана)',
        selfApplicable: false,
        forcedText: 'Калибратор растягивает тебя звездой, фиксируя конечности.',
        removalText: 'Он освобождает ремни и даёт собраться.',
        requiredFunctions: ['shift_posture'],
        blockedFunctions: ['stand', 'kneel', 'walk', 'shift_posture', 'reach', 'touch'],
        m: { intensity: 0.4, valence: -0.3, sharpness: 0.2, novelty: 0.3 }
    },
    {
        id: 'bound_hands',
        point_id: 'hands',
        slot: 'restraint_arms',
        exclusiveWithinSlot: true,
        priority: 50,
        label: 'Связанные руки (за спиной)',
        selfApplicable: false,
        forcedText: 'Калибратор стягивает твои руки за спиной.',
        removalText: 'Он освобождает запястья.',
        blockedFunctions: ['manipulate', 'touch', 'reach', 'gesture'],
        m: { intensity: 0.3, valence: -0.2, sharpness: 0.2, novelty: 0.2 }
    },
    {
        id: 'bound_legs',
        point_id: 'knees',
        slot: 'restraint_legs',
        exclusiveWithinSlot: true,
        priority: 50,
        label: 'Связанные ноги',
        selfApplicable: false,
        forcedText: 'Калибратор связывает твои ноги, оставляя беспомощной.',
        removalText: 'Он снимает стяжки с ног.',
        blockedFunctions: ['stand', 'walk', 'kneel', 'shift_posture'],
        m: { intensity: 0.3, valence: -0.2, sharpness: 0.2, novelty: 0.2 }
    },
    {
        id: 'blindfold',
        point_id: 'head',
        slot: 'equipment_head',
        exclusiveWithinSlot: true,
        priority: 50,
        label: 'Завязанные глаза',
        selfApplicable: false,
        forcedText: 'Он закрывает тебе глаза, лишая опоры.',
        removalText: 'Он снимает повязку и возвращает зрение.',
        blockedFunctions: ['look'],
        m: { intensity: 0.5, valence: -0.2, sharpness: 0.3, novelty: 0.5 }
    }
];

const insertContextStmt = db.prepare('INSERT INTO context_presets (id, label, point_id, modifiers_json, type, slot, exclusive_within_slot, blocks_slots, affected_point_ids, blocked_functions, boosted_functions, required_functions, priority, self_applicable, self_text, forced_text, removal_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
for (const c of contexts) {
    insertContextStmt.run(
        c.id, 
        c.label, 
        c.point_id, 
        JSON.stringify((c as any).m), 
        (c as any).type || 'condition', 
        (c as any).slot || 'general', 
        (c as any).exclusiveWithinSlot ? 1 : 0, 
        JSON.stringify((c as any).blocksSlots || []), 
        JSON.stringify((c as any).affectedPointIds || []), 
        JSON.stringify((c as any).blockedFunctions || []), 
        JSON.stringify((c as any).boostedFunctions || []), 
        JSON.stringify((c as any).requiredFunctions || []), 
        (c as any).priority || 0,
        (c as any).selfApplicable ? 1 : 0,
        (c as any).selfText || null,
        (c as any).forcedText || null,
        (c as any).removalText || null
    );
}

console.log("Создание сцен...");
const baseSceneActions = JSON.stringify(actions.map(a => a.id));
const actionCosts = JSON.stringify({
    gentle_stroke: { credits: 1 },
    hard_slap: { authority: 1 },
    wait: { timeBudget: 1 }
});
const transitionsLab = JSON.stringify([
    { targetSceneId: 'lab_recovery', conditions: { requiresActionId: 'wait', minAttitude: 70 } },
    { targetSceneId: 'lab_discipline', conditions: { requiresActionId: 'hard_slap', maxAttitude: 35 } }
]);

db.prepare('INSERT INTO scenes (id, available_actions, action_costs, transitions) VALUES (?, ?, ?, ?)')
    .run('lab', baseSceneActions, actionCosts, transitionsLab);

db.prepare('INSERT INTO scenes (id, available_actions, action_costs, transitions) VALUES (?, ?, ?, ?)')
    .run('lab_recovery', JSON.stringify(['gentle_stroke', 'wait', 'verbal_pressure']), JSON.stringify({ wait: { timeBudget: 1 } }), JSON.stringify([{ targetSceneId: 'lab', conditions: { requiresActionId: 'wait', minAttitude: 60 } }]));

db.prepare('INSERT INTO scenes (id, available_actions, action_costs, transitions) VALUES (?, ?, ?, ?)')
    .run('lab_discipline', JSON.stringify(['hard_slap', 'firm_grip', 'wait']), JSON.stringify({ hard_slap: { authority: 1 }, wait: { timeBudget: 1 } }), JSON.stringify([{ targetSceneId: 'lab', conditions: { requiresActionId: 'wait', minAttitude: 45 } }]));

console.log("Распределение персонажей по сценам...");
const assignSceneStmt = db.prepare(`
    INSERT INTO scene_characters (scene_id, character_id, role, can_act, presence_state)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(scene_id, character_id) DO UPDATE SET
        role = excluded.role,
        can_act = excluded.can_act,
        presence_state = excluded.presence_state
`);
const updateLocationStmt = db.prepare('UPDATE characters SET current_scene_id = ? WHERE id = ?');

const placeCharacter = (sceneId: string, characterId: string, role = 'participant', canAct = true, presenceState = 'present') => {
    assignSceneStmt.run(sceneId, characterId, role, canAct ? 1 : 0, presenceState);
    updateLocationStmt.run(sceneId, characterId);
};

placeCharacter('lab', 'S-01', 'subject', true);
placeCharacter('lab', 'PL-1', 'calibrator', true);
placeCharacter('lab', 'OBS-01', 'observer', false);
placeCharacter('lab_recovery', 'S-02', 'subject', true);
placeCharacter('lab_recovery', 'VEIL-01', 'handler', false);

console.log("База данных успешно пересобрана!");
