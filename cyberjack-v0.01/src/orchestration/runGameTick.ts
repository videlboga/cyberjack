import { handleBuyAssetAction } from '../scenario/buyAssetHandler';
// src/orchestration/runGameTick.ts
import { randomUUID } from 'crypto';
import { loadTickState } from './loadTickState';
import { computeTickOutcome } from './computeTickOutcome';
import { commitTickOutcome } from './commitTickOutcome';
import { publishTickOutcome } from './publishTickOutcome';
import type { TickEffect } from './tickEffectPlan';
import { compileAction } from '../compiler/compileAction';
import { eventQueries } from '../infrastructure/eventQueries';
import { activeContextsRepo, sceneRepo, presetRepo, characterRepo, characterRelationRepo, subjectiveAssociationRepo } from '../infrastructure/repositories';
import { CompiledAction, TickBundle, GameEvent } from '../domain/types';
import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import { intimateNarrationFor } from '../domain/intimateNarration';
import { appendJsonLog } from '../utils/fileLogs';
import { explainPromptLog, explainEngineState } from '../utils/logExplainers';
import * as checkActionAccess from '../scenario/checkActionAccess';
import { applyResourceCosts } from '../scenario/applyResourceCosts';
import { runScenarioStep } from '../scenario/runScenarioStep';
import { ContextManager } from './contextManager';
import { sceneCharacterRepo } from '../infrastructure/repositories';

import { ConditionWatcher } from './conditionWatcher';
import { resolveTickConsequences } from './resolveTickConsequences';
import { pointStateRepo } from '../infrastructure/repositories';
import { DEFAULT_CONFIG } from '../engine/config';
import { dampTowardsBaseline, advanceBaseline } from '../engine/baselineUtils';
import { clamp } from '../engine/utils';
import { resolveLaboratoryMove } from '../scenario/resolveLaboratoryMove';
import { calculateSituationalCompliance, deriveEdgeProfile } from '../domain/edgeState';
import { conditioningTags, preferenceValenceModifier } from '../domain/conditioning';
import { resolveInteractionActionCandidate } from '../domain/resolver';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { actionConflictsWithStance, actionRespectsStance, boundaryAcknowledgementStrength, boundaryValencePenalty, requestedStanceFromReaction } from '../domain/interactionStance';
import { resolvePortraitEmotion } from '../domain/portraitEmotion';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';
import { db } from '../infrastructure/db';
import { buildPhysicalReaction } from '../narrative/physicalReaction';
import { buildBoundaryExpression } from '../narrative/boundaryExpression';
import { presentCommand } from '../narrative/commandPresentation';
import { canPerformPartnerPointAction, isPartnerPointAction } from '../domain/intimatePartnerMechanics';
import { memoryAppraisalModifier } from '../domain/memoryCorrection';

export interface GameEventPayload {
    subjectId: string;
    pointId: string;
    playerId: string;
    actingCharacterId?: string;
    sceneId: string;
    presetId: string; // The base action id
    playerIntensity?: number;
    dynamicModifiers?: Partial<CompiledAction>;
    eventType?: GameEvent['type'];
    textMessage?: string;
    parserVersion?: string;
    customPayload?: Record<string, unknown>;
    deltaTime?: number;
    stateDeltaScale?: number;
    skipPrompt?: boolean;
    skipContextTimeAdvance?: boolean;
}

export function resolveGenericUndressContexts(
    text: string,
    activeActionIds: string[],
    tagsForAction: (actionId: string) => string[],
): string[] | null {
    const generic = /(?:сними(?:те)?\s+(?:всю\s+)?одежду|раздень(?:ся|тесь)|сними(?:те)?\s+вс[её])/iu.test(text);
    if (!generic) return null;
    return [...new Set(activeActionIds.filter(actionId => tagsForAction(actionId).includes('clothing')))];
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
    const initiatorId = payload.actingCharacterId || payload.playerId || payload.subjectId;
    // 1. Load state
    const state = loadTickState(payload.subjectId, payload.pointId, payload.playerId, payload.sceneId, initiatorId);
    const authoredPreset = presetRepo.getActionPreset(payload.presetId);
    if (initiatorId !== payload.subjectId && authoredPreset && isPartnerPointAction(payload.presetId, authoredPreset.tags || [], payload.pointId)) {
        const actorPointIds = pointStateRepo.getAllForSubject(initiatorId).map(point => point.pointId);
        if (!canPerformPartnerPointAction(actorPointIds, payload.presetId, authoredPreset.tags || [], payload.pointId)) {
            throw new Error('У исполнителя нет анатомической точки, необходимой для этого интимного действия');
        }
    }
    const stateBefore = {
        core: { ...state.core },
        point: { ...state.point }
    };
    const relationalDynamics = relationshipDynamicsRepo.get(payload.subjectId, initiatorId);
    const elapsedTime = payload.deltaTime ?? (payload.presetId === 'wait' ? 20 : 1);
    const preTickContextNotes: string[] = [];
    const tickEffects: TickEffect[] = [];
    let labRelocationApplied = false;
    
    // 2. Scenario layer: доступность действия, ресурсы, локация
    const validation = checkActionAccess.validateAction(
        payload.presetId, state.scene, state.resources, payload.subjectId, payload.playerId, payload.pointId
    );
    const internalSustainedPulse = [
        'sustained_vibration_pulse',
        'sustained_electro_pulse',
        'sustained_sexual_pulse',
    ].includes(payload.presetId) && Boolean(payload.customPayload?.sustainedSource);
    if (!validation.allowed && payload.presetId !== 'wait' && !internalSustainedPulse) {
        throw new Error(validation.errorReason || `Action "${payload.presetId}" blocked by scenario.`);
    }

    // 2.5 Verify node unblocked
    const blockCheck = ContextManager.isPointBlocked(payload.subjectId, payload.pointId);
    // Semantic parsing also extracts body-part mentions from ordinary speech.
    // That point is useful for appraisal and preference context, but a spoken
    // sentence does not physically contact it and must not be rejected by
    // clothing. A command that resolves to a physical perform_action remains
    // subject to the same body-point block.
    const parsedCommandType = (payload.dynamicModifiers as any)?.commandIntent?.type;
    const nonContactSpeech = payload.presetId === 'verbal_pressure'
        && Number((payload.dynamicModifiers as any)?.contact || 0) <= 0
        && parsedCommandType !== 'perform_action';
    if (blockCheck.blocked && payload.presetId !== 'wait' && !nonContactSpeech) {
        throw new Error(blockCheck.reason || `Точка "${payload.pointId}" заблокирована.`);
    }

    const actionCosts = state.scene.actionCosts?.[payload.presetId] || null;
    if (actionCosts && Object.keys(actionCosts).length) {
        try {
            const nextResources = applyResourceCosts(state.resources, actionCosts);
            state.resources = nextResources;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to apply resource costs');
        }
    }

    let activeSceneId = payload.sceneId;
    
    // 3. Get history for novelty
    const history = eventQueries.getRecentLogs(payload.subjectId, 5);
    const edgeProfile = deriveEdgeProfile(state.core, history);
    const complianceFor = (action: { id?: string; label?: string; type?: string; pointId?: string } = {}) => {
        const compliance = calculateSituationalCompliance({
            attitude: state.relation?.attitude ?? state.core.attitude ?? 0,
            plasticity: state.core.plasticity || 0,
            profile: edgeProfile,
            action,
        });
        const contextIds = new Set(activeContextsRepo.getAllForSubject(payload.subjectId).map(context => context.actionId));
        const stateModifier = (contextIds.has('effect_suggestibility') ? 15 : 0) +
            (contextIds.has('effect_subspace') ? 10 : 0) +
            (contextIds.has('act_inject_truth_serum') ? 25 : 0);
        const learnedModifier = relationalDynamics.learnedCompliance * .35 - relationalDynamics.resistance * .25 + relationalDynamics.dependency * .1;
        return { ...compliance, stateModifier, learnedModifier, total: Math.max(0, Math.min(150, compliance.total + stateModifier + learnedModifier)) };
    };
    
    // 4. Compile Action Vector
    let allContexts = activeContextsRepo.getAllForSubject(payload.subjectId);
    if (allContexts.some(context => context.actionId === 'effect_apathy') &&
        !allContexts.some(context => context.actionId === 'pose_lying_down')) {
        const collapse = ContextManager.planAutonomousCollapse(payload.subjectId);
        if (collapse.effect) {
            tickEffects.push(collapse.effect);
            // Model the collapse locally so compileAction sees the lying pose
            // without re-reading the DB before commit.
            allContexts = [...allContexts, {
                id: 'planned_lying_down', actionId: 'pose_lying_down', pointId: 'global_pose',
                subjectId: payload.subjectId, actorId: payload.subjectId,
            } as any];
        }
        if (collapse.narrative) preTickContextNotes.push(collapse.narrative);
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
    const intimateNarration = intimateNarrationFor(
        payload.presetId,
        payload.pointId,
        payload.customPayload?.sustainedSource,
    );
    if (intimateNarration) {
        compiledAction = { ...compiledAction, ...intimateNarration };
    }

    // 4.5 Apply Virtual Contexts (Mental and Body point overloads)
    const baseAction = (compiledAction as any)._baseAction;
    (compiledAction as any)._baseAction = baseAction || compiledAction;
    const classifiedVerbalTags = Array.isArray((payload.dynamicModifiers as any)?.tags)
        ? (payload.dynamicModifiers as any).tags
        : null;
    compiledAction.tags = classifiedVerbalTags || conditioningTags(compiledAction.actionKey, compiledAction.tags || []);
    (compiledAction as any)._baseAction = {
        ...(compiledAction as any)._baseAction,
        tags: compiledAction.tags,
    };
    const mentionInfluence = payload.presetId === 'verbal_pressure' ? 0.25 : 1;
    const conditioningModifier = payload.presetId === 'wait'
        ? 0
        : preferenceValenceModifier(compiledAction.tags || [], state.core.preferences) * mentionInfluence;
    if (conditioningModifier !== 0) {
        compiledAction.valence = clamp(compiledAction.valence + conditioningModifier, -1, 1);
        (compiledAction as any).conditioningModifier = conditioningModifier;
        (compiledAction as any)._baseAction = {
            ...(compiledAction as any)._baseAction,
            valence: clamp(((compiledAction as any)._baseAction?.valence || 0) + conditioningModifier, -1, 1),
            conditioningModifier,
        };
    }
    const memoryAssociationSignal = payload.presetId === 'wait'
        ? 0
        : subjectiveAssociationRepo.scoreAction(payload.subjectId, payload.actingCharacterId || payload.playerId, compiledAction.tags || []);
    const memoryModifier = memoryAppraisalModifier(memoryAssociationSignal, payload.presetId === 'verbal_pressure');
    if (memoryModifier !== 0) {
        compiledAction.valence = clamp(compiledAction.valence + memoryModifier, -1, 1);
        (compiledAction as any).memoryAssociationModifier = memoryModifier;
        (compiledAction as any)._baseAction = { ...(compiledAction as any)._baseAction, valence: clamp(((compiledAction as any)._baseAction?.valence || 0) + memoryModifier, -1, 1), memoryAssociationModifier: memoryModifier };
    }

    const parsedCommandIntent = payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent;
    let commandIntent = parsedCommandIntent ? { ...parsedCommandIntent } : parsedCommandIntent;
    let commandResolutionError: string | undefined;
    if (commandIntent?.type === 'change_current_interaction') {
        const semanticCommand = commandIntent;
        const activeIds = new Set(activeContextsRepo.getAllForSubject(payload.subjectId).map((context: any) => context.actionId));
        {
            const resolved = resolveInteractionActionCandidate({
                presets: presetRepo.getAllActionPresets(),
                activeContextIds: Array.from(activeIds) as string[],
                goal: semanticCommand.goal,
                suggestedActionId: semanticCommand.suggestedActionId,
                pointId: semanticCommand.pointId
            });
            if (resolved) {
                commandIntent = {
                    type: 'perform_action',
                    actionId: resolved.id,
                    targetId: semanticCommand.targetId,
                    pointId: (resolved.validTargets || []).includes(semanticCommand.pointId) ? semanticCommand.pointId : 'systemic'
                };
            } else {
                commandResolutionError = `Нет применимого действия, которое позволяет ${semanticCommand.goal === 'stop' ? 'прекратить' : semanticCommand.goal === 'adjust' ? 'изменить' : 'начать'} текущее взаимодействие.`;
                commandIntent = { type: 'none' };
            }
        }
        if (payload.dynamicModifiers) {
            (payload.dynamicModifiers as any).commandIntent = commandIntent;
        }
    }
    // preserve any action preset referenced by the parsed command so we can apply its effects later
    let commandActionPreset: any = undefined;
    if (commandIntent && commandIntent.type && commandIntent.type !== 'none') {
        (compiledAction as any).commandIntent = commandIntent;
        if ((compiledAction as any)._baseAction) {
            ((compiledAction as any)._baseAction as any).commandIntent = commandIntent;
        }
    }

    // Poses, movement and wardrobe/equipment toggles are scene operations, not
    // physiological calibration stimuli. Their context effects are applied
    // below, while this carrier tick remains metabolically neutral.
    if (commandIntent && ['change_pose', 'activate_context', 'deactivate_context', 'deactivate_contexts', 'move'].includes(commandIntent.type)) {
        compiledAction = { ...compiledAction, intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 };
        (compiledAction as any)._baseAction = { ...(compiledAction as any)._baseAction, intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 };
    }

    let activeStance = interactionStanceRepo.get(payload.subjectId, initiatorId);
    const nonContactTurn = Number(compiledAction.contact || 0) <= 0.05;
    const acknowledgementStrength = nonContactTurn
        ? boundaryAcknowledgementStrength(payload.textMessage || compiledAction.source?.rawText)
        : 0;
    let stanceSoftenedBeforeTick = false;
    if (activeStance && nonContactTurn) {
        // The immediate command to stop is not the same thing as forgiveness.
        // Once contact has actually ceased, let the live stance close quickly;
        // relationship memory still retains whether it had been ignored.
        const softenAmount = acknowledgementStrength > 0 ? acknowledgementStrength : .2;
        tickEffects.push({ kind: 'stance.soften', subjectId: payload.subjectId, actorId: initiatorId, amount: softenAmount });
        // Model the soften locally so the boundary decision below sees the
        // softened intensity without re-reading the DB before commit.
        activeStance = { ...activeStance, intensity: Math.max(0, activeStance.intensity - softenAmount) };
        stanceSoftenedBeforeTick = true;
    }
    const ignoredBoundary = actionConflictsWithStance(activeStance, compiledAction, payload.pointId);
    const respectedBoundary = Boolean(activeStance && actionRespectsStance(compiledAction));
    if (ignoredBoundary && activeStance) {
        const penalty = boundaryValencePenalty(activeStance);
        compiledAction.valence = clamp(compiledAction.valence - penalty, -1, 1);
        compiledAction.tags = [...new Set([...(compiledAction.tags || []), 'boundary_ignored'])];
        (compiledAction as any).interactionStance = { request: activeStance.request, ignored: true, penalty };
        tickEffects.push({ kind: 'stance.record-ignored', subjectId: payload.subjectId, actorId: initiatorId });
        preTickContextNotes.push(`Активная граница персонажа проигнорирована: действие продолжает нежелательный контакт.`);
    } else if (respectedBoundary && !stanceSoftenedBeforeTick) {
        tickEffects.push({ kind: 'stance.soften', subjectId: payload.subjectId, actorId: initiatorId });
        (compiledAction as any).interactionStance = { request: activeStance!.request, respected: true };
    }

    // 5. Run Engine Tick
    const stateDeltaScale = clamp(Number(payload.stateDeltaScale ?? 1), 0, 1);
    let engineOutput = computeTickOutcome({
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        action: compiledAction,
        core: state.core,
        point: state.point,
        relationship: state.relation,
        config: undefined,
        deltaTime: elapsedTime
    }, stateDeltaScale);

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
    if (!payload.skipContextTimeAdvance) {
        tickEffects.push({
            kind: 'context.age',
            subjectId: payload.subjectId,
            deltaTime: payload.presetId === 'wait' ? 1 : elapsedTime,
            elapsedMinutes: elapsedTime,
        });
    }

    if (engineOutput.tickMeta?.inputs) {
        (engineOutput.tickMeta.inputs.action as any)._baseAction = (compiledAction as any)._baseAction;
    }

    // 6. Save new state
    const tickId = randomUUID();

    // 6.0 Apply Context Overrides (Parser Intention Hook)
    // Here we perform dynamic context modification dictated directly by the LLM classification,
    // intercepting and modifying the subject's conditions immediately.
    let addedContextNotes: string[] = [
        ...preTickContextNotes,
        ...(commandResolutionError ? [`[Система]: ${commandResolutionError}`] : [])
    ];
    // Did this tick actually change contexts / apply effects?
    let actionApplied = false;
    // Hoist forced-action tracking to function scope so we can log system_trigger
    // AFTER the primary commit (ensuring correct id ordering: interaction < system_trigger)
    let forcedNarrativeToLog: string | undefined = undefined;
    let forcedAttempted = false;
    if (commandIntent && commandIntent.type !== 'none') {
        
        const activeContextsRepo2 = activeContextsRepo;
        

        // Track forced-action narrative/effects so we only log a "performed"
        // system_trigger after the effects actually changed state.
        let forcedApplied = false;
        let commandEffectsAuthorized = false;

        let targetCtxId: string | undefined;
        if (commandIntent.type === 'change_pose') targetCtxId = commandIntent.targetPoseId;
    else if (commandIntent.type === 'activate_context') targetCtxId = commandIntent.targetContextId;
        else if (commandIntent.type === 'deactivate_context' || commandIntent.type === 'deactivate_contexts') {
            const deactivateIds = commandIntent.type === 'deactivate_context'
                ? [commandIntent.targetContextId]
                : commandIntent.targetContextIds;
            for (const deactivateId of [...new Set(deactivateIds)]) {
                const actionPreset = presetRepo.getActionPreset(deactivateId);
                const currentStatuses = activeContextsRepo2.getAllForSubject(payload.subjectId)
                    .filter((c: any) => c.actionId === deactivateId);
                if (!currentStatuses.length) continue;
                const requiredCompliance = actionPreset?.type === 'clothing' ? 40 : 25;
                const compliance = complianceFor({ id: deactivateId, label: actionPreset?.label, type: actionPreset?.type, pointId: payload.pointId });
                if (compliance.total < requiredCompliance) {
                    const refusalNarrative = `[Система]: Актив отклоняет требование «${actionPreset?.label || deactivateId}». Податливость ${Math.round(compliance.total)} (база ${Math.round(compliance.base)}, состояние ${compliance.edgeModifier >= 0 ? '+' : ''}${compliance.edgeModifier}); требуется ${requiredCompliance}.`;
                    addedContextNotes.push(refusalNarrative);
                } else {
                // One wearable context can occupy several body points. A verbal
                // command removes the item as a whole, not just its first row.
                const removeNarr = (actionPreset as any)?.vector?.removeNarrative || (actionPreset as any)?._baseAction?.vector?.removeNarrative;
                const subjectChar = characterRepo.get(payload.subjectId);
                const subjectName = subjectChar?.name || payload.subjectId;
                const removalNarrative = removeNarr ? removeNarr.replace(/\{name\}/g, subjectName) : `${subjectName} снимает: ${actionPreset?.label || deactivateId}`;
                tickEffects.push({
                    kind: 'context.remove-action',
                    subjectId: payload.subjectId,
                    actionId: deactivateId,
                    event: {
                        subjectId: payload.subjectId,
                        type: 'context_change',
                        presetId: 'context_change',
                        narrative: removalNarrative,
                        metadata: { removed: true },
                    },
                });
                addedContextNotes.push(removalNarrative);
                actionApplied = true;
                }
            }
        } else if (commandIntent.type === 'move') {
            const tgtLoc = commandIntent.targetLocation;
            const currentCompliance = complianceFor({ id: 'move', label: tgtLoc, type: 'move' }).total;
            const moveCompliance = 30;
            if (currentCompliance < moveCompliance) {
                const subjectName = characterRepo.get(payload.subjectId)?.name || payload.subjectId;
                const refusedNarrative = `[Система]: ${subjectName} отклоняет указание на перемещение в «${tgtLoc}».`;
                addedContextNotes.push(refusedNarrative);
            } else {
                const laboratoryMove = payload.sceneId === 'scene_lab_calibrator'
                    ? resolveLaboratoryMove(payload.subjectId, tgtLoc, payload.playerId)
                    : { outcome: 'unresolved', handled: false, moved: false, effects: [], label: undefined, slotId: undefined, reason: undefined };
                if (laboratoryMove.handled) {
                    const subjectChar = characterRepo.get(payload.subjectId);
                    const subjectName = subjectChar?.name || payload.subjectId;
                    if (laboratoryMove.moved) {
                        const moveNarrative = `[Система]: ${subjectName} перемещается ${laboratoryMove.label}.`;
                        tickEffects.push(...laboratoryMove.effects);
                        tickEffects.push({
                            kind: 'event.append',
                            event: {
                                subjectId: payload.subjectId,
                                type: 'context_change',
                                presetId: 'move',
                                narrative: moveNarrative,
                                metadata: { added: true, slotId: laboratoryMove.slotId },
                            },
                        });
                        labRelocationApplied = true;
                        addedContextNotes.push(moveNarrative);
                        actionApplied = true;
                    } else if (laboratoryMove.reason) {
                        addedContextNotes.push(`[Система]: ${laboratoryMove.reason}`);
                    }
                } else {
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
                    const subjCharPresence = sceneChars.find(c => c.character.subjectId === payload.subjectId || c.character.id === payload.subjectId);
                    if (subjCharPresence) {
                        if (subjCharPresence.slotId !== finalSlotId) {
                            tickEffects.push({ kind: 'scene.set-slot', sceneId: payload.sceneId, characterId: subjCharPresence.character.id, slotId: finalSlotId });
                            let reason = (state.relation?.attitude > 70) ? "с готовностью" : "с неохотой, подчиняясь приказу";
                            const moveNarrative = `[Система]: Актив перемещается в зону "${targetLabel}", ${reason}.`;
                            tickEffects.push({
                                kind: 'event.append',
                                event: {
                                    subjectId: payload.subjectId,
                                    type: 'context_change',
                                    presetId: 'move',
                                    narrative: moveNarrative,
                                    metadata: { added: true },
                                },
                            });
                            addedContextNotes.push(moveNarrative);
                        } else {
                            addedContextNotes.push(`Ты уже в зоне "${targetLabel}", перемещение не нужно.`);
                        }
                    }
                }
            }
            }
        } else if (commandIntent.type === 'perform_action') {
            commandActionPreset = presetRepo.getActionPreset(commandIntent.actionId);
            const activeClothing = resolveGenericUndressContexts(
                payload.textMessage || '',
                activeContextsRepo.getAllForSubject(payload.subjectId).map(context => context.actionId),
                actionId => presetRepo.getActionPreset(actionId)?.tags || [],
            );
            if (activeClothing) {
                if (activeClothing.length) {
                    const removalBase = commandActionPreset
                        || presetRepo.getActionPreset('eq_clothe_calibration_set_remove')
                        || presetRepo.getActionPreset('eq_clothe_jumpsuit_remove');
                    commandActionPreset = {
                        ...(removalBase || {}),
                        id: 'command_remove_worn_clothing',
                        label: 'Снять одежду',
                        type: 'physical',
                        tags: ['clothing', 'remove'],
                        priority: (removalBase as any)?.priority || 1,
                        removeContexts: [...new Set(activeClothing)],
                    } as any;
                } else {
                    addedContextNotes.push('[Система]: Команда снять одежду не привела к действию: на персонаже нет одежды.');
                    commandActionPreset = undefined;
                }
            }
            if (commandActionPreset) {
                const requiredContexts: string[] = (commandActionPreset as any).requireContexts || [];
                const activeIds = new Set(activeContextsRepo.getAllForSubject(payload.subjectId).map((context: any) => context.actionId));
                const missingContexts = requiredContexts.filter(contextId => !activeIds.has(contextId));
                if (missingContexts.length) {
                    addedContextNotes.push(`[Система]: Действие "${commandActionPreset.label}" не выполнено: отсутствует необходимое текущее состояние.`);
                    commandActionPreset = undefined;
                } else {
                    forcedAttempted = true;
                    const requiredCompliance = (commandActionPreset.priority || 1) * 20;
                    const currentCompliance = complianceFor({ id: commandActionPreset.id || commandIntent.actionId, label: commandActionPreset.label, type: commandActionPreset.type, pointId: commandIntent.pointId }).total;
                    const targetName = commandIntent.targetId || 'не указана';

                    if (currentCompliance >= requiredCompliance) {
                        commandEffectsAuthorized = true;
                        let reason = state.relation?.attitude > 70 ? "с готовностью выполняя указание" : "выполняя указание без подтверждённого добровольного согласия";
                        if (state.core.attitude < 30) reason = "скрипя зубами, но будучи не в силах сопротивляться";
                        forcedNarrativeToLog = `[Система]: Актив выполняет указание "${commandActionPreset.label}" (цель: ${targetName}), ${reason}.`;
                        actionApplied = true;
                        // keep a short local note for immediate UI feedback; don't
                        // persist the formal system_trigger until effects are applied
                        // (see later in the effects block).
                    } else {
                        const refusedNarrative = `[Система]: Актив мысленно отклоняет действие "${commandActionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен для выполнения (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                        addedContextNotes.push(refusedNarrative);
                    }
                }
            } else if (!activeClothing) {
                addedContextNotes.push(`[Система]: Команда не выполнена: действие «${commandIntent.actionId}» отсутствует в каталоге.`);
            }
        } else if (commandIntent.type === 'perform_described_action') {
            // RP-style described action: *Глажу по щеке*, *бью хлыстом* etc.
            // The parser already resolved a matching preset (or null) and checked inventory.
            if (commandIntent.refusal) {
                // Refused — missing item, no match, or other reason
                const refusalNarrative = `[Система]: ${commandIntent.refusal}`;
                addedContextNotes.push(refusalNarrative);
                tickEffects.push({
                    kind: 'event.append',
                    event: {
                        subjectId: payload.subjectId,
                        type: 'system_trigger',
                        presetId: 'system_trigger',
                        narrative: refusalNarrative,
                        metadata: { added: true },
                    },
                });
                actionApplied = false;
            } else if (commandIntent.matchedActionId) {
                // Matched a preset — apply its effects similar to perform_action
                commandActionPreset = presetRepo.getActionPreset(commandIntent.matchedActionId);
                if (commandActionPreset) {
                    forcedAttempted = true;
                    const requiredCompliance = (commandActionPreset.priority || 1) * 20;
                    const currentCompliance = complianceFor({ id: commandActionPreset.id || commandIntent.matchedActionId, label: commandActionPreset.label, type: commandActionPreset.type, pointId: commandIntent.pointId }).total;
                    // Default target is the subject being acted upon
                    const targetChar = characterRepo.get(commandIntent.targetId || payload.subjectId);
                    const targetName = targetChar?.name || commandIntent.targetId || payload.subjectId;
                    const descText = commandIntent.description || '';

                    if (currentCompliance >= requiredCompliance) {
                        commandEffectsAuthorized = true;
                        // For described actions, the PLAYER is doing something TO the subject.
                        // The subject's compliance determines whether they accept or resist,
                        // but the narrative should describe the player's action, not the subject "following orders".
                        let reason: string;
                        if (state.core.attitude < 30) {
                            reason = "напрягаясь и пытаясь отдёрнуться";
                        } else if (state.relation?.attitude > 70) {
                            reason = "с готовностью принимая ласку";
                        } else {
                            reason = "не сумев предотвратить контакт; это само по себе не означает согласия или покорности";
                        }
                        forcedNarrativeToLog = `[Система]: *${descText}* → ${commandActionPreset.label}, ${reason}.`;
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
                const wasAlreadyActive = activeContextsRepo2.getAllForSubject(payload.subjectId)
                    .some((context: any) => context.actionId === targetCtxId);
                const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = complianceFor({ id: targetCtxId, label: actionPreset.label, type: actionPreset.type, pointId: payload.pointId }).total;
                
                if (currentCompliance >= requiredCompliance) {
                    if (wasAlreadyActive) {
                        addedContextNotes.push(`[Система]: Состояние "${actionPreset.label}" уже было активно до текущей команды; нового перехода не произошло.`);
                    } else {
                        let reason = (state.relation?.attitude > 70) ? "без явного сопротивления переходу" : "переходя в новое состояние без подтверждённого добровольного принятия";
                        if (state.core.attitude < 30) reason = "вынужденно и унизительно для себя";
                        // If there is a playerId (actor), mark them as initiator; otherwise default to subject
                        const initiator = initiatorId;
                        // Only record a forced narrative state when the action preset explicitly
                        // defines a non-verbal, non-wait type. If the preset has no type, we
                        // avoid creating a forced narrative to prevent polluting memory with
                        // spurious "Выполнено действие: Разговор" entries.
                        if (actionPreset.type && actionPreset.type !== 'verbal' && actionPreset.type !== 'wait') {
                            const forcedNarrative = `[Система]: Команда выполнена. Текущее состояние актива теперь: "${actionPreset.label}"; ${reason}. Переход уже показан визуально: в чат нужны только слова персонажа, без описания движения или позы. До команды состояние было другим.`;
                            tickEffects.push({
                                kind: 'context.apply',
                                subjectId: payload.subjectId,
                                actionId: targetCtxId,
                                action: actionPreset,
                                initiatorId: initiator,
                                event: {
                                    subjectId: payload.subjectId,
                                    type: 'context_change',
                                    presetId: 'context_change',
                                    narrative: forcedNarrative,
                                    metadata: { added: true },
                                },
                            });
                            addedContextNotes.push(forcedNarrative);
                            actionApplied = true;
                        }
                    }
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно отклоняет требование перейти в состояние "${actionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        }

                    // Execute effects of the commanded actionPreset (apply/remove contexts)
                    try {
                        const initiator = initiatorId;
                        // If the commanded actionPreset itself defines contextConfig, apply it to the subject
                        if (commandEffectsAuthorized && commandActionPreset && (commandActionPreset as any).contextConfig) {
                            const applyNarrative = `[Система]: Применено действие "${commandActionPreset.label}" к активу.`;
                            tickEffects.push({
                                kind: 'context.apply',
                                subjectId: payload.subjectId,
                                actionId: commandIntent.actionId,
                                action: commandActionPreset as any,
                                initiatorId: initiator,
                                event: {
                                    subjectId: payload.subjectId,
                                    type: 'context_change',
                                    presetId: commandIntent.actionId,
                                    narrative: applyNarrative,
                                    metadata: { added: true },
                                },
                            });
                            addedContextNotes.push(applyNarrative);
                            // mark that the forced action produced an actual state change
                            forcedApplied = true;
                            actionApplied = true;
                        }

                        // If the commanded actionPreset declares removeContexts, remove them from the subject
                        if (commandEffectsAuthorized && commandActionPreset && (commandActionPreset as any).removeContexts && Array.isArray((commandActionPreset as any).removeContexts)) {
                            let removedAny = false;
                            for (const remCtx of (commandActionPreset as any).removeContexts) {
                                const wasActive = activeContextsRepo.getAllForSubject(payload.subjectId)
                                    .some((context: any) => context.actionId === remCtx);
                                if (!wasActive) continue;
                                tickEffects.push({
                                    kind: 'context.remove-action',
                                    subjectId: payload.subjectId,
                                    actionId: remCtx,
                                });
                                // mark that the forced action produced an actual state change
                                removedAny = true;
                                forcedApplied = true;
                                actionApplied = true;
                            }
                            if (removedAny) {
                                const removedNarrative = `[Система]: Удалены связанные контексты в результате действия "${commandActionPreset.label}".`;
                                const lastRemoval = [...tickEffects].reverse().find(effect =>
                                    effect.kind === 'context.remove-action' && effect.subjectId === payload.subjectId,
                                );
                                if (lastRemoval) lastRemoval.event = {
                                    subjectId: payload.subjectId,
                                    type: 'context_change',
                                    presetId: commandIntent.actionId,
                                    narrative: removedNarrative,
                                    metadata: { removed: true },
                                };
                                addedContextNotes.push(removedNarrative);
                            }
                        }
                    } catch (err) {
                        console.error('[runGameTick] failed to apply commanded action preset effects', err);
                    }
                    // After attempting effects, if the forced action was attempted and
                    // the narrative says it was performed (compliance was sufficient),
                    // we log the system-trigger narrative AFTER primary state persistence so its id
                    // is higher than the interaction log — ensuring correct chronological
                    // order in recentEvents (interaction first, then system_trigger).
                    // The actual eventLogRepo.append belongs to the commit phase below.
                    if (forcedApplied && forcedNarrativeToLog) {
                        addedContextNotes.push(forcedNarrativeToLog);
                    }
    }

    let compiledContextAllowed = true;
    const isDirectedPoseRequest =
        compiledAction.type === 'pose' &&
        !(compiledAction.tags || []).includes('comfort');
    if (compiledAction.contextConfig && isDirectedPoseRequest) {
        const requiredCompliance = (compiledAction.contextConfig.priority || compiledAction.priority || 1) * 20;
        const compliance = complianceFor({
            id: payload.presetId,
            label: compiledAction.label,
            type: compiledAction.type,
            pointId: payload.pointId
        });
        compiledContextAllowed = compliance.total >= requiredCompliance;
        if (!compiledContextAllowed) {
            const refusedNarrative = `[Система]: Актив не выполняет указание "${compiledAction.label}". Подчинение ${Math.round(compliance.total)}; требуется ${requiredCompliance}. Поза и визуальное состояние не изменились.`;
            addedContextNotes.push(refusedNarrative);
            tickEffects.push({
                kind: 'event.append',
                event: {
                    subjectId: payload.subjectId,
                    type: 'system_trigger',
                    presetId: payload.presetId,
                    narrative: refusedNarrative,
                    metadata: { refused: true, requiredCompliance, actualCompliance: compliance.total },
                },
            });
        }
    }

    if (compiledAction.contextConfig && compiledContextAllowed) {
        // Sexual contact is a single scene-level interaction, but its stored
        // point must remain the actual anatomical target for sustained pulses.
        // Replace an earlier contact explicitly instead of using a synthetic
        // occupied point that would lose that target information.
        if (compiledAction.contextConfig.type === 'sexual_interaction') {
            for (const context of activeContextsRepo.getAllForSubject(payload.subjectId)) {
                const preset = presetRepo.getActionPreset(context.actionId);
                if (preset?.contextConfig?.type === 'sexual_interaction' &&
                    (context.actionId !== payload.presetId || context.pointId !== payload.pointId)) {
                    tickEffects.push({ kind: 'context.remove-id', contextId: context.id });
                }
            }
        }
        const initiator = initiatorId;
        tickEffects.push({
            kind: 'context.apply',
            subjectId: payload.subjectId,
            actionId: payload.presetId,
            action: compiledAction,
            pointId: payload.pointId,
            initiatorId: initiator,
        });
        actionApplied = true;
    }
    if (compiledAction.removeContexts && compiledContextAllowed) {
        for (const remCtx of compiledAction.removeContexts) {
            tickEffects.push({ kind: 'context.remove-action', subjectId: payload.subjectId, actionId: remCtx });
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
            tickEffects.push({ kind: 'point.save', subjectId: payload.subjectId, point: passivePoint });
        }
    }

    // === Edging & Tension Discharge Mechanic ===
    const worldMinute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
    const deviceOrgasmPolicy = String((payload.customPayload as any)?.deviceSession?.orgasmPolicy || '');
    const consequence = resolveTickConsequences({
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        presetId: payload.presetId,
        coreBefore: state.core,
        output: engineOutput,
        history,
        activeContextIds: activeContextsRepo.getAllForSubject(payload.subjectId).map(context => context.actionId),
        deviceOrgasmPolicy,
    });
    engineOutput = consequence.output;
    const peakEventToLog = consequence.peakEventToLog;
    const notableObservationEvent = consequence.notableObservationEvent;
    addedContextNotes.push(...consequence.notes);
    tickEffects.push(...consequence.effects);

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
    const conditionPlan = ConditionWatcher.plan(
        payload.subjectId,
        payload.pointId,
        engineOutput.nextCore,
        engineOutput.nextPoint
    );
    addedContextNotes.push(...conditionPlan.narratives);
    tickEffects.push(...conditionPlan.effects);

    // Orchestration may have changed nextCore after numerical computation (discharge,
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

    const requestedStance = ignoredBoundary ? null : requestedStanceFromReaction({
        subjectId: payload.subjectId,
        actorId: initiatorId,
        action: compiledAction,
        pointId: payload.pointId,
        appraisal: engineOutput.result.finalValence,
        discomfort: engineOutput.result.discomfort,
        overload: engineOutput.result.overload,
    });
    if (requestedStance) tickEffects.push({ kind: 'stance.save', stance: requestedStance });
    // A scoped boundary remains stored for its point, but it must not colour
    // an unrelated point or an ordinary conversation as if the character were
    // still rejecting every possible contact.
    const resultingStance = requestedStance || (ignoredBoundary || respectedBoundary
        ? interactionStanceRepo.get(payload.subjectId, initiatorId)
        : null);
    const relationshipDynamics = relationalDynamics;
    const constrainedForReaction = ignoredBoundary || allContexts.some(context =>
        /suspend|cuff|restraint|machine|collar|spread_eagle|hold_exposure/.test(context.actionId)
    );
    const negativeUnavoidableExperience = constrainedForReaction && engineOutput.result.finalValence < -.1;
    const relationAttitude = Number(state.relation?.attitude ?? state.core.attitude ?? 50);
    const relationOpenness = Number(state.relation?.openness ?? state.core.openness ?? 50);
    const localOpenness = Number(state.point.localOpenness ?? 50);
    const stancePenalty = resultingStance ? resultingStance.intensity * 70 : 0;
    const willingness = clamp(relationAttitude * .35 + relationOpenness * .35 + localOpenness * .3 - stancePenalty, 0, 100);
    const agency = initiatorId === payload.subjectId ? 100 : ignoredBoundary ? 0 : respectedBoundary ? 80 : 30;
    const emotion = resolvePortraitEmotion({
        behavioralState: diagnostics.observation.behavioralState,
        reaction: diagnostics.observation.reaction,
        transitions: diagnostics.observation.transitions,
        state: engineOutput.nextCore,
    });
    diagnostics.observation.reactionSnapshot = {
        sensation: {
            pleasure: engineOutput.result.pleasure,
            discomfort: engineOutput.result.discomfort,
            overload: engineOutput.result.overload,
            intensity: engineOutput.result.experiencedIntensity,
        },
        appraisal: {
            valence: engineOutput.result.finalValence,
            willingness,
            agency,
            trust: relationAttitude,
        },
        affect: {
            valence: engineOutput.result.finalValence,
            arousal: engineOutput.nextCore.tension,
            control: engineOutput.nextCore.capacity,
            emotion,
        },
        behavior: {
            state: diagnostics.observation.behavioralState,
            resistance: resultingStance ? Math.max(relationshipDynamics.resistance, resultingStance.intensity * 100) : relationshipDynamics.resistance,
            desiredResponse: negativeUnavoidableExperience && relationshipDynamics.dissociation >= 65
                ? 'silent_compliance'
                : negativeUnavoidableExperience && relationshipDynamics.learnedCompliance >= 80
                    ? 'assimilated_acceptance'
                    : negativeUnavoidableExperience && relationshipDynamics.learnedCompliance >= 50
                        ? 'forced_rationalization'
                        : resultingStance?.request === 'stop' ? 'stop' : resultingStance?.request === 'slow_down' ? 'slow_down' : 'continue',
        },
        dynamics: relationshipDynamics,
        boundary: resultingStance ? {
            request: resultingStance.request,
            ignored: ignoredBoundary,
            respected: respectedBoundary,
            intensity: resultingStance.intensity,
        } : null,
    };
    const physicalReaction = buildPhysicalReaction(diagnostics.observation, compiledAction, engineOutput.nextCore);
    if (physicalReaction) {
        diagnostics.observation.physicalReaction = physicalReaction;
        diagnostics.observation.subjectiveText += ` ${physicalReaction.subjectiveText}`;
        diagnostics.observation.uiText += ` ${physicalReaction.observerText}`;
    }
    const boundaryExpression = buildBoundaryExpression(diagnostics.observation, engineOutput.nextCore);
    if (boundaryExpression) diagnostics.observation.boundaryExpression = boundaryExpression;
    if (resultingStance?.request === 'stop') {
        diagnostics.observation.subjectiveText += ignoredBoundary
            ? ' Я хочу прекратить этот контакт; моё требование уже проигнорировано.'
            : ' Я хочу, чтобы этот контакт прекратился.';
        diagnostics.observation.uiText += ignoredBoundary
            ? ' Активная граница проигнорирована; персонаж требует прекратить контакт.'
            : ' Персонаж хочет прекратить текущий контакт.';
    } else if (resultingStance?.request === 'slow_down') {
        diagnostics.observation.subjectiveText += ' Я хочу замедлить или ослабить воздействие.';
        diagnostics.observation.uiText += ' Персонаж просит снизить интенсивность.';
    }

    if (requestedStance) {
        addedContextNotes.push(requestedStance.request === 'stop'
            ? `[Новая граница персонажа] В результате именно этого воздействия персонаж теперь хочет прекратить текущий контакт.`
            : `[Новая граница персонажа] В результате именно этого воздействия персонаж теперь хочет, чтобы контакт ослабили или замедлили.`);
    }

    // Prompt construction receives engineOutput as latestResult. Preserve the
    // finalized semantic observation on it; otherwise buildPromptPayload would
    // reconstruct an earlier observation from raw numbers and lose the
    // boundary that was derived after the engine tick.
    (engineOutput as any).observation = diagnostics.observation;

    const observableAction = ['physical', 'context'].includes(String(compiledAction.type || ''))
        && compiledAction.actionKey !== 'wait'
        && !(payload.customPayload?.backgroundTime && !(diagnostics.observation.transitions || []).length);
    const sceneObservation = observableAction
        ? (() => {
            const actorId = payload.actingCharacterId || payload.playerId || 'PL-1';
            const pointLabel = presetRepo.getPointPreset(payload.pointId)?.label || payload.pointId;
            const observedIntent = (payload.dynamicModifiers as any)?.commandIntent;
            const observedOutcome = observedIntent?.type && observedIntent.type !== 'none' && actionApplied
                ? (() => {
                    const executor = characterRepo.get(payload.subjectId)?.name || payload.subjectId;
                    const target = observedIntent.targetId ? characterRepo.get(String(observedIntent.targetId))?.name || observedIntent.targetId : '';
                    const label = observedIntent.actionId ? presetRepo.getActionPreset(String(observedIntent.actionId))?.label || observedIntent.actionId : 'указание';
                    return `${executor} выполнила указание «${label}»${target ? ` для ${target}` : ''}`;
                })()
                : '';
            return {
                sceneId: activeSceneId,
                playerId: payload.playerId,
                actorId,
                targetId: payload.subjectId,
                actionId: compiledAction.actionKey || payload.presetId,
                actionLabel: compiledAction.label || payload.presetId,
                pointId: payload.pointId,
                pointLabel,
                actionTags: compiledAction.tags || [],
                finalValence: engineOutput.result.finalValence,
                notable: Boolean(diagnostics.observation.transitions?.length),
                background: Boolean(payload.customPayload?.backgroundTime),
                spokenText: String((compiledAction as any).source?.rawText || payload.textMessage || '').trim(),
                outcomeText: observedOutcome,
                worldMinute,
            };
        })()
        : undefined;

    // The primary action becomes durable exactly once. Reactive projections
    // are published only after this transaction succeeds.
    commitTickOutcome({
        tickId,
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        initiatorId,
        presetId: payload.presetId,
        compiledAction,
        output: engineOutput,
        observation: diagnostics.observation,
        eventMetadata: payload.customPayload,
        learningScale: stateDeltaScale,
        stateBefore,
        resources: state.resources,
        peakEvent: peakEventToLog,
        commandEvent: {
            attempted: forcedAttempted,
            applied: actionApplied,
            narrative: forcedNarrativeToLog,
        },
        effects: tickEffects,
    });
    publishTickOutcome({
        tickId,
        subjectId: payload.subjectId,
        before: stateBefore.core,
        after: engineOutput.nextCore,
        sceneObservation,
        syncLabSpatialRelations: labRelocationApplied,
    });

    // 6.5 Update context strain (Escalation / Decay)

    const prompt = payload.skipPrompt
        ? { systemPrompt: '' } as TickBundle['prompt']
        : await buildPromptPayload(payload.subjectId, payload.subjectId, engineOutput, activeSceneId, { initiatorId });

    // Log the constructed prompt payload for debugging/inspection
    if (!payload.skipPrompt) try {
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

    // Command resolution has its own present-tense scene presentation in the
    // conversation layer. Do not also feed its mechanical audit messages to
    // the model: words such as "подчинение" and "уже выполнено" turn a live
    // action into a post-factum, coercive-sounding explanation.
    const promptSystemNotes = commandIntent?.type && commandIntent.type !== 'none'
        ? addedContextNotes.filter(note => !/(Актив .*отклоняет|Актив не выполняет|Актив мысленно отклоняет|Команда выполнена|Применено действие|Удалены связанные контексты|выполняет указание)/i.test(note))
        : addedContextNotes;
    if (promptSystemNotes.length > 0 && prompt.systemPrompt) {
        prompt.systemPrompt += `\n\n[Системные события тика]:\n${promptSystemNotes.join('\n')}`;
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

    
    const finalCommandIntent = payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent;
    const commandPresentation = finalCommandIntent?.type && finalCommandIntent.type !== 'none'
        ? (() => {
            const targetId = finalCommandIntent.targetId && finalCommandIntent.targetId !== payload.subjectId
                ? String(finalCommandIntent.targetId)
                : undefined;
            const targetName = targetId
                ? characterRepo.get(targetId)?.name || targetId
                : undefined;
            const actionLabel = commandActionPreset?.label
                || (finalCommandIntent.actionId ? presetRepo.getActionPreset(finalCommandIntent.actionId)?.label : undefined)
                || finalCommandIntent.targetPoseId
                || finalCommandIntent.targetContextId
                || finalCommandIntent.targetLocation
                || 'указанное действие';
            const presence = sceneCharacterRepo.list(payload.sceneId).find(entry =>
                entry.character.id === payload.subjectId || entry.character.subjectId === payload.subjectId,
            );
            return presentCommand({
                performed: actionApplied,
                executorId: payload.subjectId,
                executorName: characterRepo.get(payload.subjectId)?.name || payload.subjectId,
                targetId,
                targetName,
                actionLabel,
                requesterName: characterRepo.get(initiatorId)?.name || (initiatorId === 'PL-1' ? 'Калибратор' : initiatorId),
                relationToRequester: state.relation,
                relationToTarget: targetId ? characterRelationRepo.get(payload.subjectId, targetId) : null,
                dynamics: relationalDynamics,
                core: state.core,
                role: presence?.role,
            });
        })()
        : undefined;
    if (finalCommandIntent?.type && finalCommandIntent.type !== 'none') {
        const refusalWasAboutWillingness = addedContextNotes.some(note =>
            /отклоняет|недостаточ|не выполняет указание|подчинение .*требуется/i.test(note),
        );
        if (actionApplied || !refusalWasAboutWillingness) {
            tickEffects.push({ kind: 'pending-command.clear', subjectId: payload.subjectId, playerId: payload.playerId });
        } else {
            const modifiers = payload.dynamicModifiers as any;
            tickEffects.push({
                kind: 'pending-command.save',
                focus: {
                    subjectId: payload.subjectId,
                    playerId: payload.playerId,
                    sceneId: payload.sceneId,
                    sourceText: modifiers.pendingCommandSourceText || modifiers.commandSourceText || payload.textMessage || '',
                    description: modifiers.pendingCommandDescription || modifiers.commandDescription || payload.textMessage || 'невыполненное поручение',
                    intent: finalCommandIntent,
                    routing: modifiers.routing,
                },
            });
        }
    }

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
            commandIntent: payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent,
            resumedPendingCommand: Boolean(payload.dynamicModifiers && (payload.dynamicModifiers as any).resumedPendingCommand),
            pendingCommandDescription: payload.dynamicModifiers && (payload.dynamicModifiers as any).pendingCommandDescription,
            commandPresentation,
        },
        actionApplied,
        systemNotes: addedContextNotes,
    };
}
