import { db } from './src/infrastructure/db';

console.log("Очистка базы данных...");
db.exec('DELETE FROM subjects; DELETE FROM subject_point_states; DELETE FROM players; DELETE FROM scenes; DELETE FROM action_presets; DELETE FROM point_presets;');

console.log("Создание субъекта S-01...");
db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'Test Subject', 60, 50, 40, 50, 50);

console.log("Добавление точек применения (point_presets)...");
const points = [
    { id: 'head', label: 'Голова/Волосы', sens: 30, att: 70 },
    { id: 'face', label: 'Лицо', sens: 60, att: 40 },
    { id: 'lips', label: 'Губы', sens: 85, att: 20 },
    { id: 'neck', label: 'Шея', sens: 80, att: 30 },
    { id: 'shoulders', label: 'Плечи', sens: 30, att: 80 },
    { id: 'back', label: 'Спина', sens: 40, att: 60 },
    { id: 'chest', label: 'Грудь', sens: 60, att: 30 },
    { id: 'nipples', label: 'Соски', sens: 95, att: 10 },
    { id: 'belly', label: 'Живот', sens: 50, att: 40 },
    { id: 'arms', label: 'Руки/Предплечья', sens: 20, att: 90 },
    { id: 'wrists', label: 'Запястья', sens: 50, att: 50 },
    { id: 'hands', label: 'Ладони', sens: 70, att: 85 },
    { id: 'waist', label: 'Талия', sens: 65, att: 45 },
    { id: 'hips', label: 'Бедра (спереди)', sens: 40, att: 50 },
    { id: 'groin', label: 'Пах/Гениталии', sens: 100, att: 5 },
    { id: 'buttocks', label: 'Ягодицы', sens: 50, att: 15 },
    { id: 'inner_thighs', label: 'Внутр. бедра', sens: 85, att: 10 },
    { id: 'knees', label: 'Колени', sens: 20, att: 70 },
    { id: 'calves', label: 'Икры', sens: 30, att: 70 },
    { id: 'feet', label: 'Ступни', sens: 75, att: 50 }
];

const insertPointStmt = db.prepare('INSERT INTO point_presets (id, label, values_json) VALUES (?, ?, ?)');
const insertSubjectPointStmt = db.prepare('INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude) VALUES (?, ?, ?, ?)');

for (const p of points) {
    insertPointStmt.run(p.id, p.label, JSON.stringify({ localSensitivity: p.sens, localAttitude: p.att }));
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
    { id: 'stare', label: 'Пристальный взгляд', i: 0.3, v: -0.1, c: 0.0, s: 0.1, n: 0.2 },
    { id: 'close_inspection', label: 'Относительно близкий осмотр', i: 0.4, v: -0.3, c: 0.0, s: 0.2, n: 0.4 },
    { id: 'feint_strike', label: 'Ложный замах', i: 0.7, v: -0.5, c: 0.0, s: 0.9, n: 0.5 },
    { id: 'praise', label: 'Ласковая похвала', i: 0.4, v: 0.8, c: 0.0, s: 0.1, n: 0.3 },
    { id: 'humiliation', label: 'Унижение/Оскорбление', i: 0.7, v: -0.8, c: 0.0, s: 0.6, n: 0.6 },
    { id: 'shout', label: 'Резкий приказ', i: 0.8, v: -0.6, c: 0.0, s: 0.7, n: 0.5 }
];

const insertActionStmt = db.prepare('INSERT INTO action_presets (id, label, values_json) VALUES (?, ?, ?)');
for (const a of actions) {
    insertActionStmt.run(a.id, a.label, JSON.stringify({
        intensity: a.i, valence: a.v, contact: a.c, sharpness: a.s, novelty: a.n
    }));
}

console.log("Создание сцены...");
db.prepare('INSERT INTO scenes (id, available_actions) VALUES (?, ?)').run('lab', JSON.stringify(actions.map(a => a.id)));

console.log("База данных успешно пересобрана!");
