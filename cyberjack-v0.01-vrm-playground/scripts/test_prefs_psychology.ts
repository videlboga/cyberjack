import { db } from '../src/infrastructure/db';
import { subjectRepo, characterRepo, characterRelationRepo, subjectPreferencesRepo } from '../src/infrastructure/repositories';
import { saveTickState } from '../src/orchestration/saveTickState';

async function run() {
    // 1. Setup
    subjectRepo.save('test_target_1', 'Sub Target', { sensitivity: 50, capacity: 50, openness: 50, plasticity: 80, attitude: 50 });
    characterRepo.ensureSubject('test_target_1', 'Sub Target');

    subjectRepo.save('test_actor_1', 'Dom Actor', { sensitivity: 50, capacity: 50, openness: 50, plasticity: 20, attitude: 50 });
    const actorChar = characterRepo.ensureSubject('test_actor_1', 'Dom Actor');
  db.prepare('UPDATE characters SET kind = \'subject\' WHERE id = \'test_actor_1\'').run();;

    // Dom Sadist: attitude 20 (sympathy -0.6), plasticity 20 (dominance +0.6)
    characterRelationRepo.ensure(actorChar.id, 'test_target_1', { attitude: 20, plasticity: 20 });
    characterRelationRepo.updateAttitude(actorChar.id, 'test_target_1', 20, { openness: 50, plasticity: 20 });

    // Sub Masochist: attitude 80 (sympathy +0.6), plasticity 80 (dominance -0.6)
    characterRelationRepo.ensure('test_target_1', actorChar.id, { attitude: 80, plasticity: 80 });
    characterRelationRepo.updateAttitude('test_target_1', actorChar.id, 80, { openness: 50, plasticity: 80 });

    // Reset prefs
    subjectPreferencesRepo.set('test_target_1', { actions: {}, points: {}, contexts: {} });
    subjectPreferencesRepo.set('test_actor_1', { actions: {}, points: {}, contexts: {} });

    // Mock an action that causes pain/discomfort
    const mockOutput = {
        nextCore: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 80, attitude: 80, tension: 70 },
        nextPoint: { pointId: 'head', localSensitivity: 50, localAttitude: 50, localOpenness: 50 },
        result: {
            pleasure: 0,
            discomfort: 0.8, // Action caused pain
            attitudeShift: 0,
            effectiveSensitivity: 50, effectiveAttitude: 50, finalValence: -1, experiencedIntensity: 0.8,
            overload: 0, engagement: 0.5, learningEffect: 0.1
        },
        delta: { core: {}, point: {} },
        tickMeta: {}
    };

    saveTickState('test_target_1', 'head', 'test_actor_1', 'slap', { novelty: 0.5 } as any, mockOutput as any, 'tick_test_1');

    console.log("=== Target (Submissive) Prefs after pain ===");
    console.log(JSON.stringify(subjectPreferencesRepo.get('test_target_1'), null, 2));

    console.log("\n=== Actor (Dominant Sadist) Prefs after causing pain ===");
    console.log(JSON.stringify(subjectPreferencesRepo.get('test_actor_1'), null, 2)); process.exit(0);
}

run().catch(console.error);
