
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

// Simple constants
const DEFAULT_PLAYER = {
    id: 'PL-1',
    resources: { credits: 0, authority: 0, timeBudget: 0 }
};

function normalizePlayer(resourcesObj?: { id: string; resources: Record<string, number> } | null) {
    const src = resourcesObj || DEFAULT_PLAYER;
    return { ...DEFAULT_PLAYER, ...src };
}

function buildAutoUserMessage(opts: { actionLabel: string; pointLabel?: string }): string {
    const pointPart = opts.pointLabel ? ` — точка ${opts.pointLabel}` : '';
    return `*(Без слов)* [Калибратор применяет воздействие: ${opts.actionLabel}${pointPart}]`;
}

// Memory tracking for forced narrative skipLLM logic
const pendingActionNarratives: Record<string, string[]> = {};

export const processWait = async (req: Request, res: Response) => {
    try {
        const { subjectId = 'S-01', ticks = 1, eventId = 'lab', callLLM = false } = req.body;
        let lastBundle: Awaited<ReturnType<typeof runGameTick>> | null = null;

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
            if (stReply.speech) chatMemoryRepo.append(subjectId, 'assistant', (stReply as any).speech);

            recordMemoryEvent({
                subjectId,
                bundle: lastBundle,
                userText: waitMessage,
                assistantText: stReply.speech
            });
            maybeSummarizeChat(subjectId);
        }

        const fullState = subjectRepo.getWithPoint(subjectId, 'general');
        const resources = normalizePlayer(resourceRepo.get('PL-1'));
        
        res.json({
            success: true,
            state: fullState,
            reply: stReply || null,
            promptMessages: promptMessages || null,
            actionTrace: null,
            tickResult: lastBundle?.output.result,
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
        const { subjectId = 'S-01', textMessage, playerId = 'PL-1' } = req.body;
        const tickSceneId = req.body.sceneId || 'lab';

        // 1. Proximity Validation Constraints
        if (!textMessage && (req.body.presetId || req.body.actionId)) {
            const actionPresetId = req.body.presetId || req.body.actionId;
            const actionPreset = presetRepo.getActionPreset(actionPresetId);
            
            if (actionPreset && (actionPreset.type === 'physical' || actionPreset.contact > 0.3)) {
                const presentChars = sceneCharacterRepo.list(tickSceneId);
                const subjSceneChar = presentChars.find(sc => sc.character.subjectId === subjectId || sc.character.id === subjectId);
                const playerSceneChar = presentChars.find(sc => sc.character.playerId === playerId || sc.character.id === playerId);
                if (subjSceneChar && playerSceneChar && subjSceneChar.slotId && playerSceneChar.slotId && subjSceneChar.slotId !== playerSceneChar.slotId) {
                    return res.status(400).json({ success: false, error: 'Слишком далеко для физического воздействия. Сначала подойдите в нужную зону.' });
                }
            }
        }

        const baseUserMessage = typeof textMessage === 'string' && textMessage.trim().length ? textMessage.trim() : null;

        // 1. Dispatch through Orchestrator (handles Parsing + Engine Tick)
        // Note: dispatchEvent now calls runGameTick
        const { bundle, dynamicModifiers, pointIdUsed } = await dispatchEvent(req.body);
        const eventId = tickSceneId;
        const actionId = req.body.presetId || bundle.compiledAction?.actionKey || (bundle.compiledAction as any)?.action || 'unknown_action';
        const actionLabel = bundle.compiledAction?.label || req.body.labelOverride || req.body.presetId || 'неизвестное воздействие';
        const pointPreset = presetRepo.getPointPreset(pointIdUsed);
        const pointLabel = pointPreset?.label || pointIdUsed;
        const fullState = subjectRepo.getWithPoint(subjectId, pointIdUsed);

        // Pre-LLM Orchestration Hook Processing
        // (Wants neutralize pose, commanding poses, applying direct changes)
        // Wait, Context overrides should really be inside RUN GAME TICK! But for now we just handle it via Orchestrator here cleanly.
        let promptDirty = false;
        const immediateNotes: string[] = [];
        let suppressActionNarrative = actionId === 'wait';
        const hasUserText = Boolean(baseUserMessage);
        const actorCharacter = characterRepo.ensureCharacter(playerId, playerId === 'PL-1' ? 'Калибратор' : playerId);
        const actionNarrative = describeActionNarrative(actionId, actionLabel, actorCharacter.name || 'Калибратор', pointLabel, pointIdUsed);

        const normalizedInput = baseUserMessage ? baseUserMessage.toLowerCase() : '';
        const wantsNeutralPose = /\b(встань|вставай|поднимись|поднимайся|на\s+ноги|встаньте)\b/.test(normalizedInput);

        let promptPayload = bundle.prompt;
        const suppressTickIds = suppressActionNarrative ? [bundle.tickId] : undefined;
        if (promptDirty || suppressTickIds) {
            promptPayload = await buildPromptPayloadWithDB(subjectId, subjectId, bundle.output, eventId, { suppressTickIds });
            bundle.prompt = promptPayload;
        }

        if (!suppressActionNarrative) immediateNotes.unshift(actionNarrative);
        
        if (req.body.skipLLM) {
            pendingActionNarratives[subjectId] = pendingActionNarratives[subjectId] || [];
            pendingActionNarratives[subjectId].push(...immediateNotes);
        } else if (pendingActionNarratives[subjectId]) {
            immediateNotes.unshift(...pendingActionNarratives[subjectId]);
            delete pendingActionNarratives[subjectId];
        }

        if (!req.body.skipLLM && immediateNotes.length) {
            const block = `\n[Только что]\n${immediateNotes.join('\n')}`;
            promptPayload.systemPrompt = `${promptPayload.systemPrompt}${block}`;
            bundle.prompt = promptPayload;
        }

        let autoUserMessage: string | null = baseUserMessage;
        let actionLabelMessage: string | null = null;
        if (!suppressActionNarrative) {
            actionLabelMessage = buildAutoUserMessage({ actionLabel, pointLabel });
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

        res.json({
            success: true,
            tickResult: bundle.output.result,
            state: fullState,
            resources: normalizePlayer(resourceRepo.get(playerId)),
            diagnostics: bundle.diagnostics,
            bundle,
            reply: turnExecutionMetrics?.reply || null,
            promptMessages: turnExecutionMetrics?.promptMessages || null,
            actorReplies: turnExecutionMetrics?.actorReplies || [],
            narratorReaction: turnExecutionMetrics?.narratorReaction || null,
            classifierLog: dynamicModifiers?.raw ?? null,
            classifierModel: dynamicModifiers?.model ?? null
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};
