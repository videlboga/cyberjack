const db = require('better-sqlite3')('cyberjack.sqlite');
const scenes = db.prepare(`SELECT id FROM scenes`).all();
const stmt = db.prepare(`INSERT OR IGNORE INTO scene_characters (scene_id, character_id, role, can_act, presence_state, slot_id) VALUES (?, 'PL-1', 'player', 1, 'present', ?)`);
for (const scene of scenes) {
    let slot = null;
    if (scene.id === 'eli-chamber') slot = 'sector_airlock';
    else if (scene.id === 'lab-avatars') slot = 'sector_entrance'; // Guessing
    stmt.run(scene.id, slot || 'general');
}
console.log('Fixed PL-1 scene characters');
