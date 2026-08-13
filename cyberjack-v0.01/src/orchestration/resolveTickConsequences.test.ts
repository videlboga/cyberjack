import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import { presetRepo } from '../infrastructure/repositories';
import { resolveTickConsequences } from './resolveTickConsequences';
import type { TickOutput } from '../domain/types';

function makeOutput(overrides: Partial<TickOutput> = {}): TickOutput {
    return {
        nextCore: {
            sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 0,
        },
        nextPoint: {
            pointId: 'systemic', localSensitivity: 50, localAttitude: 50, localOpenness: 50, familiarity: 0, exposureCount: 0,
        },
        result: {
            effectiveSensitivity: 50, effectiveAttitude: 50, attitudeShift: 0,
            finalValence: 0, pleasure: 0, discomfort: 0, overload: 0,
            experiencedIntensity: 0, engagement: 0, learningEffect: 0,
        },
        delta: { core: {} as any, point: {} as any },
        tickMeta: { inputs: {} as any },
        ...overrides,
    } as any;
}

const baseInput = {
    subjectId: 'S-1',
    pointId: 'systemic',
    presetId: 'stimulate',
    coreBefore: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 0 } as any,
    history: [],
    activeContextIds: [],
};

describe('resolveTickConsequences', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        for (const table of ['action_presets', 'subject_edge_states', 'active_contexts', 'world_state']) {
            db.prepare(`DELETE FROM ${table}`).run();
        }
        db.prepare('PRAGMA foreign_keys = ON').run();
        db.prepare(`INSERT INTO world_state (id, total_minutes) VALUES ('main', 100)`).run();
    });

    it('is pure: does not write to the database, only returns effects', () => {
        presetRepo.saveActionPreset('effect_refractory', 'Refractory', { intensity_mult: 0.25 }, { type: 'condition', duration: 3, occupiesPoints: [] });
        const output = makeOutput({
            nextCore: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 100 },
            result: {
                effectiveSensitivity: 50, effectiveAttitude: 50, attitudeShift: 0,
                finalValence: 0.5, pleasure: 20, discomfort: 0, overload: 0,
                experiencedIntensity: 10, engagement: 0, learningEffect: 0,
            },
        });
        const before = db.prepare(`SELECT COUNT(*) AS c FROM active_contexts`).get() as any;
        const result = resolveTickConsequences({ ...baseInput, output });
        const after = db.prepare(`SELECT COUNT(*) AS c FROM active_contexts`).get() as any;
        expect(after.c).toBe(before.c);
        // The refractory context is expressed as an effect, not applied here.
        expect(result.effects.some(e => e.kind === 'context.apply' && e.actionId === 'effect_refractory')).toBe(true);
    });

    it('resolves a positive discharge into a refractory effect and edge clear', () => {
        presetRepo.saveActionPreset('effect_refractory', 'Refractory', { intensity_mult: 0.25 }, { type: 'condition', duration: 3, occupiesPoints: [] });
        const output = makeOutput({
            nextCore: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 100 },
            result: {
                effectiveSensitivity: 50, effectiveAttitude: 50, attitudeShift: 0,
                finalValence: 0.5, pleasure: 20, discomfort: 0, overload: 0,
                experiencedIntensity: 10, engagement: 0, learningEffect: 0,
            },
        });
        const result = resolveTickConsequences({ ...baseInput, output });
        expect(result.notableObservationEvent).toBe('positive_discharge');
        expect(result.peakEventToLog?.presetId).toBe('discharge');
        expect(result.effects.some(e => e.kind === 'context.apply' && e.actionId === 'effect_refractory')).toBe(true);
        expect(result.effects.some(e => e.kind === 'edge.clear')).toBe(true);
        expect(result.output.nextCore.tension).toBe(10);
    });

    it('resolves exhaustion without a discharge when capacity hits zero', () => {
        const output = makeOutput({
            nextCore: { sensitivity: 50, capacity: 0, openness: 50, plasticity: 50, attitude: 50, tension: 20 },
        });
        const result = resolveTickConsequences({
            ...baseInput,
            coreBefore: { sensitivity: 50, capacity: 0, openness: 50, plasticity: 50, attitude: 50, tension: 90 },
            output,
        });
        expect(result.notableObservationEvent).toBe('exhaustion');
        expect(result.peakEventToLog?.presetId).toBe('ruined');
        expect(result.output.nextCore.tension).toBe(20);
    });

    it('keeps a low-tension tick free of discharge and edge writes', () => {
        const output = makeOutput({ nextCore: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 30 } });
        const result = resolveTickConsequences({ ...baseInput, output });
        expect(result.notableObservationEvent).toBeUndefined();
        expect(result.peakEventToLog).toBeNull();
        // tension < 80 resolves any lingering edge state (edge.clear), but no
        // discharge context is applied and no edge.update is written.
        expect(result.effects.some(e => e.kind === 'context.apply')).toBe(false);
        expect(result.effects.some(e => e.kind === 'edge.update')).toBe(false);
    });
});
