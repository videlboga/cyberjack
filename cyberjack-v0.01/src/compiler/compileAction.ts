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
}

/**
 * High-level orchestration for compiling the final Action Vector
 * that will be sent into Engine.runTick()
 */
export function compileAction(input: ActionInput): CompiledAction {
    // 1. Get Base
    const baseAction = presetRepo.getActionPreset(input.presetId) || {};
    
    // 2. Add player direct overrides
    const playerModifiers: Partial<CompiledAction> = {};
    if (input.playerIntensity !== undefined) {
        // Assume player slider mostly controls intensity. 
        // We override base rather than add.
        baseAction.intensity = input.playerIntensity;
    }

    // 3. Compute Novelty 
    baseAction.novelty = computeNovelty(baseAction, input.history || []);

    // 4. Get Contexts
    const activeContextIds = activeContextsRepo.getAllForEvent(input.eventId);
    const contextModifiers = compileContextVector(activeContextIds);

    // 5. Merge
    return mergeVectors(baseAction, contextModifiers);
}
