// src/engine/utils.ts

export function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export function ensureFiniteNumber(value: any, fallback: number, label?: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Keeps the familiar 0..100 behaviour intact, then lets experimental values
 * continue to matter with diminishing mechanical returns. The result tends
 * towards 200 instead of growing without control.
 */
export function softMechanicalScale(value: number, knee = 100, ceiling = 200): number {
    const safe = Math.max(0, ensureFiniteNumber(value, 0));
    if (safe <= knee) return safe;
    const span = Math.max(0.001, ceiling - knee);
    return knee + span * (1 - Math.exp(-(safe - knee) / knee));
}

/**
 * Positive learning above the human-range knee remains unbounded but becomes
 * progressively slower. Losses and recovery are applied linearly.
 */
export function applySoftPositiveGain(current: number, delta: number, knee = 100): number {
    const safeCurrent = Math.max(0, ensureFiniteNumber(current, 0));
    const safeDelta = ensureFiniteNumber(delta, 0);
    if (safeDelta <= 0) return Math.max(0, safeCurrent + safeDelta);
    const resistance = 1 + Math.max(0, safeCurrent - knee) / Math.max(0.001, knee);
    return safeCurrent + safeDelta / resistance;
}

/**
 * Applies a generic decay formula that slowly pulls `level` towards zero while
 * allowing positive gains. Equivalent to: level = level * (1 - decayRate) + gain.
 */
export function applyDecayLevel(level: number, gain: number, decayRate: number): number {
    const clampedDecay = clamp(decayRate, 0, 1);
    const next = level * (1 - clampedDecay) + gain;
    return clamp(next, 0, 1);
}
