const fs = require('fs');
const filepath = 'src/prompts/config.ts';
let code = fs.readFileSync(filepath, 'utf-8');
code = code.replace("Хронология твоих мучений:", "Последние события:");
fs.writeFileSync(filepath, code);
