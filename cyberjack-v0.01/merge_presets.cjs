const fs = require('fs');

function parseJSONC(text) {
    return JSON.parse(text.replace(/\/\/.*$/gm, ''));
}

const basic = parseJSONC(fs.readFileSync('src/infrastructure/data/presets/actions_basic.json', 'utf8'));
const extended = parseJSONC(fs.readFileSync('src/infrastructure/data/presets/actions_extended.json', 'utf8'));
const equipmentActions = parseJSONC(fs.readFileSync('src/infrastructure/data/presets/actions_equipment.json', 'utf8'));

const allActions = [...basic, ...extended, ...equipmentActions];

fs.writeFileSync('src/infrastructure/data/presets/actions.json', JSON.stringify(allActions, null, 2));

const eq = parseJSONC(fs.readFileSync('src/infrastructure/data/presets/items_equipment.json', 'utf8'));
const drugs = parseJSONC(fs.readFileSync('src/infrastructure/data/presets/items_drugs.json', 'utf8'));

const allItems = [...eq, ...drugs];

fs.writeFileSync('src/infrastructure/data/presets/items.json', JSON.stringify(allItems, null, 2));

for (const file of ['actions_basic.json', 'actions_extended.json', 'actions_equipment.json', 'items_equipment.json', 'items_drugs.json']) {
    fs.unlinkSync('src/infrastructure/data/presets/' + file);
}
