import { presetRepo } from '../src/infrastructure/repositories';
import { validateAction } from '../src/scenario/checkActionAccess';
import { db } from '../src/infrastructure/db';
import { characterItemsRepo } from '../src/infrastructure/repositories';

// 1. Create a dummy scene with the action available
const scene = {
    id: 'lab',
    availableActions: ['handcuff_target'],
    slots: ['center']
};

// 2. Clear inventory
characterItemsRepo.remove('PL-1', 'handcuffs');

// 3. Create the action preset
presetRepo.saveActionPreset('handcuff_target', 'Надеть наручники', {
    intensity: 5, valence: -5, contact: 1, sharpness: 0, novelty: 0,
}, {
    type: 'restraint',
    occupiesPoints: ['wrists'],
    requiresItem: 'handcuffs'
});

console.log('--- Test 1: No Item ---');
const result1 = validateAction('handcuff_target', scene, undefined, 'S-01', 'PL-1');
console.log('Result 1:', result1);

console.log('--- Test 2: Has Item ---');
characterItemsRepo.save({ characterId: 'PL-1', itemId: 'handcuffs' });
const result2 = validateAction('handcuff_target', scene, undefined, 'S-01', 'PL-1');
console.log('Result 2:', result2);

