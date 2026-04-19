const fs = require('fs');
console.log(fs.readFileSync('src/ui/GameApp.tsx', 'utf8').split('return').map((p, i) => i + ': ' + p.substring(0, 50)).join('\n'));
