import { describe, expect, it } from 'vitest';
import { autonomousInitiativeProbability } from './autonomousScene';

describe('autonomous scene initiative', () => {
    it('increases initiative for a fresh, preferred observed action', () => {
        const baseline = autonomousInitiativeProbability({
            sensitivity: 50, capacity: 50, openness: 50,
            eventAgeMinutes: 30,
        });
        const engagedWitness = autonomousInitiativeProbability({
            sensitivity: 75, capacity: 30, openness: 75,
            relationToObservedTarget: 85,
            learnedAction: 4,
            learnedTags: [3],
            eventAgeMinutes: 0,
        });
        expect(engagedWitness).toBeGreaterThan(baseline);
        expect(engagedWitness).toBeLessThanOrEqual(1);
    });
});
