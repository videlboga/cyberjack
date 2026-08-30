
import { db } from "./src/infrastructure/db";
import "./src/infrastructure/seed";
import { ensureWorldSeed, getPlayerLocation } from "./src/scenario/worldService";
import { characterRepo } from "./src/infrastructure/repositories";

db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('PL-1', 'Калибратор', 'player', 'scene_liaison')
    ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_liaison'`).run();
console.log("after insert:", characterRepo.get('PL-1')?.currentSceneId);
ensureWorldSeed();
console.log("after ensureWorldSeed:", characterRepo.get('PL-1')?.currentSceneId);
