const fs = require('fs');

let content = fs.readFileSync('scripts/test_llm_proactive.ts', 'utf8');

content = "import 'dotenv/config';\n" + content;
fs.writeFileSync('scripts/test_llm_proactive.ts', content);

