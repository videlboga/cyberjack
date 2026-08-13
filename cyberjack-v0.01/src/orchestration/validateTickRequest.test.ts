import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import { presetRepo } from '../infrastructure/repositories';
import { validateTickRequest } from './validateTickRequest';

const baseInput = {
    subjectId: 'S-1',
    pointId: 'systemic',
    presetId: 'stimulate',
    playerId: 'PL-1',
    initiatorId: 'PL-1',
    sceneId: 'scene_lab_calibrator',
    resources: { id: 'S-1', resources: { energy: { characterId: 'S-1', resourceKey: 'energy', amount: 100 } } } as any,
    scene: { availableActions: ['stimulate', 'costly'] } as any,
    customPayload: null,
};

describe('validateTickRequest', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        for (const table of ['action_presets', 'characters', 'active_contexts']) {
            db.prepare(`DELETE FROM ${table}`).run();
        }
        db.prepare('PRAGMA foreign_keys = ON').run();
        presetRepo.saveActionPreset('stimulate', 'Стимуляция', { intensity: 0.5 });
    });

    it('passes an allowed action without mutation', () => {
        const result = validateTickRequest(baseInput);
        expect(result.resources).toBeDefined();
        expect(result.resources.resources.energy.amount).toBe(100);
    });

    it('rejects an unknown action with an error', () => {
        presetRepo.saveActionPreset('forbidden', 'Forbidden', {});
        const input = {
            ...baseInput,
            presetId: 'forbidden',
            scene: { availableActions: [] } as any,
        };
        expect(() => validateTickRequest(input)).toThrow();
    });

    it('applies resource costs and returns the updated resources', () => {
        const input = {
            ...baseInput,
            scene: {
                availableActions: ['costly'],
                actionCosts: { costly: { consume: { energy: 30 } } },
            } as any,
            presetId: 'costly',
        };
        const result = validateTickRequest(input);
        expect(result.resources.resources.energy.amount).toBe(70);
    });

    it('is read-only: does not persist anything to the database', () => {
        const before = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        validateTickRequest(baseInput);
        const after = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        expect(after.c).toBe(before.c);
    });
});
