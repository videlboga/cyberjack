
import { Request, Response } from 'express';
import { dispatchEvent } from '../../orchestration/eventRouter';
import { subjectRepo, resourceRepo, presetRepo, sceneCharacterRepo, activeContextsRepo, eventLogRepo, characterRepo } from '../../infrastructure/repositories';
import { db } from '../../infrastructure/db';
import { executeTurnConversations } from '../../orchestration/sceneOrchestrator';
import { describeActionNarrative } from '../../narrative/eventTemplates';
import { buildPromptPayloadWithDB } from '../../prompts/buildPromptPayloadWrapper';
import { classifySpokenEmotion, generateCharacterReply } from '../../adapters/llmAdapter';
import { applyVerbalInputToFrame, buildReactionSystemPrompt, buildReactionTurnMessage } from '../../narrative/reactionFrame';
import { recordMemoryEvent } from '../../services/memoryLayer';
import { chatMemoryRepo } from '../../infrastructure/repositories';
import { normalizePlayer } from './playerController';
import { buildStateDescription, getContractProgress } from '../../services/chipGenerator';
import { generateSceneImage, shouldGenerateImage } from '../../services/portraitGenerator';
import { getWorldClock } from '../../scenario/worldService';
import { deriveTelemetry } from '../../narrative/telemetry';
import { resolvePortraitEmotion } from '../../domain/portraitEmotion';
import { randomUUID } from 'crypto';
import { actionTimePolicy } from '../../domain/actionTimePolicy';
import { advanceSimulationTime } from '../../scenario/simulationTime';
import { buildPairedDialogueHistory } from '../../narrative/dialogueHistory';

const deferredReplyJobs = new Map<string, {
    done: boolean;
    metrics?: any;
    error?: string | null;
    completion?: Promise<void>;
    chunks?: string[];
    subscribers?: Set<Response>;
}>();

const physiologyLockedPortraits = new Set([
    'unconscious', 'climax', 'afterglow', 'subspace', 'pain',
    'mixed_overload', 'high_negative', 'exhausted', 'sleepy'
]);

const settleClassifiedEmotion = (previous: string | null, proposed: string, confidence: number) => {
    if (confidence < 0.58) return previous || proposed;
    if (!previous || previous === proposed) return proposed;
    // A very confident observation may cross the full emotional space. With
    // weaker evidence, retain the previous expression instead of flickering.
    return confidence >= 0.78 ? proposed : previous;
};

function publicDeferredJob(job: any) {
    const { completion: _completion, subscribers: _subscribers, ...publicJob } = job;
    return publicJob;
}

export const getDeferredReply = (req: Request, res: Response) => {
    const id = String(req.params.jobId || '');
    const job = deferredReplyJobs.get(id);
    if (!job) return res.status(404).json({ success: false, error: 'Ожидаемый ответ не найден' });
    res.json({ success: true, ...publicDeferredJob(job) });
    if (job.done) deferredReplyJobs.delete(id);
};

export const waitForDeferredReply = async (req: Request, res: Response) => {
    const id = String(req.params.jobId || '');
    const job = deferredReplyJobs.get(id);
    if (!job) return res.status(404).json({ success: false, error: 'Ожидаемый ответ не найден' });
    if (!job.done && job.completion) {
        await Promise.race([
            job.completion,
            new Promise(resolve => setTimeout(resolve, 60_000))
        ]);
    }
    const completed = deferredReplyJobs.get(id);
    if (!completed) return res.status(404).json({ success: false, error: 'Ожидаемый ответ не найден' });
    res.json({ success: true, ...publicDeferredJob(completed) });
    if (completed.done) deferredReplyJobs.delete(id);
};

export const streamDeferredReply = (req: Request, res: Response) => {
    const id = String(req.params.jobId || '');
    const job = deferredReplyJobs.get(id);
    if (!job) return res.status(404).end();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    for (const chunk of job.chunks || []) res.write(`event: token\ndata: ${JSON.stringify({ chunk })}\n\n`);
    if (job.done) {
        res.write(`event: done\ndata: ${JSON.stringify(publicDeferredJob(job))}\n\n`);
        return res.end();
    }
    if (!job.subscribers) job.subscribers = new Set();
    job.subscribers.add(res);
    req.on('close', () => job.subscribers?.delete(res));
};

function publishDeferredToken(job: any, chunk: string) {
    if (!chunk) return;
    (job.chunks ||= []).push(chunk);
    for (const subscriber of job.subscribers || []) subscriber.write(`event: token\ndata: ${JSON.stringify({ chunk })}\n\n`);
}

function finishDeferredStream(job: any) {
    for (const subscriber of job.subscribers || []) {
        subscriber.write(`event: done\ndata: ${JSON.stringify(publicDeferredJob(job))}\n\n`);
        subscriber.end();
    }
    job.subscribers?.clear();
}

function buildAutoUserMessage(opts: { actionLabel: string; pointLabel?: string; actorName: string; targetName: string }): string {
    const pointPart = opts.pointLabel ? ` — точка ${opts.pointLabel}` : '';
    return `*(Без слов)* [${opts.actorName} применяет воздействие к ${opts.targetName}: ${opts.actionLabel}${pointPart}]`;
}

export function buildPairedSpeechHistory(
    entries: Array<{ role: 'user' | 'assistant'; content: string }>,
    limit = 12
) {
    return buildPairedDialogueHistory(entries, limit);
}

export function calculateActionSpeechChance(input: {
    intensity: number;
    tensionBefore: number;
    tensionAfter: number;
    sensoryAmplification?: number;
    transitions?: Array<{ kind?: string }>;
}) {
    if ((input.transitions || []).some(transition => ['discharge', 'overload', 'breakdown'].includes(transition.kind || ''))) return 1;
    let chance = 0.4;
    if (input.intensity >= 0.6) chance += 0.15;
    if (input.intensity >= 0.9) chance += 0.1;
    const tension = Math.max(input.tensionBefore || 0, input.tensionAfter || 0);
    if (tension >= 50) chance += 0.1;
    if (tension >= 75) chance += 0.15;
    if (tension >= 90) chance += 0.1;
    const sensoryAmplification = Number(input.sensoryAmplification || 1);
    if (sensoryAmplification >= 5) return 0.95;
    if (sensoryAmplification >= 3) chance += 0.3;
    else if (sensoryAmplification >= 2) chance += 0.15;
    return Math.min(0.95, chance);
}

export function resolveDirectedActorId(
    addressedCharacterId?: string,
    inferredActorId?: string,
    fallbackSubjectId?: string,
): string | undefined {
    // An explicit UI selection is authoritative. The semantic parser may infer
    // a different nearby actor from an ambiguous pronoun, but it must never
    // reroute a direct conversation away from the selected addressee.
    return addressedCharacterId || inferredActorId || fallbackSubjectId;
}



export const processWait = async (req: Request, res: Response) => {
    try {
        const { subjectId = 'S-AV-01', ticks = 1 } = req.body;
        const deltaTime = Math.max(1, Math.round(
            req.body.deltaTime !== undefined ? Number(req.body.deltaTime) : Number(ticks) || 1
        ));
        const worldClock = await advanceSimulationTime(deltaTime);
        const fullState = subjectRepo.getWithPoint(subjectId, 'systemic');
        const resources = normalizePlayer(resourceRepo.get('PL-1'));

        res.json({
            success: true,
            state: fullState,
            telemetry: null,
            reply: null,
            promptMessages: null,
            actionTrace: null,
            sustainedEffects: [],
            tickResult: null,
            diagnostics: null,
            bundle: null,
            resources,
            worldClock
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const processTick = async (req: Request, res: Response) => {
    try {
        const { subjectId: requestedSubjectId = 'S-AV-01', textMessage, playerId: requestedPlayerId = 'PL-1' } = req.body;
        const addressedCharacterId = typeof req.body.addressedCharacterId === 'string' && req.body.addressedCharacterId.trim()
            ? req.body.addressedCharacterId.trim()
            : undefined;
        const interactionContext = String(req.body.interactionContext || 'Диагностический стол');
        const tickSceneId = req.body.sceneId || 'scene_lab_calibrator';


        const baseUserMessage = typeof textMessage === 'string' && textMessage.trim().length ? textMessage.trim() : null;

        // 1. Dispatch through Orchestrator (handles Parsing + Engine Tick)
        // Note: dispatchEvent now calls runGameTick
        const requestedActionId = String(req.body.presetId || '');
        const timePolicy = actionTimePolicy(requestedActionId);
        const dispatchPayload = {
            ...req.body,
            pointId:(req.body.pointId || 'systemic').toLowerCase(),
            deltaTime:req.body.deltaTime !== undefined ? Number(req.body.deltaTime) : 1.0,
            stateDeltaScale:timePolicy.stateDeltaScale,
            // Context duration belongs to the world-minute service. The action
            // tick computes the action itself but must not age processes again.
            skipContextTimeAdvance:true,
        };
        const { bundle, dynamicModifiers, pointIdUsed, subjectIdUsed, actorIdUsed } = await dispatchEvent(dispatchPayload);
        const subjectId = subjectIdUsed || requestedSubjectId;
        const playerId = requestedPlayerId;
        const actingCharacterId = actorIdUsed || requestedPlayerId;
        const eventId = tickSceneId;
        const actionId = req.body.presetId || bundle.compiledAction?.actionKey || (bundle.compiledAction as any)?.action || 'unknown_action';
        const actionLabel = bundle.compiledAction?.label || req.body.labelOverride || req.body.presetId || 'неизвестное воздействие';
        const pointPreset = presetRepo.getPointPreset(pointIdUsed);
        const pointLabel = pointPreset?.label || pointIdUsed;
        const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);

        let suppressActionNarrative = actionId === 'wait';
        const actorCharacter = characterRepo.ensureCharacter(actingCharacterId, actingCharacterId === 'PL-1' ? 'Калибратор' : actingCharacterId);

        const chanceSpeech = req.body.llmMode === 'speech_chance' || req.body.llmMode === 'scene_chance';
        const speechOnly = req.body.llmMode === 'speech_only' || req.body.llmMode === 'speech_chance';
        let promptPayload = bundle.prompt;
        const suppressTickIds = (suppressActionNarrative || speechOnly) ? [bundle.tickId] : undefined;
        if (suppressTickIds) {
            promptPayload = await buildPromptPayloadWithDB(subjectId, subjectId, bundle.output, eventId, { suppressTickIds, initiatorId: playerId });
            bundle.prompt = promptPayload;
        }
        if (baseUserMessage && promptPayload.reactionFrame) {
            // runGameTick appends authoritative command outcomes after the
            // reaction frame is compiled. Rebuilding the reaction prompt for a
            // spoken command used to discard those outcomes, leaving the model
            // with only the new context and making a just-completed pose look
            // as though it had already been active before the command.
            const systemEventsMarker = '[Системные события тика]:';
            const systemEventsOffset = promptPayload.systemPrompt?.indexOf(systemEventsMarker) ?? -1;
            const systemEvents = systemEventsOffset >= 0
                ? promptPayload.systemPrompt.slice(systemEventsOffset)
                : '';
            const commandType = dynamicModifiers?.commandIntent?.type;
            const parsedCommand = Boolean(dynamicModifiers?.routing || (commandType && commandType !== 'none'));
            promptPayload.reactionFrame = parsedCommand
                ? {
                    ...promptPayload.reactionFrame,
                    event: { ...promptPayload.reactionFrame.event, playerSpeech: baseUserMessage }
                }
                : applyVerbalInputToFrame(promptPayload.reactionFrame, baseUserMessage);
            promptPayload.systemPrompt = buildReactionSystemPrompt(promptPayload.reactionFrame);
            if (systemEvents) promptPayload.systemPrompt += `\n\n${systemEvents}`;
            bundle.prompt = promptPayload;
        }

        let autoUserMessage: string | null = baseUserMessage;
        let actionLabelMessage: string | null = null;
        if (!suppressActionNarrative) {
            actionLabelMessage = buildAutoUserMessage({ actionLabel, pointLabel, actorName: actorCharacter?.name || 'Калибратор', targetName: fullState?.name || subjectId });
        }
        // Keep physical actions in the same durable timeline as dialogue. They
        // remain user-role messages for LLM compatibility; the UI presents the
        // explicit prefix as a system/action row.
        if (!baseUserMessage && !suppressActionNarrative) {
            chatMemoryRepo.append(subjectId, 'user', `[Действие] ${actionLabel} · ${pointLabel}`, interactionContext);
        }

        let turnExecutionMetrics: any = null;
        let llmError: string | null = null;
        const deferLLM = Boolean(req.body.deferLLM);
        const observationTransitions = bundle.diagnostics?.observation?.transitions || [];
        const llmChance = chanceSpeech
            ? calculateActionSpeechChance({
                intensity: Number(bundle.compiledAction.intensity) || 0,
                tensionBefore: Number(bundle.stateBefore.core.tension) || 0,
                tensionAfter: Number(bundle.stateAfter.core.tension) || 0,
                sensoryAmplification: Number(bundle.output.result.sensoryAmplification) || 1,
                transitions: observationTransitions
            })
            : 1;
        const llmSkipped = chanceSpeech && Math.random() >= llmChance;
        
        const generateTurnReply = async () => {
            let generatedMetrics: any = null;
            let generatedError: string | null = null;
            if (speechOnly) {
                const observation = bundle.diagnostics?.observation;
                // The reaction frame already carries a compact recent-dialogue
                // section. Keep only a short verbatim tail for conversational
                // cadence instead of sending the same exchange twice.
                const previousHistory = buildPairedSpeechHistory(chatMemoryRepo.getRecent(subjectId, 16), 6);
                let currentInput: string;
                if (promptPayload.reactionFrame && baseUserMessage) {
                    const lastSpeechBlock = `[Последняя реплика собеседника]\n${baseUserMessage}`;
                    const reactionContext = buildReactionTurnMessage(promptPayload.reactionFrame, baseUserMessage)
                        .replace(lastSpeechBlock, '')
                        .trim();
                    // Preserve the ordinary chat contract: the latest thing the
                    // model sees in the user role is the player's actual line,
                    // not a long instruction document containing that line.
                    promptPayload = {
                        ...promptPayload,
                        systemPrompt: `${promptPayload.systemPrompt}\n\n[Контекст текущей реакции]\n${reactionContext}`,
                    };
                    currentInput = baseUserMessage;
                } else {
                    currentInput = promptPayload.reactionFrame
                        ? buildReactionTurnMessage(promptPayload.reactionFrame, baseUserMessage)
                        : [
                        baseUserMessage ? `[Реплика адресата]\n${baseUserMessage}` : '',
                        `[Текущий контакт]\nКалибратор применяет: ${actionLabel}. Зона: ${pointLabel}.\nТвоё фактическое внутреннее ощущение: ${observation?.subjectiveText || 'реакция неясна'}.`
                        ].filter(Boolean).join('\n\n');
                }
                const generated = await generateCharacterReply(promptPayload, currentInput, previousHistory, (chunk) => {
                    if (replyJobId) {
                        const job = deferredReplyJobs.get(replyJobId);
                        if (job) publishDeferredToken(job, chunk);
                    }
                });
                const structured = generated.reply && typeof generated.reply === 'object'
                    ? generated.reply as { speech: string; speechAct?: string; addressedTo?: string }
                    : { speech: String(generated.reply || '') };
                let portraitEmotion = resolvePortraitEmotion({
                    speech: structured.speech,
                    behavioralState: observation?.behavioralState,
                    reaction: observation?.reaction,
                    transitions: observation?.transitions,
                    state: {
                        ...bundle.stateAfter.core,
                        contexts: (observation?.contexts || []).map((context: any) => ({ actionId: context.id }))
                    }
                });
                generatedError = generated.error || null;
                if (baseUserMessage) chatMemoryRepo.append(subjectId, 'user', baseUserMessage, interactionContext);
                let assistantMessageId: number | null = null;
                if (!generatedError) {
                    if (structured.speech) {
                        const previousEmotion = [...chatMemoryRepo.getRecent(subjectId, 12)]
                            .reverse()
                            .find(message => message.role === 'assistant' && message.portraitEmotion)
                            ?.portraitEmotion || null;
                        assistantMessageId = chatMemoryRepo.append(subjectId, 'assistant', structured.speech, interactionContext, portraitEmotion);
                        if (assistantMessageId) {
                            chatMemoryRepo.updatePortraitEmotion(assistantMessageId, portraitEmotion, 'simulation+speech-fallback', 0.55);
                            if (!physiologyLockedPortraits.has(portraitEmotion)) {
                                try {
                                    const classified = await classifySpokenEmotion({
                                        playerSpeech: baseUserMessage,
                                        characterSpeech: structured.speech,
                                        previousEmotion,
                                        simulationPrior: portraitEmotion,
                                        tension: bundle.stateAfter.core.tension,
                                        attitude: bundle.stateAfter.core.attitude,
                                        openness: bundle.stateAfter.core.openness,
                                    });
                                    const settled = settleClassifiedEmotion(previousEmotion, classified.emotion, classified.confidence);
                                    portraitEmotion = settled;
                                    chatMemoryRepo.updatePortraitEmotion(
                                        assistantMessageId!,
                                        settled,
                                        'speech-classifier',
                                        classified.confidence,
                                    );
                                } catch (error: any) {
                                    console.warn('[PortraitEmotion] speech classification failed:', error?.message || error);
                                }
                            }
                        }
                    }
                }
                generatedMetrics = { reply: { speech: structured.speech || '', speechAct: structured.speechAct || null, addressedTo: structured.addressedTo || null, reaction: '', portraitEmotion }, promptMessages: generated.sentMessages, actorReplies: [], narratorReaction: null };
                queueMicrotask(() => {
                    try {
                        recordMemoryEvent({
                            subjectId,
                            bundle,
                            userText: baseUserMessage || undefined,
                            assistantText: generatedError ? '' : structured.speech || '',
                            speechAct: generatedError ? undefined : structured.speechAct,
                            addressedTo: generatedError ? undefined : structured.addressedTo
                        });
                    } catch (error) {
                        console.error('[Memory] deferred speech memory failed:', error);
                    }
                });
            } else {
                // Full multi-actor orchestration remains available to the main simulator.
                generatedMetrics = await executeTurnConversations(bundle, {
                    subjectId,
                    eventId,
                    actionId,
                    actionLabel,
                    pointLabel,
                    pointIdUsed,
                    autoUserMessage,
                    actionLabelMessage,
                    suppressTickIds,
                    fullStateName: fullState.name || subjectId,
                    reqBodyInfoTag: req.body?.presetId,
                    promptPayload,
                    interactionContext,
                    directedActorId: resolveDirectedActorId(
                        addressedCharacterId,
                        dynamicModifiers?.routing?.actorId,
                        baseUserMessage ? subjectId : undefined,
                    ),
                    onToken: (chunk) => {
                        if (replyJobId) {
                            const job = deferredReplyJobs.get(replyJobId);
                            if (job) publishDeferredToken(job, chunk);
                        }
                    }
                });
            }
            return { metrics: generatedMetrics, error: generatedError };
        };
        const replyPending = deferLLM && !req.body.skipLLM && !llmSkipped;
        const replyJobId = replyPending ? randomUUID() : null;
        if (!req.body.skipLLM && !llmSkipped) {
            if (deferLLM) {
                const job = { done: false, chunks: [], subscribers: new Set<Response>() } as { done: boolean; metrics?: any; error?: string | null; completion?: Promise<void>; chunks?: string[]; subscribers?: Set<Response> };
                deferredReplyJobs.set(replyJobId!, job);
                job.completion = generateTurnReply()
                    .then(generated => {
                        job.done = true;
                        job.metrics = generated.metrics;
                        job.error = generated.error;
                        finishDeferredStream(job);
                    })
                    .catch(error => {
                        console.error('[processTick] deferred character reply failed:', error);
                        job.done = true;
                        job.error = error?.message || String(error);
                        finishDeferredStream(job);
                    });
            } else {
                const generated = await generateTurnReply();
                turnExecutionMetrics = generated.metrics;
                llmError = generated.error;
            }
        }
        if (llmSkipped) {
            const observation = bundle.diagnostics?.observation;
            recordMemoryEvent({ subjectId, bundle });
        }

        // Generate narrative state description + contract progress + suggested chips
        const stateDescription = buildStateDescription(subjectId);
        const contractProgress = getContractProgress(subjectId, playerId);
        const suggestedChips: any[] = [];

        // Async scene image generation — does NOT block the response.
        // Image is pushed to the frontend via WebSocket when ready.
        if (!req.body.skipLLM && !req.body.skipImageGen) {
            const tickResult = bundle.output?.result;
            const doGen = shouldGenerateImage({
                actionApplied: (bundle as any).actionApplied || false,
                systemNotes: (bundle as any).systemNotes || [],
                contextChanged: (bundle as any).actionApplied || false,
                tickResult: tickResult ? {
                    pleasure: tickResult.pleasure,
                    discomfort: tickResult.discomfort,
                    overload: tickResult.overload,
                    engagement: tickResult.engagement,
                } : undefined,
            });
            if (doGen) {
                generateSceneImage(
                    subjectId, playerId,
                    tickResult ? {
                        pleasure: tickResult.pleasure,
                        discomfort: tickResult.discomfort,
                        overload: tickResult.overload,
                        engagement: tickResult.engagement,
                    } : undefined,
                    turnExecutionMetrics?.narratorReaction || undefined,
                ).catch(err => console.error('[processTick] image gen error:', err.message));
            }
        }

        // Process controls alter what is happening now. They do not fast-forward
        // the world; their sustained consequences arrive through minute ticks.
        // A discrete action occupies one game minute.
        const actionMinutes = timePolicy.worldMinutes;
        const worldClock = actionMinutes
            ? await advanceSimulationTime(actionMinutes, undefined, { activeSubjectIds: [subjectId] })
            : getWorldClock();
        const telemetry = deriveTelemetry({
            core: bundle.stateAfter.core,
            point: bundle.stateAfter.point,
            observation: bundle.diagnostics?.observation,
            contexts: activeContextsRepo.getAllForSubject(subjectId)
        });

        res.json({
            success: true,
            tickResult: bundle.output.result,
            state: fullState,
            telemetry,
            resources: normalizePlayer(resourceRepo.get(playerId)),
            diagnostics: bundle.diagnostics,
            bundle,
            actionApplied: (bundle as any).actionApplied || false,
            systemNotes: (bundle as any).systemNotes || [],
            reply: turnExecutionMetrics?.reply || null,
            promptMessages: turnExecutionMetrics?.promptMessages || null,
            actorReplies: turnExecutionMetrics?.actorReplies || [],
            narratorReaction: turnExecutionMetrics?.narratorReaction || null,
            llmError,
            llmChance,
            llmSkipped,
            replyPending,
            replyJobId,
            classifierLog: dynamicModifiers?.raw ?? null,
            classifierModel: dynamicModifiers?.model ?? null,
            stateDescription,
            contractProgress,
            suggestedChips,
            worldClock
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};
