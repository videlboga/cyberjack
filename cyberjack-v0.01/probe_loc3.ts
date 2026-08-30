
import { db } from "./src/infrastructure/db";
import "./src/infrastructure/seed";
import { ensureWorldSeed } from "./src/scenario/worldService";
import { characterRepo } from "./src/infrastructure/repositories";

db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('PL-1', 'Калибратор', 'player', 'scene_liaison')
    ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_liaison'`).run();
console.log("before:", characterRepo.get('PL-1')?.currentSceneId);
// monkeypatch sceneCharacterRepo.set to log
const { sceneCharacterRepo } = await import("./src/infrastructure/repositories");
const origSet = sceneCharacterRepo.set.bind(sceneCharacterRepo);
sceneCharacterRepo.set = (sceneId, charId, opts) => {
  if (charId === 'PL-1') console.log("SET PL-1 ->", sceneId);
  return origSet(sceneId, charId, opts);
};
ensureWorldSeed();
console.log("after:", characterRepo.get('PL-1')?.currentSceneId);
