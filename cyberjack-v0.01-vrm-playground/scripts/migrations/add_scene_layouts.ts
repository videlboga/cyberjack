import Database from 'better-sqlite3';

const db = new Database('cyberjack.sqlite', { verbose: console.log });

db.exec(`
  CREATE TABLE IF NOT EXISTS scene_layouts (
    scene_id TEXT PRIMARY KEY,
    layout_json TEXT NOT NULL,
    FOREIGN KEY (scene_id) REFERENCES scenes(id)
  );
`);
console.log("Migration complete: added scene_layouts");
