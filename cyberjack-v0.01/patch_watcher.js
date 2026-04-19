const fs = require('fs');
let file = fs.readFileSync('src/orchestration/conditionWatcher.ts', 'utf8');

// The rules apply to all points. We can add a filter to ignore virtual points:
// if (point.id === 'systemic' || point.id === 'mind_state' || point.id === 'posture') continue;
// Wait, I can just patch the evaluation logic where it loops over points:
file = file.replace(
    /for \(const point of Object.values\(character.body.points\)\) \{/,
    "for (const point of Object.values(character.body.points)) {\n            if (['systemic', 'mind_state', 'posture', 'slot_room', 'slot_social'].includes(point.id)) continue;"
);

// We should also remove the explicit hide we added to AnatomyView in the previous session:
fs.writeFileSync('src/orchestration/conditionWatcher.ts', file);
