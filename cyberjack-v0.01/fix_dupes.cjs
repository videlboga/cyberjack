const fs = require('fs');
let code = fs.readFileSync('src/adapters/llmAdapter.ts', 'utf8');

// Remove duplicate ChatMessage
const firstOcc = code.indexOf('export interface ChatMessage');
const nextOcc = code.indexOf('export interface ChatMessage', firstOcc + 10);
if (nextOcc !== -1) {
  const openBrace = code.indexOf('{', nextOcc);
  const closeBrace = code.indexOf('}', openBrace);
  code = code.substring(0, nextOcc) + code.substring(closeBrace + 1);
}

// Remove duplicate imports
const lines = code.split('\n');
const uniqueImports = new Set();
const outLines = [];
let inImport = false;
for (const line of lines) {
  if (line.startsWith('import ') && line.includes('from')) {
    if (!uniqueImports.has(line)) {
      uniqueImports.add(line);
      outLines.push(line);
    }
  } else {
    outLines.push(line);
  }
}
code = outLines.join('\n');

fs.writeFileSync('src/adapters/llmAdapter.ts', code);
