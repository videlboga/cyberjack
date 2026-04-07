import { db } from './db.js'; // Убедитесь, что импорт корректен для вашей сборки

console.log("Начинаем безопасное заполнение базы данных (без удаления существующих данных)...");

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

const insertSubjectStmt = db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name
`);

db.transaction(() => {
    console.log("Обновление субъектов...");
    for (const subject of subjects) {
        insertSubjectStmt.run(
            subject.id, subject.name, 
            subject.state.sensitivity, subject.state.capacity, subject.state.openness, subject.state.plasticity, subject.state.attitude,
            subject.state.sensitivity, subject.state.capacity, subject.state.openness, subject.state.plasticity, subject.state.attitude
        );
    }
})();

const points = [
    { id: 'global_pose', label: 'Общая поза тела (виртуальная)', sens: 0, att: 50 },
    { id: 'mind_state', label: 'Состояние разума (виртуальная)', sens: 0, att: 50 },
    { id: 'head', label: 'Голова/Волосы', sens: 30, att: 70, providesFunctions: ['look', 'hear'] },
    { id: 'face', label: 'Лицо', sens: 60, att: 40 },
    { id: 'lips', label: 'Губы', sens: 85, att: 20, providesFunctions: ['speak', 'kiss', 'eat'] },
    { id: 'neck', label: 'Шея', sens: 80, att: 30 },
    { id: 'shoulders', label: 'Плечи', sens: 30, att: 80 },
    { id: 'back', label: 'Спина', sens: 40, att: 60, providesFunctions: ['stabilize_posture'] },
    { id: 'chest', label: 'Грудь', sens: 60, att: 30 },
    { id: 'nipples', label: 'Соски', sens: 95, att: 10 },
    { id: 'belly', label: 'Живот', sens: 50, att: 40 },
    { id: 'arms', label: 'Руки/Предплечья', sens: 20, att: 90, providesFunctions: ['reach', 'gesture'] },
    { id: 'wrists', label: 'Запястья', sens: 50, att: 50 },
    { id: 'hands', label: 'Ладони', sens: 70, att: 85, providesFunctions: ['touch', 'manipulate'] },
    { id: 'waist', label: 'Талия', sens: 65, att: 45 },
    { id: 'hips', label: 'Бедра (спереди)', sens: 40, att: 50 },
    { id: 'groin', label: 'Пах/Гениталии', sens: 100, att: 5 },
    { id: 'buttocks', label: 'Ягодицы', sens: 50, att: 15 },
    { id: 'inner_thighs', label: 'Внутр. бедра', sens: 85, att: 10 },
    { id: 'knees', label: 'Колени', sens: 20, att: 70, providesFunctions: ['kneel', 'stand', 'shift_posture'] },
    { id: 'calves', label: 'Икры', sens: 30, att: 70 },
    { id: 'feet', label: 'Ступни', sens: 75, att: 50, providesFunctions: ['stand', 'walk'] },
    { id: 'general', label: 'Общее воздействие', sens: 50, att: 50 },
    { id: 'slot_pose', label: 'Слот: Поза', sens: 50, att: 50 },
    { id: 'slot_room', label: 'Слот: Окружение (Комната)', sens: 50, att: 50 },
    { id: 'slot_social', label: 'Слот: Социальное', sens: 50, att: 50 }
];

const insertPointStmt = db.prepare(`
    INSERT INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
        label = excluded.label, values_json = excluded.values_json, provides_functions = excluded.provides_functions
`);

const insertSubjectPointStmt = db.prepare(`
    INSERT OR IGNORE INTO subject_point_states 
    (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
    console.log("Обновление точек (points) и связей...");
    for (const p of points) {
        insertPointStmt.run(
            p.id, p.label, JSON.stringify({ localSensitivity: p.sens, localAttitude: p.att }),
            (p as any).parentId || null, JSON.stringify((p as any).providesFunctions || []), JSON.stringify((p as any).tags || [])
        );
        for (const subject of subjects) {
            insertSubjectPointStmt.run(subject.id, p.id, p.sens, p.att, 0, 0, p.sens, p.att);
        }
    }
})();

// Добавляем остальные данные (Игрок, Сцены, Actions) только если их нет.
db.prepare('INSERT OR IGNORE INTO players (id, resources) VALUES (?, ?)').run('PL-1', JSON.stringify({ credits: 10, authority: 5, timeBudget: 5 }));

console.log("База данных успешно обновлена без потери прогресса!");

console.log("Добавление действий (actions)...");
const actions = [
    { id: 'gentle_stroke', label: 'Мягкое поглаживание', i: 0.2, v: 0.6, c: 0.4, s: 0.1, n: 0.2 },
    { id: 'tickle', label: 'Щекотка пальцами', i: 0.4, v: 0.2, c: 0.3, s: 0.4, n: 0.5 },
    { id: 'light_kiss', label: 'Легкий поцелуй', i: 0.2, v: 0.7, c: 0.5, s: 0.05, n: 0.4 },
    { id: 'deep_kiss', label: 'Страстный поцелуй', i: 0.6, v: 0.9, c: 0.8, s: 0.2, n: 0.6 },
    { id: 'feather_stroke', label: 'Проведение перышком', i: 0.1, v: 0.5, c: 0.1, s: 0.0, n: 0.7 },
    { id: 'deep_massage', label: 'Глубокий массаж', i: 0.6, v: 0.8, c: 0.9, s: 0.1, n: 0.3 },
    { id: 'licking', label: 'Облизывание языком', i: 0.3, v: 0.6, c: 0.5, s: 0.05, n: 0.6 },
    { id: 'firm_grip', label: 'Жесткий захват', i: 0.7, v: -0.2, c: 0.8, s: 0.3, n: 0.4 },
    { id: 'light_bite', label: 'Легкий укус', i: 0.4, v: 0.4, c: 0.4, s: 0.6, n: 0.5 },
    { id: 'hard_bite', label: 'Сильный укус', i: 0.7, v: -0.5, c: 0.6, s: 0.8, n: 0.5 },
    { id: 'pinch', label: 'Щипок', i: 0.5, v: -0.4, c: 0.2, s: 0.8, n: 0.3 },
    { id: 'scratching', label: 'Царапанье ногтями', i: 0.4, v: -0.2, c: 0.3, s: 0.8, n: 0.4 },
    { id: 'slap', label: 'Легкий шлепок', i: 0.5, v: -0.3, c: 0.6, s: 0.7, n: 0.4 },
    { id: 'hard_slap', label: 'Сильный удар ладонью', i: 0.8, v: -0.6, c: 0.8, s: 0.8, n: 0.5 },
    { id: 'needle_prick', label: 'Укол иглой', i: 0.4, v: -0.7, c: 0.1, s: 1.0, n: 0.6 },
    { id: 'belt_strike', label: 'Удар ремнем', i: 0.7, v: -0.7, c: 0.5, s: 0.9, n: 0.6 },
    { id: 'whip_strike', label: 'Удар хлыстом', i: 0.9, v: -0.9, c: 0.3, s: 1.0, n: 0.5 },
    { id: 'taser_shock', label: 'Разряд электрошокера', i: 0.95, v: -0.95, c: 0.4, s: 0.95, n: 0.8 },
    { id: 'ice_cube', label: 'Прикладывание льда', i: 0.6, v: 0.1, c: 0.4, s: 0.6, n: 0.8 },
    { id: 'hot_wax', label: 'Капля горячего воска', i: 0.7, v: -0.1, c: 0.2, s: 0.8, n: 0.8 },
    { id: 'vibrator_pulse', label: 'Импульс вибратором', i: 0.6, v: 0.8, c: 0.7, s: 0.2, n: 0.7 },
    { id: 'hair_pull', label: 'Рывок за волосы', i: 0.6, v: -0.4, c: 0.5, s: 0.7, n: 0.4 },
    { id: 'spit', label: 'Плевок', i: 0.3, v: -0.8, c: 0.2, s: 0.8, n: 0.7 },
    { id: 'breath_blow', label: 'Обдувание дыханием', i: 0.1, v: 0.4, c: 0.05, s: 0.1, n: 0.5 },
    { id: 'verbal_pressure', label: 'Обычная беседа (скрытое)', i: 0.1, v: 0.0, c: 0.0, s: 0.0, n: 0.1 },
    { id: 'stare', label: 'Пристальный взгляд', i: 0.3, v: -0.1, c: 0.0, s: 0.1, n: 0.2 },
    { id: 'close_inspection', label: 'Относительно близкий осмотр', i: 0.4, v: -0.3, c: 0.0, s: 0.2, n: 0.4 },
    { id: 'feint_strike', label: 'Ложный замах', i: 0.7, v: -0.5, c: 0.0, s: 0.9, n: 0.5 },
    { id: 'pose_lying', label: 'Поза: Лёжа', i: -0.1, v: 0.1, c: 0.1, s: 0, n: -0.1, cc: { type: 'pose', occupiesPoints: ['global_pose'], exclusiveWithinPoint: true, requiredFunctions: ['shift_posture'] } },
    { id: 'pose_kneeling', label: 'Поза: Стоя на коленях', i: 0.2, v: -0.2, c: 0, s: 0.1, n: 0.1, cc: { type: 'pose', occupiesPoints: ['global_pose'], exclusiveWithinPoint: true, requiredFunctions: ['kneel', 'shift_posture'] } },
    { id: 'pose_spread_eagle', label: 'Поза: Звездой (привязана)', i: 0.4, v: -0.3, c: 0, s: 0.2, n: 0.3, cc: { type: 'pose', occupiesPoints: ['global_pose'], exclusiveWithinPoint: true, requiredFunctions: ['shift_posture'], blockedFunctions: ['stand', 'kneel', 'walk', 'shift_posture', 'reach', 'touch'] } },
    { id: 'bound_hands', label: 'Связанные руки (за спиной)', i: 0.3, v: -0.2, c: 0, s: 0.2, n: 0.2, cc: { type: 'restraint', occupiesPoints: ['hands', 'arms'], exclusiveWithinPoint: true, priority: 50, blockedFunctions: ['manipulate', 'touch', 'reach', 'gesture'] } },
    { id: 'bound_legs', label: 'Связанные ноги', i: 0.3, v: -0.2, c: 0, s: 0.2, n: 0.2, cc: { type: 'restraint', occupiesPoints: ['knees', 'feet', 'calves'], exclusiveWithinPoint: true, priority: 50, blockedFunctions: ['stand', 'walk', 'kneel', 'shift_posture'] } },
    { id: 'blindfold', label: 'Завязанные глаза', i: 0.5, v: -0.2, c: 0, s: 0.3, n: 0.5, cc: { type: 'equipment', occupiesPoints: ['eyes_virtual'], exclusiveWithinPoint: true, priority: 50, blockedFunctions: ['look'] } }
];

const insertActionStmt = db.prepare('INSERT INTO action_presets (id, label, values_json, context_config_json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, values_json = excluded.values_json, context_config_json = excluded.context_config_json');
db.transaction(() => {
    for (const a of actions) {
        insertActionStmt.run(a.id, a.label, JSON.stringify({ intensity: a.i, valence: a.v, contact: a.c || 0, sharpness: a.s || 0, novelty: a.n || 0 }), a.cc ? JSON.stringify(a.cc) : null);
    }
})();

console.log("Добавление сцен и персонажей...");
const baseSceneActions = JSON.stringify(actions.map(a => a.id));
db.prepare('INSERT OR IGNORE INTO scenes (id, available_actions, action_costs, transitions) VALUES (?, ?, ?, ?)').run('lab', baseSceneActions, JSON.stringify({ gentle_stroke: { credits: 1 }, hard_slap: { authority: 1 }, wait: { timeBudget: 1 } }), JSON.stringify([{ targetSceneId: 'lab_recovery', conditions: { requiresActionId: 'wait', minAttitude: 70 } }, { targetSceneId: 'lab_discipline', conditions: { requiresActionId: 'hard_slap', maxAttitude: 35 } }]));

console.log("Добавочные данные успешно загружены!");

console.log("Создание персонажей и отношений...");

const subjectsArr = [
    { id: 'S-01', name: 'Синтетик (Нейтраль/Пластика)', attitude: 50 },
    { id: 'S-02', name: 'Синтетик (Импульсив/Гиперчувствительная)', attitude: 40 }
];

const insertCharacterStmt = db.prepare('INSERT INTO characters (id, name, kind, subject_id, player_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind');

db.transaction(() => {
    for (const subject of subjectsArr) {
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
})();

console.log("Настройка отношений...");
const relationStmt = db.prepare(`
    INSERT INTO character_relations (from_id, to_id, knows, present, can_interact, attitude, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(from_id, to_id) DO UPDATE SET 
        knows = excluded.knows, present = excluded.present, can_interact = excluded.can_interact, attitude = excluded.attitude
`);

type RelationOptions = { knows?: boolean; present?: boolean; canInteract?: boolean; attitude?: number };

const addRelation = (fromId: string, toId: string, opts: RelationOptions = {}) => {
    relationStmt.run(
        fromId,
        toId,
        opts.knows === false ? 0 : 1,
        opts.present === false ? 0 : 1,
        opts.canInteract === false ? 0 : 1,
        opts.attitude ?? 50,
        opts.attitude ?? 50
    );
};

db.transaction(() => {
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
})();

console.log("Распределение персонажей по сценам...");
const assignSceneStmt = db.prepare(`
    INSERT INTO scene_characters (scene_id, character_id, role, can_act, presence_state)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(scene_id, character_id) DO UPDATE SET
        role = excluded.role, can_act = excluded.can_act, presence_state = excluded.presence_state
`);

const updateLocationStmt = db.prepare('UPDATE characters SET current_scene_id = ? WHERE id = ?');

const placeCharacter = (sceneId: string, characterId: string, role = 'participant', canAct = true, presenceState = 'present') => {
    assignSceneStmt.run(sceneId, characterId, role, canAct ? 1 : 0, presenceState);
    updateLocationStmt.run(sceneId, characterId);
};

db.transaction(() => {
    placeCharacter('lab', 'S-01', 'subject', true);
    placeCharacter('lab', 'PL-1', 'calibrator', true);
    placeCharacter('lab', 'OBS-01', 'observer', false);
})();

console.log("Персонажи и отношения успешно обновлены!");
