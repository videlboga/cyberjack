import { describe, expect, it } from 'vitest';
import { autonomousInitiativeProbability } from './autonomousScene';

describe('autonomous co-presence initiative', () => {
    const state = {
        sensitivity: 60,
        capacity: 60,
        openness: 40,
        relationToObservedTarget: 50,
        eventAgeMinutes: 60,
    };

    it('treats a shared room as a durable opportunity for social initiative', () => {
        const apart = autonomousInitiativeProbability(state);
        const roommates = autonomousInitiativeProbability({ ...state, sharesRoom:true });

        expect(roommates).toBeCloseTo(apart + .12);
    });
});
