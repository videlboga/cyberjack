import { handleBuyAssetAction } from '../scenario/buyAssetHandler';
// src/orchestration/runGameTick.ts
import { randomUUID } from 'crypto';
import { loadTickState } from './loadTickState';
import { saveTickState } from './saveTickState';
import { compileAction } from '../compiler/compileAction';
import { runTick } from '../engine/runTick';
import { eventQueries } from '../infrastructure/eventQueries';
import { activeContextsRepo, resourceRepo, sceneRepo, presetRepo, eventLogRepo, characterRepo } from '../infrastructure/repositories';
import { CompiledAction, TickBundle, GameEvent } from '../domain/types';
import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import { appendJsonLog } from '../utils/fileLogs';
import { explainPromptLog, explainEngineState } from '../utils/logExplainers';
import * as checkActionAccess from '../scenario/checkActionAccess';
import { applyResourceCosts } from '../scenario/applyResourceCosts';
import { runScenarioStep } from '../scenario/runScenarioStep';
import { ContextManager } from './contextManager';
import { sceneCharacterRepo } from '../infrastructure/repositories';

import { ConditionWatcher } from './conditionWatcher';
import { evaluateTensionDischarge } from './triggers';
import { pointStateRepo } from '../infrastructure/repositories';
import { DEFAULT_CONFIG } from '../engine/config';
import { dampTowardsBaseline, advanceBaseline } from '../engine/baselineUtils';
import { STATE_RULES } from './conditionWatcher';
import { clamp } from '../engine/utils';

export interface GameEventPayload {
    subjectId: string;
    pointId: string;
    playerId: string;
    sceneId: string;
    presetId: string; // The base action id
    playerIntensity?: number;
    dynamicModifiers?: Partial<CompiledAction>;
    eventType?: GameEvent['type'];
    textMessage?: string;
    parserVersion?: string;
    customPayload?: Record<string, unknown>;
    deltaTime?: number;
}

export function constrainCapacityWhileUnresponsive(input: {
    previousCapacity: number;
    proposedCapacity: number;
    isRest: boolean;
    elapsedTime: number;
    recoveryRate?: number;
}) {
    if (!input.isRest) return Math.min(input.proposedCapacity, input.previousCapacity);
    const recoveryRate = input.recoveryRate ?? DEFAULT_CONFIG.formulas.applyLearning.capacityRecoveryRate ?? 1;
    // Collapse recovery is intentionally slower than ordinary rest. Generic
    // baseline damping may still propose a lower value, but cannot wake the
    // subject in a single long pause by restoring most of the baseline gap.
    const recoveryCeiling = input.previousCapacity + recoveryRate * input.elapsedTime * 0.5;
    return Math.min(input.proposedCapacity, recoveryCeiling);
}

export async function runGameTick(payload: GameEventPayload): Promise<TickBundle> {
    // 1. Load state
    const state = loadTickState(payload.subjectId, payload.pointId, payload.playerId, payload.sceneId);
    const stateBefore = {
        core: { ...state.core },
        point: { ...state.point }
    };
    const elapsedTime = payload.deltaTime ?? (payload.presetId === 'wait' ? 20 : 1);
    const preTickContextNotes: string[] = [];
    
    // 2. Scenario layer: доступность действия, ресурсы, локация
    const validation = checkActionAccess.validateAction(
        payload.presetId, state.scene, state.resources, payload.subjectId, payload.playerId
    );
    if (!validation.allowed && payload.presetId !== 'wait') {
        throw new Error(validation.errorReason || `Action "${payload.presetId}" blocked by scenario.`);
    }

    // 2.5 Verify node unblocked
    const blockCheck = ContextManager.isPointBlocked(payload.subjectId, payload.pointId);
    if (blockCheck.blocked && payload.presetId !== 'wait') {
        throw new Error(blockCheck.reason || `Точка "${payload.pointId}" заблокирована.`);
    }

    const actionCosts = state.scene.actionCosts?.[payload.presetId] || null;
    if (actionCosts && Object.keys(actionCosts).length) {
        try {
            const nextResources = applyResourceCosts(state.resources, actionCosts);
            resourceRepo.save(nextResources);
            state.resources = nextResources;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to apply resource costs');
        }
    }

    let activeSceneId = payload.sceneId;
    
    // 3. Get history for novelty
    const history = eventQueries.getRecentLogs(payload.subjectId, 5);
    
    // 4. Compile Action Vector
    let allContexts = activeContextsRepo.getAllForSubject(payload.subjectId);
    if (allContexts.some(context => context.actionId === 'effect_apathy') &&
        !allContexts.some(context => context.actionId === 'pose_lying_down')) {
        const collapse = ContextManager.applyAutonomousCollapse(payload.subjectId);
        if (collapse.applied && collapse.narrative) preTickContextNotes.push(collapse.narrative);
        allContexts = activeContextsRepo.getAllForSubject(payload.subjectId);
    }
    const applicableContexts = allContexts.filter(c => !c.pointId || c.pointId === payload.pointId);

    let compiledAction = compileAction({
        presetId: payload.presetId,
        eventId: payload.sceneId, // Treat sceneId as the root event contexts are bound to for now
        playerIntensity: payload.playerIntensity,
        history: history,
        dynamicModifiers: payload.dynamicModifiers,
        sourceText: payload.textMessage,
        parserVersion: payload.parserVersion, 
        activeContexts: applicableContexts,
        familiarity: state.point.familiarity ?? 0
    });

    // 4.5 Apply Virtual Contexts (Mental and Body point overloads)
    const baseAction = (compiledAction as any)._baseAction;
    (compiledAction as any)._baseAction = baseAction || compiledAction;

    const commandIntent = payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent;
    // preserve any action preset referenced by the parsed command so we can apply its effects later
    let commandActionPreset: any = undefined;
    if (commandIntent && commandIntent.type && commandIntent.type !== 'none') {
        (compiledAction as any).commandIntent = commandIntent;
        if ((compiledAction as any)._baseAction) {
            ((compiledAction as any)._baseAction as any).commandIntent = commandIntent;
        }
    }

    // 5. Run Engine Tick
    const engineOutput = runTick({
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        action: compiledAction,
        core: state.core,
        point: state.point,
        config: undefined,
        deltaTime: elapsedTime
    });

    const wasUnresponsive = allContexts.some(context =>
        context.actionId === 'effect_apathy' || context.actionId === 'effect_chronic_apathy'
    );
    if (wasUnresponsive) {
        engineOutput.nextCore.capacity = constrainCapacityWhileUnresponsive({
            previousCapacity: state.core.capacity,
            proposedCapacity: engineOutput.nextCore.capacity,
            isRest: payload.presetId === 'wait',
            elapsedTime
        });
        const baselineCoreCfg = DEFAULT_CONFIG.formulas.baseline?.core || {};
        engineOutput.nextCore.baselineCapacity = advanceBaseline(
            state.core.baselineCapacity ?? state.core.capacity,
            engineOutput.nextCore.capacity,
            {
                plasticity: engineOutput.nextCore.plasticity,
                openness: engineOutput.nextCore.openness,
                novelty: compiledAction.novelty
            },
            { baseRate: baselineCoreCfg.adaptBase, ...baselineCoreCfg, timeScale: elapsedTime }
        );
    }

    // Existing contexts affect this action and age afterwards. Contexts created
    // by the current action are applied later and start ageing on the next tick.
    // A long pause is one gameplay step for finite condition durations; its
    // elapsed time still drives physiological recovery inside the engine.
    ContextManager.processTick(payload.subjectId, payload.presetId === 'wait' ? 1 : elapsedTime);

    if (engineOutput.tickMeta?.inputs) {
        (engineOutput.tickMeta.inputs.action as any)._baseAction = (compiledAction as any)._baseAction;
    }

    // 6. Save new state
    const tickId = randomUUID();

    // 6.0 Apply Context Overrides (Parser Intention Hook)
    // Here we perform dynamic context modification dictated directly by the LLM classification,
    // intercepting and modifying the subject's conditions immediately.
    let addedContextNotes: string[] = [...preTickContextNotes];
    // Did this tick actually change contexts / apply effects?
    let actionApplied = false;
    // Hoist forced-action tracking to function scope so we can log system_trigger
    // AFTER saveTickState (ensuring correct id ordering: interaction < system_trigger)
    let forcedNarrativeToLog: string | undefined = undefined;
    let forcedAttempted = false;
    if (commandIntent && commandIntent.type !== 'none') {
        
        const activeContextsRepo2 = activeContextsRepo;
        

        // Track forced-action narrative/effects so we only log a "performed"
        // system_trigger after the effects actually changed state.
        let forcedApplied = false;

        let targetCtxId: string | undefined;
        if (commandIntent.type === 'change_pose') targetCtxId = commandIntent.targetPoseId;
    else if (commandIntent.type === 'activate_context') targetCtxId = commandIntent.targetContextId;
        else if (commandIntent.type === 'deactivate_context') {
            const deactivateId = commandIntent.targetContextId;
            const actionPreset = presetRepo.getActionPreset(deactivateId);
            const currentStatuses = activeContextsRepo2.getAllForSubject(payload.subjectId)
                .filter((c: any) => c.actionId === deactivateId);
            if (currentStatuses.length > 0) {
                // One wearable context can occupy several body points. A verbal
                // command removes the item as a whole, not just its first row.
                activeContextsRepo2.removeByActionId(payload.subjectId, deactivateId);
                const removeNarr = (actionPreset as any)?.vector?.removeNarrative || (actionPreset as any)?._baseAction?.vector?.removeNarrative;
                const subjectChar = characterRepo.get(payload.subjectId);
                const subjectName = subjectChar?.name || payload.subjectId;
                const removalNarrative = removeNarr ? removeNarr.replace(/\{name\}/g, subjectName) : `${subjectName} снимает: ${actionPreset?.label || deactivateId}`;
                eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                addedContextNotes.push(removalNarrative);
                actionApplied = true;
            }
        } else if (commandIntent.type === 'move') {
            const tgtLoc = commandIntent.targetLocation;
            let finalSlotId: string | null = null;
            let targetLabel = tgtLoc;
            
            const sceneChars = sceneCharacterRepo.list(payload.sceneId);
            const sceneSlots = state.scene.slots || []; 
            
            if (tgtLoc.trim().toLowerCase() === 'initiator') {
                const initiator = sceneChars.find(c => c.character.id === payload.playerId || c.character.playerId === payload.playerId);
                if (initiator && initiator.slotId) {
                    finalSlotId = initiator.slotId;
                    targetLabel = initiator.character.name || initiator.character.id;
                }
            } else {
                const tgtChar = sceneChars.find(c => {
                    const cname = (c.character.name || '').toLowerCase();
                    return cname.includes(tgtLoc.toLowerCase()) || tgtLoc.toLowerCase().includes(cname);
                });
                if (tgtChar && tgtChar.slotId) {
                    finalSlotId = tgtChar.slotId;
                    targetLabel = tgtChar.character.name || tgtLoc;
                } else {
                    const slotObj = sceneSlots.find((s: any) => {
                        const sname = (typeof s === 'string' ? s : s.id || '').toLowerCase();
                        return sname === tgtLoc.toLowerCase() || sname.includes(tgtLoc.toLowerCase()) || tgtLoc.toLowerCase().includes(sname);
                    });
                    if (slotObj) {
                        finalSlotId = typeof slotObj === 'string' ? slotObj : (slotObj as any).id;
                        targetLabel = finalSlotId;
                    } else {
                        finalSlotId = tgtLoc;
                    }
                }
            }

            if (finalSlotId) {
                const currentCompliance = (state.relation?.attitude || state.core.attitude || 0) + ((state.core.plasticity || 0) * 0.5);
                const moveCompliance = 30; 
                
                if (currentCompliance >= moveCompliance) {
                    const subjCharPresence = sceneChars.find(c => c.character.subjectId === payload.subjectId || c.character.id === payload.subjectId);
                    if (subjCharPresence) {
                        if (subjCharPresence.slotId !== finalSlotId) {
                            sceneCharacterRepo.set(payload.sceneId, subjCharPresence.character.id, { slotId: finalSlotId });
                            let reason = (state.relation?.attitude > 70) ? "с готовностью" : "с неохотой, подчиняясь приказу";
                            const moveNarrative = `[Система]: Актив перемещается в зону "${targetLabel}", ${reason}.`;
                            eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'move', action: null, actionLabel: moveNarrative, narrative: moveNarrative }, { added: true });
                            addedContextNotes.push(moveNarrative);
                        } else {
                            addedContextNotes.push(`Ты уже в зоне "${targetLabel}", перемещение не нужно.`);
                        }
                    }
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно отклоняет указание на перемещение в "${targetLabel}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен для выполнения (требуется ${moveCompliance}).`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        } else if (commandIntent.type === 'perform_action') {
            commandActionPreset = presetRepo.getActionPreset(commandIntent.actionId);
            if (commandActionPreset) {
                forcedAttempted = true;
                const requiredCompliance = (commandActionPreset.priority || 1) * 20;
                const currentCompliance = (state.relation?.attitude || state.core.attitude || 0) + ((state.core.plasticity || 0) * 0.5);
                const targetName = commandIntent.targetId || 'не указана';

                if (currentCompliance >= requiredCompliance) {
                    let reason = state.relation?.attitude > 70 ? "из симпатии и покорности" : "вынужденно подчиняясь сломленной воле";
                    if (state.core.attitude < 30) reason = "скрипя зубами, но будучи не в силах сопротивляться";
                    forcedNarrativeToLog = `[Система]: Актив выполняет указание "${commandActionPreset.label}" (цель: ${targetName}), ${reason}.`;
                    // keep a short local note for immediate UI feedback; don't
                    // persist the formal system_trigger until effects are applied
                    // (see later in the effects block).
                    addedContextNotes.push(forcedNarrativeToLog);
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно отклоняет действие "${commandActionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен для выполнения (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        } else if (commandIntent.type === 'perform_described_action') {
            // RP-style described action: *Глажу по щеке*, *бью хлыстом* etc.
            // The parser already resolved a matching preset (or null) and checked inventory.
            if (commandIntent.refusal) {
                // Refused — missing item, no match, or other reason
                const refusalNarrative = `[Система]: ${commandIntent.refusal}`;
                addedContextNotes.push(refusalNarrative);
                eventLogRepo.append(payload.subjectId, 'system_trigger', { presetId: 'system_trigger', action: null, actionLabel: refusalNarrative, narrative: refusalNarrative }, { added: true });
                actionApplied = false;
            } else if (commandIntent.matchedActionId) {
                // Matched a preset — apply its effects similar to perform_action
                commandActionPreset = presetRepo.getActionPreset(commandIntent.matchedActionId);
                if (commandActionPreset) {
                    forcedAttempted = true;
                    const requiredCompliance = (commandActionPreset.priority || 1) * 20;
                    const currentCompliance = (state.relation?.attitude || state.core.attitude || 0) + ((state.core.plasticity || 0) * 0.5);
                    // Default target is the subject being acted upon
                    const targetChar = characterRepo.get(commandIntent.targetId || payload.subjectId);
                    const targetName = targetChar?.name || commandIntent.targetId || payload.subjectId;
                    const descText = commandIntent.description || '';

                    if (currentCompliance >= requiredCompliance) {
                        // For described actions, the PLAYER is doing something TO the subject.
                        // The subject's compliance determines whether they accept or resist,
                        // but the narrative should describe the player's action, not the subject "following orders".
                        let reason: string;
                        if (state.core.attitude < 30) {
                            reason = "напрягаясь и пытаясь отдёрнуться";
                        } else if (state.relation?.attitude > 70) {
                            reason = "с готовностью принимая ласку";
                        } else {
                            reason = "покорно позволяя себе касаться";
                        }
                        forcedNarrativeToLog = `[Система]: *${descText}* → ${commandActionPreset.label}, ${reason}.`;
                        addedContextNotes.push(forcedNarrativeToLog);
                    } else {
                        const refusedNarrative = `[Система]: Актив мысленно отклоняет действие "${commandActionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен для выполнения (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                        addedContextNotes.push(refusedNarrative);
                    }
                }
            }
        }

                if (targetCtxId) {
            const actionPreset = presetRepo.getActionPreset(targetCtxId);
            if (actionPreset && actionPreset.contextConfig) {
                const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = (state.relation?.attitude || state.core.attitude || 0) + ((state.core.plasticity || 0) * 0.5);
                
                if (currentCompliance >= requiredCompliance) {
                    let reason = (state.relation?.attitude > 70) ? "охотно поддаваясь влиянию" : "с неохотой подчиняясь программированию";
                    if (state.core.attitude < 30) reason = "вынужденно и унизительно для себя";
                    // If there is a playerId (actor), mark them as initiator; otherwise default to subject
                    const initiator = payload.playerId || payload.subjectId;
                    ContextManager.applyContext(payload.subjectId, targetCtxId, actionPreset, undefined, initiator);
                    // Only record a forced narrative state when the action preset explicitly
                    // defines a non-verbal, non-wait type. If the preset has no type, we
                    // avoid creating a forced narrative to prevent polluting memory with
                    // spurious "Выполнено действие: Разговор" entries.
                    if (actionPreset.type && actionPreset.type !== 'verbal' && actionPreset.type !== 'wait') {
                        const forcedNarrative = `[Система]: Актив принимает состояние "${actionPreset.label}", ${reason}. Примени это состояние.`;
                        eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                        addedContextNotes.push(forcedNarrative);
                        actionApplied = true;
                    }
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно отклоняет требование перейти в состояние "${actionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        }

                    // Execute effects of the commanded actionPreset (apply/remove contexts)
                    try {
                        const initiator = payload.playerId || payload.subjectId;
                        // If the commanded actionPreset itself defines contextConfig, apply it to the subject
                        if (commandActionPreset && (commandActionPreset as any).contextConfig) {
                            ContextManager.applyContext(payload.subjectId, commandIntent.actionId, commandActionPreset as any, undefined, initiator);
                            const applyNarrative = `[Система]: Применено действие "${commandActionPreset.label}" к активу.`;
                            eventLogRepo.append(payload.subjectId, 'context_change', { presetId: commandIntent.actionId, action: null, actionLabel: applyNarrative, narrative: applyNarrative }, { added: true });
                            addedContextNotes.push(applyNarrative);
                            // mark that the forced action produced an actual state change
                            forcedApplied = true;
                            actionApplied = true;
                        }

                        // If the commanded actionPreset declares removeContexts, remove them from the subject
                        if (commandActionPreset && (commandActionPreset as any).removeContexts && Array.isArray((commandActionPreset as any).removeContexts)) {
                            for (const remCtx of (commandActionPreset as any).removeContexts) {
                                activeContextsRepo.removeByActionId(payload.subjectId, remCtx);
                                // mark that the forced action produced an actual state change
                                forcedApplied = true;
                                actionApplied = true;
                            }
                            const removedNarrative = `[Система]: Удалены связанные контексты в результате действия "${commandActionPreset.label}".`;
                            eventLogRepo.append(payload.subjectId, 'context_change', { presetId: commandIntent.actionId, action: null, actionLabel: removedNarrative, narrative: removedNarrative }, { removed: true });
                            addedContextNotes.push(removedNarrative);
                        }
                    } catch (err) {
                        console.error('[runGameTick] failed to apply commanded action preset effects', err);
                    }
                    // After attempting effects, if the forced action was attempted and
                    // the narrative says it was performed (compliance was sufficient),
                    // we log the system-trigger narrative AFTER saveTickState so its id
                    // is higher than the interaction log — ensuring correct chronological
                    // order in recentEvents (interaction first, then system_trigger).
                    // The actual eventLogRepo.append is moved below saveTickState.
                    if (forcedAttempted && forcedNarrativeToLog) {
                        actionApplied = true;
                    }
    }

    // "Neutral pose" heuristic: If saying "встань", stand up.
    if (payload.textMessage) {
        const wantsNeutralPose = /\b(встань|вставай|поднимись|поднимайся|на\s+ноги|встаньте)\b/.test(payload.textMessage.toLowerCase());
        if (wantsNeutralPose) {
            
            const activeContextsRepo2 = activeContextsRepo;
            

            const currentContexts = activeContextsRepo2.getAllForSubject(payload.subjectId);
            const poseContexts = currentContexts
                .map((obj: any) => ({ ctx: obj, preset: presetRepo.getActionPreset(obj.actionId) }))
                .filter((item: any) => item.preset?.contextConfig?.occupiesPoints?.includes('global_pose'));

            if (poseContexts.length) {
                for (const { ctx, preset } of poseContexts) {
                    if (!preset?.id) continue;
                    const poseRemoveNarr = preset?.vector?.removeNarrative;
                    const poseSubjectChar = characterRepo.get(payload.subjectId);
                    const poseSubjectName = poseSubjectChar?.name || payload.subjectId;
                    const removalNarrative = poseRemoveNarr ? poseRemoveNarr.replace(/\{name\}/g, poseSubjectName) : `${poseSubjectName} меняет положение: ${preset.label}`;
                    activeContextsRepo2.remove(ctx.id);
                    eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                    addedContextNotes.push(removalNarrative);
                    actionApplied = true;
                }
            } else {
                addedContextNotes.push('Ты уже стоишь, поэтому дополнительных изменений нет.');
            }
        }
    }

    if (compiledAction.contextConfig) {
        const initiator = payload.playerId || payload.subjectId;
        ContextManager.applyContext(payload.subjectId, payload.presetId, compiledAction, undefined, initiator);
        actionApplied = true;
    }
    if (compiledAction.removeContexts) {
        for (const remCtx of compiledAction.removeContexts) {
            activeContextsRepo.removeByActionId(payload.subjectId, remCtx);
            actionApplied = true;
        }
    }

    // Passive time affects every local point, not only the synthetic systemic
    // point used by /wait. Current values recover/damp toward their own
    // baselines; baselines continue to follow through the normal learning rule.
    if (payload.presetId === 'wait') {
        const pointCfg = DEFAULT_CONFIG.formulas.baseline?.point || {};
        for (const passivePoint of pointStateRepo.getAllForSubject(payload.subjectId)) {
            if (passivePoint.pointId === payload.pointId) continue;
            const baselineSensitivity = passivePoint.baselineLocalSensitivity ?? passivePoint.localSensitivity;
            const baselineAttitude = passivePoint.baselineLocalAttitude ?? passivePoint.localAttitude;
            const recoveredSensitivity = Math.min(baselineSensitivity, passivePoint.localSensitivity + DEFAULT_CONFIG.formulas.applyLearning.localSensitivityRegenRate * elapsedTime);
            passivePoint.localSensitivity = dampTowardsBaseline(recoveredSensitivity, baselineSensitivity, { ...pointCfg, timeScale: elapsedTime });
            passivePoint.localAttitude = dampTowardsBaseline(passivePoint.localAttitude, baselineAttitude, { ...pointCfg, timeScale: elapsedTime });
            passivePoint.baselineLocalSensitivity = advanceBaseline(baselineSensitivity, passivePoint.localSensitivity, { plasticity: engineOutput.nextCore.plasticity, openness: engineOutput.nextCore.openness, novelty: 0 }, { baseRate: pointCfg.adaptBase, ...pointCfg, timeScale: elapsedTime });
            passivePoint.baselineLocalAttitude = advanceBaseline(baselineAttitude, passivePoint.localAttitude, { plasticity: engineOutput.nextCore.plasticity, openness: engineOutput.nextCore.openness, novelty: 0 }, { baseRate: pointCfg.adaptBase, ...pointCfg, timeScale: elapsedTime });
            pointStateRepo.save(payload.subjectId, passivePoint.pointId, passivePoint);
        }
    }

    // === Edging & Tension Discharge Mechanic ===
    let peakEventToLog: { presetId: string; narrative: string } | null = null;
    let notableObservationEvent: 'positive_discharge' | 'breakdown' | 'exhaustion' | undefined;
    // A discharge is an outcome of active stimulation. Rest can lower tension
    // or leave a subject near the edge, but cannot itself cause the peak event.
    if (payload.presetId !== 'wait' && engineOutput.nextCore.tension >= 100) {
        const activeContextIds = activeContextsRepo.getAllForSubject(payload.subjectId).map(context => context.actionId);
        for (const rule of STATE_RULES) {
            if (rule.check(engineOutput.nextCore, engineOutput.nextPoint)) activeContextIds.push(rule.actionPresetId);
        }
        const discharge = evaluateTensionDischarge({
            core: engineOutput.nextCore,
            result: engineOutput.result,
            recentEvents: history,
            activeContextIds
        });
        const isPositive = discharge.outcome === 'positive';
        let dischargeNarrative = '';

        if (isPositive) {
            notableObservationEvent = 'positive_discharge';
            dischargeNarrative = `[Система: ПОЛОЖИТЕЛЬНАЯ РАЗРЯДКА] Накопленное возбуждение достигает пика и завершается глубокой физиологической разрядкой.`;
            const trustFactor = clamp(((engineOutput.nextCore.attitude || 0) - 30) / 70, 0, 1);
            engineOutput.nextCore.openness = Math.min((engineOutput.nextCore.openness || 0) + 5 + 10 * trustFactor, 100);
            engineOutput.nextCore.attitude = Math.min((engineOutput.nextCore.attitude || 0) + 3 + 12 * trustFactor, 100);
            engineOutput.nextCore.sensitivity = Math.max((engineOutput.nextCore.sensitivity || 0) - 20, 0); // refractory period
            engineOutput.nextCore.capacity = Math.max((engineOutput.nextCore.capacity || 0) - 40, 0);
            if (!presetRepo.getActionPreset('effect_refractory')) {
                presetRepo.saveActionPreset(
                    'effect_refractory',
                    'Рефрактерный период',
                    { intensity_mult: 0.25, contact_mult: 0.8, novelty_mult: 0.25 },
                    { type: 'condition', duration: 3, occupiesPoints: [] }
                );
            }
            const refractoryPreset = presetRepo.getActionPreset('effect_refractory');
            if (refractoryPreset) {
                ContextManager.applyContext(payload.subjectId, 'effect_refractory', refractoryPreset);
            }
        } else {
            notableObservationEvent = 'breakdown';
            dischargeNarrative = `[Система: НЕРВНЫЙ СРЫВ] Накопленная активация разрешается паническим истощением вместо положительной разрядки.`;
            engineOutput.nextCore.attitude = Math.max((engineOutput.nextCore.attitude || 0) - 20, 0);
            engineOutput.nextCore.openness = Math.max((engineOutput.nextCore.openness || 0) - 15, 0);
            engineOutput.nextCore.capacity = 0; // Total exhaustion
        }

        // Apply shared post-discharge vulnerability
        engineOutput.nextCore.plasticity = Math.min((engineOutput.nextCore.plasticity || 0) + 30, 100);
        engineOutput.nextCore.tension = 10; // Reset tension down to baseline-ish value

        addedContextNotes.push(dischargeNarrative);
        peakEventToLog = { presetId: 'discharge', narrative: dischargeNarrative };

    } else if ((engineOutput.nextCore.capacity || 0) <= 0 && (state.core.tension || 0) > 85 && (engineOutput.nextCore.tension || 0) < 100) {
        notableObservationEvent = 'exhaustion';
        // "Ruined" / Exhaustion before peak
        const ruinNarrative = `[Система: ИСТОЩЕНИЕ РЕСУРСА] Выносливость упала до нуля, пока субъект находился на грани. Разрядки не произошло. Оставляя лишь гнетущую апатию и опустошение.`;
        addedContextNotes.push(ruinNarrative);
        engineOutput.nextCore.attitude = Math.max((engineOutput.nextCore.attitude || 0) - 10, 0);
        engineOutput.nextCore.tension = 20; // Tension drops into a frustrating low-burn
        
        peakEventToLog = { presetId: 'ruined', narrative: ruinNarrative };
    }
    engineOutput.notableEvent = notableObservationEvent;

    // Save player and scene state at the final atomicity boundary
    
    // Currently scene changes aren't saved to DB in runGameTick but rather through activeSceneId. If scene state mutated, we'd save it here.

    // 6.1 Run scenario consequences (transitions, missions)
    const scenarioResult = runScenarioStep(
        {
            scene: state.scene,
            resources: state.resources,
            core: engineOutput.nextCore,
            contracts: state.contracts
        },
        { actionId: payload.presetId }
    );

    if (scenarioResult.updatedResources !== state.resources) {
        state.resources = scenarioResult.updatedResources;
    }
    // We can do something with scenarioResult.updatedContracts later if needed.
    if (scenarioResult.updatedCore && scenarioResult.updatedCore !== engineOutput.nextCore) {
        engineOutput.nextCore = scenarioResult.updatedCore;
    }

    // === Resource Regeneration per tick ===
    try {
        const cur = state.resources.resources || {};
        for (const [key, res] of Object.entries(cur)) {
            if (res.regenRate && res.regenRate !== 0) {
                res.amount += res.regenRate * elapsedTime;
                if (res.maxAmount !== undefined && res.amount > res.maxAmount) {
                    res.amount = res.maxAmount;
                }
            }
        }
    } catch (err) {
        console.warn('Resource regen error', err);
    }

    if (scenarioResult.nextSceneId && scenarioResult.nextSceneId !== state.scene.id) {
        const nextScene = sceneRepo.get(scenarioResult.nextSceneId);
        if (nextScene) {
            state.scene = nextScene;
            activeSceneId = nextScene.id;
        }
    }
    if (!activeSceneId) {
        activeSceneId = state.scene.id;
    }

    // 6.6 Evaluate conditions for state triggers (Trauma, Panic, Subspace) over ticks
    addedContextNotes.push(...ConditionWatcher.evaluate(
        payload.subjectId,
        payload.pointId,
        engineOutput.nextCore,
        engineOutput.nextPoint
    ));

    // Orchestration may have changed nextCore after runTick (discharge,
    // breakdown, scenario consequences). Keep public delta consistent with the
    // state that is actually persisted.
    engineOutput.delta.core = {
        tension: engineOutput.nextCore.tension - stateBefore.core.tension,
        sensitivity: engineOutput.nextCore.sensitivity - stateBefore.core.sensitivity,
        capacity: engineOutput.nextCore.capacity - stateBefore.core.capacity,
        openness: engineOutput.nextCore.openness - stateBefore.core.openness,
        plasticity: engineOutput.nextCore.plasticity - stateBefore.core.plasticity,
        attitude: engineOutput.nextCore.attitude - stateBefore.core.attitude,
    };
    engineOutput.delta.point.localSensitivity = engineOutput.nextPoint.localSensitivity - stateBefore.point.localSensitivity;
    engineOutput.delta.point.localAttitude = engineOutput.nextPoint.localAttitude - stateBefore.point.localAttitude;

    const pointPresetForObservation = presetRepo.getPointPreset(payload.pointId);
    const diagnostics = buildDiagnostics(
        engineOutput.tickMeta.inputs.action,
        state.core,
        engineOutput,
        payload.subjectId,
        pointPresetForObservation?.label,
        { previousContextIds: allContexts.map(context => context.actionId), notableEvent: notableObservationEvent }
    );

    // 7. Save Atomically (before prompt building). Store the semantic snapshot
    // with the event so history never has to reinterpret an old tick.
    saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId, diagnostics.observation);
    if (peakEventToLog) {
        eventLogRepo.append(payload.subjectId, 'system_tick', { presetId: peakEventToLog.presetId, action: null, actionLabel: peakEventToLog.narrative, narrative: peakEventToLog.narrative }, { added: true });
    }

    // 7.1 Log system_trigger AFTER saveTickState so its event_log id is higher
    // than the interaction log written by saveTickState. This ensures the narrator
    // sees them in correct chronological order: interaction (player acted) → system_trigger (asset complied).
    if (forcedAttempted && forcedNarrativeToLog) {
        eventLogRepo.append(payload.subjectId, 'system_trigger', { presetId: 'system_trigger', action: null, actionLabel: forcedNarrativeToLog, narrative: forcedNarrativeToLog }, { added: true });
    }

    // [Async] Background update relations
    // const bgUpdate = require('../workers/backgroundRelationUpdate');
    setTimeout(() => {
        // bgUpdate.backgroundRelationUpdate(
//            payload.subjectId, 
//            payload.playerId, 
//            payload.presetId, 
//            payload.presetId,
//            engineOutput.delta?.core?.attitude || 0
//        );
    }, 100);
    
    if (scenarioResult.updatedResources !== state.resources || true) {
        resourceRepo.save(state.resources);
    }

    // 6.5 Update context strain (Escalation / Decay)

    const prompt = await buildPromptPayload(payload.subjectId, payload.subjectId, engineOutput, activeSceneId, { initiatorId: payload.playerId || 'PL-1' });

    // Log the constructed prompt payload for debugging/inspection
    try {
        appendJsonLog('prompt_payloads.jsonl', {
            tickId,
            forSubject: payload.subjectId,
            sceneId: activeSceneId,
            prompt: prompt,
            explanationRu: explainPromptLog({ tickId, forSubject: payload.subjectId, sceneId: activeSceneId, prompt })
        });
    } catch (e) { /* ignore */ }

    let systemMarketLog = '';
    if (payload.presetId === 'buy_raw_asset' && payload.customPayload?.assetId) {
        try {
            systemMarketLog = handleBuyAssetAction(
                payload.playerId, 
                payload.subjectId, 
                activeSceneId, 
                payload.customPayload.assetId as string
            );
            prompt.systemPrompt += `\n\n${systemMarketLog}`;
        } catch (e: any) {
            prompt.systemPrompt += `\n\n[SYSTEM: Транзакция отклонена: ${e.message}]`;
        }
    }

    // Inject addedContextNotes into systemPrompt so the LLM can react to
    // system events (refusals, moves, context changes) in its reply.
    if (addedContextNotes.length > 0 && prompt.systemPrompt) {
        prompt.systemPrompt += `\n\n[Системные события тика]:\n${addedContextNotes.join('\n')}`;
    }

    const event: GameEvent = {
        id: tickId,
        type: payload.eventType || (payload.textMessage ? 'verbal_input' : 'ui_action'),
        subjectId: payload.subjectId,
        playerId: payload.playerId,
        sceneId: activeSceneId,
        pointId: payload.pointId,
        timestamp: new Date().toISOString(),
        payload: {
            presetId: payload.presetId,
            playerIntensity: payload.playerIntensity,
            dynamicModifiers: payload.dynamicModifiers,
            ...payload.customPayload
        }
    };

    const actionTrace = [
        { label: 'State before (core)', values: stateBefore.core },
        { label: 'State before (point)', values: stateBefore.point },
        { label: 'Compiled action', values: compiledAction },
        {
            label: 'Engine result',
            values: {
                delta: engineOutput.delta?.core,
                result: engineOutput.result
            }
        },
        { label: 'State after (core)', values: engineOutput.nextCore },
        { label: 'State after (point)', values: engineOutput.nextPoint }
    ];

    // Log engine state changes: before vs after
    try {
        const diffs: any = { core: {}, point: {} };
        for (const k of Object.keys(stateBefore.core || {})) {
            const beforeV = (stateBefore.core as any)[k];
            const afterV = (engineOutput.nextCore as any)[k];
            if (JSON.stringify(beforeV) !== JSON.stringify(afterV)) diffs.core[k] = { before: beforeV, after: afterV };
        }
        for (const k of Object.keys(stateBefore.point || {})) {
            const beforeV = (stateBefore.point as any)[k];
            const afterV = (engineOutput.nextPoint as any)[k];
            if (JSON.stringify(beforeV) !== JSON.stringify(afterV)) diffs.point[k] = { before: beforeV, after: afterV };
        }
    appendJsonLog('engine_state.jsonl', { tickId, subjectId: payload.subjectId, diffs, diagnostics, explanationRu: explainEngineState({ tickId, subjectId: payload.subjectId, diffs, diagnostics }) });
    } catch (e) { /* ignore */ }

    
    return {
        tickId,
        event,
        compiledAction,
        output: engineOutput,
        stateBefore,
        stateAfter: {
            core: engineOutput.nextCore,
            point: engineOutput.nextPoint
        },
        diagnostics,
        prompt,
        scenario: scenarioResult,
        metadata: {
            commandIntent: payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent
        },
        actionApplied,
        systemNotes: addedContextNotes,
    };
}
