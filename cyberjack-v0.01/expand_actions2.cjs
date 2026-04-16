const fs = require('fs');

const actionsPath = 'src/infrastructure/data/presets/actions.json';
const seedsPath = 'scripts/run-seed.cjs';

const actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));

const newActions = [
  // CLOTHING
  {
    id: 'eq_clothe_underwear',
    name: 'Одеть: Нижнее белье',
    description: 'Базовое нижнее белье.',
    categories: ['clothing'],
    tags: ['clothing', 'comfort'],
    validTargets: ['groin', 'chest'],
    vector: { intensity: 1, valence: 3, sharpness: 0, contact: 5, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'clothing', duration: -1, occupiesPoints: ['groin'] }
  },
  {
    id: 'eq_strip_underwear',
    name: 'Снять нижнее белье',
    description: 'Полное обнажение базовых зон.',
    categories: ['clothing'],
    tags: ['vulnerable', 'exposure'],
    requireContexts: ['eq_clothe_underwear'],
    removeContexts: ['eq_clothe_underwear'],
    validTargets: ['groin'],
    vector: { intensity: 4, valence: -4, sharpness: 1, contact: 2, novelty: 4, powerBase: 25 }
  },
  {
    id: 'eq_clothe_shirt',
    name: 'Одеть: Рубашка/Футболка',
    description: 'Повседневный верх.',
    categories: ['clothing'],
    tags: ['clothing', 'comfort'],
    validTargets: ['torso'],
    vector: { intensity: 1, valence: 2, sharpness: 0, contact: 5, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'clothing', duration: -1, occupiesPoints: ['torso'] }
  },
  {
    id: 'eq_strip_shirt',
    name: 'Снять верхнюю одежду',
    description: 'Обнажить торс.',
    categories: ['clothing'],
    tags: ['vulnerable', 'exposure'],
    requireContexts: ['eq_clothe_shirt'],
    removeContexts: ['eq_clothe_shirt'],
    validTargets: ['torso'],
    vector: { intensity: 3, valence: -2, sharpness: 1, contact: 2, novelty: 3, powerBase: 15 }
  },
  {
    id: 'eq_clothe_pants',
    name: 'Одеть: Штаны',
    description: 'Брюки или штаны.',
    categories: ['clothing'],
    tags: ['clothing', 'comfort'],
    validTargets: ['legs'],
    vector: { intensity: 1, valence: 2, sharpness: 0, contact: 5, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'clothing', duration: -1, occupiesPoints: ['legs'] }
  },
  {
    id: 'eq_strip_pants',
    name: 'Снять штаны',
    description: 'Оставить ноги без защиты.',
    categories: ['clothing'],
    tags: ['vulnerable', 'exposure'],
    requireContexts: ['eq_clothe_pants'],
    removeContexts: ['eq_clothe_pants'],
    validTargets: ['legs'],
    vector: { intensity: 3, valence: -2, sharpness: 1, contact: 2, novelty: 3, powerBase: 15 }
  },
  {
    id: 'eq_clothe_shoes',
    name: 'Обуть: Ботинки',
    description: 'Обувь.',
    categories: ['clothing'],
    tags: ['clothing', 'comfort'],
    validTargets: ['feet'],
    vector: { intensity: 1, valence: 2, sharpness: 0, contact: 3, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'clothing', duration: -1, occupiesPoints: ['feet'] }
  },
  {
    id: 'eq_strip_shoes',
    name: 'Снять ботинки',
    description: 'Разуть.',
    categories: ['clothing'],
    tags: ['vulnerable', 'exposure'],
    requireContexts: ['eq_clothe_shoes'],
    removeContexts: ['eq_clothe_shoes'],
    validTargets: ['feet'],
    vector: { intensity: 2, valence: -1, sharpness: 1, contact: 1, novelty: 2, powerBase: 10 }
  },

  // POSES
  {
    id: 'pose_sitting',
    name: 'Поза: Сидя',
    description: 'Сидеть на поверхности.',
    categories: ['pose'],
    tags: ['pose', 'neutral'],
    validTargets: ['general'],
    vector: { intensity: 1, valence: 1, sharpness: 0, contact: 0, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'pose', duration: -1, occupiesPoints: ['global_pose'] }
  },
  {
    id: 'pose_lying_down',
    name: 'Поза: Лежа',
    description: 'Лежать ровно.',
    categories: ['pose'],
    tags: ['pose', 'vulnerable'],
    validTargets: ['general'],
    vector: { intensity: 2, valence: -1, sharpness: 0, contact: 2, novelty: 2, powerBase: 15 },
    contextConfig: { type: 'pose', duration: -1, occupiesPoints: ['global_pose'] }
  },

  // SUSPENSION (Подвес)
  {
    id: 'act_suspend_wrists',
    name: 'Подвешивание за запястья',
    description: 'Закрепить веревки или цепи на запястьях и поднять тело так, чтобы ноги едва касались пола.',
    categories: ['physical', 'context'],
    tags: ['restraint', 'pain', 'vulnerable', 'suspension'],
    requiresItem: 'eq_suspension', // Имитирует привязку к оборудованию сектора
    validTargets: ['limbs', 'general'],
    vector: { intensity: 8, valence: -6, sharpness: 4, contact: 9, novelty: 7, powerBase: 50 },
    contextConfig: {
      type: 'equipment',
      duration: -1,
      exclusiveWithinPoint: true,
      occupiesPoints: ['global_pose', 'hands'],
      modifiers: { intensity: 5, valence: -3, sharpness: 2, contact: 8, novelty: 2 }
    }
  },
  {
    id: 'act_release_wrists',
    name: 'Развязать запястья (снять с подвеса)',
    description: 'Опустить на пол и освободить руки от креплений.',
    categories: ['physical', 'context'],
    tags: ['comfort', 'relief'],
    requireContexts: ['act_suspend_wrists'],
    removeContexts: ['act_suspend_wrists'],
    validTargets: ['limbs', 'general'],
    vector: { intensity: 3, valence: 7, sharpness: 0, contact: 4, novelty: 3, powerBase: 20 }
  }
];

const allNewIds = newActions.map(a => a.id);

for (const a of newActions) {
  if (!actions.find(x => x.id === a.id)) {
    actions.push(a);
  }
}

fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 2));

// Update scripts/run-seed.cjs
let seedScript = fs.readFileSync(seedsPath, 'utf8');

const match = seedScript.match(/const labActions = JSON\.stringify\(\[([^\]]+)\]\);/);
if (match) {
  let existingActionsStr = match[1];
  let currentActions = existingActionsStr.split(',').map(s => s.replace(/['"]/g, ''));
  
  const additionalActionsFromOriginalSeed = [
    'gentle_stroke','tickle','light_kiss','deep_kiss','feather_stroke',
    'deep_massage','licking','firm_grip','light_bite','hard_bite',
    'pinch','scratching','slap','hard_slap','needle_prick','belt_strike',
    'whip_strike','taser_shock','ice_cube','hot_wax','vibrator_pulse',
    'hair_pull','spit','breath_blow','verbal_pressure','stare',
    'close_inspection','feint_strike','pose_kneeling','restraint_cuffs'
  ];

  const uniqueActionsList = new Set([...currentActions, ...additionalActionsFromOriginalSeed, ...allNewIds]);
  const finalArray = Array.from(uniqueActionsList).filter(x => x);

  const newArrayStr = finalArray.map(a => `'${a}'`).join(',');
  const replacement = `const labActions = JSON.stringify([${newArrayStr}]);`;
  
  seedScript = seedScript.replace(match[0], replacement);
  fs.writeFileSync(seedsPath, seedScript);
  console.log(`Added ${finalArray.length} actions total to lab scene.`);
} else {
  console.error("Could not find labActions string!");
}
