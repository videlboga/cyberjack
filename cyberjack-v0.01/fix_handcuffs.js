const fs = require('fs');

const actsPath = 'src/infrastructure/data/presets/actions.json';
const acts = JSON.parse(fs.readFileSync(actsPath, 'utf8'));
for (const obj of acts) {
    if (obj.validTargets) {
        obj.validTargets = obj.validTargets.map(t => t === 'hands' ? 'left_hand' : t);
        obj.validTargets = obj.validTargets.map(t => t === 'hands' ? 'right_hand' : t);
    }
    if (obj.contextConfig && obj.contextConfig.occupiesPoints) {
        if (obj.contextConfig.occupiesPoints.includes('hands')) {
            obj.contextConfig.occupiesPoints = obj.contextConfig.occupiesPoints.filter(p => p !== 'hands');
            obj.contextConfig.occupiesPoints.push('left_hand', 'right_hand');
        }
    }
}
fs.writeFileSync(actsPath, JSON.stringify(acts, null, 2));

console.log('Fixed handcuffs.');
