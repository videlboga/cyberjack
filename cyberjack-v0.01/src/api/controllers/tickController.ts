
import { Request, Response } from 'express';
import { dispatchEvent } from '../../orchestration/eventRouter';
import { subjectRepo, resourceRepo, presetRepo, sceneCharacterRepo, activeContextsRepo, eventLogRepo, characterRepo } from '../../infrastructure/repositories';
import { db } from '../../infrastructure/db';
import { executeTurnConversations } from '../../orchestration/sceneOrchestrator';
import { describeActionNarrative } from '../../narrative/eventTemplates';
import { ContextManager } from '../../orchestration/contextManager';
import { buildPromptPayloadWithDB } from '../../prompts/buildPromptPayloadWrapper';
import { runGameTick } from '../../orchestration/runGameTick';
import { generateCharacterReply } from '../../adapters/llmAdapter';
import { applyVerbalInputToFrame, buildReactionSystemPrompt, buildReactionTurnMessage } from '../../narrative/reactionFrame';
import { recordMemoryEvent } from '../../services/memoryLayer';
import { chatMemoryRepo } from '../../infrastructure/repositories';
import { normalizePlayer } from './playerController';
import { buildStateDescription, getContractProgress } from '../../services/chipGenerator';
import { generateSceneImage, shouldGenerateImage } from '../../services/portraitGenerator';
import { advanceWorldTime } from '../../scenario/worldService';
import { deriveTelemetry } from '../../narrative/telemetry';
import { planSustainedPulses } from '../../orchestration/sustainedEffects';

function buildAutoUserMessage(opts: { actionLabel: string; pointLabel?: string; actorName: string; targetName: string }): string {
    const pointPart = opts.pointLabel ? ` — точка ${opts.pointLabel}` : '';
    return `*(Без слов)* [${opts.actorName} применяет воздействие к ${opts.targetName}: ${opts.actionLabel}${pointPart}]`;
}

export function buildPairedSpeechHistory(
    entries: Array<{ role: 'user' | 'assistant'; content: string }>,
    limit = 12
) {
    const mentionsLoreTerm = (text = '') => /(резонанс|пустот|бездн|аномали)/i.test(text);
    const usable = entries.filter(entry =>
        entry.content && !/^\[Текущий контакт\]|^\*\(Без слов\)\*|^\[Игрок \(/.test(entry.content)
    );
    const paired: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const entry of usable) {
        if (entry.role === 'user') {
            paired.push({ role: entry.role, content: entry.content });
        } else if (paired.length && paired[paired.length - 1].role === 'user') {
            const precedingInput = paired[paired.length - 1].content;
            if (!mentionsLoreTerm(entry.content) || mentionsLoreTerm(precedingInput)) {
                paired.push({ role: entry.role, content: entry.content });
            }
        }
    }
    const recent = paired.slice(-limit);
    while (recent[0]?.role === 'assistant') recent.shift();
    return recent;
}

export function calculateActionSpeechChance(input: {
    intensity: number;
    tensionBefore: number;
    tensionAfter: number;
    transitions?: Array<{ kind?: string }>;
}) {
    if ((input.transitions || []).some(transition => transition.kind === 'discharge' || transition.kind === 'breakdown')) return 1;
    let chance = 0.4;
    if (input.intensity >= 0.6) chance += 0.15;
    if (input.intensity >= 0.9) chance += 0.1;
    const tension = Math.max(input.tensionBefore || 0, input.tensionAfter || 0);
    if (tension >= 50) chance += 0.1;
    if (tension >= 75) chance += 0.15;
    if (tension >= 90) chance += 0.1;
    return Math.min(0.95, chance);
}



export const processWait = async (req: Request, res: Response) => {
    try {
        const { subjectId = 'S-AV-01', ticks = 1, eventId = 'scene_lab_calibrator', callLLM = false } = req.body;
        const interactionContext = String(req.body.interactionContext || 'Диагностический стол');
        const deltaTime = req.body.deltaTime !== undefined ? Number(req.body.deltaTime) : 20.0;
        const pulseTargets = ['neck', 'chest', 'nipples', 'belly', 'inner_thighs', 'groin', 'vulva', 'clitoris', 'penis', 'testicles', 'anus'];
        if (!presetRepo.getActionPreset('sustained_vibration_pulse')) {
            presetRepo.saveActionPreset('sustained_vibration_pulse', 'Импульс продолжительной вибрации', {
                intensity: .28, valence: .65, contact: .75, sharpness: .08, novelty: .25, validTargets: pulseTargets
            });
        }
        if (!presetRepo.getActionPreset('sustained_electro_pulse')) {
            presetRepo.saveActionPreset('sustained_electro_pulse', 'Импульс продолжительной электростимуляции', {
                intensity: .42, valence: -.25, contact: .65, sharpness: .55, novelty: .3, validTargets: pulseTargets
            });
        }
        let lastBundle: Awaited<ReturnType<typeof runGameTick>> | null = null;
        const sustainedEffects: Array<{ sourceActionId: string; label: string; pointId: string; pulses: number }> = [];

        for (let i = 0; i < ticks; i++) {
            const plans = planSustainedPulses(activeContextsRepo.getAllForSubject(subjectId), deltaTime);
            if (!plans.length) {
                lastBundle = await runGameTick({
                    subjectId, pointId: 'systemic', playerId: 'PL-1', sceneId: eventId,
                    presetId: 'wait', deltaTime
                });
                continue;
            }
            for (const plan of plans) {
                sustainedEffects.push({ sourceActionId: plan.sourceActionId, label: plan.label, pointId: plan.pointId, pulses: plan.pulses });
                for (let pulse = 0; pulse < plan.pulses; pulse++) {
                    lastBundle = await runGameTick({
                        subjectId,
                        pointId: plan.pointId,
                        playerId: 'PL-1',
                        sceneId: eventId,
                        presetId: plan.presetId,
                        deltaTime: 1,
                        customPayload: { sustainedSource: plan.sourceActionId, pulse: pulse + 1, pulseCount: plan.pulses }
                    });
                }
            }
        }

        let stReply, promptMessages;
        if (callLLM && lastBundle) {
            const turnMessage = lastBundle.prompt.reactionFrame
                ? buildReactionTurnMessage(lastBundle.prompt.reactionFrame)
                : `[Пауза] Прошло времени: ${ticks} тиков. Говорить необязательно.`;
            const history = chatMemoryRepo.getRecent(subjectId, 8).map(entry => ({ role: entry.role, content: entry.content }));
            const generated = await generateCharacterReply(lastBundle.prompt, turnMessage, history);
            stReply = typeof generated.reply === 'object' ? generated.reply : { speech: String(generated.reply || '') };
            promptMessages = generated.sentMessages;
            if (stReply.speech) chatMemoryRepo.append(subjectId, 'assistant', (stReply as any).speech, interactionContext);

            recordMemoryEvent({
                subjectId,
                bundle: lastBundle,
                assistantText: stReply.speech,
                speechAct: (stReply as any).speechAct,
                addressedTo: (stReply as any).addressedTo
            });
        }

        const fullState = subjectRepo.getWithPoint(subjectId, 'systemic');
        const resources = normalizePlayer(resourceRepo.get('PL-1'));
        const worldClock = advanceWorldTime(10 * Math.max(1, Number(ticks) || 1), undefined, { activeSubjectIds: [subjectId] });
        
        const telemetry = lastBundle ? deriveTelemetry({
            core: lastBundle.stateAfter.core,
            point: lastBundle.stateAfter.point,
            observation: lastBundle.diagnostics?.observation,
            contexts: activeContextsRepo.getAllForSubject(subjectId)
        }) : null;

        res.json({
            success: true,
            state: fullState,
            telemetry,
            reply: stReply || null,
            promptMessages: promptMessages || null,
            actionTrace: null,
            sustainedEffects,
            tickResult: lastBundle?.output.result,
            diagnostics: lastBundle?.diagnostics,
            bundle: lastBundle,
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
        const dispatchPayload = { ...req.body, pointId: (req.body.pointId || 'systemic').toLowerCase(), deltaTime: req.body.deltaTime !== undefined ? Number(req.body.deltaTime) : 1.0 };
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
            const commandType = dynamicModifiers?.commandIntent?.type;
            const parsedCommand = Boolean(dynamicModifiers?.routing || (commandType && commandType !== 'none'));
            promptPayload.reactionFrame = parsedCommand
                ? {
                    ...promptPayload.reactionFrame,
                    event: { ...promptPayload.reactionFrame.event, playerSpeech: baseUserMessage }
                }
                : applyVerbalInputToFrame(promptPayload.reactionFrame, baseUserMessage);
            promptPayload.systemPrompt = buildReactionSystemPrompt(promptPayload.reactionFrame);
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
        const observationTransitions = bundle.diagnostics?.observation?.transitions || [];
        const llmChance = chanceSpeech
            ? calculateActionSpeechChance({
                intensity: Number(bundle.compiledAction.intensity) || 0,
                tensionBefore: Number(bundle.stateBefore.core.tension) || 0,
                tensionAfter: Number(bundle.stateAfter.core.tension) || 0,
                transitions: observationTransitions
            })
            : 1;
        const llmSkipped = chanceSpeech && Math.random() >= llmChance;
        
        if (!req.body.skipLLM && !llmSkipped) {
            if (speechOnly) {
                const observation = bundle.diagnostics?.observation;
                const previousHistory = buildPairedSpeechHistory(chatMemoryRepo.getRecent(subjectId, 32), 12);
                const currentInput = promptPayload.reactionFrame
                    ? buildReactionTurnMessage(promptPayload.reactionFrame, baseUserMessage)
                    : [
                        baseUserMessage ? `[Реплика адресата]\n${baseUserMessage}` : '',
                        `[Текущий контакт]\nКалибратор применяет: ${actionLabel}. Зона: ${pointLabel}.\nТвоё фактическое внутреннее ощущение: ${observation?.subjectiveText || 'реакция неясна'}.`
                    ].filter(Boolean).join('\n\n');
                const generated = await generateCharacterReply(promptPayload, currentInput, previousHistory);
                const structured = generated.reply && typeof generated.reply === 'object'
                    ? generated.reply as { speech: string; speechAct?: string; addressedTo?: string }
                    : { speech: String(generated.reply || '') };
                llmError = generated.error || null;
                if (baseUserMessage) chatMemoryRepo.append(subjectId, 'user', baseUserMessage, interactionContext);
                if (!llmError) {
                    if (structured.speech) chatMemoryRepo.append(subjectId, 'assistant', structured.speech, interactionContext);
                }
                recordMemoryEvent({
                    subjectId,
                    bundle,
                    userText: baseUserMessage || undefined,
                    assistantText: llmError ? '' : structured.speech || '',
                    speechAct: llmError ? undefined : structured.speechAct,
                    addressedTo: llmError ? undefined : structured.addressedTo
                });
                turnExecutionMetrics = { reply: { speech: structured.speech || '', speechAct: structured.speechAct || null, addressedTo: structured.addressedTo || null, reaction: '' }, promptMessages: generated.sentMessages, actorReplies: [], narratorReaction: null };
            } else {
                // Full multi-actor orchestration remains available to the main simulator.
                turnExecutionMetrics = await executeTurnConversations(bundle, {
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
                    directedActorId: dynamicModifiers?.routing?.actorId || addressedCharacterId
                });
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

        const worldClock = advanceWorldTime(5, undefined, { activeSubjectIds: [subjectId] });
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
