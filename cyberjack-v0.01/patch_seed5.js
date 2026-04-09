const fs = require('fs');

let seedContent = fs.readFileSync('src/infrastructure/seed.ts', 'utf8');

const newContexts = `
        { id: 'context_defiant', label: 'Агрессивный бунт', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.1, valence: -0.2, contact: 0.0, sharpness: 0.2, novelty: 0.1 }, contextConfig: { type: 'condition', duration: -1, priority: 3 } },
        { id: 'context_anger', label: 'Гнев на калибратора', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.2, valence: -0.3, contact: 0.0, sharpness: 0.3, novelty: 0.0 }, contextConfig: { type: 'condition', duration: 10, priority: 2 } },
        { id: 'context_sensitive_skin', label: 'Сверхчувствительная кожа', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.3, valence: 0.0, contact: 0.2, sharpness: 0.4, novelty: 0.0 }, contextConfig: { type: 'condition', duration: -1, priority: 2 } },
        { id: 'context_low_endurance', label: 'Низкая выносливость', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.0, valence: -0.1, contact: 0.0, sharpness: 0.2, novelty: 0.0 }, contextConfig: { type: 'condition', duration: -1, priority: 2 } },
        { id: 'context_high_endurance', label: 'Высокая выносливость', type: 'condition', tags: ['physical', 'condition'], values: { intensity: -0.2, valence: 0.1, contact: 0.0, sharpness: -0.1, novelty: 0.0 }, contextConfig: { type: 'condition', duration: -1, priority: 2 } },
        { id: 'context_calloused', label: 'Огрубевшая кожа', type: 'condition', tags: ['physical', 'condition'], values: { intensity: -0.3, valence: 0.0, contact: -0.2, sharpness: -0.4, novelty: 0.0 }, contextConfig: { type: 'condition', duration: -1, priority: 2 } },
        { id: 'context_cyber_implants', label: 'Сбоящие импланты', type: 'condition', tags: ['physical', 'cybernetics'], values: { intensity: 0.2, valence: -0.2, contact: 0.0, sharpness: 0.5, novelty: 0.3 }, contextConfig: { type: 'condition', duration: -1, priority: 3 } },
        { id: 'context_glitch_prone', label: 'Склонность к глитчам', type: 'condition', tags: ['physical', 'cybernetics'], values: { intensity: 0.1, valence: 0.0, contact: 0.0, sharpness: 0.2, novelty: 0.4 }, contextConfig: { type: 'condition', duration: -1, priority: 1 } },
        { id: 'context_eager_to_please', label: 'Желание угодить', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.0, valence: 0.3, contact: 0.1, sharpness: -0.2, novelty: 0.0 }, contextConfig: { type: 'condition', duration: -1, priority: 2 } },
        { id: 'context_fear_of_punishment', label: 'Страх наказания', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.3, valence: -0.4, contact: 0.0, sharpness: 0.4, novelty: 0.1 }, contextConfig: { type: 'condition', duration: -1, priority: 2 } },
        { id: 'context_masochism', label: 'Мазохизм', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.2, valence: 0.4, contact: 0.1, sharpness: -0.2, novelty: 0.2 }, contextConfig: { type: 'condition', duration: -1, priority: 3 } },
        { id: 'context_hypnotic_susceptibility', label: 'Внушаемость', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.0, valence: 0.2, contact: 0.0, sharpness: -0.3, novelty: 0.0 }, contextConfig: { type: 'condition', duration: -1, priority: 2 } }
`;

seedContent = seedContent.replace(
    /\{ id: 'restraint_cuffs', label: 'Скованность: Наручники'.*?\}\n\s*\];/,
    "{ id: 'restraint_cuffs', label: 'Скованность: Наручники', type: 'restraint', tags: ['restraint', 'bdsm'], values: { intensity: 0.4, valence: -0.4, contact: 0.5, sharpness: 0.2, novelty: 0.2 }, contextConfig: { type: 'restraint', occupiesPoints: ['wrists_front'], duration: -1 } }," + newContexts + "\n    ];"
);

// We should also add these into available_actions of the lab scene so LLM theoretically knows about them, or we can just keep them as hidden conditionals. Wait, 'lab' scene doesn't need them in available actions unless we want them to pop up. Actually LLM triggers them by \`commandIntent\`. So they don't *have* to be in available_actions unless the UI needs to show them, but these are INTERNAL. So we don't put them in the scene's available_actions string.

fs.writeFileSync('src/infrastructure/seed.ts', seedContent);
