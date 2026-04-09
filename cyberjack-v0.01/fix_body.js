const fs = require('fs');

let content = fs.readFileSync('src/orchestration/eventRouter.ts', 'utf8');
content = content.replace("presetId: payload.presetId,", "presetId: payload.presetId || 'verbal_pressure',");
fs.writeFileSync('src/orchestration/eventRouter.ts', content);
