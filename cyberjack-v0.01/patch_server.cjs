const fs = require('fs');
const file = 'src/api/server.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "ContextManager.processTick(subjectId);",
    "if (!req.body.skipTimeTick) {\n            ContextManager.processTick(subjectId);\n        }"
);

const llmStart = "// 4. SillyTavern Communication (External Adapter)";
const llmEndRe = /maybeSummarizeChat\(subjectId\);\s+res\.json\(\{/g;

// Instead of regex replace on big block, inject if (!req.body.skipLLM)
code = code.replace(llmStart, `if (!req.body.skipLLM) {
        ${llmStart}`);

code = code.replace(/maybeSummarizeChat\(subjectId\);\s+res\.json\(\{/, `}
        maybeSummarizeChat(subjectId);

        res.json({`);

fs.writeFileSync(file, code);
console.log('patched');
