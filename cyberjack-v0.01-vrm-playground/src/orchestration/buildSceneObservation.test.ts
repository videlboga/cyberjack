import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import { presetRepo } from '../infrastructure/repositories';
import { buildSceneObservation } from './buildSceneObservation';

function baseOutput() {
    return {
        nextCore: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 10 },
        nextPoint: { pointId: 'systemic', localSensitivity: 50, localAttitude: 50, localOpenness: 50, familiarity: 0, exposureCount: 0 },
        result: {
            effectiveSensitivity: 50, effectiveAttitude: 50, attitudeShift: 0,
            finalValence: 0.3, pleasure: 5, discomfort: 0, overload: 0,
            experiencedIntensity: 3, engagement: 1, learningEffect: 0,
        },
        delta: { core: {} as any, point: {} as any },
        tickMeta: { inputs: {} as any },
    } as any;
}

describe('buildSceneObservation', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        db.prepare(`DELETE FROM action_presets`).run();
        db.prepare('PRAGMA foreign_keys = ON').run();
        presetRepo.saveActionPreset('stimulate', 'Стимуляция', { intensity: 0.5 });
    });

    it('returns undefined for a non-observable action', () => {
        const result = buildSceneObservation({
            observableAction: false,
            activeSceneId: 'scene_lab',
            playerId: 'PL-1',
            subjectId: 'S-1',
            pointId: 'systemic',
            presetId: 'wait',
            actionApplied: false,
            compiledAction: { actionKey: 'wait', label: 'Ожидание', type: 'wait' } as any,
            output: baseOutput(),
            worldMinute: 10,
            hasTransitions: false,
        });
        expect(result).toBeUndefined();
    });

    it('builds an observation with the resolved actor and final valence', () => {
        const result = buildSceneObservation({
            observableAction: true,
            activeSceneId: 'scene_lab',
            playerId: 'PL-1',
            actingCharacterId: 'PL-1',
            subjectId: 'S-1',
            pointId: 'systemic',
            presetId: 'stimulate',
            actionApplied: true,
            compiledAction: { actionKey: 'stimulate', label: 'Стимуляция', type: 'physical', tags: ['contact'] } as any,
            output: baseOutput(),
            worldMinute: 42,
            hasTransitions: true,
        });
        expect(result).toBeDefined();
        expect(result!.sceneId).toBe('scene_lab');
        expect(result!.actorId).toBe('PL-1');
        expect(result!.targetId).toBe('S-1');
        expect(result!.actionId).toBe('stimulate');
        expect(result!.finalValence).toBeCloseTo(0.3);
        expect(result!.notable).toBe(true);
        expect(result!.worldMinute).toBe(42);
    });

    it('is read-only: does not write to the database', () => {
        const before = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        buildSceneObservation({
            observableAction: true,
            activeSceneId: 'scene_lab',
            playerId: 'PL-1',
            subjectId: 'S-1',
            pointId: 'systemic',
            presetId: 'stimulate',
            actionApplied: true,
            compiledAction: { actionKey: 'stimulate', label: 'Стимуляция', type: 'physical', tags: [] } as any,
            output: baseOutput(),
            worldMinute: 5,
            hasTransitions: false,
        });
        const after = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        expect(after.c).toBe(before.c);
    });
});
