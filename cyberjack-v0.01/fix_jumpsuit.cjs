const fs = require('fs');
const path = './src/infrastructure/data/presets/actions.json';
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
const jumpsuit = data.find(a => a.id === 'eq_clothe_jumpsuit');

if (jumpsuit && jumpsuit.contextConfig) {
  jumpsuit.contextConfig.blocksPoints = [
    "vulva", "vagina", "clitoris", "anus", "nipples", "breasts", "groin", "penis", "testicles"
  ];
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Fixed jumpsuit blocksPoints');
}
