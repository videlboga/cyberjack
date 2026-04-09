const fs = require('fs');

let seedContent = fs.readFileSync('src/infrastructure/seed.ts', 'utf8');

// Put removeContexts inside values, or just rewrite the JS loop
seedContent = seedContent.replace(
  'db.prepare(`INSERT OR REPLACE INTO action_presets (id, label, type, tags, values_json, context_config_json) VALUES (?, ?, ?, ?, ?, ?)`).run(act.id, act.label, act.type || "physical", JSON.stringify(act.tags || []), JSON.stringify(act.values), act.contextConfig ? JSON.stringify(act.contextConfig) : null);',
  'const valJson = { ...act.values, removeContexts: act.removeContexts }; db.prepare(`INSERT OR REPLACE INTO action_presets (id, label, type, tags, values_json, context_config_json) VALUES (?, ?, ?, ?, ?, ?)`).run(act.id, act.label, act.type || "physical", JSON.stringify(act.tags || []), JSON.stringify(valJson), act.contextConfig ? JSON.stringify(act.contextConfig) : null);'
);

fs.writeFileSync('src/infrastructure/seed.ts', seedContent);
