import { db } from "../src/infrastructure/db.js";
import { sceneCharacterRepo } from "../src/infrastructure/repositories.js";

async function setupLab() {
    const sceneId = 'lab';
    sceneCharacterRepo.add(sceneId, 'PL-1', 'player');
    sceneCharacterRepo.add(sceneId, 'S-GEN-1', 'npc');

    // Make PL-1 the current player and S-GEN-1 the target
    db.prepare("UPDATE characters SET current_scene_id = ? WHERE id = ?").run(sceneId, 'PL-1');
    db.prepare("UPDATE characters SET current_scene_id = ? WHERE id = ?").run(sceneId, 'S-GEN-1');
    
    // Also establish relations
    db.prepare(`
        INSERT OR REPLACE INTO character_relations (from_id, to_id, knows, present, can_interact, attitude, openness, plasticity)
        VALUES 
        ('PL-1', 'S-GEN-1', 1, 1, 1, 50, 50, 50),
        ('S-GEN-1', 'PL-1', 1, 1, 1, 50, 50, 50)
    `).run();

    console.log("Lab setup complete. PL-1 and S-GEN-1 are in the room.");
}

setupLab();
