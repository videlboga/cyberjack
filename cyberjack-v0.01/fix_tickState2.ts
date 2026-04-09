import fs from 'fs';
let content = fs.readFileSync('src/api/controllers/tickController.ts', 'utf8');
content = content.replace(/resourcesId/g, 'playerId');
content = content.replace(/resourcesSceneChar/g, 'playerSceneChar');
fs.writeFileSync('src/api/controllers/tickController.ts', content);

let rt = fs.readFileSync('src/scenario/runScenarioStep.ts', 'utf8');
rt = rt.replace(/const \{ scene, player, core, mission \} = state;/, 'const { scene, resources, core, mission } = state;');
fs.writeFileSync('src/scenario/runScenarioStep.ts', rt);

let rgt = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');
rgt = rgt.replace(/payload\.resourcesId/g, 'payload.playerId');
fs.writeFileSync('src/orchestration/runGameTick.ts', rgt);
