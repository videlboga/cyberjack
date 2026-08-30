
import { db } from "./src/infrastructure/db";
import "./src/infrastructure/seed";
import { getPlayerLocation } from "./src/scenario/worldService";
import { characterRepo } from "./src/infrastructure/repositories";

db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('PL-1', 'Калибратор', 'player', 'scene_liaison')
    ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_liaison'`).run();
const ch = characterRepo.get('PL-1');
console.log("char:", ch ? ch.id : null, "scene:", ch?.currentSceneId);
console.log("loc:", getPlayerLocation('PL-1').id);
