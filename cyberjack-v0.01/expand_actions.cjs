const fs = require('fs');

const actionsPath = 'src/infrastructure/data/presets/actions.json';
const seedsPath = 'scripts/run-seed.cjs';

// 1. Add new actions to actions.json
const actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));

const newActions = [
  // POSES
  {
    id: 'pose_standing',
    name: 'Стойка: Смирно',
    description: 'Стоять прямо, руки по швам. Базовая стойка подчинения.',
    categories: ['pose'],
    tags: ['pose', 'neutral'],
    validTargets: ['general'],
    vector: { intensity: 1, valence: 0, sharpness: 0, contact: 0, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'pose', duration: -1, occupiesPoints: ['global_pose'] }
  },
  {
    id: 'pose_all_fours',
    name: 'Поза: На четвереньках',
    description: 'Опуститься на руки и колени, ожидая указаний.',
    categories: ['pose'],
    tags: ['pose', 'submission', 'vulnerable'],
    validTargets: ['general'],
    vector: { intensity: 3, valence: -2, sharpness: 1, contact: 3, novelty: 4, powerBase: 25 },
    contextConfig: { type: 'pose', duration: -1, occupiesPoints: ['global_pose', 'knees', 'hands'] }
  },
  {
    id: 'pose_spread_eagle',
    name: 'Поза: Широко раскрыто',
    description: 'Лежать на спине с широко разведёнными руками и ногами.',
    categories: ['pose'],
    tags: ['pose', 'vulnerable', 'intimate'],
    validTargets: ['general'],
    vector: { intensity: 5, valence: -3, sharpness: 2, contact: 2, novelty: 5, powerBase: 40 },
    contextConfig: { type: 'pose', duration: -1, occupiesPoints: ['global_pose'] }
  },
  
  // CLOTHING / EQUIPMENT
  {
    id: 'eq_blindfold_apply',
    name: 'Надеть повязку на глаза',
    description: 'Лишить зрения, обостряя другие чувства.',
    categories: ['equipment', 'sensory'],
    tags: ['sensory', 'deprivation', 'vulnerable'],
    validTargets: ['head'],
    vector: { intensity: 6, valence: -4, sharpness: 2, contact: 5, novelty: 6, powerBase: 35 },
    contextConfig: { type: 'equipment', duration: -1, occupiesPoints: ['eyes'], modifiers: { intensity: 4, sharpness: 2 } }
  },
  {
    id: 'eq_blindfold_remove',
    name: 'Снять повязку',
    description: 'Вернуть зрение.',
    categories: ['equipment'],
    tags: ['comfort'],
    requireContexts: ['eq_blindfold_apply'],
    removeContexts: ['eq_blindfold_apply'],
    validTargets: ['head'],
    vector: { intensity: 2, valence: 5, sharpness: 0, contact: 2, novelty: 2, powerBase: 10 }
  },
  {
    id: 'eq_gag_apply',
    name: 'Вставить кляп',
    description: 'Заблокировать возможность говорить.',
    categories: ['equipment', 'restraint'],
    tags: ['restraint', 'demeaning'],
    validTargets: ['head'],
    vector: { intensity: 7, valence: -5, sharpness: 4, contact: 8, novelty: 6, powerBase: 45 },
    contextConfig: { type: 'equipment', duration: -1, occupiesPoints: ['mouth'], modifiers: { intensity: 3, sharpness: 3 } }
  },
  {
    id: 'eq_gag_remove',
    name: 'Вынуть кляп',
    description: 'Позволить дышать свободно и говорить.',
    categories: ['equipment'],
    tags: ['comfort'],
    requireContexts: ['eq_gag_apply'],
    removeContexts: ['eq_gag_apply'],
    validTargets: ['head'],
    vector: { intensity: 3, valence: 6, sharpness: 0, contact: 3, novelty: 3, powerBase: 15 }
  },
  {
    id: 'eq_clothe_robe',
    name: 'Одеть: Медицинский халат',
    description: 'Накинуть простой, тонкий халат.',
    categories: ['clothing'],
    tags: ['clothing', 'comfort'],
    validTargets: ['torso'],
    vector: { intensity: 1, valence: 4, sharpness: 0, contact: 6, novelty: 2, powerBase: 5 },
    contextConfig: { type: 'clothing', duration: -1, occupiesPoints: ['torso'] }
  },
  {
    id: 'eq_strip_robe',
    name: 'Снять халат',
    description: 'Обнажить тело.',
    categories: ['clothing'],
    tags: ['vulnerable', 'exposure'],
    requireContexts: ['eq_clothe_robe'],
    removeContexts: ['eq_clothe_robe'],
    validTargets: ['torso'],
    vector: { intensity: 4, valence: -3, sharpness: 1, contact: 2, novelty: 4, powerBase: 25 }
  }
];

const allNewIds = newActions.map(a => a.id);

for (const a of newActions) {
  if (!actions.find(x => x.id === a.id)) {
    actions.push(a);
  }
}

fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 2));

// 2. Update scripts/run-seed.cjs
let seedScript = fs.readFileSync(seedsPath, 'utf8');

// Find the labActions array to append
const match = seedScript.match(/const labActions = JSON\.stringify\(\[([^\]]+)\]\);/);
if (match) {
  let existingActionsStr = match[1];
  // Parse back to array
  // existingActionsStr might be pure string or contain quotes
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
  // filter out any empty strings
  const finalArray = Array.from(uniqueActionsList).filter(x => x);

  const newArrayStr = finalArray.map(a => `'${a}'`).join(',');
  const replacement = `const labActions = JSON.stringify([${newArrayStr}]);`;
  
  seedScript = seedScript.replace(match[0], replacement);
  fs.writeFileSync(seedsPath, seedScript);
  console.log(`Added ${finalArray.length} actions total to lab scene.`);
} else {
  console.error("Could not find labActions string in run-seed.cjs");
}
