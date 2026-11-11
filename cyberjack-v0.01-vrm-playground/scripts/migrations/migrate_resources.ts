import Database from 'better-sqlite3';

const db = new Database('cyberjack.sqlite', { verbose: console.log });

db.exec(`
  CREATE TABLE IF NOT EXISTS character_resources_new (
    character_id TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    amount REAL NOT NULL,
    max_amount REAL,
    regen_rate REAL,
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (character_id, resource_key),
    FOREIGN KEY (character_id) REFERENCES characters(id)
  );
`);

try {
    const oldRows = db.prepare('SELECT id, resources FROM character_resources').all() as any[];
    const insertStmt = db.prepare('INSERT INTO character_resources_new (character_id, resource_key, amount) VALUES (?, ?, ?)');
    
    db.transaction(() => {
        for (const row of oldRows) {
            try {
                const parsed = JSON.parse(row.resources);
                for (const [key, val] of Object.entries(parsed)) {
                    insertStmt.run(row.id, key, Number(val));
                }
            } catch (e) {}
        }
    })();
    db.exec(`DROP TABLE character_resources`);
    db.exec(`ALTER TABLE character_resources_new RENAME TO character_resources`);
} catch (e: any) {
    console.log("Resources table migration skipped or failed:", e.message);
}

// Ensure AP has max and regen
db.exec(`
    UPDATE character_resources 
    SET max_amount = 9999, regen_rate = 1 
    WHERE resource_key = 'actionPoints' OR resource_key = 'AP'
`);

// Migrate Scene action_costs
try {
    const scenes = db.prepare('SELECT id, action_costs FROM scenes').all() as any[];
    const updateScene = db.prepare('UPDATE scenes SET action_costs = ? WHERE id = ?');
    db.transaction(() => {
        for (const scene of scenes) {
            if (!scene.action_costs) continue;
            try {
                const costs = JSON.parse(scene.action_costs);
                const newCosts: any = {};
                for (const [actionId, costMap] of Object.entries(costs)) {
                    if ((costMap as any).require || (costMap as any).consume) {
                        newCosts[actionId] = costMap;
                    } else {
                        newCosts[actionId] = { consume: costMap };
                    }
                }
                updateScene.run(JSON.stringify(newCosts), scene.id);
            } catch(e) {}
        }
    })();
} catch (e: any) {}

console.log("Resource migration complete.");
