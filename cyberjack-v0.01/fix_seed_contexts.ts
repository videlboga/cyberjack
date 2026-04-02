import fs from 'fs';

let content = fs.readFileSync('seed_expanded.ts', 'utf-8');

const replacement = `const contexts = [
    { id: 'pose_lying', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Лёжа', m: { intensity: -0.1, valence: 0.1, contact: 0.1, novelty: -0.1 } },
    { id: 'pose_kneeling', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Стоя на коленях', m: { intensity: 0.2, valence: -0.2, sharpness: 0.1, novelty: 0.1 } },
    { id: 'pose_spread_eagle', point_id: 'slot_pose', slot: 'pose', exclusiveWithinSlot: true, label: 'Поза: Звездой (привязана)', m: { intensity: 0.4, valence: -0.3, sharpness: 0.2, novelty: 0.3 } },
    { id: 'bound_hands', point_id: 'hands', slot: 'restraint_arms', exclusiveWithinSlot: true, label: 'Связанные руки', m: { intensity: 0.3, valence: -0.2, sharpness: 0.2, novelty: 0.2 } },
    { id: 'blindfold', point_id: 'head', slot: 'equipment_head', exclusiveWithinSlot: true, label: 'Завязанные глаза', m: { intensity: 0.5, valence: -0.2, sharpness: 0.3, novelty: 0.5 } }
];`;

content = content.replace(/const contexts = \[\s+{ id: 'pose_lying'.*?\} \s+\];/s, replacement);

fs.writeFileSync('seed_expanded.ts', content);
