const fs = require('fs');
let s = fs.readFileSync('src/ui/views/Simulation/SimulationView.tsx', 'utf-8');
const search = `            const reqBody: any = {
                subjectId: focusedCharId,
                pointId: 'general',
                intensity,
                sceneId: 'lab',
                playerId: 'PL-1',
                skipLLM: false
            };`;
const replace = `            const reqBody: any = {
                subjectId: focusedCharId,
                pointId: targetPointId,
                intensity,
                sceneId: 'lab',
                playerId: 'PL-1',
                skipLLM
            };`;
s = s.replace(search, replace);
fs.writeFileSync('src/ui/views/Simulation/SimulationView.tsx', s);
