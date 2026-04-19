const fs = require('fs');
const path = require('path');

// 1. Update actions.json
const actionsPath = path.join(__dirname, 'src/infrastructure/data/presets/actions.json');
let actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));

actions.forEach(act => {
    // Replace validTargets
    if (act.validTargets) {
        act.validTargets = act.validTargets.map(t => {
            if (t === 'global_pose' || t === 'slot_pose') return 'posture';
            if (t === 'general') return 'mind_state';
            return t;
        });
        act.validTargets = [...new Set(act.validTargets)]; // Deduplicate
    }
    
    // Replace occupiesPoints
    if (act.occupiesPoints) {
        act.occupiesPoints = act.occupiesPoints.map(t => {
            if (t === 'global_pose' || t === 'slot_pose') return 'posture';
            if (t === 'general') return 'mind_state';
            return t;
        });
        act.occupiesPoints = [...new Set(act.occupiesPoints)];
    }
});
fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 2), 'utf8');
console.log('Fixed actions.json');

// 2. Update anatomy.ts
const anatomyPath = path.join(__dirname, 'src/domain/anatomy.ts');
if (fs.existsSync(anatomyPath)) {
    let anatomy = fs.readFileSync(anatomyPath, 'utf8');

    // Replace the system points Definitions
    // Let's replace the id constants and structure if present
    anatomy = anatomy.replace(/'global_pose'/g, "'posture'");
    anatomy = anatomy.replace(/'general'/g, "'systemic'");
    
    // Now we might have duplicates of 'posture' if 'slot_pose' existed and was renamed.
    // Instead of simple replacement, let's let the user manually or via grep know what points remain.
    fs.writeFileSync(anatomyPath, anatomy, 'utf8');
    console.log('Fixed anatomy.ts');
}
