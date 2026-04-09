const fs = require('fs');
let code = fs.readFileSync('src/ui/App.tsx', 'utf8');

code = code.replace(/handleAction\(\)/g, "addToQueue()");

// Also fix item.duration > 0
code = code.replace("item.duration > 0", "(item.duration || 0) > 0");
code = code.replace("duration: item.duration", "duration: item.duration || -1");

fs.writeFileSync('src/ui/App.tsx', code);
