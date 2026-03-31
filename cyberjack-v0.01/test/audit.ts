import { runGameTick } from '../src/orchestration/runGameTick';
import { db } from '../src/infrastructure/db';
import { buildDiagnostics } from '../src/diagnostics/buildDiagnostics';
import { buildPromptPayload } from '../src/prompts/buildPromptPayload';

db.exec('DELETE FROM subjects; DELETE FROM subject_point_states; DELETE FROM players; DELETE FROM scenes; DELETE FROM action_presets;');

db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'Test Subject', 50, 50, 40, 50, 50);

db.prepare(`
    INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude)
    VALUES (?, ?, ?, ?)
`).run('S-01', 'p1', 50, 50);

db.prepare(`
    INSERT INTO players (id, resources)
    VALUES (?, ?)
`).run('PL-1', JSON.stringify({}));

db.prepare(`
    INSERT INTO scenes (id, available_actions)
    VALUES (?, ?)
`).run('SC-1', JSON.stringify([]));

db.prepare(`
    INSERT INTO action_presets (id, label, values_json)
    VALUES (?, ?, ?)
`).run('soft_contact', 'Soft Contact', JSON.stringify({
    intensity: 0.7,
    valence: 0.4,
    contact: 0.8,
    sharpness: 0.2,
    novelty: 0.5
}));


async function run() {
  const stateBeforeObj = db.prepare('SELECT * FROM subjects WHERE id = ?').get('S-01');
  const pointBeforeObj = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?').get('S-01', 'p1');
  console.log('[STATE BEFORE]\n' + JSON.stringify({ ...stateBeforeObj as object, point: pointBeforeObj }, null, 2));

  console.log('[INPUT]\n' + JSON.stringify({
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

  const resultBundle = await runGameTick({
    subjectId: 'S-01',
    pointId: 'p1',
    playerId: 'PL-1',
    sceneId: 'SC-1',
    presetId: 'soft_contact',
    playerIntensity: 0.7
  });

  console.log('\n[COMPILED ACTION]\n' + JSON.stringify(resultBundle.action, null, 2));
  console.log('\n[RESULT]\n' + JSON.stringify(resultBundle.result, null, 2));
  
  const stateAfterObj = db.prepare('SELECT * FROM subjects WHERE id = ?').get('S-01');
  const pointAfterObj = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?').get('S-01', 'p1');
  const finalState = { ...stateAfterObj as object, point: pointAfterObj };
  console.log('\n[STATE AFTER]\n' + JSON.stringify(finalState, null, 2));
  
  // Generating diagnostics and prompt here manually as they were stripped from runTick 
  // previously and moved to API logic or prompt mapping.
  // We mock the previous runGameTick returning full output.
  const diagnostics = buildDiagnostics(resultBundle.result, finalState as any, resultBundle.action);
  console.log('\n[DIAGNOSTICS]\n' + JSON.stringify(diagnostics, null, 2));
  
  const prompt = await buildPromptPayload('S-01', resultBundle.result);
  console.log('\n[PROMPT]\n' + prompt.systemPrompt);
}

run().catch(console.error);
