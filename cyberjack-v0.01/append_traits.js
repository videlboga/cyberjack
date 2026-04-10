const fs = require('fs');

const filePath = 'src/infrastructure/data/presets/traits.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const newTraits = [
  {
    "id": "trait_footfetish_passive",
    "name": "Подофилия (Пассивная)",
    "description": "Острое наслаждение от любого физического взаимодействия со своими ступнями.",
    "rules": [
      {
        "trigger": { "requireTarget": "feet" },
        "overrides": { "valence": 4.0, "intensityMult": 1.5, "contactMult": 2.0 }
      },
      {
        "trigger": { "requireTarget": "feet", "requireActionTags": ["pain"] },
        "overrides": { "valence": -2.0, "intensityMult": 2.0 }
      }
    ]
  },
  {
    "id": "trait_footfetish_active",
    "name": "Подофилия (Активная)",
    "description": "Повышенный интерес к ступням партнера. Воздействие на чужие ступни или с их помощью приносит большое удовольствие.",
    "rules": [
      {
        "trigger": { "requireTarget": "feet", "requireActionCategories": ["physical"] },
        "overrides": { "valence": 5.0, "intensityMult": 1.3 }
      },
      {
        "trigger": { "requireActionTags": ["feet"] },
        "overrides": { "valence": 4.0, "powerMult": 1.2 }
      }
    ]
  },
  {
    "id": "trait_hand_fetish",
    "name": "Хирофилия (Фетиш рук)",
    "description": "Обостренное внимание и чувствительность в области кистей рук.",
    "rules": [
      {
        "trigger": { "requireTarget": "hands" },
        "overrides": { "valence": 3.0, "contactMult": 1.8, "intensityMult": 1.3 }
      },
      {
        "trigger": { "requireActionTags": ["hands"] },
        "overrides": { "valence": 3.0 }
      }
    ]
  },
  {
    "id": "trait_groin_fixation",
    "name": "Генитальная фиксация",
    "description": "Сверхконцентрация на нижней интимной зоне. Любое воздействие на пах вызывает преувеличенную реакцию.",
    "rules": [
      {
        "trigger": { "requireTarget": "groin" },
        "overrides": { "valence": 2.0, "intensityMult": 1.6, "powerMult": 1.4 }
      },
      {
        "trigger": { "requireTarget": "groin", "requireActionTags": ["pain"] },
        "overrides": { "valence": -5.0, "sharpnessMult": 1.5 }
      }
    ]
  },
  {
    "id": "trait_erotophilia",
    "name": "Эротофилия (Общий интимный фетиш)",
    "description": "Общая зацикленность на интимных, сексуализированных действиях, независимо от конкретной зоны.",
    "rules": [
      {
        "trigger": { "requireActionTags": ["intimate"] },
        "overrides": { "valence": 5.0, "intensityMult": 1.3, "noveltyMult": 0.8 }
      }
    ]
  },
  {
    "id": "trait_breast_fixation",
    "name": "Мазофилия (Фиксация на груди)",
    "description": "Обостренная чувствительность и психологическая фиксация на верхней интимной зоне (груди).",
    "rules": [
      {
        "trigger": { "requireTarget": "chest" },
        "overrides": { "valence": 4.0, "contactMult": 1.6, "intensityMult": 1.2 }
      },
      {
        "trigger": { "requireTarget": "chest", "requireActionTags": ["pain"] },
        "overrides": { "valence": -3.0, "sharpnessMult": 1.3 }
      }
    ]
  }
];

data.push(...newTraits);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Appended traits!');
