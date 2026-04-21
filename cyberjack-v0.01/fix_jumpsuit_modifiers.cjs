const fs = require('fs');
const path = './src/infrastructure/data/presets/actions.json';
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
const action = data.find(a => a.id === 'eq_clothe_jumpsuit');

if (action && action.contextConfig) {
  action.contextConfig.modifiers = {
    intensity_mult: 0.3,
    sharpness_mult: 0.1,
    contact_mult: 0.5
  };
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Fixed jumpsuit modifiers to _mult format');
}
