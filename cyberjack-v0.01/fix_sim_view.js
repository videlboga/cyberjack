const fs = require('fs');
let content = fs.readFileSync('src/ui/views/Simulation/SimulationView.tsx', 'utf8');
content = content.replace(/if \(d\.reactionSummary\)\s*parts\.push\(d\.reactionSummary\);/, 
`if (body.reply) parts.push(body.reply);
        else if (d.reactionSummary) parts.push(d.reactionSummary);`);
fs.writeFileSync('src/ui/views/Simulation/SimulationView.tsx', content);
