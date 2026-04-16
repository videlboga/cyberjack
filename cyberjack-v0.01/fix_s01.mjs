import Database from 'better-sqlite3';
const db = new Database('cyberjack.sqlite', { verbose: console.log });

console.log('Fixing Subject S-01...');

try {
    db.prepare('ALTER TABLE subjects ADD COLUMN baseline_tension REAL DEFAULT 0').run();
} catch (e) {}

try {
    db.prepare('ALTER TABLE subjects ADD COLUMN tension REAL DEFAULT 0').run();
} catch (e) {}

const insertSubjectStmt = db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude, baseline_tension, tension)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, tension = excluded.tension
`);

insertSubjectStmt.run(
    'S-01', 'Эли',
    50, 60, 50, 80, 50, // current
    50, 60, 50, 80, 50, // baseline
    0, 0 // tension and baseline_tension
);

console.log('Subject S-01 inserted/updated!');
