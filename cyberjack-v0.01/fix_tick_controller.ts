import { readFileSync, writeFileSync } from 'fs';

// Replace processTick in tickController
// We'll write a completely new tickController!
const newController = `
import { Request, Response } from 'express';
import { dispatchEvent } from '../../orchestration/eventRouter';
import { subjectRepo, playerRepo, presetRepo, sceneCharacterRepo, activeContextsRepo, eventLogRepo } from '../../infrastructure/repositories';
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

function normalizePlayer(playerObj?: { id: string; resources: Record<string, number> } | null) {
    const src = playerObj || DEFAULT_PLAYER;
    return { ...DEFAULT_PLAYER, ...src };
}

function buildAutoUserMessage(opts: { actionLabel: string; pointLabel?: string }): string {
    const pointPart = opts.pointLabel ? \` — точка \${opts.pointLabel}\` : '';
    return \`*(Без слов)* [Калибратор применяет воздействие: \${opts.actionLabel}\${pointPart}]\`;
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
            const waitMessage = \`[Прошло времени: \${ticks} тиков. Ничего нового не произошло. Ответь, только если хочешь что-то сказать в пустоту.]\`;
            const systemPrompt = lastBundle.prompt.systemPrompt;
            const fullPrompt = systemPrompt + "\\n\\n" + buildUserPromptForCurrentTick({ actorName: 'Среда', actionDescription: waitMessage });
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
        let suppressActionNarrative = false;
        const hasUserText = Boolean(baseUserMessage);
        const actorCharacter = characterRepo.ensurePlayer(playerId, playerId === 'PL-1' ? 'Калибратор' : playerId);
        const actionNarrative = describeActionNarrative(actionId, actionLabel, actorCharacter.name || 'Калибратор', pointLabel, pointIdUsed);

        const normalizedInput = baseUserMessage ? baseUserMessage.toLowerCase() : '';
        const wantsNeutralPose = /\\b(встань|вставай|поднимись|поднимайся|на\\s+ноги|встаньте)\\b/.test(normalizedInput);

        const commandIntent = dynamicModifiers?.commandIntent;
        if (commandIntent && commandIntent.type !== 'none') {
            let targetCtxId: string | undefined;
            if (commandIntent.type === 'change_pose') targetCtxId = commandIntent.targetPoseId;
            else if (commandIntent.type === 'activate_context') targetCtxId = commandIntent.targetContextId;
            else if (commandIntent.type === 'deactivate_context') {
                const deactivateId = commandIntent.targetContextId;
                const actionPreset = presetRepo.getActionPreset(deactivateId);
                const currentStatus = activeContextsRepo.getAllForSubject(subjectId).find(c => c.actionId === deactivateId);
                if (currentStatus) {
                    activeContextsRepo.remove(currentStatus.id);
                    const removalNarrative = \`Состояние отменено: \${actionPreset?.label || deactivateId}\`;
                    eventLogRepo.append(subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                    promptDirty = true;
                    immediateNotes.push(removalNarrative);
                    suppressActionNarrative = !hasUserText;
                }
            }

            if (targetCtxId) {
                const actionPreset = presetRepo.getActionPreset(targetCtxId);
                if (actionPreset && actionPreset.contextConfig) {
                    const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                    const currentCompliance = (fullState.core.plasticity || 0) + (fullState.core.openness || 0) * 0.5 + (fullState.core.attitude || 0) * 0.5;
                    
                    if (currentCompliance >= requiredCompliance) {
                        ContextManager.applyContext(subjectId, targetCtxId, actionPreset);
                        const forcedNarrative = \`Выполнено действие: \${actionPreset.label}. Примени это состояние.\`;
                        eventLogRepo.append(subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                        promptDirty = true;
                        immediateNotes.push(forcedNarrative);
                        suppressActionNarrative = !hasUserText;
                    } else {
                        const refusedNarrative = \`[Система]: Актив мысленно ОТКАЗЫВАЕТСЯ выполнять команду ("\${actionPreset.label}"). Требуемый уровень подчинения: \${requiredCompliance}, но текущий всего ~\${Math.round(currentCompliance)}. Отреагируй отказом словами или жестами.\`;
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
                    const removalNarrative = \`Состояние отменено: \${preset.label}\`;
                    activeContextsRepo.remove(ctx.id);
                    eventLogRepo.append(subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                    immediateNotes.push(removalNarrative);
                }
                promptDirty = true;
            } else {
                immediateNotes.push('Ты уже стоишь, поэтому дополнительных изменений нет.');
            }
        }
        
        if (!req.body.skipTimeTick) ContextManager.processTick(subjectId);

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
            const block = \`\\n[Только что]\\n\${immediateNotes.join('\\n')}\`;
            promptPayload.systemPrompt = \`\${promptPayload.systemPrompt}\${block}\`;
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
            player: normalizePlayer(playerRepo.get(playerId)),
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
`
writeFileSync('src/api/controllers/tickController.ts', newController);
