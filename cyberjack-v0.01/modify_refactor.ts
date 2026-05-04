import { characterRelationRepo, subjectRepo } from './src/infrastructure/repositories';

async function updateSera() {
    const targetId = 'S-AV-01';
    const playerId = 'PL-1';

    console.log(`Updating ${targetId} stats...`);
    
    // Update subject core state
    const current = subjectRepo.get(targetId);
    subjectRepo.save(targetId, current?.name || 'Сера', {
        sensitivity: current?.sensitivity ?? 50,
        capacity: current?.capacity ?? 50,
        openness: 100,
        plasticity: 100,
        attitude: 100,
        tension: 0
    });

    // Update relation from Sera to Player
    characterRelationRepo.updateAttitude(targetId, playerId, 100, {
        openness: 100,
        plasticity: 100,
        baselineAttitude: 100
    });

    console.log('Done.');
    process.exit(0);
}

updateSera().catch(err => {
    console.error(err);
    process.exit(1);
});
