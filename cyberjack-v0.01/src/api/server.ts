import express from 'express';
import cors from 'cors';
import { dispatchEvent } from '../orchestration/eventRouter';
import { subjectRepo, playerRepo, presetRepo, activeContextsRepo, eventLogRepo, sceneRepo, chatMemoryRepo, characterRepo, characterRelationRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { sendToSillyTavern, sendNarratorDescription } from '../adapters/sillyTavernAdapter';
import { activeConfig, updateConfig } from '../prompts/config';
import { runGameTick } from '../orchestration/runGameTick';
import { clamp } from '../engine/utils';
import { generateCharacterContext } from '../orchestration/characterGenerator/generator';
import { composePromptSections } from '../orchestration/characterGenerator/promptComposer';
import { setGeneratedProfile } from '../orchestration/characterGenerator/profileStore';
import { applyGeneratedContextToSillyTavern } from '../adapters/sillyTavernManager';
import { maybeSummarizeChat } from '../services/chatSummary';
import { recordMemoryEvent } from '../services/memoryLayer';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';
import { buildPromptPayload } from '../prompts/buildPromptPayload';
import { orchestrateSceneActors } from '../orchestration/sceneOrchestrator';
import { describeActionNarrative, describeContextNarrative } from '../narrative/eventTemplates';
import { db } from '../infrastructure/db';

function buildAutoUserMessage(opts: { actionLabel: string; pointLabel?: string }): string {
    const pointPart = opts.pointLabel ? ` — точка ${opts.pointLabel}` : '';
    return `*(Без слов)* [Калибратор применяет воздействие: ${opts.actionLabel}${pointPart}]`;
}

const DEFAULT_PLAYER = {
    id: 'PL-1',
    resources: {
        credits: 0,
        authority: 0,
        timeBudget: 0
    }
};

function normalizePlayer(playerObj?: { id: string; resources: Record<string, number> } | null) {
    const src = playerObj || DEFAULT_PLAYER;
    characterRepo.ensurePlayer(src.id, src.id === 'PL-1' ? 'Калибратор' : src.id);
    return {
        id: src.id,
        resources: {
            ...DEFAULT_PLAYER.resources,
            ...(src.resources || {})
        }
    };
}

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/wait', async (req, res) => {
    try {
        const { subjectId = 'S-01', ticks = 1, eventId = 'lab', callLLM = false } = req.body;
        let lastBundle: Awaited<ReturnType<typeof runGameTick>> | null = null;
        
        // Run N silent ticks
        for (let i = 0; i < ticks; i++) {
            lastBundle = await runGameTick({
                subjectId,
                pointId: 'general',
                playerId: 'PL-1',
                sceneId: eventId,
                presetId: 'wait'
            });
        }

        let stReply, promptMessages;
        if (callLLM && lastBundle) {
            const waitMessage = `[Прошло времени: ${ticks} тиков. Ничего нового не произошло. Ответь, только если хочешь что-то сказать в пустоту.]`;
            const chatHistory = chatMemoryRepo.getRecent(subjectId, 10).map(entry => ({
                role: entry.role,
                content: entry.content
            }));
            const stRes = await sendToSillyTavern(lastBundle.prompt, waitMessage, chatHistory);
            stReply = stRes.reply;
            promptMessages = stRes.sentMessages;
            
            if (stReply && typeof stReply === 'object' && (stReply as any).speech) {
                chatMemoryRepo.append(subjectId, 'assistant', (stReply as any).speech);
            }
            recordMemoryEvent({
                subjectId,
                bundle: lastBundle,
                userText: waitMessage,
                assistantText: typeof stReply === 'object' ? stReply.speech : ''
            });
            maybeSummarizeChat(subjectId);
        }

        const fullState = subjectRepo.getWithPoint(subjectId, 'general');
        const player = normalizePlayer(playerRepo.get('PL-1'));
        res.json({
            success: true,
            state: fullState,
            reply: stReply || null,
            promptMessages: promptMessages || null,
            actionTrace: null,
            tickResult: lastBundle?.output.result,
            bundle: lastBundle,
            player
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

import { resolveAvailableFunctions, canExecuteCommand } from '../domain/resolver';
// ...existing code...
app.post('/api/tick', async (req, res) => {
    try {
        const { subjectId = 'S-01', textMessage, playerId = 'PL-1' } = req.body;
        const baseUserMessage =
            typeof textMessage === 'string' && textMessage.trim().length ? textMessage.trim() : null;
        
        // 1. Dispatch through Orchestrator (handles Parsing + Engine Tick)
        const { bundle, dynamicModifiers, pointIdUsed } = await dispatchEvent(req.body);
        const eventId = req.body.sceneId || 'lab';
        const actionId =
            req.body.presetId ||
            bundle.compiledAction?.actionKey ||
            (bundle.compiledAction as any)?.action ||
            'unknown_action';
        const actionLabel =
            bundle.compiledAction?.label ||
            req.body.labelOverride ||
            req.body.presetId ||
            'неизвестное воздействие';
        const pointPreset = presetRepo.getPointPreset(pointIdUsed);
        const pointLabel = pointPreset?.label || pointIdUsed;
        let promptPayload = bundle.prompt;
        let promptDirty = false;
        const immediateNotes: string[] = [];
        let suppressActionNarrative = false;
        const normalizedInput = baseUserMessage ? baseUserMessage.toLowerCase() : '';
        const wantsNeutralPose = /\b(встань|вставай|поднимись|поднимайся|на\s+ноги|встаньте)\b/.test(
            normalizedInput
        );
        const actorCharacter = characterRepo.ensurePlayer(playerId, playerId === 'PL-1' ? 'Калибратор' : playerId);
        const actorName = actorCharacter.name || 'Калибратор';

        const actionNarrative = describeActionNarrative(
            actionId,
            actionLabel,
            actorName,
            pointLabel,
            pointIdUsed
        );

        const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);
        const player = normalizePlayer(playerRepo.get(playerId));
        let pendingUserCommandMessage: string | null = baseUserMessage;
        const hasUserText = Boolean(baseUserMessage);

        // 1.5 Handle special actions returned by parser (like context changes)
        if (dynamicModifiers && dynamicModifiers.commandIntent && dynamicModifiers.commandIntent.type !== 'none') {
            const commandIntent = dynamicModifiers.commandIntent;
            
            let targetCtxId: string | undefined;

            if (commandIntent.type === 'change_pose') {
                targetCtxId = commandIntent.targetPoseId;
            } else if (commandIntent.type === 'activate_context') {
                targetCtxId = commandIntent.targetContextId;
            }

            if (targetCtxId) {
                const targetContext = presetRepo.getContextPreset(targetCtxId);
                if (targetContext) {
                    // Check logic based on anatomical constraints
                    const allPoints = presetRepo.getAllPointPresets();
                    const activeIds = activeContextsRepo.getAllForEvent(eventId);
                    const allActiveContexts = activeIds.map(a => presetRepo.getContextPreset(a.id)).filter(Boolean);
                    
                    const resolvedFunctions = resolveAvailableFunctions({
                        anatomyPoints: allPoints,
                        activeContexts: allActiveContexts
                    });
                    
                    const contextPresetsAll = presetRepo.getAllContextPresetsFull();
                    
                    const executionCheck = canExecuteCommand({
                        commandIntent,
                        contextPresets: contextPresetsAll,
                        resolvedFunctions
                    });
                    
                    const opennessTarget = 30; // Threshold hardcoded for testing, usually 50
                    const currentOpenness = fullState?.openness ?? fullState?.core?.openness ?? 0;
                    const contextCommandPhrase = `Контекст активирован: ${targetContext.label}. Примени это состояние.`;
                    if (hasUserText && !pendingUserCommandMessage) {
                        pendingUserCommandMessage = contextCommandPhrase;
                    }

                    if (executionCheck.allowed && currentOpenness >= opennessTarget) {
                        if (targetContext.slot) {
                            for (const aPreset of allActiveContexts) {
                                if (aPreset && aPreset.slot === targetContext.slot && aPreset.id !== targetContext.id) {
                                    const removalText = describeContextNarrative(aPreset, 'removed', actorName);
                                    activeContextsRepo.remove(eventId, aPreset.id);
                                    eventLogRepo.append(
                                        subjectId,
                                        'context_change',
                                        { presetId: 'context_change', action: null, actionLabel: removalText, narrative: removalText },
                                        { removed: true, slot: aPreset.slot }
                                    );
                                }
                            }
                        } else if (targetContext.point_id && !targetContext.slot) {
                            for (const aPreset of allActiveContexts) {
                                if (aPreset && aPreset.point_id === targetContext.point_id && aPreset.id !== targetContext.id) {
                                    const removalText = describeContextNarrative(aPreset, 'removed', actorName);
                                    activeContextsRepo.remove(eventId, aPreset.id);
                                    eventLogRepo.append(
                                        subjectId,
                                        'context_change',
                                        { presetId: 'context_change', action: null, actionLabel: removalText, narrative: removalText },
                                        { removed: true, point_id: aPreset.point_id }
                                    );
                                }
                            }
                        }
                        activeContextsRepo.add(eventId, targetCtxId, -1);
                        const applicationMode: 'self' | 'forced' =
                            hasUserText && targetContext.selfApplicable ? 'self' : 'forced';
                        const forcedNarrative = describeContextNarrative(targetContext, applicationMode, actorName);
                        eventLogRepo.append(subjectId, 'context_change', {
                            presetId: 'context_change',
                            action: null,
                            actionLabel: forcedNarrative,
                            narrative: forcedNarrative
                        }, { added: true });
                        promptDirty = true;
                        immediateNotes.push(forcedNarrative);
                        suppressActionNarrative = !hasUserText;
                    } else {
                        let failReason = '';
                        if (!executionCheck.allowed) {
                            failReason = `Команда отклонена из-за ограничений тела:\n - ${executionCheck.blockedReasons.join('\n - ')}`;
                        } else {
                            failReason = `Тебе приказали: ${targetContext.label}, но ты отказываешься подчиниться, т.к уровень Открытости (${currentOpenness.toFixed(1)}) недостаточен.`;
                        }
                        eventLogRepo.append(subjectId, 'context_change', {
                            presetId: 'context_change', action: null, actionLabel: failReason, actionFailed: true
                        }, { failed: true, reasons: executionCheck.blockedReasons });
                        promptDirty = true;
                        immediateNotes.push(failReason);
                    }
                }
            }
        }

        if (wantsNeutralPose) {
            const activeIds = activeContextsRepo.getAllForEvent(eventId);
            const poseContexts = activeIds
                .map(obj => presetRepo.getContextPreset(obj.id))
                .filter(ctx => ctx && ctx.slot === 'pose');

            if (poseContexts.length) {
                for (const poseCtx of poseContexts) {
                    if (!poseCtx?.id) continue;
                    const removalNarrative = describeContextNarrative(poseCtx, 'removed', actorName);
                    activeContextsRepo.remove(eventId, poseCtx.id);
                    eventLogRepo.append(
                        subjectId,
                        'context_change',
                        {
                            presetId: 'context_change',
                            action: null,
                            actionLabel: removalNarrative,
                            narrative: removalNarrative
                        },
                        { removed: true, slot: poseCtx.slot }
                    );
                    immediateNotes.push(removalNarrative);
                }
                promptDirty = true;
            } else {
                immediateNotes.push('Ты уже стоишь, поэтому дополнительных изменений нет.');
            }
        }

        const suppressTickIds = suppressActionNarrative ? [bundle.tickId] : undefined;

        if (promptDirty || suppressTickIds) {
            promptPayload = await buildPromptPayload(subjectId, bundle.output, eventId, {
                suppressTickIds
            });
            bundle.prompt = promptPayload;
        }
        if (!suppressActionNarrative) {
            immediateNotes.unshift(actionNarrative);
        }
        if (immediateNotes.length) {
            const block = `\n[Только что]\n${immediateNotes.join('\n')}`;
            promptPayload.systemPrompt = `${promptPayload.systemPrompt}${block}`;
            bundle.prompt = promptPayload;
        }

        let autoUserMessage: string | null = null;
        let actionLabelMessage: string | null = null;
        if (pendingUserCommandMessage) {
            autoUserMessage = pendingUserCommandMessage;
        } 
        if (!suppressActionNarrative) {
            actionLabelMessage = buildAutoUserMessage({
                actionLabel,
                pointLabel
            });
        }

        // 2. Load latest full UI state from DB
// ...existing code...
        // Count consecutive occurrences using actual domain state
        let actionRepeats = 1;
        if (actionId && !autoUserMessage) {
            const recentLogs = db.prepare('SELECT action_payload FROM event_logs WHERE subject_id = ? AND action_type = ? ORDER BY id DESC LIMIT 15').all(subjectId, 'interaction') as { action_payload: string }[];
            for (const row of recentLogs) {
                try {
                    const parsed = JSON.parse(row.action_payload);
                    const logActionId = parsed.presetId || parsed.actionId || parsed.action?.actionKey;
                    // Match action and point to consider it a repeat
                    if (logActionId === actionId && parsed.pointId === pointIdUsed) {
                        actionRepeats++;
                    } else {
                        break;
                    }
                } catch { break; }
            }
        }

        let historyMessage = autoUserMessage || actionLabelMessage;
        
        if (historyMessage && historyMessage.trim().length > 0) {
            if (actionRepeats > 1 && !autoUserMessage) {
                historyMessage = `*(Без слов)* [Калибратор применяет воздействие: ${actionLabel} - точка ${pointLabel}] *(уже ${actionRepeats}-й раз подряд)*`;
            }
            chatMemoryRepo.append(subjectId, 'user', historyMessage);
        }

        // 4. SillyTavern Communication (External Adapter)
        const chatHistory = chatMemoryRepo.getRecent(subjectId, 10).map(entry => ({
            role: entry.role,
            content: entry.content
        }));
        
        const orchestration = orchestrateSceneActors(bundle);

        let narratorReaction: string | null = null;
        if (orchestration.narrator?.enabled && promptPayload.narratorPrompt) {
            const narratorRes = await sendNarratorDescription(promptPayload.narratorPrompt);
            narratorReaction = narratorRes?.reaction || null;
        }

        const actorReplies: Array<{ actorId: string; kind: string; tone?: string; speech: string; reaction: string }> = [];
        let primaryReply: { speech: string; reaction: string } | null = null;
        let promptMessages: any = null;

        if (orchestration.actorDecisions.length) {
            for (const decision of orchestration.actorDecisions) {
                let currentPayload = promptPayload;
                let currentHistory = chatHistory;
                let userMsgOverride = autoUserMessage || undefined;

                if (decision.actorId !== subjectId) {
                    currentPayload = await buildPromptPayload(decision.actorId, undefined, eventId, {
                        suppressTickIds
                    });
                    
                    if (historyMessage && historyMessage.trim().length > 0) {
                        chatMemoryRepo.append(decision.actorId, 'user', `*[Наблюдение: Калибратор применил воздействие к ${subjectId}]* ${historyMessage}`);
                    }
                    currentHistory = chatMemoryRepo.getRecent(decision.actorId, 10).map(entry => ({
                        role: entry.role,
                        content: entry.content
                    }));
                    userMsgOverride = undefined; // We appended observation to their memory
                }

                const { reply, sentMessages } = await sendToSillyTavern(
                    currentPayload,
                    userMsgOverride,
                    currentHistory
                );

                const structuredReply =
                    reply && typeof reply === 'object'
                        ? (reply as { speech: string })
                        : { speech: String(reply || '') };

                actorReplies.push({
                    actorId: decision.actorId,
                    kind: decision.kind,
                    tone: decision.reason,
                    speech: structuredReply.speech,
                    reaction: narratorReaction || ''
                });

                if (decision.actorId === subjectId || !primaryReply) {
                    primaryReply = { speech: structuredReply.speech, reaction: narratorReaction || '' };
                    promptMessages = sentMessages;
                }

                if (structuredReply.speech) {
                    chatMemoryRepo.append(decision.actorId, 'assistant', structuredReply.speech);
                }
            }
        } else {
            promptMessages = [];
        }

        recordMemoryEvent({
            subjectId,
            bundle,
            userText: autoUserMessage || actionLabelMessage || undefined,
            assistantText: primaryReply?.speech || '',
            infoTag: req.body?.presetId
        });
        maybeSummarizeChat(subjectId);

        res.json({
            success: true,
            tickResult: bundle.output.result,
            state: fullState,
            player,
            diagnostics: bundle.diagnostics,
            bundle,
            reply: primaryReply,
            promptMessages,
            actorReplies,
            narratorReaction,
            actionTrace: null,
            classifierLog: dynamicModifiers?.raw ?? null,
            classifierModel: dynamicModifiers?.model ?? null
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/state', (req, res) => {
    const subjectId = (req.query.subjectId as string) || 'S-01';
    const pointId = (req.query.pointId as string) || 'hands';
    const requestedSceneId = req.query.sceneId as string | undefined;
    
    try {
        const uiState = subjectRepo.getUIState(subjectId, pointId);
        const subjectCharacter = characterRepo.ensureSubject(subjectId, uiState.subject?.name || subjectId);
        const targetSceneId = requestedSceneId || subjectCharacter.currentSceneId || 'lab';
        const scene = sceneRepo.get(targetSceneId);
        const player = normalizePlayer(playerRepo.get('PL-1'));
        const relations = characterRelationRepo.listFor(subjectCharacter.id);
        const characters = characterRepo.listAll().map((ch) => ({
            id: ch.id,
            name: ch.name,
            kind: ch.kind,
            currentSceneId: ch.currentSceneId
        }));

        let availableActions = uiState.availableActions || [];
        if (scene) {
            availableActions = (scene.availableActions || []).map(actionId => {
                const preset = presetRepo.getActionPreset(actionId);
                const costs = scene.actionCosts?.[actionId];
                return {
                    id: actionId,
                    label: preset?.label || actionId,
                    costs: costs && Object.keys(costs).length ? costs : null
                };
            });
            scene.characters = sceneCharacterRepo.list(scene.id);
        }

        res.json({ 
            success: true, 
            subject: uiState.subject,
            availablePoints: uiState.availablePoints,
            availableActions,
            scene: scene ? { id: scene.id, transitions: scene.transitions || [], characters: scene.characters || [] } : null,
            player,
            relations,
            characters
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/player/update', (req, res) => {
    try {
        const { playerId = 'PL-1', resources = {} } = req.body || {};
        const existing = normalizePlayer(playerRepo.get(playerId));
        const nextResources: Record<string, number> = { ...existing.resources };

        for (const [key, value] of Object.entries(resources || {})) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) continue;
            nextResources[key] = numeric;
        }

        const nextPlayer = { id: playerId, resources: nextResources };
        playerRepo.save(nextPlayer);
        res.json({ success: true, player: normalizePlayer(nextPlayer) });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/relations/update', (req, res) => {
    try {
        const { fromId, toId, knows, present, canInteract, attitude } = req.body || {};
        if (!fromId || !toId) {
            return res.status(400).json({ success: false, error: 'fromId и toId обязательны' });
        }

        if (knows !== undefined || present !== undefined || canInteract !== undefined) {
            characterRelationRepo.updateFlags(fromId, toId, {
                knows,
                present,
                canInteract
            });
        }

        if (typeof attitude === 'number' && Number.isFinite(attitude)) {
            characterRelationRepo.updateAttitude(fromId, toId, attitude, { baselineAttitude: attitude });
        }

        const relation = characterRelationRepo.get(fromId, toId);
        res.json({ success: true, relation });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/relations', (req, res) => {
    try {
        const fromId = (req.query.fromId as string) || '';
        if (!fromId) {
            return res.status(400).json({ success: false, error: 'fromId обязателен' });
        }
        const relations = characterRelationRepo.listFor(fromId);
        res.json({ success: true, relations });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/scenes', (req, res) => {
    try {
        const scenes = sceneRepo.list().map((scene) => ({
            ...scene,
            characters: sceneCharacterRepo.list(scene.id)
        }));
        res.json({ success: true, scenes });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/scene/move', (req, res) => {
    try {
        const { characterId, sceneId, role, canAct, presenceState } = req.body || {};
        if (!characterId || !sceneId) {
            return res.status(400).json({ success: false, error: 'characterId и sceneId обязательны' });
        }
        sceneCharacterRepo.moveCharacter(characterId, sceneId, { role, canAct, presenceState });
        const sceneCharacters = sceneCharacterRepo.list(sceneId);
        res.json({ success: true, sceneCharacters });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/contexts', (req, res) => {
    try {
        const eventId = req.query.eventId as string || 'lab';
        const allPresets = presetRepo.getAllContextPresets();
        const activeIds = activeContextsRepo.getAllForEvent(eventId);

        res.json({ success: true, allPresets, activeIds });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/contexts/toggle', (req, res) => {
    try {
        const { eventId = 'lab', subjectId = 'S-01', contextId, isActive } = req.body;
        const targetContext = presetRepo.getContextPreset(contextId);
        const actorCharacter = characterRepo.ensurePlayer('PL-1', 'Калибратор');
        const actorName = actorCharacter.name || 'Калибратор';
        
        if (!targetContext) throw new Error("Context preset not found.");

        const narratives: string[] = [];

        if (isActive) {
            // Find EXCLUSIVE contexts in the same slot/point
            if (targetContext.slot && targetContext.exclusiveWithinSlot) {
                const activeIds = activeContextsRepo.getAllForEvent(eventId);
                for (const aObj of activeIds) {
                    const aId = aObj.id;
                    const aPreset = presetRepo.getContextPreset(aId);
                    if (aPreset && aPreset.slot === targetContext.slot && aPreset.id !== targetContext.id) {
                        activeContextsRepo.remove(eventId, aId);
                        const removalText = describeContextNarrative(aPreset, 'removed', actorName);
                        eventLogRepo.append(subjectId, 'context_change', 
                            { presetId: 'context_change', action: null, actionLabel: removalText, narrative: removalText },
                            { removed: true, slot: aPreset.slot }
                        );
                        narratives.push(removalText);
                    }
                }
            } else if (targetContext.point_id && !targetContext.slot) { // Fallback to old behavior
                const activeIds = activeContextsRepo.getAllForEvent(eventId);
                for (const aObj of activeIds) {
                    const aId = aObj.id;
                    const aPreset = presetRepo.getContextPreset(aId);
                    if (aPreset && aPreset.point_id === targetContext.point_id && aPreset.id !== targetContext.id) {
                        activeContextsRepo.remove(eventId, aId);
                        const removalText = describeContextNarrative(aPreset, 'removed', actorName);
                        eventLogRepo.append(subjectId, 'context_change', 
                            { presetId: 'context_change', action: null, actionLabel: removalText, narrative: removalText },
                            { removed: true, point_id: aPreset.point_id }
                        );
                        narratives.push(removalText);
                    }
                }
            }
            activeContextsRepo.add(eventId, contextId, -1);
            const applicationMode: 'self' | 'forced' = targetContext.selfApplicable ? 'self' : 'forced';
            const forcedNarrative = describeContextNarrative(targetContext, applicationMode, actorName);
            eventLogRepo.append(subjectId, 'context_change', 
                { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative },
                { added: true, point_id: targetContext.point_id, slot: targetContext.slot }
            );
            narratives.push(forcedNarrative);
        } else {
            activeContextsRepo.remove(eventId, contextId);
            const removalText = describeContextNarrative(targetContext, 'removed', actorName);
            eventLogRepo.append(subjectId, 'context_change', 
                { presetId: 'context_change', action: null, actionLabel: removalText, narrative: removalText },
                { removed: true, point_id: targetContext.point_id }
            );
            narratives.push(removalText);
        }
        res.json({ success: true, narratives });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json({ success: true, config: activeConfig });
});

app.get('/api/characters/profile', (req, res) => {
    try {
        const rawSubject = req.query.subjectId;
        const subjectId =
            typeof rawSubject === 'string' && rawSubject.trim().length > 0 ? rawSubject.trim() : 'S-01';
        const profile = ensureGeneratedProfile(subjectId);
        res.json({ success: true, subjectId, profile });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/config', (req, res) => {
    try {
        updateConfig(req.body.config);
        res.json({ success: true, config: activeConfig });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/characters/prompt', async (req, res) => {
    try {
        const subjectId = req.body.subjectId || 'S-01';
        const includeTags = Array.isArray(req.body.includeTags) ? req.body.includeTags : undefined;
        const excludeTags = Array.isArray(req.body.excludeTags) ? req.body.excludeTags : undefined;
        const seed = typeof req.body.seed === 'string' && req.body.seed.trim() ? req.body.seed.trim() : undefined;
        const applyToSillyTavern = Boolean(req.body.applyToSillyTavern);

        const context = generateCharacterContext({
            seed,
            includeTags,
            excludeTags
        });

        const narrative = context.narrative || {
            identityParagraphs: [],
            historyParagraphs: [],
            activationParagraphs: []
        };

        const hasGeneratedNarrative =
            (narrative.identityParagraphs?.length || 0) > 0 ||
            (narrative.historyParagraphs?.length || 0) > 0 ||
            (narrative.activationParagraphs?.length || 0) > 0;

        const identityBlocks = narrative.identityParagraphs.length
            ? narrative.identityParagraphs
            : hasGeneratedNarrative
            ? []
            : [activeConfig.character.identity];
        const historyBlocks = narrative.historyParagraphs.length
            ? narrative.historyParagraphs
            : hasGeneratedNarrative
            ? []
            : [activeConfig.character.history];
        const activationBlocks = narrative.activationParagraphs || [];

        const sections = composePromptSections(context, {
            identity: activeConfig.character.identity,
            history: activeConfig.character.history,
            instructions: activeConfig.character.formatInstructions,
            identityBlocks,
            historyBlocks,
            activationBlocks,
            originBlocks: context.originStatements,
            assetBlocks: context.assetReasons
        });

        let stUpdate: { worldInfoName: string } | null = null;
        if (applyToSillyTavern) {
            const personaForSt =
                sections.personaWithoutTraits ||
                [activeConfig.character.identity, activeConfig.character.history].join('\n\n');
            const scenarioForSt =
                [sections.historyText, sections.activationText].filter(Boolean).join('\n\n') ||
                activeConfig.character.history;

            stUpdate = await applyGeneratedContextToSillyTavern({
                subjectId,
                context,
                personaText: personaForSt,
                traitBlock: sections.traitBlock,
                scenarioText: scenarioForSt,
                instructions: activeConfig.character.formatInstructions
            });
        }

        const responsePayload = {
            success: true,
            subjectId,
            seed: context.seed,
            tags: context.tags,
            grouped: context.grouped,
            personaNotes: context.personaNotes,
            personaText: sections.personaText,
            loreNotes: context.loreNotes,
            loreRefs: context.loreRefs,
            systemPrompt: `${activeConfig.adapters.sillyTavernSystemPrefix}\n${sections.systemPrompt}`,
            stUpdate,
            narrative
        };

        setGeneratedProfile(subjectId, {
            personaText: sections.personaText,
            personaWithoutTraits: sections.personaWithoutTraits,
            traitBlock: sections.traitBlock,
            loreNotes: context.loreNotes,
            loreRefs: context.loreRefs,
            systemPrompt: sections.systemPrompt,
            identityText: sections.identityText,
            historyText: sections.historyText,
            activationText: sections.activationText,
            seed: context.seed
        });

        const storedProfile = ensureGeneratedProfile(subjectId);

        res.json({
            ...responsePayload,
            profile: storedProfile
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/subject/update', (req, res) => {
    try {
        const subjectId = req.body.subjectId || 'S-01';
        const current = subjectRepo.get(subjectId);

        if (!current) {
            return res.status(404).json({ success: false, error: 'Subject not found' });
        }

        const asNumber = (value: any, fallback: number) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const updated = {
            sensitivity: clamp(asNumber(req.body.sensitivity, current.sensitivity), 0, 100),
            attitude: clamp(asNumber(req.body.attitude, current.attitude), 0, 100),
            capacity: clamp(asNumber(req.body.capacity, current.capacity), 0, 100),
            openness: clamp(asNumber(req.body.openness, current.openness), 0, 100),
            plasticity: clamp(asNumber(req.body.plasticity, current.plasticity), 0, 100),
            baselineSensitivity: clamp(asNumber(req.body.baselineSensitivity, current.baselineSensitivity ?? current.sensitivity), 0, 100),
            baselineAttitude: clamp(asNumber(req.body.baselineAttitude, current.baselineAttitude ?? current.attitude), 0, 100),
            baselineCapacity: clamp(asNumber(req.body.baselineCapacity, current.baselineCapacity ?? current.capacity), 0, 100),
            baselineOpenness: clamp(asNumber(req.body.baselineOpenness, current.baselineOpenness ?? current.openness), 0, 100),
            baselinePlasticity: clamp(asNumber(req.body.baselinePlasticity, current.baselinePlasticity ?? current.plasticity), 0, 100)
        };

        subjectRepo.save(subjectId, current.name || subjectId, updated as any);
        const fullState = subjectRepo.getWithPoint(subjectId, req.body.pointId || 'general');
        res.json({ success: true, state: fullState });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});
