import { handleBuyAssetAction } from '../scenario/buyAssetHandler';
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
import { appendJsonLog } from '../utils/fileLogs';
import { explainPromptLog, explainEngineState } from '../utils/logExplainers';
import * as checkActionAccess from '../scenario/checkActionAccess';
import { applyResourceCosts } from '../scenario/applyResourceCosts';
import { runScenarioStep } from '../scenario/runScenarioStep';
import { ContextManager } from './contextManager';
import { sceneCharacterRepo } from '../infrastructure/repositories';

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
    customPayload?: Record<string, unknown>;
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
    if (!validation.allowed && payload.presetId !== 'wait') {
        throw new Error(validation.errorReason || `Action "${payload.presetId}" blocked by scenario.`);
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
                const currentCompliance = 100;
                const moveCompliance = 30; 
                
                if (currentCompliance >= moveCompliance) {
                    const subjCharPresence = sceneChars.find(c => c.character.subjectId === payload.subjectId || c.character.id === payload.subjectId);
                    if (subjCharPresence) {
                        if (subjCharPresence.slotId !== finalSlotId) {
                            sceneCharacterRepo.set(payload.sceneId, subjCharPresence.character.id, { slotId: finalSlotId });
                            const moveNarrative = `Выполнено действие: Персонаж перемещается в зону "${targetLabel}".`;
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
            const actionPreset = presetRepo.getActionPreset(commandIntent.actionId);
            if (actionPreset) {
                const requiredCompliance = (actionPreset.priority || 1) * 20;
                const currentCompliance = 100;
                const targetName = commandIntent.targetId || 'не указана';
                
                if (currentCompliance >= requiredCompliance) {
                    const forcedNarrative = `Выполнено действие: ${actionPreset.label} (цель: ${targetName})`;
                    addedContextNotes.push(forcedNarrative);
                    eventLogRepo.append(payload.subjectId, 'system_trigger', { presetId: 'system_trigger', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно отклоняет действие "${actionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен для выполнения (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        }

                if (targetCtxId) {
            const actionPreset = presetRepo.getActionPreset(targetCtxId);
            if (actionPreset && actionPreset.contextConfig) {
                const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = 100;
                
                if (currentCompliance >= requiredCompliance) {
                    // If there is a playerId (actor), mark them as initiator; otherwise default to subject
                    const initiator = payload.playerId || payload.subjectId;
                    ContextManager.applyContext(payload.subjectId, targetCtxId, actionPreset, undefined, initiator);
                    // Only record a forced narrative state when the action preset explicitly
                    // defines a non-verbal, non-wait type. If the preset has no type, we
                    // avoid creating a forced narrative to prevent polluting memory with
                    // spurious "Выполнено действие: Разговор" entries.
                    if (actionPreset.type && actionPreset.type !== 'verbal' && actionPreset.type !== 'wait') {
                        const forcedNarrative = `Выполнено действие: ${actionPreset.label}. Примени это состояние.`;
                        eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                        addedContextNotes.push(forcedNarrative);
                    }
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно отклоняет требование перейти в состояние "${actionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
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

    // === Edging & Tension Discharge Mechanic ===
    if (engineOutput.nextCore.tension >= 100) {
        const isPositive = engineOutput.result.pleasure >= engineOutput.result.discomfort;
        let dischargeNarrative = '';

        if (isPositive) {
            dischargeNarrative = `[Система: КАСКАДНЫЙ СРЫВ] Субъект достигает пика эйфории. Мощный оргазм сносит нейронные барьеры, обнуляя волю к сопротивлению.`;
            engineOutput.nextCore.openness = Math.min((engineOutput.nextCore.openness || 0) + 20, 100);
            engineOutput.nextCore.attitude = Math.min((engineOutput.nextCore.attitude || 0) + 25, 100);
            engineOutput.nextCore.sensitivity = Math.max((engineOutput.nextCore.sensitivity || 0) - 20, 0); // refractory period
            engineOutput.nextCore.capacity = Math.max((engineOutput.nextCore.capacity || 0) - 40, 0);
        } else {
            dischargeNarrative = `[Система: КАСКАДНЫЙ СРЫВ] Субъект не выдерживает чудовищного напряжения. Разум захлебывается в паническом искореняющем шоке.`;
            engineOutput.nextCore.attitude = Math.max((engineOutput.nextCore.attitude || 0) - 20, 0);
            engineOutput.nextCore.openness = Math.max((engineOutput.nextCore.openness || 0) - 15, 0);
            engineOutput.nextCore.capacity = 0; // Total exhaustion
        }

        // Apply shared post-discharge vulnerability
        engineOutput.nextCore.plasticity = Math.min((engineOutput.nextCore.plasticity || 0) + 30, 100);
        engineOutput.nextCore.tension = 10; // Reset tension down to baseline-ish value

        addedContextNotes.push(dischargeNarrative);
        eventLogRepo.append(payload.subjectId, 'system_tick', { presetId: 'discharge', action: null, actionLabel: dischargeNarrative, narrative: dischargeNarrative }, { added: true });

    } else if ((engineOutput.nextCore.capacity || 0) <= 0 && (state.core.tension || 0) > 85 && (engineOutput.nextCore.tension || 0) < 100) {
        // "Ruined" / Exhaustion before peak
        const ruinNarrative = `[Система: ИСТОЩЕНИЕ РЕСУРСА] Выносливость упала до нуля, пока субъект находился на грани. Разрядки не произошло. Оставляя лишь гнетущую апатию и опустошение.`;
        addedContextNotes.push(ruinNarrative);
        engineOutput.nextCore.attitude = Math.max((engineOutput.nextCore.attitude || 0) - 10, 0);
        engineOutput.nextCore.tension = 20; // Tension drops into a frustrating low-burn
        
        eventLogRepo.append(payload.subjectId, 'system_tick', { presetId: 'ruined', action: null, actionLabel: ruinNarrative, narrative: ruinNarrative }, { added: true });
    }

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
                res.amount += res.regenRate;
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
    ConditionWatcher.evaluate(payload.subjectId, payload.pointId, engineOutput.nextCore, engineOutput.nextPoint);

    // 7. Save Atomically (before prompt building)
    saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId);

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

    const diagnostics = buildDiagnostics(
        engineOutput.tickMeta.inputs.action,
        state.core,
        engineOutput
    );

    const prompt = await buildPromptPayload(payload.subjectId, payload.subjectId, engineOutput, activeSceneId);

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
    };
}
