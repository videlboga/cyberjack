// src/compiler/mergeVectors.ts
import { CompiledAction } from '../domain/types';
import { clamp } from '../engine/utils';
import { DEFAULT_CONFIG } from '../engine/config';

/**
 * Merges the base action, player intent, and context modifiers together.
 */
export function mergeVectors(
    baseAction: Partial<CompiledAction>, 
    modifiers: Partial<CompiledAction>
): CompiledAction {
    const config = DEFAULT_CONFIG;
    const finalAction: any = { ...baseAction };
    
    for (const [key, val] of Object.entries(modifiers)) {
        if (typeof val === 'number') {
            finalAction[key] = (finalAction[key] || 0) + val;
        }
    }

    // Clamp within valid ranges from config
    for (const [k, ranges] of Object.entries(config.action.ranges)) {
        const key = k as keyof CompiledAction;
        const [min, max] = ranges as [number, number, number];
        const fallback = config.action.defaults[key];
        finalAction[key] = clamp(finalAction[key] ?? fallback, min, max);
    }
    
    return finalAction as CompiledAction;
}