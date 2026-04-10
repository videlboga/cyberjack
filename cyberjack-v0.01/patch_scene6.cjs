const fs = require('fs');
let code = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');

code = code.replace(
    ' Ты совершаешь это действие молча. Выдай пустой ответ, ничего не говори.', 
    ' Ты совершаешь это действие молча. Выдай ТОЛЬКО пустой ответ (строку без текста).'
);
// just a small refinement so it actually stops generating anything.

fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', code);
