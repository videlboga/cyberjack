import { describe, expect, it } from 'vitest';
import { calculateSituationalCompliance, deriveEdgeProfile } from '../src/domain/edgeState';

const core = (tension = 90, capacity = 60) => ({ tension, capacity } as any);
const observation = (pleasure: number, discomfort: number, overload = 0) => ({ reaction: { pleasure, discomfort, overload, engagement: 10, mixed: false } } as any);

describe('edge profile', () => {
    it('distinguishes positive and negative edge from recent reactions', () => {
        expect(deriveEdgeProfile(core(), [observation(12, 1)]).kind).toBe('positive');
        expect(deriveEdgeProfile(core(), [observation(0, 12)]).kind).toBe('negative');
    });

    it('raises relevant compliance at positive edge without changing core state', () => {
        const profile = deriveEdgeProfile(core(), [observation(12, 1)]);
        expect(calculateSituationalCompliance({ attitude: 40, plasticity: 50, profile, action: { id: 'eq_clothe_underwear', label: 'Снять бельё', type: 'clothing' } })).toEqual({ base: 65, edgeModifier: 20, total: 85 });
    });

    it('makes intrusive actions harder and stopping easier at a negative edge', () => {
        const profile = deriveEdgeProfile(core(), [observation(0, 12)]);
        expect(calculateSituationalCompliance({ attitude: 40, plasticity: 50, profile, action: { id: 'eq_clothe_underwear', type: 'clothing' } }).edgeModifier).toBe(-18);
        expect(calculateSituationalCompliance({ attitude: 40, plasticity: 50, profile, action: { id: 'stop_protocol' } }).edgeModifier).toBe(10);
    });
});
