import Database from 'better-sqlite3';

const db = new Database('cyberjack.sqlite', { verbose: console.log });

db.exec(`
  CREATE TABLE IF NOT EXISTS character_items (
    character_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    state TEXT DEFAULT 'active',
    charges INTEGER DEFAULT -1,
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (character_id, item_id),
    FOREIGN KEY (character_id) REFERENCES characters(id)
  );

  CREATE TABLE IF NOT EXISTS scene_objects (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    node_id TEXT,
    item_id TEXT NOT NULL,
    owner_id TEXT,
    state TEXT DEFAULT 'active',
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (scene_id) REFERENCES scenes(id)
  );
`);
console.log("Migration complete: added character_items and scene_objects");
