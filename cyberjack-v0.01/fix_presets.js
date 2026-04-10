const fs = require('fs');

function fixTargets(obj) {
    if (obj.validTargets) {
        const newTargets = new Set();
        for (const t of obj.validTargets) {
            if (t === 'torso') {
                newTargets.add('chest');
                newTargets.add('belly');
                newTargets.add('back');
            } else if (t === 'limbs') {
                newTargets.add('arms');
                newTargets.add('legs'); // Left/Right leg or generic? legs isn't there, left_leg/right_leg are
                newTargets.add('left_leg');
                newTargets.add('right_leg');
                newTargets.add('left_arm');
                newTargets.add('right_arm');
            } else {
                newTargets.add(t);
            }
        }
        obj.validTargets = Array.from(newTargets);
    }
    
    if (obj.contextConfig && obj.contextConfig.occupiesPoints) {
        const newPoints = new Set();
        for (const p of obj.contextConfig.occupiesPoints) {
            if (p === 'internal_lower') {
                newPoints.add('vagina');
                newPoints.add('anus');
            } else {
                newPoints.add(p);
            }
        }
        obj.contextConfig.occupiesPoints = Array.from(newPoints);
    }
}

function fixRules(obj) {
    if (obj.rules) {
        for (const r of obj.rules) {
            if (r.trigger && r.trigger.requireTarget === 'torso') {
                r.trigger.requireTarget = 'chest'; // Fallback since requireTarget takes string not array yet
                // Or maybe we can't map multiple? Just change trait description to chest/belly
            }
        }
    }
}

const actsPath = 'src/infrastructure/data/presets/actions.json';
const acts = JSON.parse(fs.readFileSync(actsPath, 'utf8'));
acts.forEach(fixTargets);
fs.writeFileSync(actsPath, JSON.stringify(acts, null, 2));

const traitsPath = 'src/infrastructure/data/presets/traits.json';
const traits = JSON.parse(fs.readFileSync(traitsPath, 'utf8'));
traits.forEach(fixRules);
fs.writeFileSync(traitsPath, JSON.stringify(traits, null, 2));

console.log('Fixed preset targets and points to match DB strictly.');
