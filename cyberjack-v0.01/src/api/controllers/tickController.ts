
import { Request, Response } from 'express';
import { dispatchEvent } from '../../orchestration/eventRouter';
import { withTraceContext } from '../../orchestration/trace';
import { subjectRepo, resourceRepo, presetRepo, sceneCharacterRepo, activeContextsRepo, eventLogRepo, characterRepo } from '../../infrastructure/repositories';
import { db } from '../../infrastructure/db';
import { executeTurnConversations } from '../../orchestration/sceneOrchestrator';
import { describeActionNarrative } from '../../narrative/eventTemplates';
import { buildPromptPayloadWithDB } from '../../prompts/buildPromptPayloadWrapper';
import { buildCharacterTurnContext } from '../../orchestration/characterTurnContext';
import { applyVerbalInputToFrame, buildReactionSystemPrompt } from '../../narrative/reactionFrame';
import { recordMemoryEvent } from '../../services/memoryLayer';
import { chatMemoryRepo } from '../../infrastructure/repositories';
import { normalizePlayer } from './playerController';
import { buildStateDescription, getContractProgress } from '../../services/chipGenerator';
import { generateSceneImage, shouldGenerateImage } from '../../services/portraitGenerator';
import { getWorldClock } from '../../scenario/worldService';
import { deriveTelemetry } from '../../narrative/telemetry';
import { randomUUID } from 'crypto';
import { actionTimePolicy } from '../../domain/actionTimePolicy';
import { buildPairedDialogueHistory } from '../../narrative/dialogueHistory';
import { moveCharacterInLaboratory } from '../../scenario/spatialContext';
import { syncLaboratorySpatialRelations } from '../../services/sceneRelations';
import { mapTickResponse } from '../dto/tickResponseMapper';
import { registerDeferredReply, getDeferredReplyJob, publishDeferredToken, finishDeferredStream, getDeferredReply, waitForDeferredReply, streamDeferredReply } from '../deferredReply';

export { getDeferredReply, waitForDeferredReply, streamDeferredReply };

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



export const processWait = (_req: Request, res: Response) => {
    res.status(409).json({
        success: false,
        error: 'Ручное ожидание отключено: игровое время идёт только через фоновый clock.',
    });
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

        // A direct UI action has no semantic route, so it must establish the
        // active screen's position before the physical-access check.
        // Spoken input is parsed first: its route may name a different actor
        // or target, and moving here used to bias that resolution.
        if (!textMessage && tickSceneId === 'scene_lab_calibrator' && requestedPlayerId && requestedSubjectId !== requestedPlayerId) {
            const relocation = moveCharacterInLaboratory(requestedPlayerId, requestedSubjectId, requestedPlayerId);
            if (relocation.handled) syncLaboratorySpatialRelations(requestedPlayerId);
        }

        // 1. Dispatch through Orchestrator (handles Parsing + Engine Tick)
        // Note: dispatchEvent now calls runGameTick
        const requestedActionId = String(req.body.presetId || '');
        const statePolicy = actionTimePolicy(requestedActionId);
        const dispatchPayload = {
            ...req.body,
            pointId:(req.body.pointId || 'systemic').toLowerCase(),
            deltaTime:req.body.deltaTime !== undefined ? Number(req.body.deltaTime) : 1.0,
            stateDeltaScale:statePolicy.stateDeltaScale,
            // Context duration belongs to the world-minute service. The action
            // tick computes the action itself but must not age processes again.
            skipContextTimeAdvance:true,
        };
        const { bundle, dynamicModifiers, pointIdUsed, subjectIdUsed, actorIdUsed, requestId } = await dispatchEvent(dispatchPayload);
        // A conversational screen still represents where the calibrator is,
        // but its position must never take part in choosing who the command
        // refers to.  Apply that screen transition only after parsing/routing.
        if (textMessage && tickSceneId === 'scene_lab_calibrator' && requestedPlayerId && requestedSubjectId !== requestedPlayerId) {
            const relocation = moveCharacterInLaboratory(requestedPlayerId, requestedSubjectId, requestedPlayerId);
            if (relocation.handled) syncLaboratorySpatialRelations(requestedPlayerId);
        }
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
        let promptPayload = bundle.prompt;
        const suppressTickIds = suppressActionNarrative ? [bundle.tickId] : undefined;
        if (suppressTickIds) {
            promptPayload = (await buildCharacterTurnContext({
                subjectId,
                stimulus: { kind: 'external_action', tickId: bundle.tickId },
                latestResult: bundle.output,
                eventId,
                initiatorId: playerId,
                suppressTickIds,
            })).payload;
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
            const generatedMetrics = await executeTurnConversations(bundle, {
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
                            const job = getDeferredReplyJob(replyJobId);
                            if (job) publishDeferredToken(job, chunk);
                        }
                    }
            });
            return { metrics: generatedMetrics, error: generatedMetrics?.error || null };
        };
        const replyPending = deferLLM && !req.body.skipLLM && !llmSkipped;
        const replyJobId = replyPending ? randomUUID() : null;
        if (!req.body.skipLLM && !llmSkipped) {
            if (deferLLM) {
                const job = registerDeferredReply(replyJobId!);
                job.completion = withTraceContext(requestId, () => generateTurnReply())
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
                const generated = await withTraceContext(requestId, () => generateTurnReply());
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

        // An action changes the current state; only the background game clock
        // advances time and applies sustained processes.
        const worldClock = getWorldClock();
        const telemetry = deriveTelemetry({
            core: bundle.stateAfter.core,
            point: bundle.stateAfter.point,
            observation: bundle.diagnostics?.observation,
            contexts: activeContextsRepo.getAllForSubject(subjectId)
        });

        res.json(mapTickResponse({
            bundle,
            state: fullState,
            telemetry,
            resources: normalizePlayer(resourceRepo.get(playerId)),
            dynamicModifiers,
            turnExecutionMetrics,
            llmError,
            llmChance,
            llmSkipped,
            replyPending,
            replyJobId,
            stateDescription,
            contractProgress,
            suggestedChips,
            worldClock
        }));
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};
