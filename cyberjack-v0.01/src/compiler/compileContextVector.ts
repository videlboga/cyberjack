// src/compiler/compileContextVector.ts
import { CompiledAction } from '../domain/types';
import { presetRepo } from '../infrastructure/repositories';

/**
 * Loads and merges all active contexts for a specific event into one modifier object.
 */
export function compileContextVector(activeContextIds: string[]): Partial<CompiledAction> {
    const combinedModifiers: Record<string, number> = {};

    for (const contextId of activeContextIds) {
        const presetResult = presetRepo.getContextPreset(contextId);
        const modifiers = presetResult ? presetResult.modifiers as Partial<CompiledAction> : null;
        if (modifiers) {
            for (const [key, val] of Object.entries(modifiers)) {
                if (typeof val === 'number') {
                    // Accumulate or override? For now, we'll sum up modifiers.
                    combinedModifiers[key] = (combinedModifiers[key] || 0) + val;
                }
            }
        }
    }
    
    return combinedModifiers;
}