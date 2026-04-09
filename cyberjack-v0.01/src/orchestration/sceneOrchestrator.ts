import {
    TickBundle,
    OrchestratedTurn,
    ActorDecision,
    NarratorDecision,
    CharacterRelation
} from '../domain/types';
import { activeConfig } from '../prompts/config';
import { activeContextsRepo, presetRepo, resourceRepo, subjectRepo, characterRelationRepo, sceneCharacterRepo } from '../infrastructure/repositories';

const normalize = (value: number, min = 0, max = 100) => {
    if (max === min) return 0;
    const clamped = Math.min(Math.max(value, min), max);
    return (clamped - min) / (max - min);
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function sampleProbability(prob: number): boolean {
    return Math.random() < prob;
}

function describeTone(attitude?: number): string {
    if (typeof attitude !== 'number') return 'neutral';
    if (attitude >= 70) return 'warm';
    if (attitude <= 30) return 'hostile';
    return 'neutral';
}

function relationTo(targetId: string, relations: CharacterRelation[]): CharacterRelation | undefined {
    return relations.find(rel => rel.target?.id === targetId || rel.toId === targetId);
}

export function orchestrateSceneActors(bundle: TickBundle): OrchestratedTurn {
    const cfg = activeConfig.orchestrator;
    const prompt = bundle.prompt;
    const relations = prompt.relations || [];
    const actorDecisions: ActorDecision[] = [];
    const subjectId = bundle.event.subjectId;

    const relationMap = new Map<string, CharacterRelation>();
    relations.forEach(rel => {
        if (rel.target?.id) relationMap.set(rel.target.id, rel);
    });

    const eventSceneId = bundle.event.sceneId || 'lab';
    const presentChars = sceneCharacterRepo.list(eventSceneId);
    
    const presentSubjectIds = presentChars
        .filter(pc => pc.presenceState === 'present' && pc.canAct && pc.character.subjectId)
        .map(pc => pc.character.subjectId as string);

    const allActors = Array.from(new Set([
        subjectId,
        ...presentSubjectIds,
        ...relations
            .filter(rel => rel.target?.subjectId && rel.present)
            .map(rel => rel.target!.subjectId!)
    ]));

    const lastActionIntensity = clamp01(bundle.compiledAction.intensity ?? 0);
    const lastActionNovelty = clamp01(bundle.compiledAction.novelty ?? 1); // If no novelty, assume 1 (new action)
    const activeContextIds = activeContextsRepo.getAllForSubject(bundle.event.subjectId || 'S-01');
    const activeContextLabels = activeContextIds
        .map(ctx => presetRepo.getActionPreset(ctx.actionId)?.label)
        .filter(Boolean);

    const isVerbalInput = bundle.event.type === 'verbal_input';
    const playerId = bundle.event.playerId || 'PL-1';
    const playerState = resourceRepo.get(playerId);

    for (const actorId of allActors) {
        let core = actorId === subjectId ? bundle.stateAfter.core : bundle.stateBefore.core;
        let relationToCalibrator = relationMap.get(bundle.event.playerId || 'PL-1');
        let peerRelations = relations.filter(rel => rel.target?.subjectId && rel.target.subjectId !== actorId);

        if (actorId !== subjectId) {
            const externalCore = subjectRepo.get(actorId);
            if (externalCore) core = externalCore;
            
            const actorRelations = characterRelationRepo.listFor(actorId);
            relationToCalibrator = actorRelations.find(r => r.target?.id === (bundle.event.playerId || 'PL-1'));
            peerRelations = actorRelations.filter(rel => rel.target?.subjectId && rel.target.subjectId !== actorId);
        }

        const relationNorm = relationToCalibrator ? normalize(relationToCalibrator.attitude ?? 50) : 0.5;
        const sensitivityNorm = normalize(core?.sensitivity ?? 50);
        const capacityNorm = normalize(core?.capacity ?? 50);
        const peerNorm = peerRelations.length
            ? peerRelations.reduce((sum, rel) => sum + normalize(rel.attitude ?? 50), 0) / peerRelations.length
            : 0.5;
        const contextBonus = activeContextLabels.length ? cfg.contextModifier : 0;
        const opennessNorm = normalize(core?.openness ?? 50);
        const resourceValue = Math.max(0, playerState?.resources?.credits ?? 0);
        const resourceScale = cfg.resourceScale || 100;
        const resourceNorm = normalize(resourceValue, 0, resourceScale);

        // Смягчаем штраф за отсутствие новизны: максимум снижение на 50%, а не до нуля.
        const noveltyFactor = isVerbalInput ? 1.0 : (0.5 + 0.5 * lastActionNovelty);

        const reactiveProb = clamp01(
            cfg.baseReactiveProbability * noveltyFactor +
                cfg.sensitivityModifier * (1 - capacityNorm) * noveltyFactor +
                cfg.attitudeModifier * (1 - relationNorm) * noveltyFactor +
                cfg.intensityModifier * lastActionIntensity * noveltyFactor +
                cfg.contextModifier * contextBonus +
                cfg.opennessModifier * opennessNorm +
                cfg.resourceModifier * resourceNorm +
                (isVerbalInput ? cfg.verbalReactiveBoost : 0)
        );

        const proactiveProb = clamp01(
            cfg.baseProactiveProbability +
                cfg.attitudeModifier * relationNorm +
                cfg.sensitivityModifier * sensitivityNorm +
                cfg.peerModifier * peerNorm +
                cfg.contextModifier * contextBonus
        );

        if (sampleProbability(reactiveProb)) {
            actorDecisions.push({
                actorId,
                kind: 'reactive',
                reason: describeTone(relationToCalibrator?.attitude)
            });
        } else if (sampleProbability(proactiveProb)) {
            actorDecisions.push({
                actorId,
                kind: 'proactive',
                reason: describeTone(relationToCalibrator?.attitude)
            });
        }
    }

    const narrator: NarratorDecision | undefined = prompt.narratorPrompt
        ? { enabled: true }
        : undefined;

    return {
        narrator,
        actorDecisions
    };
}

import { db } from '../infrastructure/db';
import { chatMemoryRepo } from '../infrastructure/repositories';
import { sendToSillyTavern, sendNarratorDescription } from '../adapters/sillyTavernAdapter';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import { recordMemoryEvent } from '../services/memoryLayer';
import { maybeSummarizeChat } from '../services/chatSummary';

export interface TurnExecutionParams {
    subjectId: string;
    eventId: string;
    actionId: string;
    actionLabel: string;
    pointLabel: string;
    pointIdUsed: string;
    autoUserMessage: string | null;
    actionLabelMessage: string | null;
    suppressTickIds?: string[];
    fullStateName: string;
    reqBodyInfoTag?: string;
    promptPayload: any;
}

export async function executeTurnConversations(bundle: TickBundle, params: TurnExecutionParams) {
    const {
        subjectId, eventId, actionId, actionLabel, pointLabel, pointIdUsed,
        autoUserMessage, actionLabelMessage, suppressTickIds, fullStateName, reqBodyInfoTag,
        promptPayload
    } = params;

    let actionRepeats = 1;
    if (actionId && !autoUserMessage) {
        const recentLogs = db.prepare('SELECT action_payload FROM event_logs WHERE subject_id = ? AND action_type = ? ORDER BY id DESC LIMIT 15').all(subjectId, 'interaction') as { action_payload: string }[];
        for (const row of recentLogs) {
            try {
                const parsed = JSON.parse(row.action_payload);
                const logActionId = parsed.presetId || parsed.actionId || parsed.action?.actionKey;
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
        historyMessage = `[Игрок (к ${fullStateName || subjectId})]: "${autoUserMessage}"`;
    } else if (actionLabelMessage) {
        let reactionPart = bundle.diagnostics?.reactionSummary && bundle.diagnostics.reactionSummary !== 'нейтральная реакция' 
            ? ` [Движок: ${bundle.diagnostics.reactionSummary}]` 
            : '';
        let sensoryPart = bundle.diagnostics?.actionSummary 
            ? ` [Мои сенсоры: это ощущается как ${bundle.diagnostics.actionSummary}]` 
            : '';
        historyMessage = `*(Без слов)* [Калибратор применяет воздействие к ${fullStateName || subjectId}: ${actionLabel} - точка ${pointLabel}]${sensoryPart}${reactionPart}`;
        if (actionRepeats > 1) {
            historyMessage += ` *(уже ${actionRepeats}-й раз подряд)*`;
        }
    }

    if (historyMessage.trim().length > 0) {
        chatMemoryRepo.append(subjectId, 'user', historyMessage);
    }

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
        const actorPromises = orchestration.actorDecisions.map(async (decision) => {
            let currentPayload = promptPayload;
            let currentHistory = chatHistory;
            let userMsgOverride = autoUserMessage || actionLabelMessage || undefined;
            if (narratorReaction) {
                userMsgOverride = userMsgOverride ? `${userMsgOverride}\n\n[Твоя физическая реакция (Рассказчик)]: ${narratorReaction}` : `[Твоя физическая реакция (Рассказчик)]: ${narratorReaction}`;
            }

            if (decision.actorId !== subjectId) {
                currentPayload = await buildPromptPayload(decision.actorId, subjectId, undefined, eventId, {
                    suppressTickIds
                });
                if (historyMessage && historyMessage.trim().length > 0) {
                    chatMemoryRepo.append(decision.actorId, 'user', historyMessage);
                }
                currentHistory = chatMemoryRepo.getRecent(decision.actorId, 10).map(entry => ({
                    role: entry.role,
                    content: entry.content
                }));
                let observerOverride = autoUserMessage || actionLabelMessage || undefined;
                if (narratorReaction) {
                    observerOverride = observerOverride ? `${observerOverride}\n\n[Общая сцена - реакция ${subjectId} (Рассказчик)]: ${narratorReaction}` : `[Общая сцена - реакция ${subjectId} (Рассказчик)]: ${narratorReaction}`;
                }
                userMsgOverride = observerOverride;
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

            return { decision, structuredReply, sentMessages };
        });

        const results = await Promise.all(actorPromises);

        for (const { decision, structuredReply, sentMessages } of results) {
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
        infoTag: reqBodyInfoTag,
        reactionText: primaryReply?.reaction || narratorReaction || ''
    });
    maybeSummarizeChat(subjectId);

    return {
        reply: primaryReply,
        promptMessages,
        actorReplies,
        narratorReaction
    };
}
