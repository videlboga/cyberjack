const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'cyberjack.sqlite');
const db = new Database(DB_PATH);

console.log('Running JS seed against', DB_PATH);

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const subjects = [
  { id: 'S-01', name: 'Эли', state: { sensitivity:50, capacity:60, openness:50, plasticity:80, attitude:50 } },
  { id: 'S-02', name: 'Никс', state: { sensitivity:40, capacity:50, openness:60, plasticity:30, attitude:20 } },
  { id: 'C-Gamma', name: 'Векс', state: { sensitivity:20, capacity:90, openness:10, plasticity:10, attitude:90 } },
  { id: 'PL-1', name: 'Калибратор', state: { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50 } }
];

const insertSubject = db.prepare(`INSERT OR REPLACE INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const s of subjects) {
  insertSubject.run(
    s.id, s.name,
    s.state.sensitivity, s.state.capacity, s.state.openness, s.state.plasticity, s.state.attitude,
    0, '{}',
    s.state.sensitivity, s.state.capacity, s.state.openness, s.state.plasticity, s.state.attitude
  );
}
console.log('Inserted core subjects');

const actions = loadJson('src/infrastructure/data/presets/actions.json');
if (actions) {
  const stmt = db.prepare('INSERT OR REPLACE INTO action_presets (id, label, type, tags, values_json, context_config_json) VALUES (?, ?, ?, ?, ?, ?)');
  for (const act of actions) {
    const id = act.id || act.key || act.name;
    const label = act.label || act.name || id;
    const type = (act.type || (act.categories && act.categories[0]) || 'physical');
    const tags = JSON.stringify(act.tags || []);
    const values = JSON.stringify(act.values || act.vector || act.values_json || {});
    const ctx = act.contextConfig ? JSON.stringify(act.contextConfig) : null;
    try { stmt.run(id, label, type, tags, values, ctx); } catch (e) { console.error('action insert err', id, e.message); }
  }
  console.log('Seeded action_presets from JSON:', actions.length);
} else {
  console.log('No actions preset JSON found, skipping actions seeding');
}

const scenesStmt = db.prepare('INSERT OR REPLACE INTO scenes (id, available_actions, action_costs, transitions, slots) VALUES (?, ?, ?, ?, ?)');
const labActions = JSON.stringify(['gentle_stroke','tickle','light_kiss','deep_kiss','feather_stroke','deep_massage','licking','firm_grip','light_bite','hard_bite','pinch','scratching','slap','hard_slap','needle_prick','belt_strike','whip_strike','taser_shock','ice_cube','hot_wax','vibrator_pulse','hair_pull','spit','breath_blow','verbal_pressure','stare','close_inspection','feint_strike','pose_kneeling','restraint_cuffs','pose_standing','pose_all_fours','pose_spread_eagle','eq_blindfold_apply','eq_blindfold_remove','eq_gag_apply','eq_gag_remove','eq_clothe_robe','eq_strip_robe','eq_clothe_shirt','eq_strip_shirt','eq_clothe_pants','eq_strip_pants','eq_clothe_shoes','eq_strip_shoes','pose_sitting','pose_lying_down','act_suspend_wrists','act_release_wrists','eq_clothe_panties','eq_strip_panties','eq_clothe_bra','eq_strip_bra']);
scenesStmt.run('lab', labActions, '{}', '[]', JSON.stringify([{id:'slot_table',name:'Операционный стол',capacity:2}]));
scenesStmt.run('eli-chamber', labActions, '{}', '[]', JSON.stringify([{id:'sector_isolation',name:'Изолятор',capacity:2}]));
console.log('Upserted minimal scenes');

const pointPresets = loadJson('src/infrastructure/data/presets/points.json');
if (pointPresets) {
  const stmt = db.prepare('INSERT OR REPLACE INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of pointPresets) {
    try { stmt.run(p.id, p.label, JSON.stringify(p.values || {}), p.parentId || null, JSON.stringify(p.providesFunctions || []), JSON.stringify(p.tags || [])); } catch(e){console.error('point insert', e.message);}    
  }
  console.log('Seeded point_presets:', pointPresets.length);
} else {
  console.log('No point presets JSON, skipping');
}

console.log('JS seed finished.');

const subjectsRows = db.prepare('SELECT id,name,sensitivity,capacity,openness,plasticity,attitude,tension FROM subjects').all();
console.log('Subjects in DB:');
console.table(subjectsRows);


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
  const applyContextStmt = db.prepare("INSERT OR REPLACE INTO active_contexts (id, subject_id, action_id, duration, point_id) VALUES (?, ?, ?, ?, ?)");
  applyContextStmt.run('ctx_eli_panties', 'S-01', 'eq_clothe_panties', -1, 'vulva');
  applyContextStmt.run('ctx_eli_bra', 'S-01', 'eq_clothe_bra', -1, 'chest');
  applyContextStmt.run('ctx_eli_shirt', 'S-01', 'eq_clothe_shirt', -1, 'shoulders');
  applyContextStmt.run('ctx_eli_pants', 'S-01', 'eq_clothe_pants', -1, 'hips');
  applyContextStmt.run('ctx_eli_shoes', 'S-01', 'eq_clothe_shoes', -1, 'feet');
  console.log('Clothed S-01 (Eli)');
} catch(e) {
  console.error(e);
}
// =======================================================

const insertResourceStmt = db.prepare(`
  INSERT OR REPLACE INTO character_resources (character_id, resource_key, amount, max_amount, regen_rate, metadata)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertResourceStmt.run('PL-1', 'credits', 0, 1000, 0, '{}');
insertResourceStmt.run('PL-1', 'authority', 0, 100, 0, '{}');
process.exit(0);
