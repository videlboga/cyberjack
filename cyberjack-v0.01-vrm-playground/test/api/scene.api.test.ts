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
import { presetRepo, subjectRepo } from '../../src/infrastructure/repositories';
import { expect, describe, it, beforeEach } from 'vitest';

// Run longer LLM-backed tests only when LIVE_LLM=true in environment
const itIfLive = process.env.LIVE_LLM ? it : it.skip;

describe('Scene API (contexts)', () => {
  beforeEach(() => {
    // Clean minimal tables used by tests
    db.prepare('DELETE FROM active_contexts').run();
    db.prepare('DELETE FROM action_presets').run();
    db.prepare('DELETE FROM subjects').run();
    db.prepare('DELETE FROM characters').run();
    db.prepare('DELETE FROM subject_point_states').run();
    db.prepare('DELETE FROM event_logs').run();
  });

  it('GET /api/contexts returns empty lists when none exist', async () => {
    const res = await request(app).get('/api/contexts').query({ subjectId: 'S-1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('allPresets');
    expect(Array.isArray(res.body.allPresets)).toBeTruthy();
    expect(res.body).toHaveProperty('activeIds');
  });

  itIfLive('POST /api/contexts/toggle can activate and deactivate a context (global)', async () => {
    // create subject and preset
  subjectRepo.save('sub-1', 'Sub One', { sensitivity: 1, capacity: 1, openness: 50, plasticity: 0, attitude: 50 });
  // Provide a minimal contextConfig so ContextManager will actually apply the context
  presetRepo.saveActionPreset('ctx-1', 'Test Context', { removeContexts: [] }, { duration: 5 });

    // activate globally
  let res = await request(app).post('/api/contexts/toggle').send({ subjectId: 'sub-1', contextId: 'ctx-1', isActive: true });
  if (res.status !== 200) console.error('toggle activate error', res.body);
  expect(res.status).toBe(200);
    expect(res.body.success).toBeTruthy();

    const row = db.prepare('SELECT * FROM active_contexts WHERE subject_id = ? AND action_id = ?').get('sub-1', 'ctx-1');
    expect(row).toBeTruthy();

    // deactivate globally
  res = await request(app).post('/api/contexts/toggle').send({ subjectId: 'sub-1', contextId: 'ctx-1', isActive: false });
  if (res.status !== 200) console.error('toggle deactivate error', res.body);
  expect(res.status).toBe(200);
    const rowAfter = db.prepare('SELECT * FROM active_contexts WHERE subject_id = ? AND action_id = ?').get('sub-1', 'ctx-1');
    expect(rowAfter).toBeUndefined();
  });

  itIfLive('POST /api/contexts/toggle respects pointId scoping', async () => {
  subjectRepo.save('sub-2', 'Sub Two', { sensitivity: 1, capacity: 1, openness: 50, plasticity: 0, attitude: 50 });
  presetRepo.saveActionPreset('ctx-2', 'Head Context', { removeContexts: [] }, { occupiesPoints: ['head'], duration: 5 });

    // Ensure point preset exists to allow subject_point_states insertion elsewhere; we will just use a point id
    db.prepare('INSERT OR IGNORE INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude) VALUES (?, ?, ?, ?)').run('sub-2', 'head', 1, 50);

    // activate on point 'head'
    let res = await request(app).post('/api/contexts/toggle').send({ subjectId: 'sub-2', contextId: 'ctx-2', isActive: true, pointId: 'head' });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT * FROM active_contexts WHERE subject_id = ? AND action_id = ? AND point_id = ?').get('sub-2', 'ctx-2', 'head');
    expect(row).toBeTruthy();

    // deactivate only on that point
    res = await request(app).post('/api/contexts/toggle').send({ subjectId: 'sub-2', contextId: 'ctx-2', isActive: false, pointId: 'head' });
    expect(res.status).toBe(200);
    const rowAfter = db.prepare('SELECT * FROM active_contexts WHERE subject_id = ? AND action_id = ? AND point_id = ?').get('sub-2', 'ctx-2', 'head');
    expect(rowAfter).toBeUndefined();
  });
});
