const fs = require('fs');

const actionsPath = 'src/infrastructure/data/presets/actions.json';
const seedsPath = 'scripts/run-seed.cjs';

let actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));

// Remove the generic underwear
const removeIds = ['eq_clothe_underwear', 'eq_strip_underwear'];
actions = actions.filter(a => !removeIds.includes(a.id));

const newActions = [
  {
    id: 'eq_clothe_panties',
    name: 'Одеть: Трусики',
    description: 'Легкие трусики, прикрывающие низ.',
    categories: ['clothing'],
    tags: ['clothing', 'comfort'],
    validTargets: ['groin'],
    vector: { intensity: 1, valence: 3, sharpness: 0, contact: 4, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'clothing', duration: -1, occupiesPoints: ['groin', 'vulva', 'anus'] }
  },
  {
    id: 'eq_strip_panties',
    name: 'Снять трусики',
    description: 'Обнажить область паха.',
    categories: ['clothing'],
    tags: ['vulnerable', 'exposure'],
    requireContexts: ['eq_clothe_panties'],
    removeContexts: ['eq_clothe_panties'],
    validTargets: ['groin'],
    vector: { intensity: 4, valence: -3, sharpness: 1, contact: 2, novelty: 4, powerBase: 20 }
  },
  {
    id: 'eq_clothe_bra',
    name: 'Одеть: Бюстгальтер',
    description: 'Бра, поддерживающее и скрывающее грудь.',
    categories: ['clothing'],
    tags: ['clothing', 'comfort'],
    validTargets: ['chest'],
    vector: { intensity: 1, valence: 2, sharpness: 0, contact: 4, novelty: 1, powerBase: 5 },
    contextConfig: { type: 'clothing', duration: -1, occupiesPoints: ['chest', 'breasts', 'nipples'] }
  },
  {
    id: 'eq_strip_bra',
    name: 'Снять бюстгальтер',
    description: 'Обнажить грудь.',
    categories: ['clothing'],
    tags: ['vulnerable', 'exposure'],
    requireContexts: ['eq_clothe_bra'],
    removeContexts: ['eq_clothe_bra'],
    validTargets: ['chest'],
    vector: { intensity: 4, valence: -3, sharpness: 1, contact: 2, novelty: 4, powerBase: 20 }
  }
];

const allNewIds = newActions.map(a => a.id);
for (const a of newActions) {
  if (!actions.find(x => x.id === a.id)) {
    actions.push(a);
  }
}

fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 2));

// Update run-seed.cjs
let seedScript = fs.readFileSync(seedsPath, 'utf8');

const match = seedScript.match(/const labActions = JSON\.stringify\(\[([^\]]+)\]\);/);
if (match) {
  let existingActionsStr = match[1];
  let currentActions = existingActionsStr.split(',').map(s => s.replace(/['"]/g, ''));
  
  // Clean up the generic ones
  currentActions = currentActions.filter(a => !removeIds.includes(a));
  
  const uniqueActionsList = new Set([...currentActions, ...allNewIds]);
  const finalArray = Array.from(uniqueActionsList).filter(x => x);

  const newArrayStr = finalArray.map(a => `'${a}'`).join(',');
  const replacement = `const labActions = JSON.stringify([${newArrayStr}]);`;
  
  seedScript = seedScript.replace(match[0], replacement);
  fs.writeFileSync(seedsPath, seedScript);
  console.log(`Updated seed script. Added panty/bra split. Total actions in lab: ${finalArray.length}`);
} else {
  console.error("Could not find labActions string!");
}
