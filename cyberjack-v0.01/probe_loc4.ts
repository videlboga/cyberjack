
import { db } from "./src/infrastructure/db";
import "./src/infrastructure/seed";
import { ensureWorldSeed } from "./src/scenario/worldService";
import { characterRepo } from "./src/infrastructure/repositories";

db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('PL-1', 'Калибратор', 'player', 'scene_liaison')
    ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_liaison'`).run();
console.log("before:", characterRepo.get('PL-1')?.currentSceneId);
// trace all UPDATE characters SET current_scene_id
const orig = db.prepare.bind(db);
db.prepare = (sql, ...args) => {
  if (typeof sql === 'string' && sql.includes('current_scene_id') && sql.includes('UPDATE characters')) {
    console.log("SQL:", sql.slice(0, 80));
  }
  return orig(sql, ...args);
};
ensureWorldSeed();
console.log("after:", characterRepo.get('PL-1')?.currentSceneId);
