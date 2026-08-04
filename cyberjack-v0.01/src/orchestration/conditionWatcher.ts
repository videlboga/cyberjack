import { SubjectCoreState, SubjectPointState, CompiledAction } from '../domain/types';
import { stateTriggersRepo, presetRepo, eventLogRepo, activeContextsRepo } from '../infrastructure/repositories';
import { ContextManager } from './contextManager';

export interface TriggerRule {
    code: string;
    description: string;
    pointSpecific?: boolean; // If true, this condition binds to the specific pointId being interacted with
    check: (core: SubjectCoreState, point: SubjectPointState) => boolean;
    releaseCheck?: (core: SubjectCoreState, point: SubjectPointState) => boolean;
    requiredTicks: number; // 0 for instant effects, > 0 for chronic
    actionPresetId: string; // The active context to grant
    durationOnTrigger?: number; // How long it stays (-1 forever). Overrides preset logic if needed.
    removeOnFail?: boolean; // If true, removes the context the moment condition fails (perfect for instant conditions).
}

// Capacity describes available functional reserve, not consciousness itself.
// An exhausted subject collapses only after nervous activation has fallen low;
// sufficiently strong stimulation can restore contact without restoring energy.
// Loss of conscious contact is reserved for near-total exhaustion after the
// nervous activation has also subsided. Low resource alone means fatigue,
// panic or overload — not unconsciousness.
export const COLLAPSE_CAPACITY_THRESHOLD = 3;
export const COLLAPSE_TENSION_THRESHOLD = 8;
export const FORCED_AROUSAL_TENSION_THRESHOLD = 30;
export const NATURAL_RECOVERY_CAPACITY_THRESHOLD = 25;
export const LOCAL_HYPERESTHESIA_ENTER_DELTA = 15;
export const LOCAL_HYPERESTHESIA_RELEASE_DELTA = 8;

const localSensitivityDelta = (point: SubjectPointState) =>
    point.localSensitivity - (point.baselineLocalSensitivity ?? point.localSensitivity);

export function isExhaustedCollapse(core: SubjectCoreState): boolean {
    return core.capacity <= COLLAPSE_CAPACITY_THRESHOLD && core.tension <= COLLAPSE_TENSION_THRESHOLD;
}

export function hasRecoveredContact(core: SubjectCoreState): boolean {
    return core.capacity >= NATURAL_RECOVERY_CAPACITY_THRESHOLD || core.tension >= FORCED_AROUSAL_TENSION_THRESHOLD;
}

export const STATE_RULES: TriggerRule[] = [
    {
        code: 'apathy_instant',
        description: 'Временный Срыв (Пока держится условие)',
        check: isExhaustedCollapse,
        releaseCheck: hasRecoveredContact,
        requiredTicks: 0,
        actionPresetId: 'effect_apathy',
        removeOnFail: true,
        durationOnTrigger: -1
    },
    {
        code: 'chronic_apathy',
        description: 'Хроническая Апатия (Держится долго после N тиков)',
        check: isExhaustedCollapse,
        releaseCheck: hasRecoveredContact,
        requiredTicks: 5,
        actionPresetId: 'effect_chronic_apathy',
        durationOnTrigger: 10,
        removeOnFail: true
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
        check: (core) => core.capacity <= 25 && core.attitude < 40 && core.tension >= 30,
        releaseCheck: (core) => core.capacity >= 35 || core.tension <= 20,
        requiredTicks: 2,
        actionPresetId: 'effect_panic',
        durationOnTrigger: 30,
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
        description: 'Глобальная Гиперестезия',
        check: (core) => core.sensitivity >= 85,
        requiredTicks: 0,
        actionPresetId: 'effect_hyperesthesia',
        removeOnFail: true
    },
    {
        code: 'local_hyperesthesia',
        description: 'Локальная Гиперестезия (Точка)',
        pointSpecific: true,
        check: (core, point) => localSensitivityDelta(point) >= LOCAL_HYPERESTHESIA_ENTER_DELTA,
        releaseCheck: (core, point) => localSensitivityDelta(point) <= LOCAL_HYPERESTHESIA_RELEASE_DELTA,
        requiredTicks: 0,
        actionPresetId: 'effect_local_hyperesthesia',
        removeOnFail: true
    },
    {
        code: 'local_numbness',
        description: 'Локальное Онемение (Точка)',
        pointSpecific: true,
        check: (core, point) => ![
            'mind_state', 'systemic', 'posture', 'global_pose',
            'global_clothing', 'slot_room', 'slot_social',
        ].includes(point.pointId) && point.localSensitivity <= 10,
        requiredTicks: 0,
        actionPresetId: 'effect_local_numbness',
        removeOnFail: true
    }
];

export class ConditionWatcher {
    static evaluate(subjectId: string, pointId: string | null, core: SubjectCoreState, point: SubjectPointState) {
        const activeContexts = activeContextsRepo.getAllForSubject(subjectId);
        const narratives: string[] = [];

        for (const rule of STATE_RULES) {
            // If the rule is point-specific, ensure we match the pointId as well
            const hasContext = activeContexts.some(c => 
                c.actionId === rule.actionPresetId && 
                (!rule.pointSpecific || c.pointId === pointId)
            );
            // Some states use hysteresis: entering collapse and recovering from it
            // must not share the same threshold or the state flickers off immediately.
            const isConditionMet = hasContext && rule.releaseCheck
                ? !rule.releaseCheck(core, point)
                : rule.check(core, point);
            
            // To separate triggers by point, compound the trigger code
            const triggerCode = rule.pointSpecific && pointId ? `${rule.code}_${pointId}` : rule.code;

            if (isConditionMet) {
                const currentTicks = stateTriggersRepo.increment(subjectId, triggerCode, 1);

                if (currentTicks >= rule.requiredTicks) {
                    if (!hasContext || (rule.requiredTicks > 0 && currentTicks === rule.requiredTicks)) {
                        if (!hasContext) {
                            const preset = presetRepo.getActionPreset(rule.actionPresetId);
                            if (preset) {
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

                                const applyPointId = rule.pointSpecific ? pointId : undefined;
                                ContextManager.applyContext(subjectId, rule.actionPresetId, preset, applyPointId || undefined);

                                let physicalConsequence = '';
                                if (rule.code === 'apathy_instant') {
                                    const collapse = ContextManager.applyAutonomousCollapse(subjectId);
                                    physicalConsequence = collapse.narrative ? ` ${collapse.narrative}` : '';
                                }

                                const narrative = `[Состояние] Активация: ${rule.description}${rule.pointSpecific ? ` (${pointId})` : ''}.${physicalConsequence}`.trim();
                                eventLogRepo.append(subjectId, 'system_trigger', {
                                    presetId: 'system_trigger', action: null, actionLabel: narrative, narrative
                                }, { triggeredRule: triggerCode });
                                narratives.push(narrative);

                                if (preset.contextConfig && originalDuration !== undefined) {
                                    preset.contextConfig.duration = originalDuration;
                                }
                            }
                        }
                    }
                }
            } else {
                const currentTicks = stateTriggersRepo.get(subjectId, triggerCode);
                if (currentTicks > 0) {
                    stateTriggersRepo.reset(subjectId, triggerCode);
                }

                if (rule.removeOnFail && hasContext) {
                    // Need to potentially filter by pointId when removing.
                    const contextToRemove = activeContexts.find(c => 
                        c.actionId === rule.actionPresetId && 
                        (!rule.pointSpecific || c.pointId === pointId)
                    );
                    
                    if (contextToRemove) {
                        activeContextsRepo.remove(contextToRemove.id);
                        const narrative = `[Состояние] Снятие: ${rule.description}${rule.pointSpecific ? ` (${pointId})` : ''}`;
                        eventLogRepo.append(subjectId, 'system_trigger', {
                            presetId: 'system_trigger', action: null, actionLabel: narrative, narrative
                        }, { clearedRule: triggerCode });
                        narratives.push(narrative);
                    }
                }
            }
        }
        return narratives;
    }
}
