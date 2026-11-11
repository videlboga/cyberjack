import { describe, expect, it } from 'vitest';
import { computeResult } from './computeResult';
import { applyLearning } from './applyLearning';
import { LEGACY_ACTION_BALANCE_PATCH } from '../infrastructure/syncActionPresets';

const core = {
    sensitivity: 60, capacity: 70, openness: 60, plasticity: 60, attitude: 55, tension: 40,
    baselineSensitivity: 60, baselineCapacity: 70, baselineOpenness: 60,
    baselinePlasticity: 60, baselineAttitude: 55, preferences: '',
};
const point = {
    pointId: 'feet', localSensitivity: 60, localAttitude: 55, localOpenness: 60,
    familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 60,
    baselineLocalAttitude: 55, baselineLocalOpenness: 60,
};

const evaluate = (actionKey: keyof typeof LEGACY_ACTION_BALANCE_PATCH) => {
    const action = { actionKey, label: actionKey, type: 'physical' as const, tags: [], ...LEGACY_ACTION_BALANCE_PATCH[actionKey] };
    const { result } = computeResult(action, core, point);
    const learned = applyLearning(core, point, action, result);
    return { result, learned };
};

describe('standard action balance guardrails', () => {
    it('keeps deep massage useful without making it a universal acceptance exploit', () => {
        const { result, learned } = evaluate('deep_massage');
        expect(result.experiencedIntensity).toBeGreaterThan(30);
        expect(result.experiencedIntensity).toBeLessThan(60);
        expect(result.pleasure).toBeGreaterThan(result.discomfort);
        expect(learned.nextCore.attitude - core.attitude).toBeLessThan(2);
        expect(learned.nextCore.openness - core.openness).toBeLessThan(2.5);
    });

    it('keeps subtle feather and breath actions mechanically perceptible', () => {
        expect(evaluate('feather_stroke').result.experiencedIntensity).toBeGreaterThan(5);
        expect(evaluate('breath_blow').result.experiencedIntensity).toBeGreaterThan(4);
    });

    it('keeps a hard slap severe without making it the strongest routine action', () => {
        const { result } = evaluate('hard_slap');
        expect(result.experiencedIntensity).toBeLessThan(70);
        expect(result.discomfort).toBeGreaterThan(25);
        expect(result.overload).toBeLessThan(35);
    });
});
