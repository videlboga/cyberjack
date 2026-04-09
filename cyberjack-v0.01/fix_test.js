const fs = require('fs');
let content = fs.readFileSync('test_commands.js', 'utf8');
content = content.replace('http://localhost:3000/api/action/tick', 'http://localhost:3000/api/tick');
fs.writeFileSync('test_commands.js', content);
