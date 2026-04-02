import { db } from './src/infrastructure/db';

console.log("Очистка базы данных...");
db.exec('DELETE FROM subjects; DELETE FROM subject_point_states; DELETE FROM players; DELETE FROM scenes; DELETE FROM action_presets; DELETE FROM point_presets; DELETE FROM context_presets; DELETE FROM active_contexts;');

console.log("Создание субъекта S-01...");
db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'Синтетик (Нейтраль/Пластика)', 50, 60, 50, 80, 50);console.log("Добавление точек применения (point_presets)...");

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
const insertSubjectPointStmt = db.prepare('INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude) VALUES (?, ?, ?, ?)');

for (const p of points) {
    insertPointStmt.run(p.id, p.label, JSON.stringify({ localSensitivity: p.sens, localAttitude: p.att }), (p as any).parentId || null, JSON.stringify((p as any).providesFunctions || []), JSON.stringify((p as any).tags || []));
    insertSubjectPointStmt.run('S-01', p.id, p.sens, p.att);
}

console.log("Создание Игрока...");
db.prepare('INSERT INTO players (id, resources) VALUES (?, ?)').run('PL-1', JSON.stringify({}));

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
    { id: 'pose_lying', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Лёжа', requiredFunctions: ['shift_posture'], m: { intensity: -0.1, valence: 0.1, contact: 0.1, novelty: -0.1 } },
    { id: 'pose_kneeling', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Стоя на коленях', requiredFunctions: ['kneel', 'shift_posture'], m: { intensity: 0.2, valence: -0.2, sharpness: 0.1, novelty: 0.1 } },
    { id: 'pose_spread_eagle', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Звездой (привязана)', requiredFunctions: ['shift_posture'], blockedFunctions: ['stand', 'kneel', 'walk', 'shift_posture', 'reach', 'touch'], m: { intensity: 0.4, valence: -0.3, sharpness: 0.2, novelty: 0.3 } },
    { id: 'bound_hands', point_id: 'hands', slot: 'restraint_arms', exclusiveWithinSlot: true, priority: 50, label: 'Связанные руки (за спиной)', blockedFunctions: ['manipulate', 'touch', 'reach', 'gesture'], m: { intensity: 0.3, valence: -0.2, sharpness: 0.2, novelty: 0.2 } },
    { id: 'bound_legs', point_id: 'knees', slot: 'restraint_legs', exclusiveWithinSlot: true, priority: 50, label: 'Связанные ноги', blockedFunctions: ['stand', 'walk', 'kneel', 'shift_posture'], m: { intensity: 0.3, valence: -0.2, sharpness: 0.2, novelty: 0.2 } },
    { id: 'blindfold', point_id: 'head', slot: 'equipment_head', exclusiveWithinSlot: true, priority: 50, label: 'Завязанные глаза', blockedFunctions: ['look'], m: { intensity: 0.5, valence: -0.2, sharpness: 0.3, novelty: 0.5 } }
];

const insertContextStmt = db.prepare('INSERT INTO context_presets (id, label, point_id, modifiers_json, type, slot, exclusive_within_slot, blocks_slots, affected_point_ids, blocked_functions, boosted_functions, required_functions, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
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
        (c as any).priority || 0
    );
}

console.log("Создание сцены...");
db.prepare('INSERT INTO scenes (id, available_actions) VALUES (?, ?)').run('lab', JSON.stringify(actions.map(a => a.id)));

console.log("База данных успешно пересобрана!");
