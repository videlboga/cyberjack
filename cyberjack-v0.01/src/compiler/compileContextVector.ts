import { CompiledAction } from '../domain/types';
import { presetRepo } from '../infrastructure/repositories';

const STRAIN_MULTIPLIERS: Record<string, number> = {
    intensity: 1.5,
    valence: 1.0,
    sharpness: 1.2,
    contact: 0.5,
    novelty: 0.5
};

export function compileContextVector(activeContexts: { id: string; strain?: number }[]): Partial<CompiledAction> {
    const combinedModifiers: Record<string, number> = {};

    for (const ctx of activeContexts) {
        const presetResult = presetRepo.getContextPreset(ctx.id);
        const modifiers = presetResult ? presetResult.modifiers as Partial<CompiledAction> : null;
        
        if (modifiers) {
            for (const [key, val] of Object.entries(modifiers)) {
                if (typeof val === 'number') {
                    let adjustedVal = val;
                    const strain = Math.max(0, Math.min(ctx.strain ?? 0, 1));
                    const multiplier = STRAIN_MULTIPLIERS[key] ?? 0;
                    if (strain > 0 && multiplier !== 0) {
                        adjustedVal += val * multiplier * strain;
                    }

                    combinedModifiers[key] = (combinedModifiers[key] || 0) + adjustedVal;
                }
            }
        }
    }
    
    return combinedModifiers;
}
