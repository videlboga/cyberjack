// src/orchestration/runGameTick.ts
import { randomUUID } from 'crypto';
import { loadTickSnapshot } from './loadTickSnapshot';
import { computeTickOutcome } from './computeTickOutcome';
import { commitTickOutcome } from './commitTickOutcome';
import { publishTickOutcome } from './publishTickOutcome';
import type { TickEffect } from './tickEffectPlan';
import { eventQueries } from '../infrastructure/eventQueries';
import { activeContextsRepo, sceneRepo, presetRepo } from '../infrastructure/repositories';
import { CompiledAction, TickBundle, GameEvent, DynamicModifiers } from '../domain/types';
import type { DeviceSessionMetadata } from '../domain/sessionMetadata';
import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import { appendJsonLog } from '../utils/fileLogs';
import { traceSync, newRequestId, emitTrace, withTraceContext, currentTraceRequestId } from './trace';
import { explainPromptLog, explainEngineState } from '../utils/logExplainers';
import { stablePromptFragmentStats } from '../services/stablePromptFragmentCache';
import { runScenarioStep } from '../scenario/runScenarioStep';
import { ContextManager } from './contextManager';

import { ConditionWatcher } from './conditionWatcher';
import { resolveTickConsequences } from './resolveTickConsequences';
import { applyCommandEffects } from './applyCommandEffects';
import { buildSceneObservation } from './buildSceneObservation';
import { validateTickRequest } from './validateTickRequest';
import { compileTickAction } from './compileTickAction';
import { buildTickResponse, buildPendingCommandEffect } from './buildTickResponse';
import { buildCharacterTurnContext } from './characterTurnContext';
import { buildTickCommitPlan } from './buildTickCommitPlan';
import { pointStateRepo } from '../infrastructure/repositories';
import { DEFAULT_CONFIG } from '../engine/config';
import { dampTowardsBaseline, advanceBaseline } from '../engine/baselineUtils';
import { clamp } from '../engine/utils';
import { resolveLaboratoryMove } from '../scenario/resolveLaboratoryMove';
import { deriveEdgeProfile } from '../domain/edgeState';
import { requestedStanceFromReaction } from '../domain/interactionStance';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { resolvePortraitEmotion } from '../domain/portraitEmotion';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';
import { db } from '../infrastructure/db';
import { buildPhysicalReaction } from '../narrative/physicalReaction';
import { buildBoundaryExpression } from '../narrative/boundaryExpression';

export interface GameEventPayload {
    subjectId: string;
    pointId: string;
    playerId: string;
    actingCharacterId?: string;
    sceneId: string;
    presetId: string; // The base action id
    playerIntensity?: number;
    dynamicModifiers?: DynamicModifiers;
    eventType?: GameEvent['type'];
    textMessage?: string;
    parserVersion?: string;
    customPayload?: Record<string, unknown>;
    deltaTime?: number;
    stateDeltaScale?: number;
    skipPrompt?: boolean;
    skipContextTimeAdvance?: boolean;
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
    // Reuse the current trace context when present (a user turn already set
    // it at the processTick/dispatchEvent boundary); mint a new one only for
    // autonomous/standalone calls. The whole tick lifecycle runs inside the
    // context so every LLM call downstream inherits the same requestId.
    const requestId = currentTraceRequestId() || newRequestId();
    return withTraceContext(requestId, () => runGameTickInner(payload, requestId));
}

async function runGameTickInner(payload: GameEventPayload, requestId: string): Promise<TickBundle> {
    const initiatorId = payload.actingCharacterId || payload.playerId || payload.subjectId;
    // 1. Load state
    const {
        state,
        stateBefore,
        relationalDynamics,
        elapsedTime,
        preTickContextNotes,
        tickEffects,
        labRelocationApplied: _labRelocationApplied,
    } = traceSync(requestId, requestId, 'loadTickSnapshot', () => loadTickSnapshot({
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        playerId: payload.playerId,
        sceneId: payload.sceneId,
        initiatorId,
        presetId: payload.presetId,
        deltaTime: payload.deltaTime,
    }), { subjectId: payload.subjectId, tickId: payload.sceneId });
    let labRelocationApplied = _labRelocationApplied;

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

    // 4. Compile Action Vector + resolve command
    const compiled = compileTickAction({
        payload: {
            subjectId: payload.subjectId,
            pointId: payload.pointId,
            presetId: payload.presetId,
            sceneId: payload.sceneId,
            playerIntensity: payload.playerIntensity,
            dynamicModifiers: payload.dynamicModifiers,
            textMessage: payload.textMessage,
            parserVersion: payload.parserVersion,
            customPayload: payload.customPayload,
            actingCharacterId: payload.actingCharacterId,
            playerId: payload.playerId,
        },
        state: {
            core: state.core,
            point: state.point,
            relation: state.relation,
        },
        history,
        edgeProfile,
        relationalDynamics,
        initiatorId,
        tickEffects,
        preTickContextNotes,
    });
    let compiledAction = compiled.compiledAction;
    const commandIntent = compiled.commandIntent;
    const commandResolutionError = compiled.commandResolutionError;
    let commandActionPreset = compiled.commandActionPreset;
    const activeStance = compiled.activeStance;
    const ignoredBoundary = compiled.ignoredBoundary;
    const respectedBoundary = compiled.respectedBoundary;
    const stanceSoftenedBeforeTick = compiled.stanceSoftenedBeforeTick;
    const complianceFor = compiled.complianceFor;
    const allContexts = activeContextsRepo.getAllForSubject(payload.subjectId);

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
        compiledAction.contextConfig?.type === 'pose' &&
        !(compiledAction.tags || []).includes('comfort');
    if (compiledAction.contextConfig && isDirectedPoseRequest) {
        const requiredCompliance = (compiledAction.contextConfig.priority || 1) * 20;
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
    const deviceOrgasmPolicy = String((payload.customPayload?.deviceSession as DeviceSessionMetadata | undefined)?.orgasmPolicy || '');
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

    // subjectId is always present in a tick, so buildDiagnostics always
    // produces an observation. Narrow it once for the rest of the stage.
    const observation = diagnostics.observation!;

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
        behavioralState: observation.behavioralState,
        reaction: observation.reaction,
        transitions: observation.transitions,
        state: engineOutput.nextCore,
    });
    observation.reactionSnapshot = {
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
            state: observation.behavioralState,
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
    const physicalReaction = buildPhysicalReaction(observation, compiledAction, engineOutput.nextCore);
    if (physicalReaction) {
        observation.physicalReaction = physicalReaction;
        observation.subjectiveText += ` ${physicalReaction.subjectiveText}`;
        observation.uiText += ` ${physicalReaction.observerText}`;
    }
    const boundaryExpression = buildBoundaryExpression(observation, engineOutput.nextCore);
    if (boundaryExpression) observation.boundaryExpression = boundaryExpression;
    if (resultingStance?.request === 'stop') {
        observation.subjectiveText += ignoredBoundary
            ? ' Я хочу прекратить этот контакт; моё требование уже проигнорировано.'
            : ' Я хочу, чтобы этот контакт прекратился.';
        observation.uiText += ignoredBoundary
            ? ' Активная граница проигнорирована; персонаж требует прекратить контакт.'
            : ' Персонаж хочет прекратить текущий контакт.';
    } else if (resultingStance?.request === 'slow_down') {
        observation.subjectiveText += ' Я хочу замедлить или ослабить воздействие.';
        observation.uiText += ' Персонаж просит снизить интенсивность.';
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
    (engineOutput as any).observation = observation;

    const observableAction = ['physical', 'context'].includes(String(compiledAction.type || ''))
        && compiledAction.actionKey !== 'wait'
        && !(payload.customPayload?.backgroundTime && !(observation.transitions || []).length);
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
        commandIntent: payload.dynamicModifiers?.commandIntent,
        customPayload: payload.customPayload,
        textMessage: payload.textMessage,
        worldMinute,
        hasTransitions: Boolean(observation.transitions?.length),
    });

    // Compute the pending-command effect BEFORE the commit so it participates
    // in the same atomic transaction. A performed command clears the pending
    // focus; a willingness refusal saves it for later continuation.
    const pendingCommandEffect = buildPendingCommandEffect({
        payload: {
            subjectId: payload.subjectId,
            playerId: payload.playerId,
            sceneId: payload.sceneId,
            textMessage: payload.textMessage,
            dynamicModifiers: payload.dynamicModifiers,
        },
        actionApplied,
        addedContextNotes,
    });
    if (pendingCommandEffect) tickEffects.push(pendingCommandEffect);

    // A raw-asset purchase is part of the same atomic commit: it debits
    // credits, updates the broker catalog, creates the character and attaches
    // it to the scene inside the tick transaction. If any step fails, the
    // whole tick (including the purchase) rolls back.
    if (payload.presetId === 'buy_raw_asset' && payload.customPayload?.assetId) {
        tickEffects.push({
            kind: 'market.buy-asset',
            playerId: payload.playerId,
            brokerId: payload.subjectId,
            sceneId: activeSceneId,
            assetId: payload.customPayload.assetId as string,
        });
    }

    // The primary action becomes durable exactly once. Reactive projections
    // are published only after this transaction succeeds.
    const commitPlan = buildTickCommitPlan({
        tickId,
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        initiatorId,
        presetId: payload.presetId,
        compiledAction,
        output: engineOutput,
        observation: observation,
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
    traceSync(requestId, requestId, 'commitTickOutcome', () => commitTickOutcome(commitPlan), { subjectId: payload.subjectId, tickId });
    publishTickOutcome({
        tickId,
        subjectId: payload.subjectId,
        before: stateBefore.core,
        after: engineOutput.nextCore,
        sceneObservation,
        syncLabSpatialRelations: labRelocationApplied,
    });

    // 6.5 Update context strain (Escalation / Decay)

    const promptBuildStartedAt = performance.now();
    const prompt = payload.skipPrompt
        ? { systemPrompt: '' } as TickBundle['prompt']
        : (await buildCharacterTurnContext({
            subjectId: payload.subjectId,
            stimulus: { kind: 'external_action', tickId },
            latestResult: engineOutput,
            eventId: activeSceneId,
            initiatorId,
        })).payload;
    const promptBuildDurationMs = Math.round(performance.now() - promptBuildStartedAt);

    // Log the constructed prompt payload for debugging/inspection
    if (!payload.skipPrompt) {
        const promptChars = prompt.systemPrompt?.length || 0;
        try {
            appendJsonLog('prompt_payloads.jsonl', {
                tickId,
                forSubject: payload.subjectId,
                sceneId: activeSceneId,
                promptSizeChars: promptChars,
                prompt,
                explanationRu: explainPromptLog({ tickId, forSubject: payload.subjectId, sceneId: activeSceneId, prompt })
            });
        } catch (e) { /* ignore */ }
        emitTrace({
            traceId: requestId,
            requestId,
            stage: 'prompt.build',
            startedAt: promptBuildStartedAt,
            durationMs: promptBuildDurationMs,
            subjectId: payload.subjectId,
            tickId,
            promptSizeChars: promptChars,
            selectedMemoryBlocks: prompt.reactionFrame?.continuity?.relevantEpisodes?.length || 0,
            memorySelection: prompt.memorySelection || { associations: 0, subjective: 0, episodes: 0, total: 0 },
            stablePromptFragmentCache: stablePromptFragmentStats(),
        });
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

    const built = buildTickResponse({
        tickId,
        requestId,
        payload: {
            subjectId: payload.subjectId,
            playerId: payload.playerId,
            sceneId: payload.sceneId,
            pointId: payload.pointId,
            presetId: payload.presetId,
            playerIntensity: payload.playerIntensity,
            eventType: payload.eventType,
            textMessage: payload.textMessage,
            dynamicModifiers: payload.dynamicModifiers,
            customPayload: payload.customPayload,
        },
        activeSceneId,
        compiledAction,
        output: engineOutput,
        stateBefore,
        diagnostics,
        prompt,
        scenarioResult,
        initiatorId,
        state,
        relationalDynamics,
        actionApplied,
        addedContextNotes,
        commandActionPreset,
        commandIntent,
        tickEffects,
    });
    const event = built.event;
    const actionTrace = built.actionTrace;
    const commandPresentation = built.commandPresentation;

    return built.response;
}
