const fs = require('fs');

const actionsFile = 'src/infrastructure/data/presets/actions.json';
let actions = JSON.parse(fs.readFileSync(actionsFile, 'utf8'));

// 1. Убираем существующую одежду
actions = actions.filter(a => !(a.categories && a.categories.includes('clothing')));

// Очки (points), которые комбинезон блокирует и занимает
const coveredPoints = [
  "neck", "shoulders", "chest", "nipples", "belly", "back", 
  "waist", "hips", "left_arm", "right_arm", "inner_thighs", 
  "left_leg", "right_leg", "knees", "buttocks", "anus", 
  "vulva", "vagina", "clitoris", "torso", "legs", "groin", "breasts"
];

// 2. Добавляем новый комбинезон
const clotheJumpsuit = {
  "id": "eq_clothe_jumpsuit",
  "name": "Надеть Комбинезон",
  "description": "Плотный изоляционный комбинезон. Закрывает всё тело, кроме лица, ладоней и ступней. Существенно снижает тактильную чувствительность.",
  "categories": ["clothing"],
  "tags": ["clothing", "isolation"],
  "validTargets": ["systemic"],
  "vector": {
    "intensity": 2,
    "valence": -1,
    "sharpness": 0,
    "contact": 8,
    "novelty": 3,
    "powerBase": 20
  },
  "contextConfig": {
    "type": "clothing",
    "duration": -1,
    "exclusiveWithinPoint": false,
    "occupiesPoints": coveredPoints,
    "blocksPoints": coveredPoints,
    "modifiers": {
      "intensity": -5,
      "sharpness": -8,
      "contact": -8
    }
  }
};

const stripJumpsuit = {
  "id": "eq_strip_jumpsuit",
  "name": "Снять Комбинезон",
  "description": "Снять комбинезон, оставив тело полностью обнаженным.",
  "categories": ["clothing"],
  "tags": ["vulnerable", "exposure"],
  "validTargets": ["systemic"],
  "requireContexts": ["eq_clothe_jumpsuit"],
  "removeContexts": ["eq_clothe_jumpsuit"],
  "vector": {
    "intensity": 4,
    "valence": -3,
    "sharpness": 1,
    "contact": 4,
    "novelty": 5,
    "powerBase": 20
  }
};

actions.push(clotheJumpsuit, stripJumpsuit);

fs.writeFileSync(actionsFile, JSON.stringify(actions, null, 2), 'utf8');
console.log('actions.json updated with jumpsuit.');
