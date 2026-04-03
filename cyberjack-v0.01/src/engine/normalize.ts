// src/engine/normalize.ts

import { CompiledAction, SubjectCoreState, SubjectPointState, EngineConfig } from '../domain/types';
import { clamp, ensureFiniteNumber } from './utils';

type ActionScalarKey = keyof EngineConfig['action']['ranges'];

export function normalizeAction(action: Partial<CompiledAction>, config: EngineConfig): CompiledAction {
    const normalized: Partial<CompiledAction> = {};
    const defaults = config.action.defaults as Partial<Record<ActionScalarKey, number>>;
    const source = action as Partial<Record<ActionScalarKey, number>>;

    for (const key of Object.keys(config.action.ranges) as ActionScalarKey[]) {
        const [min, max] = config.action.ranges[key];
        const fallback = defaults[key] ?? 0;
        const raw = source[key] ?? fallback;
        normalized[key] = clamp(ensureFiniteNumber(raw, fallback, key), min, max);
    }

    return normalized as CompiledAction;
}

export function normalizeCore(core: Partial<SubjectCoreState>, config: EngineConfig): SubjectCoreState {
    const normalized: any = {};
    for (const k of Object.keys(config.core.defaults)) {
        const key = k as keyof SubjectCoreState;
        const raw = core[key] ?? config.core.defaults[key];
        normalized[key] = clamp(ensureFiniteNumber(raw, config.core.defaults[key], key), config.core.min, config.core.max);
    }
    return normalized as SubjectCoreState;
}

export function normalizePoint(point: Partial<SubjectPointState>, config: EngineConfig): SubjectPointState {
    const normalized: any = {
        pointId: point.pointId || 'general',
    };
    for (const k of Object.keys(config.point.defaults)) {
        const key = k as keyof SubjectPointState;
        const raw = (point as any)[key] ?? (config.point.defaults as any)[key];
        normalized[key] = clamp(ensureFiniteNumber(raw, (config.point.defaults as any)[key], key), config.point.min, config.point.max);
    }
    return normalized as SubjectPointState;
}
