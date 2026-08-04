import { describe, expect, it } from 'vitest';
import { applyLearning } from '../src/engine/applyLearning';
import { computeResult } from '../src/engine/computeResult';
import { DEFAULT_CONFIG } from '../src/engine/config';
import { applySoftPositiveGain, softMechanicalScale } from '../src/engine/utils';

const action: any = {
    actionKey: 'calibration', label: 'Calibration', type: 'physical', tags: [],
    intensity: .3, valence: .5, contact: .7, sharpness: .1, novelty: .8
};

describe('soft experimental overdrive', () => {
    it('allows unbounded positive growth with diminishing gains above 100', () => {
        expect(applySoftPositiveGain(90, 20)).toBe(110);
        expect(applySoftPositiveGain(200, 20)).toBe(210);
        expect(applySoftPositiveGain(400, 20)).toBe(405);
    });

    it('keeps the old mechanical scale through 100 and safely compresses overdrive', () => {
        expect(softMechanicalScale(75)).toBe(75);
        expect(softMechanicalScale(100)).toBe(100);
        expect(softMechanicalScale(200)).toBeGreaterThan(100);
        expect(softMechanicalScale(400)).toBeLessThan(200);
    });

    it('preserves and evolves sensitivity and plasticity above 100', () => {
        const core: any = {
            sensitivity: 130, capacity: 70, openness: 65, plasticity: 140, attitude: 60, tension: 0,
            baselineSensitivity: 130, baselineCapacity: 70, baselineOpenness: 65,
            baselinePlasticity: 140, baselineAttitude: 60
        };
        const point: any = {
            pointId: 'feet', localSensitivity: 150, localAttitude: 60, localOpenness: 60,
            familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 150,
            baselineLocalAttitude: 60, baselineLocalOpenness: 60
        };
        const result = {
            experiencedIntensity: 15, effectiveSensitivity: 140, pleasure: 25, discomfort: 0,
            overload: 0, engagement: 70, learningEffect: 50, finalValence: .7
        };
        const next = applyLearning(core, point, action, result, DEFAULT_CONFIG);
        expect(next.nextCore.sensitivity).toBeGreaterThan(100);
        expect(next.nextCore.plasticity).toBeGreaterThan(140);
        expect(next.nextPoint.localSensitivity).toBeGreaterThan(100);
    });

    it('makes overdriven sensitivity mechanically stronger without unbounded result metrics', () => {
        const core = (sensitivity: number): any => ({
            sensitivity, capacity: 70, openness: 60, plasticity: 70, attitude: 60, tension: 0
        });
        const point = (localSensitivity: number): any => ({
            pointId: 'feet', localSensitivity, localAttitude: 60, localOpenness: 60,
            familiarity: 0, exposureCount: 0
        });
        const normal = computeResult(action, core(100), point(100), DEFAULT_CONFIG);
        const overdriven = computeResult(action, core(250), point(250), DEFAULT_CONFIG);
        expect(overdriven.result.effectiveSensitivity).toBeGreaterThan(normal.result.effectiveSensitivity);
        expect(overdriven.result.experiencedIntensity).toBeGreaterThanOrEqual(normal.result.experiencedIntensity);
        expect(overdriven.result.experiencedIntensity).toBeLessThanOrEqual(100);
        expect(overdriven.result.learningEffect).toBeLessThanOrEqual(100);
    });

    it('treats the anatomical preset as 1x and adds bounded load for extreme amplification', () => {
        const normalCore: any = {
            sensitivity: 50, capacity: 60, openness: 50, plasticity: 50, attitude: 50, tension: 0
        };
        const feet = (localSensitivity: number): any => ({
            pointId: 'feet', localSensitivity, localAttitude: 50, localOpenness: 50,
            familiarity: 0, exposureCount: 0
        });
        const normal = computeResult(action, normalCore, feet(75), DEFAULT_CONFIG).result;
        const extreme = computeResult(action, { ...normalCore, sensitivity: 500 }, feet(750), DEFAULT_CONFIG).result;
        expect(normal.sensoryAmplification).toBeCloseTo(1);
        expect(normal.exceptionalSensoryLoad).toBe(0);
        expect(extreme.sensoryAmplification).toBeGreaterThan(9);
        expect(extreme.exceptionalSensoryLoad).toBeGreaterThan(0);
        expect(extreme.overload).toBeGreaterThanOrEqual(normal.overload);
        expect(extreme.overload).toBeLessThanOrEqual(100);
    });
});
