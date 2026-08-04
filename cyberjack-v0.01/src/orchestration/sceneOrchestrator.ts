import { runGameTick } from './runGameTick';
import { TickBundle, OrchestratedTurn, ActorDecision, NarratorDecision, CharacterRelation, ScenePromptPayload } from '../domain/types';
import { activeConfig } from '../prompts/config';
import { activeContextsRepo, presetRepo, resourceRepo, subjectRepo, characterRelationRepo, sceneCharacterRepo, pointStateRepo, sceneRepo, characterRepo } from '../infrastructure/repositories';
import { ActionScorer } from './actionScorer';
import { appendJsonLog } from '../utils/fileLogs';
import { explainPromptLog, explainOrchestratorDecision } from '../utils/logExplainers';
import { getActiveContextLabel, getActiveContextPromptText } from '../domain/contextPresentation';
import { getLaboratorySpatialContext } from '../scenario/spatialContext';
import { OVERLOAD_NOTICEABLE } from '../domain/overloadScale';
import { resolvePortraitEmotion } from '../domain/portraitEmotion';

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

export function orchestrateSceneActors(bundle: TickBundle, directedActorId?: string): OrchestratedTurn {
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
    const spatial = eventSceneId === 'scene_lab_calibrator' ? getLaboratorySpatialContext(subjectId, bundle.event.playerId || 'PL-1') : null;
    const spatialIds = spatial ? new Set(spatial.characterIds) : null;
    const presentSubjectIds = presentChars
        .filter(pc => pc.presenceState === 'present' && pc.canAct && pc.character.subjectId)
        .filter(pc => !spatialIds || spatialIds.has(pc.character.id))
        .map(pc => pc.character.subjectId as string);
    const presenceBySubject = new Map(presentChars.filter(pc => pc.character.subjectId).map(pc => [pc.character.subjectId as string, pc]));
    const laboratoryStatus = new Map(
        (
            db
                .prepare(
                    `
        SELECT character_id, status
        FROM laboratory_room_assignments
        WHERE player_id = ?
    `
                )
                .all(bundle.event.playerId || 'PL-1') as Array<{
                character_id: string;
                status: string;
            }>
        ).map(row => [row.character_id, row.status])
    );

    const allActors = Array.from(new Set([subjectId, ...presentSubjectIds, ...(spatial ? [] : relations.filter(rel => rel.target?.subjectId && rel.present).map(rel => rel.target!.subjectId!))]));

    const lastActionIntensity = clamp01(bundle.compiledAction.intensity ?? 0);
    const lastActionNovelty = clamp01(bundle.compiledAction.novelty ?? 1); // If no novelty, assume 1 (new action)
    const activeContextIds = activeContextsRepo.getAllForSubject(bundle.event.subjectId || 'S-01');
    const activeContextLabels = activeContextIds.map(ctx => getActiveContextPromptText(presetRepo.getActionPreset(ctx.actionId), ctx.actionId)).filter(Boolean);

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
        const peerNorm = peerRelations.length ? peerRelations.reduce((sum, rel) => sum + normalize(rel.attitude ?? 50), 0) / peerRelations.length : 0.5;
        const contextBonus = activeContextLabels.length ? cfg.contextModifier : 0;
        const opennessNorm = normalize(core?.openness ?? 50);
        const playerCredits = playerState?.resources?.credits?.amount ?? playerState?.resources?.credits ?? 0;
        const resourceValue = Math.max(0, Number(playerCredits));
        const resourceScale = cfg.resourceScale || 100;
        const resourceNorm = normalize(resourceValue, 0, resourceScale);

        // Смягчаем штраф за отсутствие новизны: снижение максимум на 20%, чтобы персонажи чаще отвечали.
        const noveltyFactor = isVerbalInput ? 1.0 : 0.8 + 0.2 * lastActionNovelty;

        // Наблюдатели вмешиваются реже. Если это слова к кому-то другому — штраф больше.
        const isTarget = actorId === (directedActorId || subjectId);
        const observerPenalty = isTarget ? 1.0 : directedActorId && isVerbalInput ? 0 : isVerbalInput ? 0.2 : 0.1;
        const reactiveProb = clamp01(
            (cfg.baseReactiveProbability * noveltyFactor +
                cfg.sensitivityModifier * (1 - capacityNorm) * noveltyFactor +
                cfg.attitudeModifier * (1 - relationNorm) * noveltyFactor +
                cfg.intensityModifier * lastActionIntensity * noveltyFactor +
                cfg.contextModifier * contextBonus +
                cfg.opennessModifier * opennessNorm +
                cfg.resourceModifier * resourceNorm +
                (isVerbalInput ? cfg.verbalReactiveBoost : 0)) *
                observerPenalty
        );

        const proactiveProb = clamp01(
            (cfg.baseProactiveProbability + cfg.attitudeModifier * relationNorm + cfg.sensitivityModifier * sensitivityNorm + cfg.peerModifier * peerNorm + cfg.contextModifier * contextBonus) *
                observerPenalty
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
        const actorPresence = presenceBySubject.get(actorId);
        const slotId = String(actorPresence?.slotId || '');
        const deviceBound = String(laboratoryStatus.get(actorId) || '').startsWith('device:');
        // Being audible in the same room is not the same as participating in
        // the procedure. Ambient occupants may observe significant events,
        // while autonomous physical initiatives require explicit proximity.
        const physicallyEngaged = isTarget || slotId.startsWith('near:');
        const canInitiatePhysicalAction = physicallyEngaged && !deviceBound;

        // push diagnostics for this actor (recorded even if no decision made)
        actorDiagnostics.push({
            actorId,
            isTarget,
            reactiveProb,
            proactiveProb,
            apNorm,
            effectiveProactiveProb,
            slotId,
            deviceBound,
            physicallyEngaged,
            canInitiatePhysicalAction
        });

        // Инициатива уместна в свободный тик/паузу. На конкретное действие игрока
        // персонаж сначала реагирует, а не перебивает его случайным новым действием.
        let becameProactive = false;
        const initiativeWindow = bundle.compiledAction.actionKey === 'wait' || bundle.event.type === 'system_tick';
        if (initiativeWindow && canInitiatePhysicalAction && sampleProbability(effectiveProactiveProb)) {
            // Если персонаж хочет действовать проактивно, узнаем ЧТО он хочет сделать
            let proactiveReason = describeTone(relationToCalibrator?.attitude);
            let decidedAction = undefined;

            if (actorId !== playerId) {
                // Пытаемся найти лучшую цель из присутствующих
                const possibleTargets = presentSubjectIds.filter(id => id !== actorId);
                const targetId = possibleTargets.length > 0 ? possibleTargets[Math.floor(Math.random() * possibleTargets.length)] : actorId === subjectId ? playerId : subjectId;

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
        const externallySignificant = (bundle.output.result.overload || 0) >= OVERLOAD_NOTICEABLE || hasMajorTransition;
        const reaction = bundle.diagnostics?.observation?.reaction;
        const reactionMagnitude = Math.max(Number(reaction?.pleasure || 0), Number(reaction?.discomfort || 0), Number(reaction?.overload || 0), Number(reaction?.engagement || 0) * 0.45);
        const frameRequiresSpeech = actorId === subjectId && Boolean(prompt.reactionFrame?.event.requiresSpeech);
        const meaningfulTargetMoment =
            isTarget &&
            (isVerbalInput || bundle.compiledAction.actionKey !== 'wait' || frameRequiresSpeech || externallySignificant || reactionMagnitude >= 12 || sampleProbability(reactiveProb * 0.3));
        const meaningfulObserverMoment =
            !isTarget &&
            // A line addressed to a specific character is not an invitation
            // for a nearby observer to answer in their place.
            (isVerbalInput ? !directedActorId && reactiveProb >= 0.15 : externallySignificant && reactiveProb >= 0.08);
        const shouldReact = meaningfulTargetMoment || meaningfulObserverMoment;
        if (!becameProactive && shouldReact) {
            actorDecisions.push({
                actorId,
                kind: 'reactive',
                reason: `${describeTone(relationToCalibrator?.attitude)}; значимость реакции ${reactionMagnitude.toFixed(1)}`
            });
        }
    }
    // Не превращаем один тик в хор: цель события и максимум один наблюдатель.
    const responseTargetId = directedActorId || subjectId;
    const targetDecisions = actorDecisions.filter(decision => decision.actorId === responseTargetId);
    const observerDecisions = actorDecisions.filter(decision => decision.actorId !== responseTargetId).slice(0, 1);
    actorDecisions.splice(0, actorDecisions.length, ...targetDecisions, ...observerDecisions);

    // Narrator generation is intentionally disabled. Character replies are enough
    // for interactive turns, while the two narrator passes add avoidable latency.
    const narrator: NarratorDecision | undefined = undefined;

    return {
        narrator,
        actorDecisions,
        diagnostics: actorDiagnostics
    };
}

import { db } from '../infrastructure/db';
import { chatMemoryRepo } from '../infrastructure/repositories';
import { generateCharacterReply, generateNarratorReply, generateSceneForCharacter } from '../adapters/llmAdapter';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import { recordMemoryEvent } from '../services/memoryLayer';
import { applyVerbalInputToFrame, buildReactionSystemPrompt, buildReactionTurnMessage } from '../narrative/reactionFrame';
import { deriveTelemetry, formatTelemetryForPrompt, formatVisibleConditionForPrompt } from '../narrative/telemetry';
import { buildPairedDialogueHistory } from '../narrative/dialogueHistory';
import { renderTemporalDialogue, selectCurrentDialogueSegment, TemporalDialogueEntry } from '../narrative/temporalDialogue';

function dialogueContextBeforeCurrent(history: TemporalDialogueEntry[], currentSpeech: string | undefined, speakerName: string, initiatorName = 'Калибратор') {
    const prior = [...history];
    if (currentSpeech && prior.at(-1)?.role === 'user' && prior.at(-1)?.content.trim() === currentSpeech.trim()) {
        prior.pop();
    }
    return renderTemporalDialogue(selectCurrentDialogueSegment(prior, 8), speakerName, initiatorName);
}

function historyWithoutDuplicatedCurrentInput(history: Array<{ role: 'user' | 'assistant'; content: string }>, currentSpeech?: string) {
    if (!currentSpeech || history.at(-1)?.role !== 'user' || history.at(-1)?.content.trim() !== currentSpeech.trim()) {
        return history;
    }
    return history.slice(0, -1);
}

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
    interactionContext?: string;
    directedActorId?: string;
    onToken?: (chunk: string, actorId: string) => void;
}

export async function executeTurnConversations(bundle: TickBundle, params: TurnExecutionParams) {
    const {
        subjectId,
        eventId,
        actionId,
        actionLabel,
        pointLabel,
        pointIdUsed,
        autoUserMessage,
        actionLabelMessage,
        suppressTickIds,
        fullStateName,
        reqBodyInfoTag,
        promptPayload,
        interactionContext,
        directedActorId,
        onToken
    } = params;
    const recentPhysicalPoint = (() => {
        const row = db.prepare(`SELECT action_payload FROM event_logs WHERE subject_id = ? AND action_type = 'interaction' ORDER BY id DESC LIMIT 12`).all(subjectId) as Array<{
            action_payload: string;
        }>;
        for (const item of row) {
            try {
                const point = String(JSON.parse(item.action_payload || '{}').pointId || '');
                if (point && point !== 'systemic') return point;
            } catch {}
        }
        return pointIdUsed;
    })();

    let actionRepeats = 0;
    if (actionId && !autoUserMessage) {
        const recentLogs = db.prepare('SELECT action_payload FROM event_logs WHERE subject_id = ? AND action_type = ? ORDER BY id DESC LIMIT 15').all(subjectId, 'interaction') as {
            action_payload: string;
        }[];
        for (const row of recentLogs) {
            try {
                const parsed = JSON.parse(row.action_payload);
                const logActionId = parsed.presetId || parsed.actionId || parsed.action?.actionKey;
                if (logActionId === actionId && parsed.pointId === pointIdUsed) {
                    actionRepeats++;
                } else {
                    break;
                }
            } catch {
                break;
            }
        }
    }

    let historyMessage = '';
    if (autoUserMessage) {
        historyMessage = `[Игрок (к ${fullStateName || subjectId})]: "${autoUserMessage}"`;
    } else if (actionLabelMessage) {
        let reactionPart = bundle.diagnostics?.reactionSummary && bundle.diagnostics.reactionSummary !== 'нейтральная реакция' ? ` [Движок: ${bundle.diagnostics.reactionSummary}]` : '';
        let sensoryPart = bundle.diagnostics?.actionSummary ? ` [Мои сенсоры: это ощущается как ${bundle.diagnostics.actionSummary}]` : '';

        const actionPayloadStr = (bundle.event as any)?.action_payload;
        const rawActor = typeof actionPayloadStr === 'string' ? JSON.parse(actionPayloadStr)?.actorName : null;
        const actorNameForHistory = rawActor || 'Игрок';
        historyMessage = `*(Без слов)* [${actorNameForHistory} применяет воздействие к ${fullStateName || subjectId}: ${actionLabel} - точка ${pointLabel}]${sensoryPart}${reactionPart}`;
        if (actionRepeats > 1) {
            historyMessage += ` *(уже ${actionRepeats}-й раз подряд)*`;
        }
    }
    // Dialogue memory stores literal speech only; mechanical events are episodes.
    const dialogueOwnerId = directedActorId || subjectId;
    if (autoUserMessage?.trim()) chatMemoryRepo.append(dialogueOwnerId, 'user', autoUserMessage.trim(), interactionContext);

    const chatHistory = buildPairedDialogueHistory(
        chatMemoryRepo
            .getRecent(dialogueOwnerId, 32)
            .filter(entry => !/^\[Текущий контакт\]|^\*\(Без слов\)\*|^\[Игрок \(/.test(entry.content))
            .slice(-16)
            .map(entry => ({ role: entry.role, content: entry.content, worldMinute: entry.worldMinute, contextLabel: entry.contextLabel }))
    );

    const orchestration = orchestrateSceneActors(bundle, directedActorId);

    // A direct utterance has one conversational addressee. Other present
    // characters may act proactively on their own ticks, but must not produce
    // a second "answer" to somebody else's question in the same turn.
    if (autoUserMessage?.trim() && directedActorId) {
        orchestration.actorDecisions = orchestration.actorDecisions.filter(
            decision => decision.actorId === directedActorId
        );
    }

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
    } catch (e) {
        /* ignore */
    }

    // Also write the full orchestration object (decisions + reasons) for detailed analysis
    try {
        const summaryDecisions = orchestration.actorDecisions.map(d => ({
            actorId: d.actorId,
            kind: d.kind,
            reason: d.reason,
            mechanicalAction: d.mechanicalAction
                ? {
                      actionId: (d.mechanicalAction as any).actionId || (d.mechanicalAction as any).action || null,
                      pointId: (d.mechanicalAction as any).pointId || (d.mechanicalAction as any).point || null,
                      targetId: (d.mechanicalAction as any).targetId || (d.mechanicalAction as any).target || null,
                      score: (d.mechanicalAction as any).score || null
                  }
                : null
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
            explanationRu: explainOrchestratorDecision({
                tickId: bundle.tickId,
                sceneId: eventId,
                subjectId,
                decisions: summaryDecisions
            })
        });
    } catch (e) {
        /* ignore */
    }

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
    const activeContextLabels = activeContextIds.map((c: any) => getActiveContextPromptText(presetRepo.getActionPreset(c.actionId), c.actionId)).filter(Boolean);
    let sceneForChar: string | null = null;
    // The reaction frame already contains authoritative sensory state. A
    // separate LLM paraphrase before character speech added an entire serial
    // request without new game information. It is opt-in for diagnostics only.
    if (orchestration.narrator?.enabled && process.env.LLM_SCENE_PREFACE === 'true') {
        const tickResult = bundle.output?.result;
        const tickResultText = tickResult
            ? `Удовольствие: ${tickResult.pleasure?.toFixed(1)}, дискомфорт: ${tickResult.discomfort?.toFixed(1)}, перегрузка: ${tickResult.overload?.toFixed(1)}, вовлечённость: ${tickResult.engagement?.toFixed(1)}`
            : '';
        const stateText = `Чувствительность: ${bundle.stateAfter.core.sensitivity?.toFixed(0)}, выносливость: ${bundle.stateAfter.core.capacity?.toFixed(0)}, напряжение: ${bundle.stateAfter.core.tension?.toFixed(0)}`;
        const contextsText = activeContextLabels.length ? `Активные состояния: ${activeContextLabels.join(', ')}` : '';
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

    const actorReplies: Array<{
        actorId: string;
        actorName: string;
        kind: string;
        tone?: string;
        speech: string;
        speechAct?: string;
        addressedTo?: string;
        reaction: string;
        portraitEmotion?: string;
    }> = [];
    let primaryReply: {
        speech: string;
        speechAct?: string;
        addressedTo?: string;
        reaction: string;
        portraitEmotion?: string;
    } | null = null;
    let promptMessages: any = null;
    const commandIntent = (bundle.metadata as any)?.commandIntent;
    const resumedPendingCommand = Boolean((bundle.compiledAction as any)?.resumedPendingCommand || (bundle.metadata as any)?.resumedPendingCommand);
    const hasParsedCommand = Boolean(commandIntent?.type && commandIntent.type !== 'none' && !resumedPendingCommand);
    const resolvedCommandActionLabel = commandIntent?.type === 'perform_action'
        ? presetRepo.getActionPreset(commandIntent.actionId)?.label || commandIntent.actionId
        : actionLabel;
    const systemNotes = Array.isArray((bundle as any).systemNotes) ? (bundle as any).systemNotes.filter((note: unknown): note is string => typeof note === 'string' && note.trim().length > 0) : [];

    // ── Commanded cross-character action ──
    // When the player orders an NPC to perform a physical action on another
    // character, runGameTick evaluates the NPC's compliance on itself (the
    // subject). If the compliance check passed (actionApplied), the actual
    // engine effects must be applied to the target character via a second
    // tick — exactly like the proactive NPC→NPC path below, but driven by
    // commandIntent instead of autonomous initiative.
    if (
        hasParsedCommand
        && commandIntent?.type === 'perform_action'
        && commandIntent.targetId
        && commandIntent.targetId !== subjectId
        && bundle.actionApplied
    ) {
        try {
            const targetCharName = subjectRepo.get(commandIntent.targetId)?.name || commandIntent.targetId;
            const executorName = subjectRepo.get(subjectId)?.name || subjectId;
            const cmdPreset = presetRepo.getActionPreset(commandIntent.actionId);
            const cmdActionLabel = cmdPreset?.label || commandIntent.actionId;
            const cmdPointLabel = presetRepo.getPointPreset(commandIntent.pointId)?.label || commandIntent.pointId;
            await runGameTick({
                subjectId: commandIntent.targetId,
                pointId: commandIntent.pointId,
                playerId: bundle.event.playerId || 'PL-1',
                actingCharacterId: subjectId,
                sceneId: eventId,
                presetId: commandIntent.actionId,
            });
            const notice = `*(Сцена: ${executorName} применяет ${cmdActionLabel} к ${targetCharName} (${cmdPointLabel}))*`;
            chatMemoryRepo.append(commandIntent.targetId, 'user', notice, interactionContext);
            chatMemoryRepo.append(subjectId, 'user', notice, interactionContext);
        } catch (err) {
            console.error('[SceneOrchestrator] Failed to run commanded cross-character tick:', err);
        }
    }

    if (orchestration.actorDecisions.length) {
        const actorPromises = orchestration.actorDecisions.map(async decision => {
            const responseTargetId = directedActorId || subjectId;
            const isResponseTarget = decision.actorId === responseTargetId;
            const isDirectedCommandActor = Boolean(autoUserMessage && hasParsedCommand && isResponseTarget);
            let currentPayload = promptPayload;
            let currentHistory = chatHistory;
            let userMsgOverride = currentPayload.reactionFrame ? buildReactionTurnMessage(currentPayload.reactionFrame) : autoUserMessage || actionLabelMessage || undefined;
            if (autoUserMessage) {
                userMsgOverride = isResponseTarget
                    ? `${userMsgOverride || ''}\n\n[Прямое обращение к тебе от Калибратора]\n«${autoUserMessage}»`
                    : `${userMsgOverride || ''}\n\n[Реплика Калибратора, обращённая к ${fullStateName || subjectId}, не к тебе]\n«${autoUserMessage}»`;
            }

            // Inject Narrator A (sensory scene) into the character's prompt
            if (sceneForChar) {
                userMsgOverride = userMsgOverride ? `${userMsgOverride}\n\n[Твоё телесное восприятие]: ${sceneForChar}` : `[Твоё телесное восприятие]: ${sceneForChar}`;
            }

            if (decision.actorId !== subjectId) {
                currentPayload = await buildPromptPayload(decision.actorId, subjectId, bundle.output, eventId, {
                    suppressTickIds,
                    initiatorId: bundle.event.playerId || 'PL-1'
                });
                if (autoUserMessage?.trim() && currentPayload.reactionFrame) {
                    // A routed command is not merely dialogue: its mechanical
                    // result has already been resolved by runGameTick. Preserve
                    // that event in the frame instead of replacing it with the
                    // generic "no physical action happened" verbal frame.
                    currentPayload.reactionFrame = isDirectedCommandActor
                        ? {
                              ...currentPayload.reactionFrame,
                              event: {
                                  ...currentPayload.reactionFrame.event,
                                  playerSpeech: autoUserMessage.trim()
                              },
                              dramaticPosition: bundle.actionApplied
                                  ? {
                                        primaryIntent: 'естественно подтвердить уже выполненное поручение или кратко сообщить его видимый результат',
                                        secondaryConflict: 'личное отношение может окрасить ответ, но действие уже произошло и не требует повторного согласования',
                                        preferredSpeechAct: 'comply',
                                        allowedSpeechActs: ['comply', 'report', 'acknowledge', 'tease', 'warn']
                                    }
                                  : {
                                        primaryIntent: 'сообщить, почему поручение не привело к новому действию',
                                        secondaryConflict: 'нужно различить невозможность, отказ и уже существовавшее состояние',
                                        preferredSpeechAct: 'report',
                                        allowedSpeechActs: ['report', 'answer', 'set_boundary', 'offer', 'silence']
                                    }
                          }
                        : applyVerbalInputToFrame(currentPayload.reactionFrame, autoUserMessage.trim());
                    currentPayload.reactionFrame.continuity.recentDialogue = dialogueContextBeforeCurrent(currentHistory, autoUserMessage, currentPayload.reactionFrame.speaker.name);
                    currentPayload.systemPrompt = buildReactionSystemPrompt(currentPayload.reactionFrame);
                }
                currentHistory = buildPairedDialogueHistory(
                    chatMemoryRepo
                        .getRecent(decision.actorId, 32)
                        .filter(entry => !/^\[Текущий контакт\]|^\*\(Без слов\)\*|^\[Игрок \(/.test(entry.content))
                        .slice(-16)
                        .map(entry => ({ role: entry.role, content: entry.content, worldMinute: entry.worldMinute, contextLabel: entry.contextLabel }))
                );
                currentHistory = historyWithoutDuplicatedCurrentInput(currentHistory, autoUserMessage);
                userMsgOverride = currentPayload.reactionFrame ? buildReactionTurnMessage(currentPayload.reactionFrame) : actionLabelMessage || undefined;
                if (autoUserMessage) {
                    const asksForTelemetry = /(состояни|показател|телеметр|оцени|рекоменду|что\s+с\s+(?:ней|ним)|как\s+(?:она|он|они)|пульс|дыхани|перегруз|вынослив)/i.test(autoUserMessage);
                    const observerRole = presenceBySubject.get(decision.actorId)?.role || '';
                    const canReadTelemetry = ['staff', 'assistant'].includes(observerRole);
                    const perceivedCondition = deriveTelemetry({
        core: bundle.stateAfter.core,
        point: pointStateRepo.get(subjectId, recentPhysicalPoint) || bundle.stateAfter.point,
        observation: bundle.diagnostics?.observation,
        contexts: activeContextsRepo.getAllForSubject(subjectId)
                    });
                    const telemetrySection = asksForTelemetry
                        ? canReadTelemetry
                            ? `[То, что ты читаешь на диагностическом экране]\n${formatTelemetryForPrompt(perceivedCondition)}\nТы отделяешь показания прибора от собственной интерпретации и используешь профессиональные слова только так, как это естественно для тебя.`
                            : `[То, что ты действительно можешь заметить]\n${formatVisibleConditionForPrompt(perceivedCondition)}`
                        : canReadTelemetry
                            ? `[Доступный тебе диагностический экран]\nТы можешь взглянуть на показатели, но сейчас тебя о них не спрашивают. Не превращай личный разговор в отчёт без заметного признака опасности.`
                            : '';
                    const commandOutcome = isDirectedCommandActor
                        ? `
[Результат твоего действия в этом ходе]
Попытка исполнить поручение Калибратора уже позади. ${
                              bundle.actionApplied
                                  ? `Ты видишь результат собственного действия на ${fullStateName || subjectId}.`
                                  : `Ты видишь, что твоё действие ничего нового не изменило для ${fullStateName || subjectId}.`
                          }
${systemNotes.length ? systemNotes.map(note => `Ты замечаешь результат: ${note}`).join('\n') : 'Ты не замечаешь никакого дополнительного изменения.'}
Ты находишься уже после этой попытки, а не перед решением. Можешь коротко подтвердить сделанное, назвать непосредственно видимый результат или высказать возникшее после него сомнение.
`
                        : `
[То, что происходит в этом ходе]
Ты сейчас только участвуешь в разговоре и не совершаешь нового физического действия.
`;
                    userMsgOverride = `${userMsgOverride || ''}

[Твоё непосредственное положение в этом ходе]
${
    isDirectedCommandActor
        ? `Калибратор обратился именно к тебе. Ты действуешь в отношении ${fullStateName || subjectId}.`
        : `Ты находишься рядом и видишь, что воздействие направлено на ${fullStateName || subjectId}, а не на твоё тело.
Ты не можешь видеть протокол, оборудование или действие, если они не присутствуют перед тобой в сцене.`
}
Если тебя просят оценить состояние, опирайся только на то, что ты действительно видишь, слышишь или читаешь на доступном тебе приборе.
${commandOutcome}

${telemetrySection}

${isResponseTarget ? `[Прямое обращение к тебе от Калибратора]\n«${autoUserMessage}»` : `[Реплика Калибратора, обращённая к ${fullStateName || subjectId}, не к тебе]\n«${autoUserMessage}»`}`;
                }
            }

            // Commands aimed at the primary subject used to miss the explicit
            // outcome section above (that branch only rebuilds observer
            // payloads). The frame then contained both the imperative and the
            // already changed state, so the character could answer as if she
            // had not acted yet. Make the resolved result authoritative for
            // the primary subject as well.
            if (decision.actorId === subjectId && autoUserMessage && isDirectedCommandActor) {
                if (currentPayload.reactionFrame) {
                    currentPayload.reactionFrame = {
                        ...currentPayload.reactionFrame,
                        event: {
                            ...currentPayload.reactionFrame.event,
                            playerSpeech: autoUserMessage.trim()
                        },
                        dramaticPosition: bundle.actionApplied
                            ? {
                                  primaryIntent: 'отреагировать из момента после уже выполненного поручения',
                                  secondaryConflict: 'личное отношение может окрасить ответ, но выполненное действие нельзя отрицать или описывать как будущее',
                                  preferredSpeechAct: 'acknowledge',
                                  allowedSpeechActs: ['acknowledge', 'report', 'set_boundary', 'warn', 'silence']
                              }
                            : {
                                  primaryIntent: 'сообщить, что поручение не привело к новому действию',
                                  secondaryConflict: 'нужно различить отказ, невозможность и уже существовавшее состояние',
                                  preferredSpeechAct: 'report',
                                  allowedSpeechActs: ['report', 'set_boundary', 'warn', 'silence']
                              }
                    };
                    currentPayload.systemPrompt = buildReactionSystemPrompt(currentPayload.reactionFrame);
                    userMsgOverride = buildReactionTurnMessage(currentPayload.reactionFrame);
                }
                userMsgOverride = `${userMsgOverride || ''}

[Результат команды — авторитетный факт]
Команда «${autoUserMessage.trim()}» уже разрешилась. ${
                    bundle.actionApplied ? `Ты уже выполнила действие «${resolvedCommandActionLabel}»; текущее состояние сцены показано после выполнения.` : 'Нового выполненного действия не произошло.'
                }
Отвечай из момента после этого результата. Не говори, что ещё только будешь выполнять команду, и не отрицай уже зафиксированное действие. Несогласие или границу можно выразить как реакцию после произошедшего.
${systemNotes.length ? systemNotes.join('\n') : ''}`;
            }

            if (autoUserMessage && currentPayload.reactionFrame) {
                // The primary subject keeps the initial payload and does not
                // pass through the observer rebuild above. Apply the actual
                // utterance here too, otherwise a plain question can inherit
                // the dramatic position of the preceding physical episode.
                if (decision.actorId === subjectId && !isDirectedCommandActor) {
                    currentPayload.reactionFrame = applyVerbalInputToFrame(currentPayload.reactionFrame, autoUserMessage.trim());
                }
                currentPayload.reactionFrame.continuity.recentDialogue = dialogueContextBeforeCurrent(currentHistory, autoUserMessage, currentPayload.reactionFrame.speaker.name);
                currentPayload.systemPrompt = buildReactionSystemPrompt(currentPayload.reactionFrame);
                currentHistory = historyWithoutDuplicatedCurrentInput(currentHistory, autoUserMessage);
                if (decision.actorId === subjectId && !isDirectedCommandActor) {
                    userMsgOverride = buildReactionTurnMessage(currentPayload.reactionFrame);
                }
            }

            if (autoUserMessage && resumedPendingCommand && decision.actorId === subjectId) {
                const pendingDescription = String((bundle.metadata as any)?.pendingCommandDescription || 'прежнее поручение');
                userMsgOverride = `${userMsgOverride || ''}\n\n[Развитие прежнего поручения]\n${
                    bundle.actionApplied
                        ? `После этой реплики твоя готовность изменилась достаточно: ты действительно выполнила прежнее поручение «${pendingDescription}». Реагируй из момента после выполнения.`
                        : `Прежнее поручение «${pendingDescription}» всё ещё остаётся предметом разговора, но ты пока его не выполнила. Если тебя спрашивают почему, назови конкретную личную причину из своего характера, отношения и текущего состояния — не повторяй один лишь отказ.`
                }`;
            }

            let structuredReply: {
                speech: string;
                speechAct?: string;
                addressedTo?: string;
            } = { speech: '' };
            let sentMessages: any = null;

            try {
                appendJsonLog('prompt_payloads.jsonl', {
                    tickId: bundle.event.id || null,
                    sceneId: eventId,
                    actorId: decision.actorId,
                    kind: decision.kind,
                    prompt: currentPayload,
                    userMsgOverride,
                    explanationRu: explainPromptLog({
                        tickId: bundle.event.id || null,
                        forSubject: decision.actorId,
                        sceneId: eventId,
                        prompt: currentPayload
                    })
                });
            } catch (e) {
                /* ignore */
            }

            if (decision.kind === 'proactive' && decision.reason) {
                userMsgOverride = userMsgOverride
                    ? `${userMsgOverride}\n\n[Твоя инициатива]: ${decision.reason}. Ответь сообразно этому намерению.`
                    : `[Твоя инициатива]: ${decision.reason}. Ответь сообразно этому намерению.`;
            }

            // Silence is a valid orchestration decision, but once the
            // orchestrator has selected a reactive speaking turn an empty LLM
            // completion is not that decision. Keep involuntary silence only
            // for a genuinely unresponsive character.
            if (decision.kind === 'reactive' && currentPayload.reactionFrame) {
                const frame = currentPayload.reactionFrame;
                const unresponsive = frame.expressionMode.control === 'minimal'
                    && frame.dramaticPosition.allowedSpeechActs.includes('silence');
                if (!unresponsive && !frame.event.requiresSpeech) {
                    currentPayload.reactionFrame = {
                        ...frame,
                        event: { ...frame.event, requiresSpeech: true }
                    };
                    currentPayload.systemPrompt = buildReactionSystemPrompt(currentPayload.reactionFrame);
                }
            }

            // ReactionFrame already contains a deliberately bounded, labelled
            // transcript. Passing the same chat again as raw role messages
            // duplicated every turn and encouraged the model to continue or
            // echo an older line instead of following the current event.
            const generationHistory = currentPayload.reactionFrame ? [] : currentHistory;
            const res = await generateCharacterReply(currentPayload, userMsgOverride, generationHistory, (chunk) => onToken?.(chunk, decision.actorId));
            sentMessages = res.sentMessages;
            structuredReply =
                res.reply && typeof res.reply === 'object'
                    ? (res.reply as {
                          speech: string;
                          speechAct?: string;
                          addressedTo?: string;
                      })
                    : { speech: String(res.reply || '') };

            try {
                appendJsonLog('prompt_payloads.jsonl', {
                    tickId: bundle.event.id || null,
                    sceneId: eventId,
                    actorId: decision.actorId,
                    kind: decision.kind,
                    response: structuredReply,
                    sentMessages,
                    explanationRu: `LLM-ответ для ${decision.actorId}: ${String(structuredReply.speech || '').slice(0, 200)}`
                });
            } catch (e) {
                /* ignore */
            }

            return { decision, structuredReply, sentMessages };
        });

        const results = await Promise.all(actorPromises);

        for (const { decision, structuredReply, sentMessages } of results) {
            const actorState = subjectRepo.get(decision.actorId)
                || (decision.actorId === subjectId ? bundle.stateAfter.core : bundle.stateBefore.core);
            const actorContexts = activeContextsRepo.getAllForSubject(decision.actorId);
            const actorObservation = decision.actorId === subjectId ? bundle.diagnostics?.observation : undefined;
            const portraitEmotion = resolvePortraitEmotion({
                speech: structuredReply.speech,
                behavioralState: actorObservation?.behavioralState,
                reaction: actorObservation?.reaction,
                transitions: actorObservation?.transitions,
                state: {
                    tension: actorState?.tension,
                    capacity: actorState?.capacity,
                    attitude: actorState?.attitude,
                    openness: actorState?.openness,
                    plasticity: actorState?.plasticity,
                    contexts: actorContexts.map(context => ({ actionId:context.actionId })),
                },
            });
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
                        chatMemoryRepo.append(tgtId, 'user', notice, interactionContext);
                    }
                    chatMemoryRepo.append(decision.actorId, 'user', notice, interactionContext);
                } catch (err) {
                    console.error('Failed to run proactive tick for NPC:', err);
                }
            }

            actorReplies.push({
                actorId: decision.actorId,
                actorName: characterRepo.get(decision.actorId)?.name || subjectRepo.get(decision.actorId)?.name || decision.actorId,
                kind: decision.kind,
                tone: decision.reason,
                speech: structuredReply.speech,
                speechAct: structuredReply.speechAct,
                addressedTo: structuredReply.addressedTo,
                reaction: sceneForChar || '',
                portraitEmotion,
            });

            if (decision.actorId === (directedActorId || subjectId) || !primaryReply) {
                primaryReply = {
                    speech: structuredReply.speech,
                    speechAct: structuredReply.speechAct,
                    addressedTo: structuredReply.addressedTo,
                    reaction: sceneForChar || '',
                    portraitEmotion,
                };
                promptMessages = sentMessages;
            }

            if (structuredReply.speech) {
                const messageId = chatMemoryRepo.append(
                    decision.actorId,
                    'assistant',
                    structuredReply.speech,
                    interactionContext,
                    portraitEmotion,
                );
                if (messageId) {
                    chatMemoryRepo.updatePortraitEmotion(messageId, portraitEmotion, 'simulation+speech', .72);
                }
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
            const playerContextLabels = playerContexts.map(ctx => getActiveContextPromptText(presetRepo.getActionPreset(ctx.actionId), ctx.actionId)).filter(Boolean);
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

    queueMicrotask(() => {
        try {
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
        } catch (error) {
            console.error('[Memory] deferred turn memory failed:', error);
        }
    });

    return {
        reply: primaryReply,
        promptMessages,
        actorReplies,
        narratorReaction
    };
}
