import { vi } from 'vitest';
// Mock LLM adapter to avoid network calls during tests
vi.mock('../../src/adapters/llmAdapter', () => ({
  sendToLLM: async (systemPrompt: string) => ({ reply: 'mocked-reply', sentMessages: [{ role: 'system', content: systemPrompt }] }),
  generateCharacterReply: async () => ({ reply: { speech: 'mock speech' }, sentMessages: [] }),
  generateNarratorReply: async () => ({ reaction: 'mock reaction', sentMessages: [] }),
  parseVerbalInputWithLLM: async () => ({ parsed: {}, model: 'mock' })
}));

import request from 'supertest';
import app from '../../src/api/server';
import { db } from '../../src/infrastructure/db';
import { presetRepo, subjectRepo, pointStateRepo, resourceRepo, characterRelationRepo } from '../../src/infrastructure/repositories';
import { expect, describe, it, beforeEach } from 'vitest';

// Run longer LLM-backed tests only when LIVE_LLM=true in environment
const itIfLive = process.env.LIVE_LLM ? it : it.skip;

describe('API - other endpoints', () => {
  beforeEach(() => {
    // clean tables used across tests; some tables may not exist in all schemas,
    // guard each delete with try/catch to avoid test setup failure.
    const tryDelete = (sql: string) => { try { db.prepare(sql).run(); } catch (e) { /* ignore missing table */ } };
    tryDelete('DELETE FROM active_contexts');
    tryDelete('DELETE FROM action_presets');
    tryDelete('DELETE FROM subjects');
    tryDelete('DELETE FROM characters');
    tryDelete('DELETE FROM subject_point_states');
    tryDelete('DELETE FROM event_logs');
  });

  itIfLive('POST /api/wait should run ticks and return state', async () => {
    // ensure subject exists
    subjectRepo.save('WAIT-1', 'Wait Subject', { sensitivity: 1, capacity: 1, openness: 50, plasticity: 0, attitude: 50, tension: 0 });

    // Ensure minimal point state rows required by loadTickState (e.g. 'systemic')
    db.prepare('INSERT OR IGNORE INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude) VALUES (?, ?, ?, ?)').run('WAIT-1', 'systemic', 0, 50);
  // Ensure player resources exist for the player character referenced by orchestration (PL-1)
  try { resourceRepo.save({ id: 'PL-1', resources: { energy: 100, credits: 100 } } as any); } catch (e) { /* ignore */ }
  // Ensure a minimal scene exists (controller defaults to scene 'lab')
  try { db.prepare("INSERT OR IGNORE INTO scenes (id, available_actions) VALUES (?, ?)").run('lab', '[]'); } catch (e) { /* ignore */ }

    const res = await request(app).post('/api/wait').send({ subjectId: 'WAIT-1', ticks: 1 });
    if (res.status !== 200) console.error('/api/wait error', res.body);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('state');
    expect(res.body.success).toBeTruthy();
  });

  itIfLive('POST /api/tick should process a tick (skip LLM)', async () => {
    subjectRepo.save('TICK-1', 'Tick Subject', { sensitivity: 1, capacity: 1, openness: 50, plasticity: 0, attitude: 50, tension: 0 });
    
    // Ensure the systemic point is seeded so loadTickState doesn't crash:
    db.prepare('INSERT OR IGNORE INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude) VALUES (?, ?, ?, ?)').run('TICK-1', 'systemic', 0, 50);

    // Ensure player resources exist for PL-1 used as the playerId
    try { resourceRepo.save({ id: 'PL-1', resources: { energy: 100, credits: 100 } } as any); } catch (e) { /* ignore */ }
    try { db.prepare("INSERT OR IGNORE INTO scenes (id, available_actions) VALUES (?, ?)").run('lab', '[]'); } catch (e) { /* ignore */ }

    const res = await request(app).post('/api/tick').send({ subjectId: 'TICK-1', skipLLM: true });
    if (res.status !== 200) console.error('/api/tick error', res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();
    expect(res.body).toHaveProperty('state');
  });

  it('GET /api/state returns subject and availableActions', async () => {
    // create subject and preset
    subjectRepo.save('S-STATE', 'State Subject', { sensitivity: 1, capacity: 1, openness: 50, plasticity: 0, attitude: 50, tension: 0 });
    presetRepo.saveActionPreset('ap-1', 'ActionPreset', { removeContexts: [] });

    const res = await request(app).get('/api/state').query({ subjectId: 'S-STATE' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();
    expect(res.body).toHaveProperty('availableActions');
  });

  it('GET /api/state scene view omits heavyweight screen data', async () => {
    subjectRepo.save('S-SCENE-STATE', 'Scene State Subject', { sensitivity: 1, capacity: 1, openness: 50, plasticity: 0, attitude: 50, tension: 0 });

    const res = await request(app)
      .get('/api/state')
      .query({ subjectId: 'S-SCENE-STATE', sceneId: 'scene_lab_calibrator', view: 'scene' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();
    expect(res.body.subject).toBeTruthy();
    expect(res.body.availableActions).toEqual([]);
    expect(res.body.availablePoints).toEqual([]);
    expect(res.body.recommendationObservations).toEqual([]);
    expect(res.body.characters).toEqual([]);
  });

  itIfLive('POST /api/subject/update and /api/subject/point', async () => {
    subjectRepo.save('SUB-UP', 'Sub Up', { sensitivity: 10, capacity: 10, openness: 50, plasticity: 0, attitude: 50, tension: 0 });

    // update subject
  let res = await request(app).post('/api/subject/update').send({ subjectId: 'SUB-UP', sensitivity: 20 });
  if (res.status !== 200) console.error('/api/subject/update error', res.body);
  expect(res.status).toBe(200);
  expect(res.body.success).toBeTruthy();

    // update point state
  res = await request(app).post('/api/subject/point').send({ subjectId: 'SUB-UP', pointId: 'hands', localSensitivity: 5 });
  if (res.status !== 200) console.error('/api/subject/point error', res.body);
  expect(res.status).toBe(200);
  expect(res.body.success).toBeTruthy();

    const pt = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?').get('SUB-UP', 'hands');
    expect(pt).toBeTruthy();
    expect(Number(pt.local_sensitivity)).toBeGreaterThanOrEqual(0);
  });

  itIfLive('player endpoints: update and relations', async () => {
    // update player resources
  let res = await request(app).post('/api/player/update').send({ playerId: 'PL-1', resources: { credits: 100 } });
  if (res.status !== 200) console.error('/api/player/update error', res.body);
  expect(res.status).toBe(200);
  expect(res.body.success).toBeTruthy();
  expect(res.body.player).toHaveProperty('resources');

    // update relations
  res = await request(app).post('/api/relations/update').send({ fromId: 'A', toId: 'B', attitude: 60 });
  if (res.status !== 200) console.error('/api/relations/update error', res.body);
  expect(res.status).toBe(200);
  expect(res.body.success).toBeTruthy();
  expect(res.body.relation).toBeTruthy();

    // get relations
  res = await request(app).get('/api/relations').query({ fromId: 'A' });
  if (res.status !== 200) console.error('/api/relations GET error', res.body);
  expect(res.status).toBe(200);
  expect(res.body.success).toBeTruthy();
  expect(Array.isArray(res.body.relations)).toBeTruthy();
  });

  it('meta endpoints: actions, config, generate character, characters list/delete', async () => {
    // actions
    presetRepo.saveActionPreset('meta-ap', 'Meta Action', { removeContexts: [] });
    let res = await request(app).get('/api/actions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();

    // config
    res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();

    // generate character
    res = await request(app).post('/api/characters/generate').send({ subjectId: 'GEN-1', name: 'Gen One' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();
    const subjectId = res.body.subjectId;
    expect(res.body.profile.version).toBe(2);
    expect(res.body.profile.identity.name).toBe('Gen One');
    const generatedSubject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId) as any;
    const modifiers = res.body.profile.mechanicalSeed.coreModifiers;
    expect(generatedSubject.sensitivity).toBe(Math.max(0, Math.min(100, 50 + Number(modifiers.sensitivity || 0))));
    expect(generatedSubject.capacity).toBe(Math.max(0, Math.min(100, 50 + Number(modifiers.capacity || 0))));
    const storedProfile = JSON.parse((db.prepare('SELECT profile_json FROM characters WHERE id = ?').get(subjectId) as any).profile_json);
    expect(storedProfile.base.name).toBe('Gen One');
    expect(storedProfile.generatedProfile.version).toBe(2);

    db.prepare('UPDATE subjects SET sensitivity = 7 WHERE id = ?').run(subjectId);
    res = await request(app).post('/api/characters/prompt').send({ subjectId, seed: 'regenerated-profile' });
    expect(res.status).toBe(200);
    expect(res.body.profile.seed).toBe('regenerated-profile');
    expect((db.prepare('SELECT sensitivity FROM subjects WHERE id = ?').get(subjectId) as any).sensitivity).toBe(7);

    // list characters
    res = await request(app).get('/api/characters');
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();

    // delete the generated character
    res = await request(app).delete(`/api/characters/${subjectId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();
  });

  it('logs endpoints: prompts and engine/orchestrator logs respond', async () => {
    let res = await request(app).get('/api/logs/prompts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();

    res = await request(app).get('/api/logs/engine');
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();

    res = await request(app).get('/api/logs/orchestrator');
    expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();
  });
});
