import { resourceRepo } from './src/infrastructure/repositories';

const playerId = 'PL-1';
const state = {
  id: playerId,
  resources: {
    credits: { characterId: playerId, resourceKey: 'credits', amount: 0 },
    authority: { characterId: playerId, resourceKey: 'authority', amount: 0 }
  }
};

resourceRepo.save(state as any);
console.log('Inserted resources for', playerId);
