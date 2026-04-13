const fs = require('fs');
let s = fs.readFileSync('src/ui/views/Simulation/SimulationView.tsx', 'utf-8');
const search = `                if (body.reply) {
                    parts.push(body.reply);
                } else if (d.reactionSummary) {
                    parts.push(d.reactionSummary);
                }`;
const replace = `                if (body.reply) {
                    if (typeof body.reply === 'string') {
                        parts.push(body.reply);
                    } else {
                        if (body.reply.reaction) parts.push(\`*(\${body.reply.reaction})*\`);
                        if (body.reply.speech && body.reply.speech.trim() !== '') parts.push(\`"\${body.reply.speech}"\`);
                    }
                } else if (d.reactionSummary) {
                    parts.push(d.reactionSummary);
                }`;
s = s.replace(search, replace);
fs.writeFileSync('src/ui/views/Simulation/SimulationView.tsx', s);
