const fs = require('fs');
let code = fs.readFileSync('src/ui/GameApp.tsx', 'utf8');
code = code.replace(/fetch\(`\$\{API_BASE\}\/api\/state\?subjectId=S-ASSET-1&sceneId=\$\{sceneId\}`\)/g, "fetch(`${API_BASE}/api/state?sceneId=${sceneId}`)");
code = code.replace(/fetchInteractionState\('S-AV-01', false\)/g, "fetchInteractionState('PL-1', false)");
fs.writeFileSync('src/ui/GameApp.tsx', code);
