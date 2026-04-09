const fs = require('fs');
const file = 'src/engine/normalize.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("config.core.defaults[key],", "(config.core.defaults as any)[key] || 0,");

fs.writeFileSync(file, code);
console.log('patched normalize');
