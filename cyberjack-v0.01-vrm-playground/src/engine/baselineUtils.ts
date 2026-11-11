import { clamp, softMechanicalScale } from './utils';

export interface DampingConfig {
    dampingBase?: number;
    dampingDistanceScale?: number;
    maxDamping?: number;
    timeScale?: number;
}

export interface BaselineShiftConfig {
    baseRate?: number;
    plasticityWeight?: number;
    opennessWeight?: number;
    noveltyBase?: number;
    noveltyScale?: number;
    extraFactor?: number;
    timeScale?: number;
}

export interface BaselineDriver {
    plasticity?: number;
    openness?: number;
    novelty?: number;
    extraFactor?: number;
}

export function dampTowardsBaseline(current: number, baseline: number, cfg: DampingConfig = {}): number {
    const distance = Math.abs(current - baseline);
    const base = cfg.dampingBase ?? 0;
    const distanceScale = cfg.dampingDistanceScale ?? 0;
    const max = cfg.maxDamping ?? 0.5;
    const perUnitStrength = clamp(base + distance * distanceScale, 0, max);
    const timeScale = Math.max(0, cfg.timeScale ?? 1);
    const strength = 1 - Math.pow(1 - perUnitStrength, timeScale);
    if (strength <= 0) return current;
    return current + (baseline - current) * strength;
}

export function advanceBaseline(
    currentBaseline: number,
    target: number,
    driver: BaselineDriver,
    cfg: BaselineShiftConfig = {}
): number {
    const baseRate = cfg.baseRate ?? 0;
    if (baseRate <= 0) return currentBaseline;

    const plasticityWeight = cfg.plasticityWeight ?? 1;
    const opennessWeight = cfg.opennessWeight ?? 1;
    const noveltyBase = cfg.noveltyBase ?? 1;
    const noveltyScale = cfg.noveltyScale ?? 0;

    const plasticityFactor =
        driver.plasticity === undefined ? 1 : Math.pow(clamp(softMechanicalScale(driver.plasticity, 100, 150) / 100, 0, 1.5), plasticityWeight);
    const opennessFactor =
        driver.openness === undefined ? 1 : Math.pow(clamp(driver.openness / 100, 0, 1), opennessWeight);
    const noveltyFactor = noveltyBase + (driver.novelty ?? 0.5) * noveltyScale;
    const extraFactor = driver.extraFactor ?? cfg.extraFactor ?? 1;

    const perUnitRate = clamp(baseRate * plasticityFactor * opennessFactor * noveltyFactor * extraFactor, 0, 1);
    const timeScale = Math.max(0, cfg.timeScale ?? 1);
    const rate = 1 - Math.pow(1 - perUnitRate, timeScale);
    if (rate <= 0) return currentBaseline;

    return currentBaseline + (target - currentBaseline) * rate;
}
