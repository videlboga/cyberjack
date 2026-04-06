import fs from 'fs';
let code = fs.readFileSync('src/api/server.ts', 'utf8');
code = code.replace(/console\.log\("ENGINE:", engineOutput\); const diagnostics = buildDiagnostics\(engineOutput\.result, fullState as any, engineOutput\.action\);/g, "const diagnostics = buildDiagnostics(engineOutput.tickMeta?.inputs?.action || {intensity:0, valence:0, contact:0, sharpness:0, novelty:0}, fullState as any, engineOutput);");
fs.writeFileSync('src/api/server.ts', code);
