import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';
import { subjectRepo, pointStateRepo, activeContextsRepo, characterRepo } from '../src/infrastructure/repositories';
import { SubjectCoreState } from '../src/domain/types';
import { db } from '../src/infrastructure/db';

function createTestChar() {
    console.log('Generating test character...');
    const ctx = generateCharacterContext({ seed: 'TEST-SUBJECT-001' });

    console.log(`Generated Subject Config:
      Modifiers: ${JSON.stringify(ctx.baseModifiers)}
      Initial Contexts: ${JSON.stringify(ctx.initialContexts)}
    `);

    const baseStat = (base: number, mod: number) => Math.max(0, Math.min(100, base + mod));
    const state: SubjectCoreState = {
        sensitivity: baseStat(50, ctx.baseModifiers?.sensitivity || 0),
        capacity: baseStat(50, ctx.baseModifiers?.capacity || 0),
        openness: baseStat(50, ctx.baseModifiers?.openness || 0),
        plasticity: baseStat(50, ctx.baseModifiers?.plasticity || 0),
        attitude: baseStat(50, ctx.baseModifiers?.attitude || 0),
    };

    const subjectId = 'S-GEN-1';
    const name = ctx.baseProfile?.name || 'Generated Subject';

    subjectRepo.save(subjectId, name, state);
    console.log(`Saved Subject ${subjectId} / ${name}`);

    db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(
        JSON.stringify({ prompt: ctx.loreNotes }),
        subjectId
    );

    const points = ['general', 'slot_social', 'head', 'face', 'lips', 'neck', 'chest', 'back', 'left_arm', 'right_arm'];
    for (const pt of points) {
        pointStateRepo.save(subjectId, pt, {
            localSensitivity: 50,
            localAttitude: 50,
        });
    }
    console.log(`Saved Point States`);

    // Clean old contexts
    const stmt = db.prepare('DELETE FROM active_contexts WHERE subject_id = ?');
    stmt.run(subjectId);

    if (ctx.initialContexts) {
        for (const contextId of ctx.initialContexts) {
            // make sure action_preset exists, otherwise it throws
            const exists = db.prepare('SELECT id FROM action_presets WHERE id = ?').get(contextId);
            if (exists) {
                const uid = `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                activeContextsRepo.add(uid, subjectId, contextId, -1, null, null);
                console.log(`Added Context: ${contextId}`);
            } else {
                console.log(`Context action_preset ${contextId} NOT FOUND in DB, skipping...`);
            }
        }
    }
    console.log('Test character successfully injected. You can now test it in the UI.');
}

createTestChar();
