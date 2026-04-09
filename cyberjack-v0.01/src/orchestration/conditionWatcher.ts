import { SubjectCoreState, SubjectPointState, CompiledAction } from '../domain/types';
import { stateTriggersRepo, presetRepo, eventLogRepo } from '../infrastructure/repositories';
import { ContextManager } from './contextManager';

export interface TriggerRule {
    code: string;
    description: string;
    check: (core: SubjectCoreState, point: SubjectPointState) => boolean;
    requiredTicks: number;
    actionPresetId: string; // The active context to grant
}

// Hardcoded rules for start; later can be generic rules from DB
export const STATE_RULES: TriggerRule[] = [
    {
        code: 'trauma_apathy',
        description: 'Отключается из-за нуля емкости и низкого отношения (Срыв)',
        check: (core) => core.capacity <= 10 && core.attitude < 40,
        requiredTicks: 4,
        actionPresetId: 'effect_apathy_breakdown' // Must exist in presets. Wait, we may not have this exact preset. We'll use 'panic_attack' or similar later.
    },
    {
        code: 'panic_attack',
        description: 'Паника из-за нулевой емкости и гипероткрытости',
        check: (core) => core.capacity <= 15 && core.openness >= 80,
        requiredTicks: 3,
        actionPresetId: 'effect_panic'
    }
];

export class ConditionWatcher {
    static evaluate(subjectId: string, core: SubjectCoreState, point: SubjectPointState) {
        for (const rule of STATE_RULES) {
            const isConditionMet = rule.check(core, point);
            
            if (isConditionMet) {
                const currentTicks = stateTriggersRepo.increment(subjectId, rule.code, 1);
                
                if (currentTicks === rule.requiredTicks) {
                    // Trigger met! apply context
                    const preset = presetRepo.getActionPreset(rule.actionPresetId);
                    if (preset) {
                        ContextManager.applyContext(subjectId, rule.actionPresetId, preset);
                        
                        const narrative = `[Условие] Достигнут порог состояния: ${rule.description}`;
                        eventLogRepo.append(subjectId, 'system_trigger', { 
                            presetId: 'system_trigger', 
                            action: null, 
                            actionLabel: narrative, 
                            narrative 
                        }, { triggeredRule: rule.code });
                        
                        // We reset it so it doesn't trigger repeatedly every tick,
                        // or we let ContextManager handle duration, and since it's already active, it will just overwrite duration.
                        // Better reset:
                        stateTriggersRepo.reset(subjectId, rule.code);
                    }
                }
            } else {
                // Condition broken, reset counter
                const currentTicks = stateTriggersRepo.get(subjectId, rule.code);
                if (currentTicks > 0) {
                    stateTriggersRepo.reset(subjectId, rule.code);
                }
            }
        }
    }
}