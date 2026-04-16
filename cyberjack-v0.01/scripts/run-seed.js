const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'cyberjack.sqlite');
const db = new Database(DB_PATH);

console.log('Running JS seed against', DB_PATH);

function safeRun(sql, params) {
  try {
    db.prepare(sql).run(...(params||[]));
  } catch (e) {
    console.error('seed error:', e && e.message);
  }
}

// Load presets if available
function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// 1) ensure basic subjects from existing seed.ts (S-01, S-02, C-Gamma, PL-1)
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

// 2) load action presets from src/infrastructure/data/presets/actions.json if exists
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

// 3) seed scenes (lab + eli-chamber) minimal if not present
const scenesStmt = db.prepare('INSERT OR REPLACE INTO scenes (id, available_actions, action_costs, transitions, slots) VALUES (?, ?, ?, ?, ?)');
const labActions = JSON.stringify(['gentle_stroke','tickle','light_kiss','deep_kiss','feather_stroke','deep_massage']);
scenesStmt.run('lab', labActions, '{}', '[]', JSON.stringify([{id:'slot_table',name:'Операционный стол',capacity:2}]));
scenesStmt.run('eli-chamber', labActions, '{}', '[]', JSON.stringify([{id:'sector_isolation',name:'Изолятор',capacity:2}]));
console.log('Upserted minimal scenes');

// 4) ensure point_presets exist by copying from seed.ts data if available (but don't overwrite existing)
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

// Show quick DB summary
const subjectsRows = db.prepare('SELECT id,name,sensitivity,capacity,openness,plasticity,attitude,tension FROM subjects').all();
console.log('Subjects in DB:');
console.table(subjectsRows);

process.exit(0);
