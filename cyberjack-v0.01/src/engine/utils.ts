// src/engine/utils.ts

export function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

export function ensureFiniteNumber(value: any, fallback: number, label?: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
