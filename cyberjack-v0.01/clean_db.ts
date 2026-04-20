import { Database } from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';

const db = new DatabaseConstructor('cyberjack.sqlite');

db.transaction(() => {
    // Delete old scenes
    db.prepare('DELETE FROM scenes WHERE id IN ("eli-chamber", "lab", "SCENE-TEST-1")').run();
    // Delete old characters
    db.prepare('DELETE FROM characters WHERE id IN ("S-01", "S-02", "C-Gamma")').run();
    db.prepare('DELETE FROM subjects WHERE id IN ("S-01", "S-02", "C-Gamma")').run();
    db.prepare('DELETE FROM scene_characters WHERE scene_id IN ("eli-chamber", "lab") OR character_id IN ("S-01", "S-02", "C-Gamma")').run();
})();
console.log("Cleaned old shit from DB");
