// src/engine/normalize.ts

import { CompiledAction, SubjectCoreState, SubjectPointState, EngineConfig } from '../domain/types';
import { clamp, ensureFiniteNumber } from './utils';

export function normalizeAction(action: Partial<CompiledAction>, config: EngineConfig): CompiledAction {
    const normalized: any = {};
    for (const [k, [min, max]] of Object.entries(config.action.ranges)) {
        const key = k as keyof CompiledAction;
        const raw = action[key] ?? config.action.defaults[key];
        normalized[key] = clamp(ensureFiniteNumber(raw, config.action.defaults[key], key), min, max);
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
    const normalized: any = {};
    for (const k of Object.keys(config.point.defaults)) {
        const key = k as keyof SubjectPointState;
        const raw = point[key] ?? config.point.defaults[key];
        normalized[key] = clamp(ensureFiniteNumber(raw, config.point.defaults[key], key), config.point.min, config.point.max);
    }
    return normalized as SubjectPointState;
}
