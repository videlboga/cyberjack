// src/engine/validate.ts

import { EngineConfig } from '../domain/types';

export function validateConfig(config: EngineConfig) {
    if (!config || !config.core || !config.action || !config.point) {
        throw new Error("Invalid config: missing core, action, or point parameters.");
    }
}
