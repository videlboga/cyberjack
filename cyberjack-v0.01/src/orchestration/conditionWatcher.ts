import { SubjectCoreState, SubjectPointState, CompiledAction } from '../domain/types';
import { stateTriggersRepo, presetRepo, eventLogRepo, activeContextsRepo } from '../infrastructure/repositories';
import { ContextManager } from './contextManager';
import type { TickEffect } from './tickEffectPlan';

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

export interface ConditionPlan {
    narratives: string[];
    effects: TickEffect[];
}

/**
 * Read-only evaluation of state-trigger conditions. Returns a plan of effects
 * (context apply/remove, state-trigger counters, event logs) that the caller
 * applies inside the tick commit. No writes are performed here.
 */
export class ConditionWatcher {
    static plan(subjectId: string, pointId: string | null, core: SubjectCoreState, point: SubjectPointState): ConditionPlan {
        const activeContexts = activeContextsRepo.getAllForSubject(subjectId);
        const narratives: string[] = [];
        const effects: TickEffect[] = [];
        // Model the trigger counters locally so the plan is deterministic and
        // the DB is only touched once, inside the commit.
        const counters = new Map<string, number>();
        const counter = (code: string) => counters.get(code) ?? stateTriggersRepo.get(subjectId, code);

        for (const rule of STATE_RULES) {
            const hasContext = activeContexts.some(c =>
                c.actionId === rule.actionPresetId &&
                (!rule.pointSpecific || c.pointId === pointId)
            );
            const isConditionMet = hasContext && rule.releaseCheck
                ? !rule.releaseCheck(core, point)
                : rule.check(core, point);

            const triggerCode = rule.pointSpecific && pointId ? `${rule.code}_${pointId}` : rule.code;

            if (isConditionMet) {
                const currentTicks = counter(triggerCode) + 1;
                counters.set(triggerCode, currentTicks);
                effects.push({ kind: 'state-trigger.set', subjectId, triggerCode, ticks: currentTicks });

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
                                effects.push({
                                    kind: 'context.apply',
                                    subjectId,
                                    actionId: rule.actionPresetId,
                                    action: preset,
                                    pointId: applyPointId || undefined,
                                });

                                let physicalConsequence = '';
                                if (rule.code === 'apathy_instant') {
                                    const collapse = ContextManager.planAutonomousCollapse(subjectId);
                                    if (collapse.effect) effects.push(collapse.effect);
                                    physicalConsequence = collapse.narrative ? ` ${collapse.narrative}` : '';
                                }

                                const narrative = `[Состояние] Активация: ${rule.description}${rule.pointSpecific ? ` (${pointId})` : ''}.${physicalConsequence}`.trim();
                                effects.push({
                                    kind: 'event.append',
                                    event: {
                                        subjectId,
                                        type: 'system_trigger',
                                        presetId: 'system_trigger',
                                        narrative,
                                        metadata: { triggeredRule: triggerCode },
                                    },
                                });
                                narratives.push(narrative);

                                if (preset.contextConfig && originalDuration !== undefined) {
                                    preset.contextConfig.duration = originalDuration;
                                }
                            }
                        }
                    }
                }
            } else {
                const currentTicks = counter(triggerCode);
                if (currentTicks > 0) {
                    counters.set(triggerCode, 0);
                    effects.push({ kind: 'state-trigger.set', subjectId, triggerCode, ticks: 0 });
                }

                if (rule.removeOnFail && hasContext) {
                    const contextToRemove = activeContexts.find(c =>
                        c.actionId === rule.actionPresetId &&
                        (!rule.pointSpecific || c.pointId === pointId)
                    );

                    if (contextToRemove) {
                        effects.push({ kind: 'context.remove-id', contextId: contextToRemove.id });
                        const narrative = `[Состояние] Снятие: ${rule.description}${rule.pointSpecific ? ` (${pointId})` : ''}`;
                        effects.push({
                            kind: 'event.append',
                            event: {
                                subjectId,
                                type: 'system_trigger',
                                presetId: 'system_trigger',
                                narrative,
                                metadata: { clearedRule: triggerCode },
                            },
                        });
                        narratives.push(narrative);
                    }
                }
            }
        }
        return { narratives, effects };
    }

    /** Applies the condition plan immediately. Kept for tests and legacy callers. */
    static evaluate(subjectId: string, pointId: string | null, core: SubjectCoreState, point: SubjectPointState): string[] {
        const plan = ConditionWatcher.plan(subjectId, pointId, core, point);
        // Apply effects in order. Context applies/removes and event logs are
        // executed directly here (outside a tick transaction) for test parity.
        for (const effect of plan.effects) {
            if (effect.kind === 'context.apply') {
                ContextManager.applyContext(effect.subjectId, effect.actionId, effect.action, effect.pointId, effect.initiatorId);
            } else if (effect.kind === 'context.remove-id') {
                activeContextsRepo.remove(effect.contextId);
            } else if (effect.kind === 'state-trigger.set') {
                stateTriggersRepo.set(effect.subjectId, effect.triggerCode, effect.ticks);
            } else if (effect.kind === 'event.append') {
                eventLogRepo.append(effect.event.subjectId, effect.event.type, {
                    presetId: effect.event.presetId, action: null,
                    actionLabel: effect.event.narrative, narrative: effect.event.narrative,
                }, effect.event.metadata || {});
            }
        }
        return plan.narratives;
    }
}
