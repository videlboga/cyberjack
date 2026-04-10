const fs = require('fs');

let content = fs.readFileSync('scripts/test_llm_proactive.ts', 'utf8');

content = content.replace("actionContext: {},", "actionContext: { intensity: 0.5 },");
fs.writeFileSync('scripts/test_llm_proactive.ts', content);

