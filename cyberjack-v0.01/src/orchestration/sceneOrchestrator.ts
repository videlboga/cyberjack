import { runGameTick } from './runGameTick';
import {
    TickBundle,
    OrchestratedTurn,
    ActorDecision,
    NarratorDecision,
    CharacterRelation
} from '../domain/types';
import { activeConfig } from '../prompts/config';
import { activeContextsRepo, presetRepo, resourceRepo, subjectRepo, characterRelationRepo, sceneCharacterRepo, pointStateRepo, sceneRepo, characterRepo } from '../infrastructure/repositories';
import { ActionScorer } from './actionScorer';
import { appendJsonLog } from '../utils/fileLogs';
import { explainPromptLog, explainOrchestratorDecision } from '../utils/logExplainers';

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
    if (typeof attitude !== 'number') return 'нейтральный тон';
    if (attitude >= 90) return 'крайне теплый, с искренней привязанностью';
    if (attitude >= 75) return 'теплый, с явной симпатией';
    if (attitude >= 60) return 'дружелюбный и приятный';
    if (attitude >= 40) return 'ровный и нейтральный';
    if (attitude >= 25) return 'холодный, с нотками недоверия и раздражения';
    if (attitude >= 10) return 'враждебный и презрительный';
    return 'крайне агрессивный, продиктованный лютой ненавистью';
}

function relationTo(targetId: string, relations: CharacterRelation[]): CharacterRelation | undefined {
    return relations.find(rel => rel.target?.id === targetId || rel.toId === targetId);
}

export function orchestrateSceneActors(bundle: TickBundle): OrchestratedTurn {
    const cfg = activeConfig.orchestrator;
    const prompt = bundle.prompt;
    const relations = prompt.relations || [];
    const actorDecisions: ActorDecision[] = [];
    const actorDiagnostics: Array<any> = [];
    const subjectId = bundle.event.subjectId;

    const relationMap = new Map<string, CharacterRelation>();
    relations.forEach(rel => {
        if (rel.target?.id) relationMap.set(rel.target.id, rel);
    });

    const eventSceneId = bundle.event.sceneId || 'scene_lab_calibrator';
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
        if (actorId === playerId || actorId === 'C-Gamma') continue; // Игрок и Калибратор не участвуют в автоматических бросках
        const actorChar = characterRepo.get(actorId);
        if (actorChar && (actorChar.playerId === playerId || (actorChar.kind as any) === 'calibrator' || (actorChar as any).profile?.base?.status === 'calibrator')) continue;

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
        const playerCredits = playerState?.resources?.credits?.amount ?? playerState?.resources?.credits ?? 0;
        const resourceValue = Math.max(0, Number(playerCredits));
        const resourceScale = cfg.resourceScale || 100;
        const resourceNorm = normalize(resourceValue, 0, resourceScale);

        // Смягчаем штраф за отсутствие новизны: снижение максимум на 20%, чтобы персонажи чаще отвечали.
        const noveltyFactor = isVerbalInput ? 1.0 : (0.8 + 0.2 * lastActionNovelty);

        // Наблюдатели вмешиваются реже. Если это слова к кому-то другому — штраф больше.
        const isTarget = (actorId === subjectId);
        const observerPenalty = isTarget ? 1.0 : (isVerbalInput ? 0.2 : 0.1);        const reactiveProb = clamp01(
            (cfg.baseReactiveProbability * noveltyFactor +
                cfg.sensitivityModifier * (1 - capacityNorm) * noveltyFactor +
                cfg.attitudeModifier * (1 - relationNorm) * noveltyFactor +
                cfg.intensityModifier * lastActionIntensity * noveltyFactor +
                cfg.contextModifier * contextBonus +
                cfg.opennessModifier * opennessNorm +
                cfg.resourceModifier * resourceNorm +
                (isVerbalInput ? cfg.verbalReactiveBoost : 0)) * observerPenalty
        );

        const proactiveProb = clamp01(
            (cfg.baseProactiveProbability +
                cfg.attitudeModifier * relationNorm +
                cfg.sensitivityModifier * sensitivityNorm +
                cfg.peerModifier * peerNorm +
                cfg.contextModifier * contextBonus) * observerPenalty
        );

        // Чем меньше AP, тем ниже шанс проявить инициативу.
        const actorResources = resourceRepo.get(actorId);
        let apNorm = 1;
        if (actorResources && actorResources.resources) {
            const curAP = Number(actorResources.resources.actionPoints ?? 100);
            const maxAP = Number(actorResources.resources.maxActionPoints ?? 100);
            apNorm = clamp01(curAP / Math.max(1, maxAP));
        }

        const effectiveProactiveProb = proactiveProb * apNorm;

        // push diagnostics for this actor (recorded even if no decision made)
        actorDiagnostics.push({
            actorId,
            isTarget,
            reactiveProb,
            proactiveProb,
            apNorm,
            effectiveProactiveProb
        });

        // Пытаемся сначала сделать проактивное действие
        let becameProactive = false;
        if (sampleProbability(effectiveProactiveProb)) {
            // Если персонаж хочет действовать проактивно, узнаем ЧТО он хочет сделать
            let proactiveReason = describeTone(relationToCalibrator?.attitude);
            let decidedAction = undefined;

            if (actorId !== playerId) {
                // Пытаемся найти лучшую цель из присутствующих
                const possibleTargets = presentSubjectIds.filter(id => id !== actorId);
                const targetId = possibleTargets.length > 0
                    ? possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
                    : (actorId === subjectId ? playerId : subjectId);
                
                if (targetId) {
                    const targetRelation = characterRelationRepo.get(actorId, targetId);
                    proactiveReason = describeTone(targetRelation?.attitude || relationToCalibrator?.attitude);
                    
                    const targetPointRecords = pointStateRepo.getAllForSubject(targetId);
                    const targetPoints = targetPointRecords.map(p => p.pointId);
                    if (targetPoints.length === 0) targetPoints.push('systemic');
                    
                    const actions = ActionScorer.scoreAvailableActions(eventSceneId, actorId, targetId, targetPoints);
                    
                    const scene = sceneRepo.get(eventSceneId);
                    const actorResources = resourceRepo.get(actorId);
                    
                    const affordable = actions.filter(a => {
                        const sceneCost = scene?.actionCosts?.[a.actionId];
                        let requiredAP = 0;
                        if (sceneCost) {
                            const costRecord = (sceneCost as any).consume || sceneCost;
                            requiredAP = Number(costRecord.actionPoints ?? costRecord.ap ?? costRecord.apCost ?? costRecord.action_points ?? 0);
                        }
                        const curAP = Number(actorResources?.resources?.actionPoints ?? 100);
                        return !(requiredAP > 0 && curAP < requiredAP);
                    });
                    
                    const bestAction = affordable.find(a => a.score > -20); // Лояльнее смотрим на действия - даже если штрафы за барьеры, могут быть триггеры
                    if (bestAction) {
                        const targetChar = subjectRepo.get(targetId);
                        const targetName = targetChar?.name || targetId;
                        const preset = presetRepo.getActionPreset(bestAction.actionId);
                        
                        decidedAction = { ...bestAction, targetId };
                        proactiveReason = `Отношение к ${targetName}: ${proactiveReason}. Цель инициативы: применить действие "${preset?.label || bestAction.actionId}" к анатомической зоне "${bestAction.pointId}" персонажа ${targetName} (Мотивация: ${Math.round(bestAction.score)})`;
                        becameProactive = true;
                    }
                }
            }

            if (becameProactive) {
                actorDecisions.push({
                    actorId,
                    kind: 'proactive',
                    reason: proactiveReason,
                    mechanicalAction: decidedAction
                });
            }
        }

        // Если не проактивны (или не смогли найти действие), пробуем отреагировать репликой
        if (!becameProactive && sampleProbability(reactiveProb)) {
            actorDecisions.push({
                actorId,
                kind: 'reactive',
                reason: describeTone(relationToCalibrator?.attitude)
            });
        }
    }    const narrator: NarratorDecision | undefined = prompt.narratorPrompt
        ? { enabled: true }
        : undefined;

    return {
        narrator,
        actorDecisions
        , diagnostics: actorDiagnostics
    };
}

import { db } from '../infrastructure/db';
import { chatMemoryRepo } from '../infrastructure/repositories';
import { generateCharacterReply, generateNarratorReply } from '../adapters/llmAdapter';
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
        
        const actionPayloadStr = (bundle.event as any)?.action_payload;
        const rawActor = typeof actionPayloadStr === 'string' ? JSON.parse(actionPayloadStr)?.actorName : null;
        const actorNameForHistory = rawActor || 'Игрок';
        historyMessage = `*(Без слов)* [${actorNameForHistory} применяет воздействие к ${fullStateName || subjectId}: ${actionLabel} - точка ${pointLabel}]${sensoryPart}${reactionPart}`;
        if (actionRepeats > 1) {
            historyMessage += ` *(уже ${actionRepeats}-й раз подряд)*`;
        }
    }    if (historyMessage.trim().length > 0) {
        chatMemoryRepo.append(subjectId, 'user', historyMessage);
    }

    const chatHistory = chatMemoryRepo.getRecent(subjectId, 10).map(entry => ({
        role: entry.role,
        content: entry.content
    }));

    const orchestration = orchestrateSceneActors(bundle);

    // Quick instrumentation: ensure a minimal orchestration record is written (helps guarantee file exists)
    try {
        appendJsonLog('orchestrator_decisions.jsonl', {
            ts: new Date().toISOString(),
            sceneId: eventId,
            subjectId,
            actorCount: orchestration.actorDecisions.length,
            narrator: !!orchestration.narrator,
            explanationRu: `Оркестрация: найдено ${orchestration.actorDecisions.length} решений${orchestration.narrator ? ', рассказчик активен' : ''}`
        });
    } catch (e) { /* ignore */ }

    // Also write the full orchestration object (decisions + reasons) for detailed analysis
    try {
        const summaryDecisions = orchestration.actorDecisions.map(d => ({
            actorId: d.actorId,
            kind: d.kind,
            reason: d.reason,
            mechanicalAction: d.mechanicalAction ? {
                actionId: (d.mechanicalAction as any).actionId || (d.mechanicalAction as any).action || null,
                pointId: (d.mechanicalAction as any).pointId || (d.mechanicalAction as any).point || null,
                targetId: (d.mechanicalAction as any).targetId || (d.mechanicalAction as any).target || null,
                score: (d.mechanicalAction as any).score || null
            } : null
        }));
        appendJsonLog('orchestrator_decisions.jsonl', {
            ts: new Date().toISOString(),
            tickId: bundle.tickId,
            eventId,
            sceneId: eventId,
            subjectId,
            narrator: !!orchestration.narrator,
            decisions: summaryDecisions,
            diagnostics: orchestration.diagnostics || [],
            explanationRu: explainOrchestratorDecision({ tickId: bundle.tickId, sceneId: eventId, subjectId, decisions: summaryDecisions })
        });
    } catch (e) { /* ignore */ }

    if (actionId === 'wait') {
        const hasProactive = orchestration.actorDecisions.some(d => d.kind === 'proactive');
        if (!hasProactive) {
            orchestration.actorDecisions = [];
        } else {
            orchestration.actorDecisions = orchestration.actorDecisions.filter(d => d.kind === 'proactive');
        }
        if (orchestration.narrator) {
            orchestration.narrator.enabled = false;
        }
    }

    let narratorReaction: string | null = null;
    if (orchestration.narrator?.enabled && promptPayload.narratorPrompt) {
        const narratorRes = await generateNarratorReply(promptPayload.narratorPrompt);
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
                currentPayload = await buildPromptPayload(decision.actorId, decision.actorId, undefined, eventId, {
                    suppressTickIds
                });
                if (historyMessage && historyMessage.trim().length > 0) {
                    chatMemoryRepo.append(decision.actorId, 'user', historyMessage);
                }
                currentHistory = chatMemoryRepo.getRecent(decision.actorId, 10).map(entry => ({
                    role: entry.role,
                    content: entry.content
                }));
                let observerOverride = historyMessage || actionLabelMessage || undefined;
                if (narratorReaction) {
                    observerOverride = observerOverride ? `${observerOverride}\n\n[Общая сцена - реакция ${subjectId} (Рассказчик)]: ${narratorReaction}` : `[Общая сцена - реакция ${subjectId} (Рассказчик)]: ${narratorReaction}`;
                }
                userMsgOverride = observerOverride;
            }

            let structuredReply = { speech: '' };
            let sentMessages: any = null;

            // Log the prompt payload that will be sent to the LLM for this actor
            try {
                appendJsonLog('prompt_payloads.jsonl', {
                    tickId: bundle.event.id || null,
                    sceneId: eventId,
                    actorId: decision.actorId,
                    kind: decision.kind,
                    prompt: currentPayload,
                    userMsgOverride,
                    explanationRu: explainPromptLog({ tickId: bundle.event.id || null, forSubject: decision.actorId, sceneId: eventId, prompt: currentPayload })
                });
            } catch (e) { /* ignore */ }

            if (decision.kind === "proactive" && decision.reason) {
                userMsgOverride = userMsgOverride 
                    ? `${userMsgOverride}\n\n[Твоя инициатива]: ${decision.reason}. Ответь сообразно этому намерению.`
                    : `[Твоя инициатива]: ${decision.reason}. Ответь сообразно этому намерению.`;
            }

            const res = await generateCharacterReply(
                currentPayload,
                userMsgOverride,
                currentHistory
            );
            sentMessages = res.sentMessages;
            structuredReply = res.reply && typeof res.reply === 'object'
                ? (res.reply as { speech: string })
                : { speech: String(res.reply || '') };

            // Log the LLM response for this actor
            try {
                appendJsonLog('prompt_payloads.jsonl', {
                    tickId: bundle.event.id || null,
                    sceneId: eventId,
                    actorId: decision.actorId,
                    kind: decision.kind,
                    response: structuredReply,
                    sentMessages,
                    explanationRu: `LLM-ответ для ${decision.actorId}: ${String(structuredReply.speech || '').slice(0,200)}`
                });
            } catch (e) { /* ignore */ }


            return { decision, structuredReply, sentMessages };
        });

        const results = await Promise.all(actorPromises);

        for (const { decision, structuredReply, sentMessages } of results) {
            if (decision.kind === 'proactive' && decision.mechanicalAction) {
                // Execute the mechanical game tick for the proactive action
                try {
                    await runGameTick({
                        subjectId: decision.mechanicalAction.targetId || subjectId,
                        pointId: decision.mechanicalAction.pointId,
                        playerId: decision.actorId,
                        sceneId: eventId,
                        presetId: decision.mechanicalAction.actionId,
                        textMessage: structuredReply.speech
                    });
                    const actionLabel = presetRepo.getActionPreset(decision.mechanicalAction.actionId)?.label || decision.mechanicalAction.actionId;
                    const actorName = subjectRepo.get(decision.actorId)?.name || decision.actorId;
                    const tgtId = decision.mechanicalAction.targetId || subjectId;
                    const targetName = subjectRepo.get(tgtId)?.name || tgtId;
                    const pointLabel = presetRepo.getPointPreset(decision.mechanicalAction.pointId)?.label || decision.mechanicalAction.pointId;
                    const notice = `*(Сцена: ${actorName} применяет ${actionLabel} к ${targetName} (${pointLabel}))*`;
                    
                    if (tgtId !== decision.actorId) {
                        chatMemoryRepo.append(tgtId, 'user', notice);
                    }
                    chatMemoryRepo.append(decision.actorId, 'user', notice);

                } catch (err) {
                    console.error('Failed to run proactive tick for NPC:', err);
                }
            }

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
