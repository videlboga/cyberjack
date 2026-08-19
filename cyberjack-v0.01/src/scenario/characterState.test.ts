import { describe, expect, it, beforeAll } from 'vitest';
import { db } from '../infrastructure/db';
import { reconcileCharacterState } from './characterState';
import { seedOneCandidate } from './generatedCandidates';

const MAI = 'NPC-CAND-GEN-04';

describe('reconcileCharacterState — единый механизм приведения к канону', () => {
  beforeAll(() => {
    if (!db.prepare('SELECT 1 FROM characters WHERE id = ?').get(MAI)) {
      seedOneCandidate({ id: MAI, seed: 'omnicron-candidate-random-04-v1', name: 'Май', age: 19, gender: 'female' });
    }
  });

  it('применяет стартовые трейты к subjects.preferences', () => {
    reconcileCharacterState(MAI, { resetPoints: true });
    const row = db.prepare('SELECT preferences FROM subjects WHERE id = ?').get(MAI) as any;
    const prefs = JSON.parse(row.preferences || '{}');
    expect(prefs.tags.pain).toBe(3.5);
    expect(prefs.tags.impact).toBe(3.5);
  });

  it('обнуляет статистику subject_point_states (familiarity, exposure_count)', () => {
    db.prepare(`UPDATE subject_point_states SET familiarity = 42, exposure_count = 99 WHERE subject_id = ? AND point_id = 'systemic'`).run(MAI);
    reconcileCharacterState(MAI, { resetPoints: true });
    const row = db.prepare(`SELECT familiarity, exposure_count FROM subject_point_states WHERE subject_id = ? AND point_id = 'systemic'`).get(MAI) as any;
    expect(row.familiarity).toBe(0);
    expect(row.exposure_count).toBe(0);
  });
});
