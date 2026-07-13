import { runGameTick } from './runGameTick';
import {
    TickBundle,
    OrchestratedTurn,
    ActorDecision,
    NarratorDecision,
    CharacterRelation,
    ScenePromptPayload
} from '../domain/types';
import { activeConfig } from '../prompts/config';
import { activeContextsRepo, presetRepo, resourceRepo, subjectRepo, characterRelationRepo, sceneCharacterRepo, pointStateRepo, sceneRepo, characterRepo } from '../infrastructure/repositories';
import { ActionScorer } from './actionScorer';
import { appendJsonLog } from '../utils/fileLogs';
import { explainPromptLog, explainOrchestratorDecision } from '../utils/logExplainers';
import { getActiveContextLabel } from '../domain/contextPresentation';

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
        .map(ctx => getActiveContextLabel(presetRepo.getActionPreset(ctx.actionId), ctx.actionId))
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

        // Инициатива уместна в свободный тик/паузу. На конкретное действие игрока
        // персонаж сначала реагирует, а не перебивает его случайным новым действием.
        let becameProactive = false;
        const initiativeWindow = bundle.compiledAction.actionKey === 'wait' || bundle.event.type === 'system_tick';
        if (initiativeWindow && sampleProbability(effectiveProactiveProb)) {
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
        const hasMajorTransition = Boolean(bundle.diagnostics?.observation?.transitions?.length);
        const externallySignificant = (bundle.output.result.overload || 0) > 10 || hasMajorTransition;
        const shouldReact = isTarget || (isVerbalInput ? reactiveProb >= 0.15 : externallySignificant && reactiveProb >= 0.08);
        if (!becameProactive && shouldReact) {
            actorDecisions.push({
                actorId,
                kind: 'reactive',
                reason: describeTone(relationToCalibrator?.attitude)
            });
        }
    }
    // Не превращаем один тик в хор: цель события и максимум один наблюдатель.
    const targetDecisions = actorDecisions.filter(decision => decision.actorId === subjectId);
    const observerDecisions = actorDecisions.filter(decision => decision.actorId !== subjectId).slice(0, 1);
    actorDecisions.splice(0, actorDecisions.length, ...targetDecisions, ...observerDecisions);

    const narrator: NarratorDecision | undefined = prompt.narratorPrompt
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
import { generateCharacterReply, generateNarratorReply, generateSceneForCharacter } from '../adapters/llmAdapter';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import { recordMemoryEvent } from '../services/memoryLayer';
import { buildReactionTurnMessage } from '../narrative/reactionFrame';

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

    let actionRepeats = 0;
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
    }
    // Dialogue memory stores literal speech only; mechanical events are episodes.
    if (autoUserMessage?.trim()) chatMemoryRepo.append(subjectId, 'user', autoUserMessage.trim());

    const chatHistory = chatMemoryRepo.getRecent(subjectId, 12)
        .filter(entry => !/^\[Текущий контакт\]|^\*\(Без слов\)\*|^\[Игрок \(/.test(entry.content))
        .slice(-6)
        .map(entry => ({ role: entry.role, content: entry.content }));

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

    // ── Narrator A: compressed sensory scene for the character ──
    // Generated BEFORE character speech, injected into character's prompt
    const activeContextIds = activeContextsRepo.getAllForSubject(subjectId);
    const activeContextLabels = activeContextIds
        .map((c: any) => getActiveContextLabel(presetRepo.getActionPreset(c.actionId), c.actionId))
        .filter(Boolean);
    let sceneForChar: string | null = null;
    if (orchestration.narrator?.enabled) {
        const tickResult = bundle.output?.result;
        const tickResultText = tickResult
            ? `Удовольствие: ${tickResult.pleasure?.toFixed(1)}, дискомфорт: ${tickResult.discomfort?.toFixed(1)}, перегрузка: ${tickResult.overload?.toFixed(1)}, вовлечённость: ${tickResult.engagement?.toFixed(1)}`
            : '';
        const stateText = `Чувствительность: ${bundle.stateAfter.core.sensitivity?.toFixed(0)}, выносливость: ${bundle.stateAfter.core.capacity?.toFixed(0)}, напряжение: ${bundle.stateAfter.core.tension?.toFixed(0)}`;
        const contextsText = activeContextLabels.length
            ? `Активные состояния: ${activeContextLabels.join(', ')}`
            : '';
        const scenePrompt: ScenePromptPayload = {
            subjectId,
            actionLabel,
            pointLabel,
            actorName: 'Калибратор',
            targetName: fullStateName || subjectId,
            stateText,
            contextsText,
            tickResultText
        };
        try {
            const sceneRes = await generateSceneForCharacter(scenePrompt);
            sceneForChar = sceneRes?.reaction || null;
        } catch (e) {
            console.error('[Scene A] failed:', e);
        }
    }

    const actorReplies: Array<{ actorId: string; kind: string; tone?: string; speech: string; speechAct?: string; addressedTo?: string; reaction: string }> = [];
    let primaryReply: { speech: string; speechAct?: string; addressedTo?: string; reaction: string } | null = null;
    let promptMessages: any = null;

    if (orchestration.actorDecisions.length) {
        const actorPromises = orchestration.actorDecisions.map(async (decision) => {
            let currentPayload = promptPayload;
            let currentHistory = chatHistory;
            let userMsgOverride = currentPayload.reactionFrame
                ? buildReactionTurnMessage(currentPayload.reactionFrame)
                : autoUserMessage || actionLabelMessage || undefined;
            if (autoUserMessage) userMsgOverride = `${userMsgOverride || ''}\n\n[Слова адресата]\n«${autoUserMessage}»`;

            // Inject Narrator A (sensory scene) into the character's prompt
            if (sceneForChar) {
                userMsgOverride = userMsgOverride
                    ? `${userMsgOverride}\n\n[Твоё телесное восприятие]: ${sceneForChar}`
                    : `[Твоё телесное восприятие]: ${sceneForChar}`;
            }

            if (decision.actorId !== subjectId) {
                currentPayload = await buildPromptPayload(decision.actorId, subjectId, bundle.output, eventId, {
                    suppressTickIds,
                    initiatorId: bundle.event.playerId || 'PL-1'
                });
                if (autoUserMessage?.trim()) chatMemoryRepo.append(decision.actorId, 'user', autoUserMessage.trim());
                currentHistory = chatMemoryRepo.getRecent(decision.actorId, 16)
                    .filter(entry => !/^\[Текущий контакт\]|^\*\(Без слов\)\*|^\[Игрок \(/.test(entry.content))
                    .slice(-8)
                    .map(entry => ({ role: entry.role, content: entry.content }));
                userMsgOverride = currentPayload.reactionFrame
                    ? buildReactionTurnMessage(currentPayload.reactionFrame)
                    : actionLabelMessage || undefined;
                if (autoUserMessage) userMsgOverride = `${userMsgOverride || ''}\n\n[Слова адресата]\n«${autoUserMessage}»`;
            }

            let structuredReply: { speech: string; speechAct?: string; addressedTo?: string } = { speech: '' };
            let sentMessages: any = null;

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
                ? (res.reply as { speech: string; speechAct?: string; addressedTo?: string })
                : { speech: String(res.reply || '') };

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
                try {
                    await runGameTick({
                        subjectId: decision.mechanicalAction.targetId || subjectId,
                        pointId: decision.mechanicalAction.pointId,
                        playerId: decision.actorId,
                        sceneId: eventId,
                        presetId: decision.mechanicalAction.actionId,
                        textMessage: structuredReply.speech
                    });
                    const actionLabel2 = presetRepo.getActionPreset(decision.mechanicalAction.actionId)?.label || decision.mechanicalAction.actionId;
                    const actorName = subjectRepo.get(decision.actorId)?.name || decision.actorId;
                    const tgtId = decision.mechanicalAction.targetId || subjectId;
                    const targetName = subjectRepo.get(tgtId)?.name || tgtId;
                    const pointLabel2 = presetRepo.getPointPreset(decision.mechanicalAction.pointId)?.label || decision.mechanicalAction.pointId;
                    const notice = `*(Сцена: ${actorName} применяет ${actionLabel2} к ${targetName} (${pointLabel2}))*`;
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
                speechAct: structuredReply.speechAct,
                addressedTo: structuredReply.addressedTo,
                reaction: sceneForChar || ''
            });

            if (decision.actorId === subjectId || !primaryReply) {
                primaryReply = { speech: structuredReply.speech, speechAct: structuredReply.speechAct, addressedTo: structuredReply.addressedTo, reaction: sceneForChar || '' };
                promptMessages = sentMessages;
            }

            if (structuredReply.speech) {
                chatMemoryRepo.append(decision.actorId, 'assistant', structuredReply.speech);
            }
        }
    } else {
        promptMessages = [];
    }

    // ── Narrator B: chronicle for chat (AFTER character speech) ──
    // Sees the action, tick result, character speech, and state
    let narratorReaction: string | null = null;
    if (orchestration.narrator?.enabled && promptPayload.narratorPrompt) {
        const tickResult = bundle.output?.result;
        const tickResultSummary = tickResult
            ? `Удовольствие: ${tickResult.pleasure?.toFixed(1)}, дискомфорт: ${tickResult.discomfort?.toFixed(1)}, перегрузка: ${tickResult.overload?.toFixed(1)}`
            : '';
        // Enrich narrator prompt with speech, contexts, and result
        promptPayload.narratorPrompt.characterSpeech = primaryReply?.speech || undefined;
        promptPayload.narratorPrompt.characterName = fullStateName || subjectId;
        promptPayload.narratorPrompt.playerSpeech = autoUserMessage || undefined;
        promptPayload.narratorPrompt.activeContexts = activeContextLabels.length ? activeContextLabels : undefined;

        // Add WHO is in each state so the narrator doesn't confuse subject vs player
        const subjectChar = characterRepo.get(bundle.event.subjectId || subjectId);
        const subjectNameForNarrator = subjectChar?.name || fullStateName || subjectId;
        const narratorPlayerId = bundle.event.playerId || 'PL-1';
        const playerChar = characterRepo.get(narratorPlayerId);
        const playerNameForNarrator = playerChar?.name || 'Калибратор';
        if (activeContextLabels.length) {
            promptPayload.narratorPrompt.activeContexts = activeContextLabels.map(label => `${subjectNameForNarrator}: ${label}`);
        }
        // Also include player's active contexts if any
        const playerContexts = activeContextsRepo.getAllForSubject(narratorPlayerId);
        if (playerContexts.length) {
            const playerContextLabels = playerContexts.map(ctx => getActiveContextLabel(presetRepo.getActionPreset(ctx.actionId), ctx.actionId)).filter(Boolean);
            if (playerContextLabels.length) {
                const existing = promptPayload.narratorPrompt.activeContexts || [];
                promptPayload.narratorPrompt.activeContexts = [...existing, ...playerContextLabels.map(label => `${playerNameForNarrator}: ${label}`)];
            }
        }
        promptPayload.narratorPrompt.tickResultSummary = tickResultSummary || undefined;
        promptPayload.narratorPrompt.systemEvents = (bundle as any).systemNotes?.length ? (bundle as any).systemNotes : undefined;

        try {
            const narratorRes = await generateNarratorReply(promptPayload.narratorPrompt);
            narratorReaction = narratorRes?.reaction || null;
        } catch (e) {
            console.error('[Narrator B] failed:', e);
        }
    }

    // Update reactions in replies with narrator B text
    if (narratorReaction) {
        for (const ar of actorReplies) {
            ar.reaction = narratorReaction;
        }
        if (primaryReply) {
            primaryReply.reaction = narratorReaction;
        }
    }

    recordMemoryEvent({
        subjectId,
        bundle,
        userText: autoUserMessage || undefined,
        assistantText: primaryReply?.speech || '',
        infoTag: reqBodyInfoTag,
        reactionText: narratorReaction || sceneForChar || '',
        speechAct: primaryReply?.speechAct,
        addressedTo: primaryReply?.addressedTo
    });

    return {
        reply: primaryReply,
        promptMessages,
        actorReplies,
        narratorReaction
    };
}
