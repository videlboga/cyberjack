// src/compiler/compileAction.ts
import { CompiledAction } from '../domain/types';
import { presetRepo, activeContextsRepo } from '../infrastructure/repositories';
import { compileContextVector } from './compileContextVector';
import { mergeVectors } from './mergeVectors';
import { computeNovelty } from './noveltyService';

export interface ActionInput {
    presetId: string;
    eventId: string; // The scene or global event to pull context from
    playerIntensity?: number; // Override if player dragged the UI slider
    history?: any[]; // Passed down to calculate novelty
    dynamicModifiers?: Partial<CompiledAction>; // Add dynamic traits, like text classification
}

/**
 * High-level orchestration for compiling the final Action Vector
 * that will be sent into Engine.runTick()
 */
export function compileAction(input: ActionInput): CompiledAction {
    // 1. Get Base (handle 'wait' as zero-vector implicitly)
    const baseAction = input.presetId === 'wait' 
        ? { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 }
        : (presetRepo.getActionPreset(input.presetId) || { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 });

    // 2. Add player direct overrides
    // Assume player slider mostly controls intensity. We override base rather than add.
    if (input.playerIntensity !== undefined && input.presetId !== 'wait') {
        baseAction.intensity = input.playerIntensity;
    }

    // 2.5 Merge dynamic modifiers (e.g. from LLM text classifier)
    // We OVERWRITE base action fields rather than add, because the LLM returns an absolute semantic vector
    const baseWithDynamic = input.dynamicModifiers 
        ? { ...baseAction, ...input.dynamicModifiers }
        : baseAction;

    // 3. Compute Novelty
    baseWithDynamic.novelty = computeNovelty(baseWithDynamic, input.history || []);

    // 4. Get Contexts
    const activeContextIds = activeContextsRepo.getAllForEvent(input.eventId);
    const contextModifiers = compileContextVector(activeContextIds);

    // 5. Merge
    return mergeVectors(baseWithDynamic as CompiledAction, contextModifiers);
}