import fs from 'fs';

let content = fs.readFileSync('seed_expanded.ts', 'utf-8');

const newPoints = `const points = [
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
    
    // Слоты для контекстов:
    { id: 'slot_pose', label: 'Слот: Поза', sens: 50, att: 50 },
    { id: 'slot_room', label: 'Слот: Окружение (Комната)', sens: 50, att: 50 },
    { id: 'slot_social', label: 'Слот: Социальное', sens: 50, att: 50 }
];`;

const newContexts = `const contexts = [
    { id: 'pose_lying', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Лёжа', requiredFunctions: ['shift_posture'], m: { intensity: -0.1, valence: 0.1, contact: 0.1, novelty: -0.1 } },
    { id: 'pose_kneeling', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Стоя на коленях', requiredFunctions: ['kneel', 'shift_posture'], m: { intensity: 0.2, valence: -0.2, sharpness: 0.1, novelty: 0.1 } },
    { id: 'pose_spread_eagle', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Звездой (привязана)', requiredFunctions: ['shift_posture'], blockedFunctions: ['stand', 'kneel', 'walk', 'shift_posture', 'reach', 'touch'], m: { intensity: 0.4, valence: -0.3, sharpness: 0.2, novelty: 0.3 } },
    { id: 'bound_hands', point_id: 'hands', slot: 'restraint_arms', exclusiveWithinSlot: true, priority: 50, label: 'Связанные руки (за спиной)', blockedFunctions: ['manipulate', 'touch', 'reach', 'gesture'], m: { intensity: 0.3, valence: -0.2, sharpness: 0.2, novelty: 0.2 } },
    { id: 'bound_legs', point_id: 'knees', slot: 'restraint_legs', exclusiveWithinSlot: true, priority: 50, label: 'Связанные ноги', blockedFunctions: ['stand', 'walk', 'kneel', 'shift_posture'], m: { intensity: 0.3, valence: -0.2, sharpness: 0.2, novelty: 0.2 } },
    { id: 'blindfold', point_id: 'head', slot: 'equipment_head', exclusiveWithinSlot: true, priority: 50, label: 'Завязанные глаза', blockedFunctions: ['look'], m: { intensity: 0.5, valence: -0.2, sharpness: 0.3, novelty: 0.5 } }
];`;

content = content.replace(/const points = \[\s*\{ id: 'head'[\s\S]*?\} \s*\];/s, newPoints);
content = content.replace(/const contexts = \[\s+\{ id: 'pose_lying'[\s\S]*?\} \s+\];/s, newContexts);

fs.writeFileSync('seed_expanded.ts', content);
