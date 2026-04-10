const fs = require('fs');

let content = fs.readFileSync('scripts/test_llm_proactive.ts', 'utf8');

content = content.replace("compiledAction: { intensity: 0.5, novelty: 0.8, actionPoints: 5, actionType: 'wait' }", "compiledAction: { intensity: 0.5, novelty: 0.8, actionPoints: 5, actionType: 'wait' }, stateBefore: { core: {} }, stateAfter: { core: {} }");
fs.writeFileSync('scripts/test_llm_proactive.ts', content);

