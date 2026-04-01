import { CompiledAction } from '../domain/types';
import { presetRepo } from '../infrastructure/repositories';

export function compileContextVector(activeContexts: { id: string, ticks: number }[]): Partial<CompiledAction> {
    const combinedModifiers: Record<string, number> = {};

    for (const ctx of activeContexts) {
        const presetResult = presetRepo.getContextPreset(ctx.id);
        const modifiers = presetResult ? presetResult.modifiers as Partial<CompiledAction> : null;
        
        if (modifiers) {
            for (const [key, val] of Object.entries(modifiers)) {
                if (typeof val === 'number') {
                    // Escalation Mechanic:
                    // Poses and restraints get more intense and more negative over time
                    let escalatedVal = val;
                    if (presetResult && (presetResult.type === 'condition' || presetResult.slot?.startsWith('pose') || presetResult.slot?.startsWith('restraint'))) {
                        if (key === 'intensity') {
                            escalatedVal = val + (ctx.ticks * 0.05); // +0.05 intensity per tick
                        }
                        if (key === 'valence' && val < 0) {
                            escalatedVal = val - (ctx.ticks * 0.05); // more negative per tick
                        }
                        if (key === 'discomfort' || key === 'sharpness') {
                            escalatedVal = val + (ctx.ticks * 0.02); // increase discomfort slightly
                        }
                    }

                    combinedModifiers[key] = (combinedModifiers[key] || 0) + escalatedVal;
                }
            }
        }
    }
    
    return combinedModifiers;
}
