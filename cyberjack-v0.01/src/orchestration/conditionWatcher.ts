import { SubjectCoreState, SubjectPointState, CompiledAction } from '../domain/types';
import { stateTriggersRepo, presetRepo, eventLogRepo, activeContextsRepo } from '../infrastructure/repositories';
import { ContextManager } from './contextManager';

export interface TriggerRule {
    code: string;
    description: string;
    check: (core: SubjectCoreState, point: SubjectPointState) => boolean;
    requiredTicks: number; // 0 for instant effects, > 0 for chronic
    actionPresetId: string; // The active context to grant
    durationOnTrigger?: number; // How long it stays (-1 forever). Overrides preset logic if needed.
    removeOnFail?: boolean; // If true, removes the context the moment condition fails (perfect for instant conditions).
}

export const STATE_RULES: TriggerRule[] = [
    {
        code: 'apathy_instant',
        description: 'Временный Срыв (Пока держится условие)',
        check: (core) => core.capacity <= 10 && core.attitude < 60,
        requiredTicks: 0,
        actionPresetId: 'effect_apathy',
        removeOnFail: true,
        durationOnTrigger: -1
    },
    {
        code: 'chronic_apathy',
        description: 'Хроническая Апатия (Держится долго после N тиков)',
        check: (core) => core.capacity <= 10 && core.attitude < 60,
        requiredTicks: 5,
        actionPresetId: 'effect_chronic_apathy',
        durationOnTrigger: 10,
        removeOnFail: false
    },
    {
        code: 'suggestibility',
        description: 'Смещение контроля',
        check: (core) => core.capacity <= 25 && core.plasticity > 80,
        requiredTicks: 0,
        actionPresetId: 'effect_suggestibility',
        removeOnFail: true
    },
    {
        code: 'freeze_state',
        description: 'Тоническое оцепенение',
        check: (core) => core.capacity <= 25 && core.openness <= 20 && core.attitude >= 40,
        requiredTicks: 0,
        actionPresetId: 'effect_freeze',
        removeOnFail: true
    },
    {
        code: 'subspace',
        description: 'Сабспейс',
        check: (core) => core.capacity <= 25 && core.attitude > 60 && core.openness > 50,
        requiredTicks: 2,
        actionPresetId: 'effect_subspace',
        removeOnFail: true
    },
    {
        code: 'panic_attack',
        description: 'Паническая Атака',
        check: (core) => core.capacity <= 25 && core.attitude < 40,
        requiredTicks: 2,
        actionPresetId: 'effect_panic',
        removeOnFail: true
    },
    {
        code: 'sensory_overload',
        description: 'Сенсорная Перегрузка',
        check: (core) => core.capacity <= 25 && core.attitude >= 40 && core.openness <= 50,
        requiredTicks: 1,
        actionPresetId: 'effect_sensory_overload',
        removeOnFail: true
    },
    {
        code: 'active_defiance',
        description: 'Активное Отторжение',
        check: (core) => core.capacity > 60 && core.attitude <= 20 && core.openness <= 30,
        requiredTicks: 0,
        actionPresetId: 'effect_active_defiance',
        removeOnFail: true
    },
    {
        code: 'hyperesthesia',
        description: 'Гиперестезия',
        check: (core) => core.sensitivity >= 85,
        requiredTicks: 0,
        actionPresetId: 'effect_hyperesthesia',
        removeOnFail: true
    }
];

export class ConditionWatcher {
    static evaluate(subjectId: string, core: SubjectCoreState, point: SubjectPointState) {
        const activeContexts = activeContextsRepo.getAllForSubject(subjectId);
        
        for (const rule of STATE_RULES) {
            const isConditionMet = rule.check(core, point);
            const hasContext = activeContexts.some(c => c.actionId === rule.actionPresetId);
            
            if (isConditionMet) {
                const currentTicks = stateTriggersRepo.increment(subjectId, rule.code, 1);
                
                // If it's an instant trigger and we just hit >= 0 ticks (well, instantly), or chronic reaching threshold
                if (currentTicks >= rule.requiredTicks) {
                    if (!hasContext || (rule.requiredTicks > 0 && currentTicks === rule.requiredTicks)) {
                        // Apply the context (we don't want to re-apply instant every tick unless it needs refresh, but ContextManager might spam it if we do)
                        if (!hasContext) {
                            const preset = presetRepo.getActionPreset(rule.actionPresetId);
                            if (preset) {
                                // temporarily patch the duration if rule specifies it
                                const originalDuration = preset.contextConfig?.duration;
                                if (preset.contextConfig && rule.durationOnTrigger !== undefined) {
                                    preset.contextConfig.duration = rule.durationOnTrigger;
                                } else if (!preset.contextConfig) {
                                    (preset as any).contextConfig = {
                                        type: 'condition',
                                        occupiesPoints: [],
                                        duration: rule.durationOnTrigger ?? -1
                                    };
                                }
                                
                                ContextManager.applyContext(subjectId, rule.actionPresetId, preset);
                                
                                const narrative = `[Состояние] Активация: ${rule.description}`;
                                eventLogRepo.append(subjectId, 'system_trigger', { 
                                    presetId: 'system_trigger', action: null, actionLabel: narrative, narrative 
                                }, { triggeredRule: rule.code });
                                
                                // Restore preset
                                if (preset.contextConfig && originalDuration !== undefined) {
                                    preset.contextConfig.duration = originalDuration;
                                }
                            }
                        }
                    }
                }
            } else {
                // Condition broken
                const currentTicks = stateTriggersRepo.get(subjectId, rule.code);
                if (currentTicks > 0) {
                    stateTriggersRepo.reset(subjectId, rule.code);
                }
                
                if (rule.removeOnFail && hasContext) {
                    activeContextsRepo.removeByActionId(subjectId, rule.actionPresetId);
                    const narrative = `[Состояние] Снятие: ${rule.description}`;
                    eventLogRepo.append(subjectId, 'system_trigger', { 
                        presetId: 'system_trigger', action: null, actionLabel: narrative, narrative 
                    }, { clearedRule: rule.code });
                }
            }
        }
    }
}