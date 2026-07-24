import { describe, it, expect } from 'vitest';
import { applyLearning } from '../src/engine/applyLearning';
import { DEFAULT_CONFIG } from '../src/engine/config';

describe('applyLearning metadata whitelist', () => {
    it('preserves whitelist fields (preferences, flags, name, profileJson)', () => {
        const core: any = {
            sensitivity: 50,
            capacity: 50,
            openness: 40,
            plasticity: 50,
            attitude: 50,
            // extra metadata we expect to be preserved
            preferences: JSON.stringify({ actions: { 'a1': 1 }, points: {}, contexts: {} }),
            flags: ['status:raw'],
            name: 'Тестовый',
            profileJson: JSON.stringify({ bio: 'тест' })
        };

        const point: any = { pointId: 'general', localSensitivity: 50, localAttitude: 50, familiarity: 0, exposureCount: 0 };
        const action: any = { actionKey: 'test', label: 'Test', type: 'physical', tags: [], intensity: 0.5, valence: 0, contact: 0.5, sharpness: 0.5, novelty: 0.5 };

        const result = {
            experiencedIntensity: 1,
            overload: 0,
            pleasure: 0,
            discomfort: 0,
            learningEffect: 0
        };

        const { nextCore } = applyLearning(core, point, action, result, DEFAULT_CONFIG);

    expect((nextCore as any).preferences).toBe(core.preferences);
    expect((nextCore as any).flags).toEqual(core.flags);
    expect((nextCore as any).name).toBe(core.name);
    expect((nextCore as any).profileJson).toBe(core.profileJson);
    });
});

describe('acceptance learning', () => {
    const core = (capacity = 60): any => ({
        sensitivity: 50, capacity, openness: 50, plasticity: 60, attitude: 50, tension: 0,
        baselineSensitivity: 50, baselineCapacity: capacity, baselineOpenness: 50,
        baselinePlasticity: 60, baselineAttitude: 50,
    });
    const point: any = {
        pointId: 'zone', localSensitivity: 50, localAttitude: 50, localOpenness: 50,
        familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 50,
        baselineLocalAttitude: 50, baselineLocalOpenness: 50,
    };
    const action: any = { actionKey: 'pleasant', label: 'Pleasant', type: 'physical', tags: [], intensity: .4, valence: 1, contact: .7, sharpness: 0, novelty: .8 };
    const result = (learningEffect: number, engagement = 40) => ({
        experiencedIntensity: 20, effectiveSensitivity: 50, overload: 0,
        pleasure: 20, discomfort: 0, learningEffect, engagement,
    });

    it('gives familiar pleasure a small acceptance gain instead of reversing it', () => {
        const { nextCore, nextPoint } = applyLearning(core(), point, action, result(0), DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeGreaterThan(50);
        expect(nextPoint.localAttitude).toBeGreaterThan(50);
        expect(nextCore.openness).toBeGreaterThan(50);
        expect(nextPoint.localOpenness).toBeGreaterThan(50);
    });

    it('forms acceptance when the positive experience is learned', () => {
        const { nextCore, nextPoint } = applyLearning(core(), point, action, result(20), DEFAULT_CONFIG);
        const familiar = applyLearning(core(), point, action, result(0), DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeGreaterThan(familiar.nextCore.attitude);
        expect(nextPoint.localAttitude).toBeGreaterThan(familiar.nextPoint.localAttitude);
        expect(nextCore.openness).toBeGreaterThan(50);
        expect(nextPoint.localOpenness).toBeGreaterThan(50);
    });

    it('does not form positive acceptance while unresponsive', () => {
        const { nextCore, nextPoint } = applyLearning(core(10), point, action, result(20), DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeCloseTo(50);
        expect(nextPoint.localAttitude).toBeCloseTo(50);
        expect(nextCore.openness).toBeCloseTo(50);
        expect(nextPoint.localOpenness).toBeCloseTo(50);
    });

    it('can increase acceptance during discomfort when appraisal is positive', () => {
        const acceptedDiscomfort = { ...result(12), pleasure: 2, discomfort: 12, finalValence: .6 };
        const { nextCore } = applyLearning(core(), point, action, acceptedDiscomfort, DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeGreaterThan(50);
    });

    it('can reduce acceptance during pleasure when appraisal is negative', () => {
        const rejectedPleasure = { ...result(12), pleasure: 12, discomfort: 1, finalValence: -.6 };
        const { nextCore } = applyLearning(core(), point, action, rejectedPleasure, DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeLessThan(50);
    });

    it('does not turn edge tension into learning by itself', () => {
        const edged = { ...core(), tension: 90 };
        const idleResult = { ...result(0, 0), pleasure: 0, discomfort: 0, experiencedIntensity: 0 };
        const { nextCore } = applyLearning(edged, point, action, idleResult, DEFAULT_CONFIG);
        expect(nextCore.openness).toBeCloseTo(50);
        expect(nextCore.plasticity).toBeCloseTo(60);
        expect(nextCore.sensitivity).toBeCloseTo(50);
    });
});

describe('capacity pacing', () => {
    const core: any = { sensitivity: 50, capacity: 60, openness: 50, plasticity: 50, attitude: 50, tension: 90, baselineSensitivity: 50, baselineCapacity: 60, baselineOpenness: 50, baselinePlasticity: 50, baselineAttitude: 50 };
    const point: any = { pointId: 'zone', localSensitivity: 50, localAttitude: 50, localOpenness: 50, familiarity: 0, exposureCount: 0 };
    const action: any = { actionKey: 'test', label: 'Test', type: 'physical', tags: [], intensity: .7, valence: 1, contact: .8, sharpness: 0, novelty: .8 };

    it('makes pleasant edge stimulation less exhausting than distress', () => {
        const pleasant = applyLearning(core, point, action, { experiencedIntensity: 40, effectiveSensitivity: 50, pleasure: 30, discomfort: 1, overload: 0, learningEffect: 10, engagement: 30 }, DEFAULT_CONFIG).nextCore;
        const distress = applyLearning(core, point, action, { experiencedIntensity: 40, effectiveSensitivity: 50, pleasure: 1, discomfort: 30, overload: 0, learningEffect: 10, engagement: 30 }, DEFAULT_CONFIG).nextCore;
        expect(pleasant.capacity).toBeGreaterThan(distress.capacity);
    });

    it('caps routine loss while retaining a larger overload path', () => {
        const routine = applyLearning(core, point, action, { experiencedIntensity: 100, effectiveSensitivity: 100, pleasure: 0, discomfort: 100, overload: 0, learningEffect: 0, engagement: 0 }, DEFAULT_CONFIG).nextCore;
        expect(core.capacity - routine.capacity).toBeLessThanOrEqual(6);
    });
});
