const fs = require('fs');

const seedPath = 'src/infrastructure/seed.ts';
let seedCode = fs.readFileSync(seedPath, 'utf8');

// Add imports
if (!seedCode.includes('import fs from')) {
    seedCode = seedCode.replace("import { db } from './db.js';", "import { db } from './db.js';\nimport fs from 'fs';\nimport { ActionPresetSchema, ItemPresetSchema, TraitPresetSchema } from '../domain/schemas.js';");
}

// Find where `const actions = [` is and maybe replace some things or just append our parsing logic before `for (const action of actions) {`
// Actually, it's safer to just inject a block right before the loop that parses and pushes our new actions, items, and traits into the DB.
// Let's check how actions look: `const insertActionStmt = db.prepare('INSERT INTO action_presets...`

const injectCode = `
    console.log("Loading and validating JSON presets...");
    const rawActions = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/actions.json', 'utf8'));
    const rawItems = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/items.json', 'utf8'));
    const rawTraits = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/traits.json', 'utf8'));

    // Load Items
    const insertItemStmt = db.prepare('INSERT OR IGNORE INTO items (id, name, type, tags, description) VALUES (?, ?, ?, ?, ?)');
    for (const item of rawItems) {
        const validItem = ItemPresetSchema.parse(item);
        insertItemStmt.run(validItem.id, validItem.name, validItem.type, JSON.stringify(validItem.tags || []), validItem.description || '');
    }

    // Load Actions
    const insertActionStmt = db.prepare('INSERT OR IGNORE INTO action_presets (id, label, type, tags, values_json, context_config_json, requires_item) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const act of rawActions) {
        const validAct = ActionPresetSchema.parse(act);
        
        insertActionStmt.run(
            validAct.id,
            validAct.name,
            validAct.categories[0], // map first category as type
            JSON.stringify(validAct.tags),
            JSON.stringify(validAct.vector),
            validAct.contextConfig ? JSON.stringify(validAct.contextConfig) : null,
            validAct.requiresItem || null
        );
    }
    
    // Load Traits
    const insertTraitStmt = db.prepare('INSERT OR IGNORE INTO traits (id, name, description, rules_json) VALUES (?, ?, ?, ?)');
    for (const trait of rawTraits) {
        const validTrait = TraitPresetSchema.parse(trait);
        insertTraitStmt.run(
            validTrait.id,
            validTrait.name,
            validTrait.description || '',
            JSON.stringify(validTrait.rules)
        );
    }
    console.log("JSON presets loaded successfully!");
`;

// Just put it right after db.transaction(() => {
if (!seedCode.includes('Loading and validating JSON presets...')) {
    seedCode = seedCode.replace('db.transaction(() => {', 'db.transaction(() => {\n' + injectCode);
    fs.writeFileSync(seedPath, seedCode);
    console.log('seed.ts patched.');
} else {
    console.log('Already patched.');
}
