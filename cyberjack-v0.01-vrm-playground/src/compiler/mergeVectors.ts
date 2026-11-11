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
    
    // Default multipliers
    const mults: Record<string, number> = {};

    for (const [key, val] of Object.entries(modifiers)) {
        if (typeof val === 'number') {
            if (key.endsWith('_mult')) {
                mults[key] = val; // Assuming these are already multiplied together in context vector
            } else if (['intensity', 'valence', 'contact', 'sharpness', 'novelty'].includes(key)) {
                finalAction[key] = (finalAction[key] || 0) + val;
            }
        }
    }

    // Clamp within valid ranges from config and apply mults
    for (const [k, ranges] of Object.entries(config.action.ranges)) {
        const key = k as keyof Pick<CompiledAction, 'intensity' | 'valence' | 'contact' | 'sharpness' | 'novelty'>;
        const [min, max] = ranges as [number, number, number];
        const fallback = config.action.defaults[key] ?? 0;
        
        let val = finalAction[key] ?? fallback;
        
        const multKey = `${key}_mult`;
        if (mults[multKey] !== undefined) {
            val *= mults[multKey];
        }

        finalAction[key] = clamp(val, min, max);
    }
    
    return finalAction as CompiledAction;
}