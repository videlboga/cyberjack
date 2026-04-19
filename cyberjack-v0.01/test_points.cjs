const Database = require('better-sqlite3');
const db = new Database('cyberjack.sqlite');
const id = 'S-01';
const points = db.prepare('SELECT p.id, p.label, sps.local_sensitivity, sps.local_attitude, sps.local_openness, sps.familiarity, sps.exposure_count FROM point_presets p JOIN subject_point_states sps ON p.id = sps.point_id WHERE sps.subject_id = ?').all(id);
console.log(points.slice(0, 2));
