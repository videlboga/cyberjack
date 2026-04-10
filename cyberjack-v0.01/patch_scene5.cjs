const fs = require('fs');
let code = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');

code = code.replace(
    'const directive = `[Внутренняя директива: Ты решил проявить инициативу. ${decision.reason}. Опиши это действие и свои слова]`;', 
    'const directive = `[Внутренняя директива: Ты проявил инициативу! ${decision.reason}. Опиши совершаемое действие от своего лица, свои чувства и слова в реплай]`;'
);

fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', code);
console.log("Patched 5!!");
