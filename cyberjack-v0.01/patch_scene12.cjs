const fs = require('fs');

let content = fs.readFileSync('scripts/test_llm_proactive.ts', 'utf8');
content = content.replace("subjectId: playerId", "subjectId: npcId");
content = content.replace("const bundle = {", "sceneCharacterRepo.set(sceneId, npcId, { role: 'npc' }); sceneCharacterRepo.set(sceneId, playerId, { role: 'player' });\n    const bundle = {");
fs.writeFileSync('scripts/test_llm_proactive.ts', content);

