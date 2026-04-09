const fs = require('fs');

let seedContent = fs.readFileSync('src/infrastructure/seed.ts', 'utf8');

const oldArrayEnd = "        { id: 'feint_strike', label: 'Ложный замах', values: { intensity: 0.7, valence: -0.5, contact: 0.0, sharpness: 0.9, novelty: 0.5 } }";

const newItems = `        { id: 'feint_strike', label: 'Ложный замах', values: { intensity: 0.7, valence: -0.5, contact: 0.0, sharpness: 0.9, novelty: 0.5 } },
        { id: 'apply_cuffs', label: 'Надеть наручники', type: 'physical', tags: ['restraint', 'bdsm'], values: { intensity: 0.5, valence: -0.4, contact: 0.8, sharpness: 0.4, novelty: 0.3 }, contextConfig: { type: 'restraint', occupiesPoints: ['wrists_front'], duration: -1 } },
        { id: 'remove_cuffs', label: 'Снять наручники', type: 'physical', tags: ['restraint', 'release'], values: { intensity: 0.2, valence: 0.5, contact: 0.5, sharpness: 0.1, novelty: 0.2 }, removeContexts: ['apply_cuffs'] },
        { id: 'strip_naked', label: 'Раздеть догола', type: 'physical', tags: ['clothing', 'humiliation'], values: { intensity: 0.6, valence: -0.3, contact: 0.6, sharpness: 0.1, novelty: 0.6 }, contextConfig: { type: 'clothing', occupiesPoints: ['body_overall'], duration: -1 } },
        { id: 'give_clothes', label: 'Позволить одеться', type: 'physical', tags: ['clothing'], values: { intensity: 0.1, valence: 0.6, contact: 0.0, sharpness: 0.0, novelty: 0.4 }, removeContexts: ['strip_naked'] },
        { id: 'force_kneel', label: 'Заставить встать на колени', type: 'physical', tags: ['pose', 'dominance'], values: { intensity: 0.7, valence: -0.6, contact: 0.3, sharpness: 0.2, novelty: 0.5 }, contextConfig: { type: 'pose', occupiesPoints: ['global_pose'], duration: -1 } },
        { id: 'allow_stand', label: 'Разрешить встать', type: 'physical', tags: ['pose'], values: { intensity: 0.1, valence: 0.4, contact: 0.0, sharpness: 0.0, novelty: 0.2 }, removeContexts: ['force_kneel'] }`;

if (seedContent.includes(oldArrayEnd)) {
    seedContent = seedContent.replace(oldArrayEnd, newItems);
    
    // Also inject new actions into the lab scene available_actions
    const labSceneOld = `'["gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke","deep_massage","licking","firm_grip","light_bite","hard_bite","pinch","scratching","slap","hard_slap","needle_prick","belt_strike","whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse","hair_pull","spit","breath_blow","verbal_pressure","stare","close_inspection","feint_strike"]'`;
    const labSceneNew = `'["gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke","deep_massage","licking","firm_grip","light_bite","hard_bite","pinch","scratching","slap","hard_slap","needle_prick","belt_strike","whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse","hair_pull","spit","breath_blow","verbal_pressure","stare","close_inspection","feint_strike","apply_cuffs","remove_cuffs","strip_naked","give_clothes","force_kneel","allow_stand"]'`;
    seedContent = seedContent.replace(labSceneOld, labSceneNew);

    fs.writeFileSync('src/infrastructure/seed.ts', seedContent);
    console.log('PATCHED SEED');
} else {
    console.log('OLD STRING NOT FOUND');
}
