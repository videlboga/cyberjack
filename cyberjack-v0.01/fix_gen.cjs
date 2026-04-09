const fs = require('fs');
let code = fs.readFileSync('src/orchestration/characterGenerator/generator.ts', 'utf8');
code = code.replace(/Boolean\(tag\)\s*&&\s*tag\s*&&\s*!excludeSet\.has\(tag\.id\)\s*&&\s*!selected\.has\(tag\.id\)\s*&&\s*requirementsMet\(tag, selected\)/g, 
"Boolean(tag) && tag && !excludeSet.has(tag.id) && !selected.has(tag.id) && requirementsMet(tag as any, selected)");
fs.writeFileSync('src/orchestration/characterGenerator/generator.ts', code);
