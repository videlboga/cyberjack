import { characterRepo, resourceRepo } from '../src/infrastructure/repositories';
console.log('Creating player PL-1...');
characterRepo.ensureCharacter('PL-1', 'Player Operator');
resourceRepo.save({
    id: 'PL-1',
    resources: {
        'strain': 0,
        'credits': 1000
    }
});
console.log('Done! Player and resources created.');
