import { describe, expect, it } from 'vitest';
import { calculateSituationalCompliance, deriveActivationPressure, deriveEdgeProfile } from '../src/domain/edgeState';

const core = (tension = 90, capacity = 60) => ({ tension, capacity } as any);
const observation = (pleasure: number, discomfort: number, overload = 0) => ({ reaction: { pleasure, discomfort, overload, engagement: 10, mixed: false } } as any);

describe('edge profile', () => {
    it('does not turn a weak clean reaction into maximum balance', () => {
        expect(deriveActivationPressure([observation(7.7, .2)]).activationBalance).toBeCloseTo(35.8, 1);
        expect(deriveActivationPressure([observation(1, 0)]).activationBalance).toBeLessThan(6);
    });

    it('does not erase recent negative pressure with one modest positive reaction', () => {
        const pressure = deriveActivationPressure([
            observation(8, .2),
            observation(0, 12),
        ]);
        expect(pressure.activationBalance).toBeLessThan(10);
        expect(pressure.activationBalance).toBeGreaterThan(-10);
    });

    it('distinguishes positive and negative edge from recent reactions', () => {
        const positive = deriveEdgeProfile(core(), [observation(12, 1)]);
        const negative = deriveEdgeProfile(core(), [observation(0, 12)]);
        expect(positive.kind).toBe('positive');
        expect(positive.expectedOutcome).toBe('positive_discharge');
        expect(positive.activationBalance).toBeGreaterThan(20);
        expect(negative.kind).toBe('negative');
        expect(negative.expectedOutcome).toBe('breakdown');
        expect(negative.activationBalance).toBeLessThan(-20);
    });

    it('shows mixed activation as overload instead of guessing a discharge', () => {
        const profile = deriveEdgeProfile(core(), [observation(12, 8, 8)]);
        expect(profile.kind).toBe('mixed');
        expect(profile.expectedOutcome).toBe('overload');
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
