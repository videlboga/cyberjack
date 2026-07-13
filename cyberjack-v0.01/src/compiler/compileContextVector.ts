import { CompiledAction } from '../domain/types';
import { presetRepo } from '../infrastructure/repositories';

const STRAIN_MULTIPLIERS: Record<string, number> = {
    intensity: 1.5,
    valence: 1.0,
    sharpness: 1.2,
    contact: 0.5,
    novelty: 0.5
};

export function compileContextVector(
    activeContexts: { actionId: string; strain?: number }[],
    baseAction?: Partial<CompiledAction>
): Partial<CompiledAction> {
    const combinedModifiers: Record<string, number> = {};

    for (const ctx of activeContexts) {
        const presetResult = presetRepo.getActionPreset(ctx.actionId);
        const config = presetResult?.contextConfig;
        
        // Persistent contexts affect later actions only through explicit
        // modifiers. Condition presets predate that field and intentionally
        // store their multipliers in the primary vector, so retain that narrow
        // compatibility path. A pose's one-time application vector must never
        // turn rest or conversation into continuous stimulation.
        const modifiers = config?.modifiers || (
            config?.type === 'condition' && presetResult
                ? presetResult.vector as Partial<CompiledAction>
                : null
        );

        if (modifiers) {
            for (const [key, val] of Object.entries(modifiers)) {
                if (typeof val === 'number') {
                    if (key.endsWith('_mult')) {
                        combinedModifiers[key] = (combinedModifiers[key] !== undefined ? combinedModifiers[key] : 1) * val;
                    } else {
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
        
        if (config && config.traitRules && baseAction) {
            const actionTags = baseAction.tags || [];
            
            for (const rule of config.traitRules) {
                const trigger = rule.trigger;
                let triggerFired = true;

                if (trigger.requireActionTags && trigger.requireActionTags.length > 0) {
                    const hasAllTags = trigger.requireActionTags.every((t: string) => actionTags.includes(t));
                    if (!hasAllTags) {
                        triggerFired = false;
                    }
                }

                if (triggerFired && trigger.minIntensity !== undefined) {
                    const actionIntensity = baseAction.intensity || 0;
                    if (actionIntensity < trigger.minIntensity) {
                        triggerFired = false;
                    }
                }

                if (triggerFired && rule.overrides) {
                    for (const [key, val] of Object.entries(rule.overrides)) {
                        if (typeof val === 'number') {
                            combinedModifiers[key] = (combinedModifiers[key] || 0) + val;
                        }
                    }
                }
            }
        }
    }
    
    return combinedModifiers;
}
