const fs = require('fs');
let code = fs.readFileSync('src/ui/App.tsx', 'utf8');
code = code.replace(/body: JSON\.stringify\(\{\s*characterId: moveCharacterId,\s*sceneId: moveSceneId\s*\}\)/s, 
"body: JSON.stringify({\n            characterId: moveCharacterId,\n            sceneId: moveSceneId,\n            slotId: moveSlotId || null\n          })");
fs.writeFileSync('src/ui/App.tsx', code);
