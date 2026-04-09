const fs = require('fs');

let seedContent = fs.readFileSync('src/infrastructure/seed.ts', 'utf8');

// Update DB call to insert new columns
seedContent = seedContent.replace(
  'db.prepare(`INSERT OR REPLACE INTO action_presets (id, label, values_json) VALUES (?, ?, ?)`).run(act.id, act.label, JSON.stringify(act.values));',
  'db.prepare(`INSERT OR REPLACE INTO action_presets (id, label, type, tags, values_json, context_config_json) VALUES (?, ?, ?, ?, ?, ?)`).run(act.id, act.label, act.type || "physical", JSON.stringify(act.tags || []), JSON.stringify(act.values), act.contextConfig ? JSON.stringify(act.contextConfig) : null);'
);

const newActions = `
        { id: 'kneel_down', label: 'Поставить на колени', type: 'context', values: { intensity: 0.3, valence: -0.4, contact: 0.2, sharpness: 0.0, novelty: 0.3 }, tags: ['pose'], contextConfig: { type: 'pose', occupiesPoints: ['legs'], exclusiveWithinPoint: true, duration: -1 } },
        { id: 'sit_chair', label: 'Посадить в кресло', type: 'context', values: { intensity: 0.1, valence: 0.1, contact: 0.1, sharpness: 0.0, novelty: 0.1 }, tags: ['pose'], contextConfig: { type: 'pose', occupiesPoints: ['legs'], exclusiveWithinPoint: true, duration: -1 } },
        { id: 'lie_down', label: 'Уложить на спину', type: 'context', values: { intensity: 0.2, valence: 0.0, contact: 0.2, sharpness: 0.0, novelty: 0.2 }, tags: ['pose'], contextConfig: { type: 'pose', occupiesPoints: ['legs', 'torso'], exclusiveWithinPoint: true, duration: -1 } },
        { id: 'stand_up', label: 'Поднять на ноги', type: 'context', values: { intensity: 0.1, valence: 0.1, contact: 0.1, sharpness: 0.0, novelty: 0.1 }, tags: ['pose'], contextConfig: { type: 'pose', occupiesPoints: ['legs', 'torso'], exclusiveWithinPoint: true, duration: -1 } },
        { id: 'apply_cuffs', label: 'Надеть наручники', type: 'context', values: { intensity: 0.6, valence: -0.5, contact: 0.5, sharpness: 0.3, novelty: 0.6 }, tags: ['restraint', 'equipment'], contextConfig: { type: 'restraint', occupiesPoints: ['wrists'], duration: -1 } },
        { id: 'remove_cuffs', label: 'Снять наручники', type: 'physical', values: { intensity: 0.1, valence: 0.4, contact: 0.2, sharpness: 0.0, novelty: 0.1 }, tags: ['release'], removeContexts: ['apply_cuffs'] },
        { id: 'apply_gag', label: 'Вставить кляп', type: 'context', values: { intensity: 0.7, valence: -0.6, contact: 0.6, sharpness: 0.2, novelty: 0.6 }, tags: ['restraint', 'equipment'], contextConfig: { type: 'restraint', occupiesPoints: ['mouth'], duration: -1 } },
        { id: 'remove_gag', label: 'Вынуть кляп', type: 'physical', values: { intensity: 0.1, valence: 0.5, contact: 0.2, sharpness: 0.0, novelty: 0.2 }, tags: ['release'], removeContexts: ['apply_gag'] },
        { id: 'strip_clothes', label: 'Раздеть (оставить голым)', type: 'context', values: { intensity: 0.6, valence: -0.3, contact: 0.4, sharpness: 0.1, novelty: 0.7 }, tags: ['clothing'], contextConfig: { type: 'clothing', occupiesPoints: ['torso', 'legs', 'genitals'], exclusiveWithinPoint: true, duration: -1 } }
`;

seedContent = seedContent.replace(
  /{ id: 'close_inspection'.*?},/,
  `$&${newActions},`
);

// Update scenes available actions
seedContent = seedContent.replace(
  /'\["gentle_stroke"(.*?)\]'/,
  `'["gentle_stroke"$1,"kneel_down","sit_chair","lie_down","stand_up","apply_cuffs","remove_cuffs","apply_gag","remove_gag","strip_clothes"]'`
);

fs.writeFileSync('src/infrastructure/seed.ts', seedContent);
