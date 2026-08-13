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
import { runScenarioStep } from '../scenario/runScenarioStep';
import { ContextManager } from './contextManager';
import { sceneCharacterRepo } from '../infrastructure/repositories';

import { ConditionWatcher } from './conditionWatcher';
import { resolveTickConsequences } from './resolveTickConsequences';
import { applyCommandEffects } from './applyCommandEffects';
import { buildSceneObservation } from './buildSceneObservation';
import { validateTickRequest } from './validateTickRequest';
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
    const validationResult = validateTickRequest({
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        presetId: payload.presetId,
        playerId: payload.playerId,
        initiatorId,
        sceneId: payload.sceneId,
        resources: state.resources,
        scene: state.scene,
        dynamicModifiers: payload.dynamicModifiers,
        customPayload: payload.customPayload,
    });
    state.resources = validationResult.resources;

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
    const commandResult = applyCommandEffects({
        payload: {
            subjectId: payload.subjectId,
            playerId: payload.playerId,
            sceneId: payload.sceneId,
            pointId: payload.pointId,
            presetId: payload.presetId,
            textMessage: payload.textMessage,
            dynamicModifiers: payload.dynamicModifiers,
        },
        state: {
            core: state.core,
            relation: state.relation,
            scene: state.scene,
        },
        compiledAction,
        commandIntent,
        initiatorId,
        complianceFor,
        tickEffects,
        addedContextNotes,
    });
    actionApplied = commandResult.actionApplied;
    forcedNarrativeToLog = commandResult.forcedNarrativeToLog;
    forcedAttempted = commandResult.forcedAttempted;
    commandActionPreset = commandResult.commandActionPreset;
    labRelocationApplied = commandResult.labRelocationApplied;

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
    const sceneObservation = buildSceneObservation({
        observableAction,
        activeSceneId,
        playerId: payload.playerId,
        actingCharacterId: payload.actingCharacterId,
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        presetId: payload.presetId,
        actionApplied,
        compiledAction,
        output: engineOutput,
        commandIntent: (payload.dynamicModifiers as any)?.commandIntent,
        customPayload: payload.customPayload,
        textMessage: payload.textMessage,
        worldMinute,
        hasTransitions: Boolean(diagnostics.observation.transitions?.length),
    });

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
