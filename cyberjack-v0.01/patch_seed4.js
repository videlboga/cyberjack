const fs = require('fs');

let seedContent = fs.readFileSync('src/infrastructure/seed.ts', 'utf8');

const oldArrayEnd = "        { id: 'feint_strike', label: 'Ложный замах', values: { intensity: 0.7, valence: -0.5, contact: 0.0, sharpness: 0.9, novelty: 0.5 } }\n    ];";

const newItems = `        { id: 'feint_strike', label: 'Ложный замах', values: { intensity: 0.7, valence: -0.5, contact: 0.0, sharpness: 0.9, novelty: 0.5 } },
        { id: 'apply_cuffs', label: 'Надеть наручники', type: 'physical', tags: ['restraint', 'bdsm'], values: { intensity: 0.5, valence: -0.4, contact: 0.8, sharpness: 0.4, novelty: 0.3 }, contextConfig: { type: 'restraint', occupiesPoints: ['wrists_front'], duration: -1 } },
        { id: 'remove_cuffs', label: 'Снять наручники', type: 'physical', tags: ['restraint', 'release'], removeContexts: ['apply_cuffs'], values: { intensity: 0.2, valence: 0.5, contact: 0.5, sharpness: 0.1, novelty: 0.2 } },
        { id: 'force_kneel', label: 'Заставить встать на колени', type: 'physical', tags: ['pose', 'dominance'], values: { intensity: 0.7, valence: -0.6, contact: 0.3, sharpness: 0.2, novelty: 0.5 }, contextConfig: { type: 'pose', occupiesPoints: ['global_pose'], duration: -1 } },
        { id: 'allow_stand', label: 'Разрешить встать', type: 'physical', tags: ['pose'], removeContexts: ['force_kneel'], values: { intensity: 0.1, valence: 0.4, contact: 0.0, sharpness: 0.0, novelty: 0.2 } }
    ];`;

seedContent = seedContent.replace(oldArrayEnd, newItems);

// Update valid json inserts
const oldInsert = "db.prepare(`INSERT OR REPLACE INTO action_presets (id, label, values_json) VALUES (?, ?, ?)`).run(act.id, act.label, JSON.stringify(act.values));";
const newInsert = "const valJson = { ...act.values, removeContexts: act.removeContexts }; db.prepare(`INSERT OR REPLACE INTO action_presets (id, label, type, tags, values_json, context_config_json) VALUES (?, ?, ?, ?, ?, ?)`).run(act.id, act.label, act.type || 'physical', JSON.stringify(act.tags || []), JSON.stringify(valJson), act.contextConfig ? JSON.stringify(act.contextConfig) : null);";
seedContent = seedContent.replace(oldInsert, newInsert);

// Replace available_actions in lab scene
const labSceneOld = `'["gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke","deep_massage","licking","firm_grip","light_bite","hard_bite","pinch","scratching","slap","hard_slap","needle_prick","belt_strike","whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse","hair_pull","spit","breath_blow","verbal_pressure","stare","close_inspection","feint_strike"]'`;
const labSceneNew = `'["gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke","deep_massage","licking","firm_grip","light_bite","hard_bite","pinch","scratching","slap","hard_slap","needle_prick","belt_strike","whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse","hair_pull","spit","breath_blow","verbal_pressure","stare","close_inspection","feint_strike","apply_cuffs","remove_cuffs","force_kneel","allow_stand"]'`;
seedContent = seedContent.replace(labSceneOld, labSceneNew);

fs.writeFileSync('src/infrastructure/seed.ts', seedContent);
