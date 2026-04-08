import { Request, Response } from 'express';
import { dispatchEvent } from '../../orchestration/eventRouter';
import { subjectRepo, playerRepo, presetRepo, activeContextsRepo, eventLogRepo, sceneRepo, chatMemoryRepo, characterRepo, characterRelationRepo, sceneCharacterRepo } from '../../infrastructure/repositories';
import { sendToLLM } from '../../adapters/llmAdapter';
import { buildUserPromptForCurrentTick } from '../../prompts/openRouterPromptBuilder';
import { activeConfig, updateConfig } from '../../prompts/config';
import { runGameTick } from '../../orchestration/runGameTick';
import { clamp } from '../../engine/utils';
import { generateCharacterContext } from '../../orchestration/characterGenerator/generator';
import { composePromptSections } from '../../orchestration/characterGenerator/promptComposer';
import { setGeneratedProfile } from '../../orchestration/characterGenerator/profileStore';
import { maybeSummarizeChat } from '../../services/chatSummary';
import { recordMemoryEvent } from '../../services/memoryLayer';
import { ensureGeneratedProfile } from '../../orchestration/characterGenerator/profileManager';
import { buildPromptPayload } from '../../prompts/buildPromptPayload';
import { orchestrateSceneActors, executeTurnConversations } from '../../orchestration/sceneOrchestrator';
import { describeActionNarrative, describeContextNarrative } from '../../narrative/eventTemplates';
import { ContextManager } from '../../engine/contextManager';
import { db } from '../../infrastructure/db';

const pendingActionNarratives: Record<string, string[]> = {};

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
    return { ...DEFAULT_PLAYER, ...src };
}


export const processWait = async (req: Request, res: Response) => {
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
            const systemPrompt = lastBundle.prompt.systemPrompt;
            const fullPrompt = systemPrompt + "\n\n" + buildUserPromptForCurrentTick({ actorName: 'Среда', actionDescription: waitMessage });
            const stRes = await sendToLLM(fullPrompt);
            stReply = { speech: stRes.reply };
            promptMessages = stRes.sentMessages;
            if (stReply.speech) {
                chatMemoryRepo.append(subjectId, 'assistant', (stReply as any).speech);
            }
            recordMemoryEvent({
                subjectId,
                bundle: lastBundle,
                userText: waitMessage,
                assistantText: stReply.speech
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
};

export const processTick = async (req: Request, res: Response) => {
    try {
        const { subjectId = 'S-01', textMessage, playerId = 'PL-1' } = req.body;
        const tickSceneId = req.body.sceneId || 'lab';

        // Verify proximity constraint
        if (!textMessage && (req.body.presetId || req.body.actionId)) {
            const actionPresetId = req.body.presetId || req.body.actionId;
            const actionPreset = actionPresetId ? presetRepo.getActionPreset(actionPresetId) : null;
            
            if (actionPreset && (actionPreset.type === 'physical' || actionPreset.contact > 0.3)) {
                // Determine characters location
                const presentChars = sceneCharacterRepo.list(tickSceneId);
                const subjSceneChar = presentChars.find(sc => sc.character.subjectId === subjectId || sc.character.id === subjectId);
                const playerSceneChar = presentChars.find(sc => sc.character.playerId === playerId || sc.character.id === playerId);
                // Allow interaction if no locations are set (assumes 'nearby') or both are set to the same value
                if (subjSceneChar && playerSceneChar && subjSceneChar.slotId && playerSceneChar.slotId && subjSceneChar.slotId !== playerSceneChar.slotId) {
                    return res.status(400).json({ success: false, error: 'Слишком далеко для физического воздействия. Сначала подойдите в нужную зону.' });
                }
            }
        }

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
            } else if (commandIntent.type === 'deactivate_context') {
                const deactivateId = commandIntent.targetContextId;
                const actionPreset = presetRepo.getActionPreset(deactivateId);
                const currentStatus = activeContextsRepo.getAllForSubject(subjectId).find(c => c.actionId === deactivateId);
                if (currentStatus) {
                    activeContextsRepo.remove(currentStatus.id);
                    const removalNarrative = `Состояние отменено: ${actionPreset?.label || deactivateId}`;
                    eventLogRepo.append(
                        subjectId,
                        'context_change',
                        { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative },
                        { removed: true }
                    );
                    promptDirty = true;
                    immediateNotes.push(removalNarrative);
                    suppressActionNarrative = !hasUserText;
                }
            }

            if (targetCtxId) {
                const actionPreset = presetRepo.getActionPreset(targetCtxId);
                if (actionPreset && actionPreset.contextConfig) {
                    const ctxPriority = actionPreset.contextConfig.priority || 1;
                    const requiredCompliance = ctxPriority * 20; // Example: 1 = 20, 2 = 40, 3 = 60
                    const currentCompliance = (fullState.core.plasticity || 0) + (fullState.core.openness || 0) * 0.5 + (fullState.core.attitude || 0) * 0.5;

                    if (currentCompliance >= requiredCompliance) {
                        ContextManager.applyContext(subjectId, targetCtxId, actionPreset);
                        const forcedNarrative = `Выполнено действие: ${actionPreset.label}. Примени это состояние.`;
                        
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
                        const refusedNarrative = `[Система]: Актив мысленно ОТКАЗЫВАЕТСЯ выполнять команду ("${actionPreset.label}"). Требуемый уровень подчинения: ${requiredCompliance}, но текущий всего ~${Math.round(currentCompliance)}. Отреагируй отказом словами или жестами.`;
                        promptDirty = true;
                        immediateNotes.push(refusedNarrative);
                        suppressActionNarrative = !hasUserText;
                    }
                }
            }
        }

        if (wantsNeutralPose) {
            const currentContexts = activeContextsRepo.getAllForSubject(subjectId);
            const poseContexts = currentContexts
                .map(obj => ({ ctx: obj, preset: presetRepo.getActionPreset(obj.actionId) }))
                .filter(item => item.preset?.contextConfig?.occupiesPoints?.includes('global_pose'));

            if (poseContexts.length) {
                for (const { ctx, preset } of poseContexts) {
                    if (!preset?.id) continue;
                    const removalNarrative = `Состояние отменено: ${preset.label}`;
                    activeContextsRepo.remove(ctx.id);
                    eventLogRepo.append(
                        subjectId,
                        'context_change',
                        {
                            presetId: 'context_change',
                            action: null,
                            actionLabel: removalNarrative,
                            narrative: removalNarrative
                        },
                        { removed: true }
                    );
                    immediateNotes.push(removalNarrative);
                }
                promptDirty = true;
            } else {
                immediateNotes.push('Ты уже стоишь, поэтому дополнительных изменений нет.');
            }
        }
        
        if (!req.body.skipTimeTick) {
            ContextManager.processTick(subjectId);
        }

        const suppressTickIds = suppressActionNarrative ? [bundle.tickId] : undefined;

        if (promptDirty || suppressTickIds) {
            promptPayload = await buildPromptPayload(subjectId, subjectId, bundle.output, eventId, {
                suppressTickIds
            });
            bundle.prompt = promptPayload;
        }
        if (!suppressActionNarrative) {
            immediateNotes.unshift(actionNarrative);
        }
        
        if (req.body.skipLLM) {
            if (!pendingActionNarratives[subjectId]) {
                pendingActionNarratives[subjectId] = [];
            }
            pendingActionNarratives[subjectId].push(...immediateNotes);
        } else {
            if (pendingActionNarratives[subjectId]) {
                immediateNotes.unshift(...pendingActionNarratives[subjectId]);
                delete pendingActionNarratives[subjectId];
            }
            
            if (immediateNotes.length) {
                const block = `\n[Только что]\n${immediateNotes.join('\n')}`;
                promptPayload.systemPrompt = `${promptPayload.systemPrompt}${block}`;
                bundle.prompt = promptPayload;
            }
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

        let historyMessage = '';
        if (autoUserMessage) {
            historyMessage = `[Игрок (к ${fullState.name || subjectId})]: "${autoUserMessage}"`;
        } else if (actionLabelMessage) {
            historyMessage = `*(Без слов)* [Калибратор применяет воздействие к ${fullState.name || subjectId}: ${actionLabel} - точка ${pointLabel}]`;
            if (actionRepeats > 1) {
                historyMessage += ` *(уже ${actionRepeats}-й раз подряд)*`;
            }
        }

        if (historyMessage.trim().length > 0) {
            chatMemoryRepo.append(subjectId, 'user', historyMessage);
        }

        
        
        
        
        

        
        let narratorReaction: string | null = null;
        let actorReplies: Array<{ actorId: string; kind: string; tone?: string; speech: string; reaction: string }> = [];
        let primaryReply: { speech: string; reaction: string } | null = null;
        let promptMessages: any = null;

        if (!req.body.skipLLM) {
        // 4. LLM Generation
        
        const orchestration = orchestrateSceneActors(bundle);

        
        if (orchestration.narrator?.enabled && promptPayload.narratorPrompt && promptPayload.narratorPrompt.instructions) {
            const narratorRes = await sendToLLM(promptPayload.narratorPrompt.instructions);
            narratorReaction = narratorRes?.reply || null;
        }

        
        
        

        if (orchestration.actorDecisions.length) {
            await Promise.all(orchestration.actorDecisions.map(async (decision) => {
                    let currentPayload = promptPayload;
                    let userMsgOverride = autoUserMessage || undefined;                if (decision.actorId !== subjectId) {
                    currentPayload = await buildPromptPayload(decision.actorId, subjectId, undefined, eventId, {
                        suppressTickIds
                    });
                    
                    if (historyMessage && historyMessage.trim().length > 0) {
                        chatMemoryRepo.append(decision.actorId, 'user', historyMessage);
                    }
                    
                    let observerOverride = autoUserMessage || undefined;
                    if (narratorReaction) {
                        observerOverride = observerOverride ? `${observerOverride}\n\n[Общая сцена - реакция ${subjectId} (Рассказчик)]: ${narratorReaction}` : `[Общая сцена - реакция ${subjectId} (Рассказчик)]: ${narratorReaction}`;
                    }
                    userMsgOverride = observerOverride;
                }

                
                    const actorNameText = actorName || 'Неизвестный';
                    const pointNameText = pointLabel || 'Тело';
                    
                    const acuteIntensity = bundle.output.result?.experiencedIntensity || 0;
                    let acuteSensation;
                    if (acuteIntensity > 70) {
                        acuteSensation = `Острая вспышка перегрузки в области "${pointNameText}" прошивает твой разум. Почти невыносимо.`;
                    }
                    
                    const finalPromptStr = `${currentPayload.systemPrompt}\n\n${buildUserPromptForCurrentTick({
                        actorName: actorNameText,
                        actionDescription: userMsgOverride || `Применяет воздействие: ${actionLabel}`,
                        acuteSensation
                    })}`;

                    const { reply, sentMessages } = await sendToLLM(finalPromptStr);

                    let parsedSpeech = reply || '';
                    try {
                        let cleanStr = parsedSpeech.replace(/```json/g, '').replace(/```/g, '').trim();
                        if (cleanStr.startsWith('{')) {
                            const parsed = JSON.parse(cleanStr);
                            if (parsed.speech) parsedSpeech = parsed.speech;
                        }
                    } catch (e) {
                        // ignore
                    }

                    const structuredReply = { speech: parsedSpeech };

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
            }));
        } else {
            promptMessages = [];
        }

        recordMemoryEvent({
            subjectId,
            bundle,
            userText: autoUserMessage || actionLabelMessage || undefined,
            assistantText: (primaryReply as any)?.speech || '',
            infoTag: req.body?.presetId
        });
        }
        maybeSummarizeChat(subjectId);

        res.json({
            success: true,
            tickResult: bundle.output.result,
            state: fullState,
            player,
            diagnostics: bundle.diagnostics,
            bundle,
            reply: (primaryReply as any),
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
};
