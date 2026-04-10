import { characterRepo, subjectRepo, resourceRepo } from '../src/infrastructure/repositories';
import { SubjectCoreState } from '../src/domain/types';
import { db } from '../src/infrastructure/db';

const BROKER_ID = 'B-001';

console.log('Creating broker B-001...');
characterRepo.ensureSubject(BROKER_ID, 'Voron');

const state: SubjectCoreState = {
    sensitivity: 40,
    capacity: 80,
    openness: 60,
    plasticity: 50,
    attitude: 40,
};

subjectRepo.save(BROKER_ID, 'Voron (Fixer)', state);

db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(
    JSON.stringify({ prompt: "You are Voron, a black market fixer. You sell raw assets (people in cryo). Be strictly business, gruff." }),
    BROKER_ID
);

resourceRepo.save({
    id: BROKER_ID,
    resources: {
        'store_catalog': {
            characterId: BROKER_ID,
            resourceKey: 'store_catalog',
            amount: 0,
            metadata: {
                assets: [
                    { id: 'RAW-001', name: 'Fresh Spacer', basePrice: 500, state: 'raw' },
                    { id: 'RAW-002', name: 'Broken Merc', basePrice: 250, state: 'raw' }
                ]
            }
        }
    }
});

console.log('Done! Broker created.');
