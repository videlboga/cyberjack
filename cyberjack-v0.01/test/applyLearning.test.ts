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

    it('does not turn familiar pleasure into automatic acceptance', () => {
        const { nextCore, nextPoint } = applyLearning(core(), point, action, result(0), DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeCloseTo(50);
        expect(nextPoint.localAttitude).toBeCloseTo(50);
    });

    it('forms acceptance when the positive experience is learned', () => {
        const { nextCore, nextPoint } = applyLearning(core(), point, action, result(20), DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeGreaterThan(50);
        expect(nextPoint.localAttitude).toBeGreaterThan(50);
    });

    it('does not form positive acceptance while unresponsive', () => {
        const { nextCore, nextPoint } = applyLearning(core(10), point, action, result(20), DEFAULT_CONFIG);
        expect(nextCore.attitude).toBeCloseTo(50);
        expect(nextPoint.localAttitude).toBeCloseTo(50);
    });
});
