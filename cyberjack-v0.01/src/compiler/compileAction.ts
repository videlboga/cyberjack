// src/compiler/compileAction.ts
import { CompiledAction } from '../domain/types';
import { presetRepo, activeContextsRepo } from '../infrastructure/repositories';
import { compileContextVector } from './compileContextVector';
import { mergeVectors } from './mergeVectors';
import { computeNovelty } from './noveltyService';
import { normalizeAuthoredActionVector, shapeImmediateContextAction } from './actionVectorScale';

export interface ActionInput {
    presetId: string;
    eventId: string; targetId?: string; // The scene or global event to pull context from
    playerIntensity?: number; // Override if player dragged the UI slider
    history?: any[]; // Passed down to calculate novelty
    dynamicModifiers?: Partial<CompiledAction>; // Add dynamic traits, like text classification
    sourceText?: string;
    parserVersion?: string;
    activeContexts?: any[]; // IDs of active contexts
    deltaTime?: number;
    familiarity?: number;
}

/**
 * High-level orchestration for compiling the final Action Vector
 * that will be sent into Engine.runTick()
 */
export function compileAction(input: ActionInput): CompiledAction {
    const presetRecord = presetRepo.getActionPreset(input.presetId);

    const authoredVector = input.presetId === 'wait'
        ? { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 }
        : (presetRecord?.vector || { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 });
    const normalizedVector = normalizeAuthoredActionVector(authoredVector as Record<string, any>);
    const baseVector = shapeImmediateContextAction(
        normalizedVector,
        presetRecord?.contextConfig?.type,
        Boolean(presetRecord?.removeContexts?.length)
    );

    const baseAction: CompiledAction = {
        actionKey: input.presetId,
        label: presetRecord?.label || input.presetId,
        type: presetRecord?.type || 'physical',
        tags: presetRecord?.tags || [],
        source: {
            presetId: input.presetId,
            rawText: input.sourceText,
            parserVersion: input.parserVersion
        },
        ...baseVector,
        contextConfig: presetRecord?.contextConfig,
        removeContexts: presetRecord?.removeContexts,
        requireContexts: presetRecord?.requireContexts,
        requiresItem: presetRecord?.requiresItem,
        requiresSceneObject: presetRecord?.requiresSceneObject,
        validTargets: presetRecord?.validTargets
    };

    // 2. Add player direct overrides
    // Multiply base intensity by slider value.
    if (input.playerIntensity !== undefined && input.presetId !== 'wait') {
        baseAction.intensity *= input.playerIntensity;
    }

    // 2.5 Merge dynamic modifiers (e.g. from LLM text classifier)
    // We OVERWRITE base action fields rather than add, because the LLM returns an absolute semantic vector
    const numericKeys: Array<keyof Pick<CompiledAction, 'intensity' | 'valence' | 'contact' | 'sharpness' | 'novelty'>> = [
        'intensity',
        'valence',
        'contact',
        'sharpness',
        'novelty'
    ];

    const baseWithDynamic = { ...baseAction };
    if (input.dynamicModifiers) {
        for (const key of numericKeys) {
            if (typeof input.dynamicModifiers[key] === 'number') {
                baseWithDynamic[key] = input.dynamicModifiers[key] as number;
            }
        }
    }

    if (input.dynamicModifiers && input.dynamicModifiers.contextConfig) {
        baseWithDynamic.contextConfig = { ...(baseWithDynamic.contextConfig || {}), ...input.dynamicModifiers.contextConfig };
    }

    // Apply the player's slider as a multiplier to the final combined intensity again, 
    // in case dynamicModifiers overwrote it (e.g. from verbalParser).
    if (input.playerIntensity !== undefined && input.presetId !== 'wait') {
        // If it got overridden by dynamic modifiers, multiply it back
        if (input.dynamicModifiers && input.dynamicModifiers.intensity) {
            baseWithDynamic.intensity *= input.playerIntensity;
        }
    }

    // 3. Compute Novelty
    baseWithDynamic.novelty = computeNovelty(baseWithDynamic, input.history || [], input.familiarity || 0);

    // 4. Get Contexts
    const activeContexts = input.activeContexts || [];
    const contextModifiers = compileContextVector(activeContexts, baseWithDynamic);

    // 5. Merge
    const merged = mergeVectors(baseWithDynamic as CompiledAction, contextModifiers);
    (merged as any)._baseAction = baseWithDynamic; // Keep base for prompt generation
    return merged;
}
