// src/orchestration/runGameTick.ts
import { randomUUID } from 'crypto';
import { loadTickState } from './loadTickState';
import { saveTickState } from './saveTickState';
import { compileAction } from '../compiler/compileAction';
import { runTick } from '../engine/runTick';
import { eventQueries } from '../infrastructure/eventQueries';
import { activeContextsRepo, resourceRepo, sceneRepo, presetRepo, eventLogRepo } from '../infrastructure/repositories';
import { CompiledAction, TickBundle, GameEvent } from '../domain/types';
import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import * as checkActionAccess from '../scenario/checkActionAccess';
import { applyResourceCosts } from '../scenario/applyResourceCosts';
import { runScenarioStep } from '../scenario/runScenarioStep';
import { ContextManager } from './contextManager';

import { ConditionWatcher } from './conditionWatcher';

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
}

export async function runGameTick(payload: GameEventPayload): Promise<TickBundle> {
    // 1. Load state
    const state = loadTickState(payload.subjectId, payload.pointId, payload.playerId, payload.sceneId);
    const stateBefore = {
        core: { ...state.core },
        point: { ...state.point }
    };
    
    // 2. Scenario layer: доступность действия, ресурсы, локация
    const validation = checkActionAccess.validateAction(
        payload.presetId, state.scene, state.resources, payload.subjectId, payload.playerId
    );
    if (!validation.allowed) {
        throw new Error(validation.errorReason || `Action "${payload.presetId}" blocked by scenario.`);
    }

    const actionCosts = state.scene.actionCosts?.[payload.presetId] || { actionPoints: 15 };
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
    const allContexts = activeContextsRepo.getAllForSubject(payload.subjectId);
    const applicableContexts = allContexts.filter(c => !c.pointId || c.pointId === payload.pointId);

    let compiledAction = compileAction({
        presetId: payload.presetId,
        eventId: payload.sceneId, // Treat sceneId as the root event contexts are bound to for now
        playerIntensity: payload.playerIntensity,
        history: history,
        dynamicModifiers: payload.dynamicModifiers,
        sourceText: payload.textMessage,
        parserVersion: payload.parserVersion, 
        activeContexts: applicableContexts
    });

    // 4.5 Apply Virtual Contexts (Mental and Body point overloads)
    const baseAction = (compiledAction as any)._baseAction;
    (compiledAction as any)._baseAction = baseAction || compiledAction;

    const commandIntent = payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent;
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
        config: undefined
    });

    if (engineOutput.tickMeta?.inputs) {
        (engineOutput.tickMeta.inputs.action as any)._baseAction = (compiledAction as any)._baseAction;
    }

    // 6. Save new state
    const tickId = randomUUID();

    // 6.0 Apply Context Overrides (Parser Intention Hook)
    // Here we perform dynamic context modification dictated directly by the LLM classification,
    // intercepting and modifying the subject's conditions immediately.
    let addedContextNotes: string[] = [];
    if (commandIntent && commandIntent.type !== 'none') {
        
        const activeContextsRepo2 = activeContextsRepo;
        

        let targetCtxId: string | undefined;
        if (commandIntent.type === 'change_pose') targetCtxId = commandIntent.targetPoseId;
    else if (commandIntent.type === 'activate_context') targetCtxId = commandIntent.targetContextId;
        else if (commandIntent.type === 'deactivate_context') {
            const deactivateId = commandIntent.targetContextId;
            const actionPreset = presetRepo.getActionPreset(deactivateId);
            const currentStatus = activeContextsRepo2.getAllForSubject(payload.subjectId).find((c: any) => c.actionId === deactivateId);
            if (currentStatus) {
                activeContextsRepo2.remove(currentStatus.id);
                const removalNarrative = `Состояние отменено: ${actionPreset?.label || deactivateId}`;
                eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                addedContextNotes.push(removalNarrative);
            }
        }

                if (targetCtxId) {
            const actionPreset = presetRepo.getActionPreset(targetCtxId);
            if (actionPreset && actionPreset.contextConfig) {
                const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = (engineOutput.nextCore.plasticity || 0) + (engineOutput.nextCore.openness || 0) * 0.5 + (engineOutput.nextCore.attitude || 0) * 0.5;
                
                if (currentCompliance >= requiredCompliance) {
                    // If there is a playerId (actor), mark them as initiator; otherwise default to subject
                    const initiator = payload.playerId || payload.subjectId;
                    ContextManager.applyContext(payload.subjectId, targetCtxId, actionPreset, undefined, initiator);
                    const forcedNarrative = `Выполнено действие: ${actionPreset.label}. Примени это состояние.`;
                    eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                    addedContextNotes.push(forcedNarrative);
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно ОТКАЗЫВАЕТСЯ выполнять команду ("${actionPreset.label}"). Требуемый уровень подчинения: ${requiredCompliance}, но текущий всего ~${Math.round(currentCompliance)}. Отреагируй отказом словами или жестами.`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
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
                    const removalNarrative = `Состояние отменено: ${preset.label}`;
                    activeContextsRepo2.remove(ctx.id);
                    eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                    addedContextNotes.push(removalNarrative);
                }
            } else {
                addedContextNotes.push('Ты уже стоишь, поэтому дополнительных изменений нет.');
            }
        }
    }

    if (compiledAction.contextConfig) {
        const initiator = payload.playerId || payload.subjectId;
        ContextManager.applyContext(payload.subjectId, payload.presetId, compiledAction, undefined, initiator);
    }
    if (compiledAction.removeContexts) {
        for (const remCtx of compiledAction.removeContexts) {
            activeContextsRepo.removeByActionId(payload.subjectId, remCtx);
        }
    }

    ContextManager.processTick(payload.subjectId); // Time passes

    // Save player and scene state at the final atomicity boundary
    
    // Currently scene changes aren't saved to DB in runGameTick but rather through activeSceneId. If scene state mutated, we'd save it here.

    // 6.1 Run scenario consequences (transitions, missions)
    const scenarioResult = runScenarioStep(
        {
            scene: state.scene,
            resources: state.resources,
            core: engineOutput.nextCore,
            mission: null
        },
        { actionId: payload.presetId }
    );

    if (scenarioResult.updatedResources !== state.resources) {
        state.resources = scenarioResult.updatedResources;
    }

    // === Action Points (AP) regeneration per tick ===
    try {
        const cur = state.resources.resources || {};
        const curAP = Number(cur.actionPoints ?? 0);
        const maxAP = Number(cur.maxActionPoints ?? 100);
        // base regen and capacity-based bonus
        const baseRegen = 5; // base AP per tick
        const capacity = Number(state.core?.capacity ?? 50);
        const capacityBonus = Math.round((capacity / 100) * 5); // up to +5
        const regen = Math.max(1, baseRegen + capacityBonus);
        const nextAP = Math.min(maxAP, curAP + regen);
        state.resources.resources = { ...cur, actionPoints: nextAP };
    } catch (err) {
        console.warn('AP regen error', err);
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
    ConditionWatcher.evaluate(payload.subjectId, payload.pointId, engineOutput.nextCore, engineOutput.nextPoint);

    // 7. Save Atomically (before prompt building)
    saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId);
    
    if (scenarioResult.updatedResources !== state.resources || true) {
        resourceRepo.save(state.resources);
    }

    // 6.5 Update context strain (Escalation / Decay)

    const diagnostics = buildDiagnostics(
        engineOutput.tickMeta.inputs.action,
        state.core,
        engineOutput
    );

    const prompt = await buildPromptPayload(payload.subjectId, payload.subjectId, engineOutput, activeSceneId);

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
            dynamicModifiers: payload.dynamicModifiers
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
    };
}
