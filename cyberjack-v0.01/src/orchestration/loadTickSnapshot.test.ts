import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { presetRepo, subjectRepo } from '../infrastructure/repositories';
import { loadTickSnapshot } from './loadTickSnapshot';

const baseInput = {
    subjectId: 'S-1',
    pointId: 'systemic',
    playerId: 'PL-1',
    sceneId: 'scene_lab_calibrator',
    initiatorId: 'PL-1',
    presetId: 'stimulate',
    deltaTime: undefined,
};

describe('loadTickSnapshot', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        for (const table of ['action_presets', 'characters', 'active_contexts']) {
            db.prepare(`DELETE FROM ${table}`).run();
        }
        db.prepare('PRAGMA foreign_keys = ON').run();
        presetRepo.saveActionPreset('stimulate', 'Стимуляция', { intensity: 0.5 });
        db.prepare(`INSERT INTO characters (id, name, kind) VALUES (?, ?, ?)`).run('S-1', 'Актив', 'npc');
        subjectRepo.save('S-1', 'Актив', {
            sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 0,
        });
        db.prepare(`
            INSERT OR IGNORE INTO subject_point_states (
                subject_id, point_id, local_sensitivity, local_attitude, local_openness,
                familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness
            )
            SELECT ?, point_id, local_sensitivity, local_attitude, local_openness,
                familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness
            FROM subject_point_states WHERE subject_id = 'S-AV-01'
        `).run('S-1');
    });

    it('loads state and initializes the tick context', () => {
        const result = loadTickSnapshot(baseInput);
        expect(result.state).toBeDefined();
        expect(result.stateBefore.core).toBeDefined();
        expect(result.stateBefore.point).toBeDefined();
        expect(result.preTickContextNotes).toEqual([]);
        expect(result.tickEffects).toEqual([]);
        expect(result.labRelocationApplied).toBe(false);
    });

    it('uses elapsedTime=20 for a wait preset and deltaTime override otherwise', () => {
        expect(loadTickSnapshot({ ...baseInput, presetId: 'wait' }).elapsedTime).toBe(20);
        expect(loadTickSnapshot({ ...baseInput, deltaTime: 7 }).elapsedTime).toBe(7);
    });

    it('is read-only: does not write to the database', () => {
        const before = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        loadTickSnapshot(baseInput);
        const after = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        expect(after.c).toBe(before.c);
    });
});
