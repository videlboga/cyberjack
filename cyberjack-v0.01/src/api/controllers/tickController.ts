
import { Request, Response } from 'express';
import { dispatchEvent } from '../../orchestration/eventRouter';
import { subjectRepo, resourceRepo, presetRepo, sceneCharacterRepo, activeContextsRepo, eventLogRepo, characterRepo } from '../../infrastructure/repositories';
import { db } from '../../infrastructure/db';
import { executeTurnConversations } from '../../orchestration/sceneOrchestrator';
import { describeActionNarrative } from '../../narrative/eventTemplates';
import { ContextManager } from '../../orchestration/contextManager';
import { buildPromptPayloadWithDB } from '../../prompts/buildPromptPayloadWrapper';
import { runGameTick } from '../../orchestration/runGameTick';
import { sendToLLM } from '../../adapters/llmAdapter';
import { buildUserPromptForCurrentTick } from '../../prompts/openRouterPromptBuilder';
import { maybeSummarizeChat } from '../../services/chatSummary';
import { recordMemoryEvent } from '../../services/memoryLayer';
import { chatMemoryRepo } from '../../infrastructure/repositories';
import { normalizePlayer } from './playerController';
import { buildStateDescription, getContractProgress, generateSuggestedChips } from '../../services/chipGenerator';
import { eventQueries } from '../../infrastructure/eventQueries';
import { generateSceneImage, shouldGenerateImage } from '../../services/portraitGenerator';

function buildAutoUserMessage(opts: { actionLabel: string; pointLabel?: string; actorName: string; targetName: string }): string {
    const pointPart = opts.pointLabel ? ` — точка ${opts.pointLabel}` : '';
    return `*(Без слов)* [${opts.actorName} применяет воздействие к ${opts.targetName}: ${opts.actionLabel}${pointPart}]`;
}



export const processWait = async (req: Request, res: Response) => {
    try {
        const { subjectId = 'S-AV-01', ticks = 1, eventId = 'scene_lab_calibrator', callLLM = false } = req.body;
        const deltaTime = req.body.deltaTime !== undefined ? Number(req.body.deltaTime) : 20.0;
        let lastBundle: Awaited<ReturnType<typeof runGameTick>> | null = null;

        for (let i = 0; i < ticks; i++) {
            lastBundle = await runGameTick({
                subjectId,
                pointId: 'systemic',
                playerId: 'PL-1',
                sceneId: eventId,
                presetId: 'wait',
                deltaTime
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
            if (stReply.speech) chatMemoryRepo.append(subjectId, 'assistant', (stReply as any).speech);

            recordMemoryEvent({
                subjectId,
                bundle: lastBundle,
                userText: waitMessage,
                assistantText: stReply.speech
            });
            maybeSummarizeChat(subjectId);
        }

        const fullState = subjectRepo.getWithPoint(subjectId, 'systemic');
        const resources = normalizePlayer(resourceRepo.get('PL-1'));
        
        res.json({
            success: true,
            state: fullState,
            reply: stReply || null,
            promptMessages: promptMessages || null,
            actionTrace: null,
            tickResult: lastBundle?.output.result,
            diagnostics: lastBundle?.diagnostics,
            bundle: lastBundle,
            resources
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const processTick = async (req: Request, res: Response) => {
    try {
        const { subjectId = 'S-AV-01', textMessage, playerId = 'PL-1' } = req.body;
        const tickSceneId = req.body.sceneId || 'scene_lab_calibrator';


        const baseUserMessage = typeof textMessage === 'string' && textMessage.trim().length ? textMessage.trim() : null;

        // 1. Dispatch through Orchestrator (handles Parsing + Engine Tick)
        // Note: dispatchEvent now calls runGameTick
        const dispatchPayload = { ...req.body, pointId: (req.body.pointId || 'systemic').toLowerCase(), deltaTime: req.body.deltaTime !== undefined ? Number(req.body.deltaTime) : 1.0 };
        const { bundle, dynamicModifiers, pointIdUsed } = await dispatchEvent(dispatchPayload);
        const eventId = tickSceneId;
        const actionId = req.body.presetId || bundle.compiledAction?.actionKey || (bundle.compiledAction as any)?.action || 'unknown_action';
        const actionLabel = bundle.compiledAction?.label || req.body.labelOverride || req.body.presetId || 'неизвестное воздействие';
        const pointPreset = presetRepo.getPointPreset(pointIdUsed);
        const pointLabel = pointPreset?.label || pointIdUsed;
        const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);

        let suppressActionNarrative = actionId === 'wait';
        const actorCharacter = characterRepo.ensureCharacter(playerId, playerId === 'PL-1' ? 'Калибратор' : playerId);

        let promptPayload = bundle.prompt;
        const suppressTickIds = suppressActionNarrative ? [bundle.tickId] : undefined;
        if (suppressTickIds) {
            promptPayload = await buildPromptPayloadWithDB(subjectId, subjectId, bundle.output, eventId, { suppressTickIds });
            bundle.prompt = promptPayload;
        }

        let autoUserMessage: string | null = baseUserMessage;
        let actionLabelMessage: string | null = null;
        if (!suppressActionNarrative) {
            actionLabelMessage = buildAutoUserMessage({ actionLabel, pointLabel, actorName: actorCharacter?.name || 'Калибратор', targetName: fullState?.name || subjectId });
        }

        let turnExecutionMetrics = null;
        
        if (!req.body.skipLLM) {
            // Unified Execution Delegate handles the db repetitive check, chatting, logic and memory writing
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
                promptPayload
            });
        }

        // Generate narrative state description + contract progress + suggested chips
        const stateDescription = buildStateDescription(subjectId);
        const contractProgress = getContractProgress(subjectId, playerId);
        let suggestedChips: any[] = [];
        if (!req.body.skipLLM) {
            try {
                const recentEventsText = eventQueries.getRecentLogs(subjectId, 5)
                    .map(e => e.actionPayload?.actionLabel || e.actionType)
                    .filter(Boolean).join('; ');
                suggestedChips = await generateSuggestedChips(subjectId, playerId, recentEventsText, '');
            } catch (e: any) {
                console.warn('[processTick] chip generation failed:', e.message);
            }
        }

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

        res.json({
            success: true,
            tickResult: bundle.output.result,
            state: fullState,
            resources: normalizePlayer(resourceRepo.get(playerId)),
            diagnostics: bundle.diagnostics,
            bundle,
            actionApplied: (bundle as any).actionApplied || false,
            systemNotes: (bundle as any).systemNotes || [],
            reply: turnExecutionMetrics?.reply || null,
            promptMessages: turnExecutionMetrics?.promptMessages || null,
            actorReplies: turnExecutionMetrics?.actorReplies || [],
            narratorReaction: turnExecutionMetrics?.narratorReaction || null,
            classifierLog: dynamicModifiers?.raw ?? null,
            classifierModel: dynamicModifiers?.model ?? null,
            stateDescription,
            contractProgress,
            suggestedChips
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};
