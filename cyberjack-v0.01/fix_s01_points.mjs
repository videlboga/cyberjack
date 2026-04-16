import Database from 'better-sqlite3';
import fs from 'fs';
const db = new Database('cyberjack.sqlite', { verbose: console.log });

console.log('Fixing points for S-01...');

const insertPointStmt = db.prepare(`
    INSERT OR IGNORE INTO point_presets (id, label, values_json, parent_id, provides_functions, tags)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const insertSubjectPointStmt = db.prepare(`
    INSERT INTO subject_point_states (
        subject_id, point_id, local_sensitivity, local_attitude,
        baseline_local_sensitivity, baseline_local_attitude
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(subject_id, point_id) DO UPDATE SET
        local_sensitivity = excluded.local_sensitivity,
        local_attitude = excluded.local_attitude
`);

// minimal set of points for S-01 to avoid crash
const pList = [
    { id: "global_pose", label: "Общая поза", sens: 10, att: 0 },
    { id: "head", label: "Голова", sens: 20, att: 0 }
];

db.transaction(() => {
    for (const p of pList) {
        const vJson = JSON.stringify({ sens: p.sens, att: p.att });
        insertPointStmt.run(p.id, p.label, vJson, null, null, null);
        insertSubjectPointStmt.run(
            'S-01', p.id,
            p.sens, p.att,
            p.sens, p.att
        );
    }
})();

console.log('Done!');
