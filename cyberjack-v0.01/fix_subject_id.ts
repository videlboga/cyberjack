import { db } from './src/infrastructure/db.ts';
import { getBaseHumanAnatomy } from './src/domain/anatomy.ts';

const targetId = 'S-AV-01';

db.prepare("INSERT OR IGNORE INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude) VALUES (?, ?, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50)").run(targetId, 'Serah');
db.prepare("INSERT OR IGNORE INTO characters (id, name, kind, subject_id, player_id) VALUES (?, ?, 'asset', ?, 'PL-1')").run(targetId, 'Serah', targetId);

const points = getBaseHumanAnatomy('female');
const insertPointStmt = db.prepare("INSERT OR IGNORE INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) VALUES (?, ?, ?, ?, ?, ?)");
const insertSubjectPointStmt = db.prepare("INSERT OR IGNORE INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude) VALUES (?, ?, ?, ?, 0, 0, ?, ?)");

for (const p of points) {
    const vJson = JSON.stringify({ sens: p.sens, att: p.att });
    insertPointStmt.run(p.id, p.label, vJson, p.parentId || null, p.providesFunctions ? JSON.stringify(p.providesFunctions) : null, null);
    insertSubjectPointStmt.run(targetId, p.id, p.sens, p.att, p.sens, p.att);
}
console.log('Subject S-AV-01 successfully added to DB with all anatomy points.');
