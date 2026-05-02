// @ts-nocheck
import '../scripts/run-seed.js';
import { runGameTick } from '../src/orchestration/runGameTick';
import { subjectRepo, pointStateRepo } from '../src/infrastructure/repositories';

async function testPerformanceAndDecay() {
    
    console.log('--- Test 1: Performance of 1 Tick ---');
    const start = performance.now();
    await runGameTick({
        subjectId: 'S-NPC-1',
        pointId: 'systemic',
        playerId: 'PL-1',
        sceneId: 'lab',
        presetId: 'wait'
    });
    const end = performance.now();
    console.log(`Time for 1 wait tick: ${(end - start).toFixed(2)} ms`);
    
    console.log('\n--- Test 2: Simulating Tension buildup and decay ---');
    // Bump tension up to see decay
    const subject = subjectRepo.get('S-NPC-1');
    if (subject) {
        subject.tension = 80;
        subject.sensitivity = 40;
        subject.capacity = 80;
        subject.openness = 50;
        subjectRepo.save(subject.id, subject, []);
    }
    
    // Initial state
    const initState = subjectRepo.get('S-NPC-1');
    console.log(`Initial Core: Tension=${initState?.tension.toFixed(2)}, Sensitivity=${initState?.sensitivity.toFixed(2)}, Capacity=${initState?.capacity.toFixed(2)}`);
    
    console.log('\n-- With deltaTime = 1.0 (Realtime manual tick) --');
    await runGameTick({
        subjectId: 'S-NPC-1',
        pointId: 'systemic',
        playerId: 'PL-1',
        sceneId: 'lab',
        presetId: 'wait',
        deltaTime: 1.0
    });
    let st = subjectRepo.get('S-NPC-1');
    console.log(`Manual Tick (1s): Tension=${st?.tension.toFixed(2)}, Sensitivity=${st?.sensitivity.toFixed(2)}, Capacity=${st?.capacity.toFixed(2)}`);

    console.log('\n-- With deltaTime = 20.0 (20s Heartbeat) --');
    await runGameTick({
        subjectId: 'S-NPC-1',
        pointId: 'systemic',
        playerId: 'PL-1',
        sceneId: 'lab',
        presetId: 'wait',
        deltaTime: 20.0
    });
    st = subjectRepo.get('S-NPC-1');
    console.log(`Heartbeat Tick (20s): Tension=${st?.tension.toFixed(2)}, Sensitivity=${st?.sensitivity.toFixed(2)}, Capacity=${st?.capacity.toFixed(2)}`);
    
    console.log('\n-- With active context + Heartbeat --');
    // add an active context artificially
    const { activeContextsRepo } = await import('../src/infrastructure/repositories');
    activeContextsRepo.add('S-NPC-1', 'shibari_restraint', 100);
    // tick heartbeat again
    await runGameTick({
        subjectId: 'S-NPC-1',
        pointId: 'systemic',
        playerId: 'PL-1',
        sceneId: 'lab',
        presetId: 'wait',
        deltaTime: 20.0
    });
    st = subjectRepo.get('S-NPC-1');
    console.log(`Heartbeat Tick + Context (20s): Tension=${st?.tension.toFixed(2)}, Sensitivity=${st?.sensitivity.toFixed(2)}, Capacity=${st?.capacity.toFixed(2)}`);
    
}

testPerformanceAndDecay();
