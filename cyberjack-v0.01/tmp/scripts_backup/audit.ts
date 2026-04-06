import { runGameTick } from './src/orchestration/runGameTick';
import { db } from './src/infrastructure/db';
import { initDB } from './src/infrastructure/repositories';
import { StateRepository } from './src/infrastructure/repositories';

initDB();

const stateRepo = new StateRepository();
stateRepo.saveState({
  id: 'S-01',
  core: { sensitivity: 50, capacity: 50, openness: 40, plasticity: 50, attitude: 50 },
  points: {
    'p1': { id: 'p1', localSensitivity: 50, localAttitude: 50 }
  }
});

async function run() {
  const stateBefore = stateRepo.getState('S-01');
  console.log('[STATE BEFORE]\n', JSON.stringify(stateBefore, null, 2));

  console.log('[INPUT]\n', JSON.stringify({
    subjectId: 'S-01',
    pointId: 'p1',
    action: {
      type: 'soft_contact',
      intensity: 0.7,
      valence: 0.4,
      contact: 0.8,
      sharpness: 0.2,
      novelty: 0.5
    }
  }, null, 2));

  const result = await runGameTick('S-01', 'p1', {
    type: 'soft_contact',
    parameters: {
      intensity: 0.7,
      valence: 0.4,
      contact: 0.8,
      sharpness: 0.2,
      // novelty: 0.5 - note: novelty might be calculated or passed depending on exact schema
    }
  });

  console.log('[COMPILED ACTION]\n', JSON.stringify(result.tickResult.action, null, 2));
  console.log('[RESULT]\n', JSON.stringify(result.tickResult.result, null, 2));
  
  const stateAfter = stateRepo.getState('S-01');
  console.log('[STATE AFTER]\n', JSON.stringify(stateAfter, null, 2));
  console.log('[DIAGNOSTICS]\n', JSON.stringify(result.diagnostics, null, 2));
  console.log('[PROMPT]\n', result.promptPayload.systemPrompt.substring(0, 300) + '...');
}

run().catch(console.error);
