import { describe, it, expect } from 'vitest';
import { runTick } from '../src/engine/runTick';
import { DEFAULT_CONFIG } from '../src/engine/config';
import { TickInput } from '../src/domain/types';

describe('Engine Core', () => {
    it('should be deterministic: same input, same output', () => {
        const input: TickInput = {
            action: { intensity: 0.5, valence: 0, contact: 0.5, sharpness: 0.5, novelty: 0.5 },
            core: { ...DEFAULT_CONFIG.core.defaults },
            point: { ...DEFAULT_CONFIG.point.defaults },
        };

        const firstRun = runTick(input);
        const secondRun = runTick(input);

        expect(firstRun).toEqual(secondRun);
    });

    it('should clamp bounds correctly (never exceed 100 or drop below 0)', () => {
        const input: TickInput = {
            action: { intensity: 999, valence: -999, contact: 999, sharpness: 999, novelty: 999 },
            core: { sensitivity: 999, capacity: -999, openness: 999, plasticity: 999, attitude: -999 },
            point: { localSensitivity: 999, localAttitude: -999 },
        };

        const output = runTick(input);

        expect(output.nextCore.sensitivity).toBeLessThanOrEqual(100);
        expect(output.nextCore.capacity).toBeGreaterThanOrEqual(0);
        expect(output.nextCore.attitude).toBeGreaterThanOrEqual(0);

        expect(output.nextPoint.localSensitivity).toBeLessThanOrEqual(100);
    });
});
