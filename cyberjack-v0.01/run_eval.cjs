const fs = require('fs');
let code = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');
code = code.replace(/if \(!bundle.event.result\) \{[\s\S]*?bundle\.event\.result = \{\};[\s\S]*?\}/, "if (!bundle.event.result) bundle.event.result = {};");
fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', code);
