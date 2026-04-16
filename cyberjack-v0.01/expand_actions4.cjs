const fs = require('fs');

const seedPath = 'scripts/run-seed.cjs';
let seedScript = fs.readFileSync(seedPath, 'utf8');

// The suspension gear should be added to the eli-chamber scene (where S-01 Eli and Isolator are) 
// and Eli (S-01) should start with the clothes ON in the active_contexts.

// In run-seed.cjs, after all creations, let's inject a snippet that adds eq_suspension to the room
// and adds eq_clothe_panties, eq_clothe_bra to Eli. 

const injectionCode = `
// ==== ADD EQUIPMENT AND CLOTHING (Runtime DB Mod) ====
// 1. Give eq_suspension item to Isolator sector
try {
  db.prepare("INSERT OR REPLACE INTO items (id, name, type, tags) VALUES ('eq_suspension', 'Система подвеса', 'equipment', '[]')").run();
  db.prepare("INSERT OR REPLACE INTO scene_objects (id, scene_id, node_id, item_id, state) VALUES ('obj_suspension_1', 'eli-chamber', 'sector_isolation', 'eq_suspension', 'active')").run();
  console.log('Added suspension equipment to eli-chamber');
} catch(e) {
  console.error(e);
}

// 2. Put panties, bra, and shirt on Eli (S-01)
try {
  const applyContextStmt = db.prepare("INSERT OR REPLACE INTO active_contexts (id, subject_id, action_id, duration) VALUES (?, ?, ?, ?)");
  applyContextStmt.run('ctx_eli_panties', 'S-01', 'eq_clothe_panties', -1);
  applyContextStmt.run('ctx_eli_bra', 'S-01', 'eq_clothe_bra', -1);
  applyContextStmt.run('ctx_eli_shirt', 'S-01', 'eq_clothe_shirt', -1);
  applyContextStmt.run('ctx_eli_pants', 'S-01', 'eq_clothe_pants', -1);
  applyContextStmt.run('ctx_eli_shoes', 'S-01', 'eq_clothe_shoes', -1);
  console.log('Clothed S-01 (Eli)');
} catch(e) {
  console.error(e);
}
// =======================================================
`;

// Insert it right before process.exit(0);
if (!seedScript.includes('// ==== ADD EQUIPMENT AND CLOTHING (Runtime DB Mod) ====')) {
  seedScript = seedScript.replace('process.exit(0);', injectionCode + '\nprocess.exit(0);');
  fs.writeFileSync(seedPath, seedScript);
  console.log('Injected clothing and equipment seed code.');
} else {
  console.log('Injection code already present.');
}
