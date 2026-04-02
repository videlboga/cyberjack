// src/engine/utils.ts

export function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export function ensureFiniteNumber(value: any, fallback: number, label?: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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
