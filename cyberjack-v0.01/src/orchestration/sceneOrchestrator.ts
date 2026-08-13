import { runGameTick } from './runGameTick';
import { TickBundle, OrchestratedTurn, ActorDecision, NarratorDecision, CharacterRelation, ScenePromptPayload } from '../domain/types';
import { activeConfig } from '../prompts/config';
import { activeContextsRepo, presetRepo, resourceRepo, subjectRepo, characterRelationRepo, sceneCharacterRepo, pointStateRepo, sceneRepo, characterRepo } from '../infrastructure/repositories';
import { ActionScorer, ActionScoreResult } from './actionScorer';
import { appendJsonLog } from '../utils/fileLogs';
import { explainPromptLog, explainOrchestratorDecision } from '../utils/logExplainers';
import { getActiveContextLabel, getActiveContextPromptText } from '../domain/contextPresentation';
import { getLaboratoryPresence, getLaboratorySpatialContext } from '../scenario/spatialContext';
import { OVERLOAD_NOTICEABLE } from '../domain/overloadScale';
import { resolvePortraitEmotion } from '../domain/portraitEmotion';
import { conditioningTags, deriveCompulsionSignals } from '../domain/conditioning';

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
        const activeCompulsions = deriveCompulsionSignals(core?.preferences, bundle.compiledAction.tags || [], [bundle.compiledAction.pointId]);
        const compulsionPressure = activeCompulsions[0]?.pressure || 0;

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
            (cfg.baseProactiveProbability + cfg.attitudeModifier * relationNorm + cfg.sensitivityModifier * sensitivityNorm + cfg.peerModifier * peerNorm + cfg.contextModifier * contextBonus + compulsionPressure * .16) *
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
        const deviceBound = eventSceneId === 'scene_lab_calibrator'
            && String(getLaboratoryPresence(actorId, bundle.event.playerId || 'PL-1')?.status || '').startsWith('device:');
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
            ,compulsions:activeCompulsions
        });

        // ── Proactive initiative ──
        // NPC can act proactively after any tick, not just wait/system_tick.
        // Probability scales with event significance so NPCs don't spam actions
        // on every minor tick, but respond to major moments (overload, transitions).
        let becameProactive = false;
        let proactiveReason = activeCompulsions[0]?.level === 3
            ? `Компульсия «${activeCompulsions[0].label}»: ${activeCompulsions[0].impulse}.`
            : describeTone(relationToCalibrator?.attitude);
        let decidedAction: any = undefined;
        let proactiveKind: 'physical' | 'verbal' | null = null;
        let proactiveImpulse: ActorDecision['impulse'];

        // Significance: how notable was this tick? Higher = more likely NPC acts.
        const hasMajorTransition = Boolean(bundle.diagnostics?.observation?.transitions?.length);
        const externallySignificant = (bundle.output.result.overload || 0) >= OVERLOAD_NOTICEABLE || hasMajorTransition;
        const reaction = bundle.diagnostics?.observation?.reaction;
        const reactionMagnitude = Math.max(Number(reaction?.pleasure || 0), Number(reaction?.discomfort || 0), Number(reaction?.overload || 0), Number(reaction?.engagement || 0) * 0.45);
        const significanceBoost = externallySignificant ? 1.0 : reactionMagnitude >= 12 ? 0.6 : 0.3;

        // Physical initiative: requires proximity (target, near:, or same device area).
        // deviceBound NPCs (on diagnostic table, in capsule) cannot physically act on others,
        // but can still speak.
        const canPhysical = physicallyEngaged && !deviceBound;

        // Verbal initiative: available to all present NPCs, including deviceBound ones.
        // An NPC strapped to a device can still say something.
        const canVerbal = true;

        if (sampleProbability(effectiveProactiveProb * significanceBoost)) {
            if (canPhysical && actorId !== playerId) {
                // Smart target selection: score all (target, action) pairs, pick the best.
                const possibleTargets = presentSubjectIds.filter(id => id !== actorId);
                let bestScored: { targetId: string; action: ActionScoreResult } | null = null;

                for (const targetId of possibleTargets) {
                    const rel = characterRelationRepo.get(actorId, targetId);
                    if (!rel) continue; // no relation = can't evaluate

                    const targetPointRecords = pointStateRepo.getAllForSubject(targetId);
                    const targetPoints = targetPointRecords.map(p => p.pointId);
                    if (targetPoints.length === 0) targetPoints.push('systemic');

                    const actions = ActionScorer.scoreAvailableActions(eventSceneId, actorId, targetId, targetPoints)
                        .map(action => {
                            const actionCompulsion = deriveCompulsionSignals(core?.preferences, conditioningTags(action.actionId), [action.pointId])[0];
                            return actionCompulsion?.level === 3
                                ? { ...action, score:action.score + actionCompulsion.pressure * 18 }
                                : action;
                        });
                    const scene = sceneRepo.get(eventSceneId);
                    const actorRes = resourceRepo.get(actorId);

                    const affordable = actions.filter(a => {
                        const sceneCost = scene?.actionCosts?.[a.actionId];
                        let requiredAP = 0;
                        if (sceneCost) {
                            const costRecord = (sceneCost as any).consume || sceneCost;
                            requiredAP = Number(costRecord.actionPoints ?? costRecord.ap ?? costRecord.apCost ?? costRecord.action_points ?? 0);
                        }
                        const curAP = Number(actorRes?.resources?.actionPoints ?? 100);
                        return !(requiredAP > 0 && curAP < requiredAP);
                    });

                    const best = affordable.find(a => a.score > -20);
                    if (best && (!bestScored || best.score > bestScored.action.score)) {
                        bestScored = { targetId, action: best };
                    }
                }

                if (bestScored) {
                    const targetChar = subjectRepo.get(bestScored.targetId);
                    const targetName = targetChar?.name || bestScored.targetId;
                    const preset = presetRepo.getActionPreset(bestScored.action.actionId);
                    const targetRelation = characterRelationRepo.get(actorId, bestScored.targetId);
                    proactiveReason = `Отношение к ${targetName}: ${describeTone(targetRelation?.attitude || relationToCalibrator?.attitude)}. Цель инициативы: применить действие "${preset?.label || bestScored.action.actionId}" к зоне "${bestScored.action.pointId}" персонажа ${targetName} (Мотивация: ${Math.round(bestScored.action.score)})`;
                    decidedAction = { ...bestScored.action, targetId: bestScored.targetId };
                    becameProactive = true;
                    proactiveKind = 'physical';
                    proactiveImpulse = {
                        id: `initiative:${bestScored.action.actionId}`,
                        primaryIntent: `Ты решила самой начать «${preset?.label || bestScored.action.actionId}» в отношении ${targetName}.`,
                        secondaryConflict: 'Это твой собственный выбор действия; говори из текущего состояния и не выдавай его за чужую команду.',
                        allowedSpeechActs: ['acknowledge', 'report', 'silence'],
                    };
                }
            }

            // If no physical action was chosen (or NPC is deviceBound), try verbal initiative.
            if (!becameProactive && canVerbal) {
                // Verbal proactive: NPC wants to say something on their own.
                // This is a speech-only proactive decision (no mechanical action).
                becameProactive = true;
                proactiveKind = 'verbal';
                proactiveImpulse = {
                    id: 'scene_initiative',
                    primaryIntent: 'Ты хочешь первой начать уместный разговор, а не только отвечать на чужие слова.',
                    secondaryConflict: 'Выбери тему из того, что ты действительно переживаешь и помнишь в этой сцене.',
                    allowedSpeechActs: ['acknowledge', 'probe', 'request', 'admit'],
                };
                proactiveReason = `${describeTone(relationToCalibrator?.attitude)}; инициативная реплика`;
            }
        }

        if (becameProactive) {
            actorDecisions.push({
                actorId,
                kind: 'proactive',
                reason: proactiveReason,
                impulse: proactiveImpulse,
                mechanicalAction: proactiveKind === 'physical' ? decidedAction : undefined
            });
        }

        // ── Reactive speech ──
        // If not proactive, check if NPC should react to what just happened.
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
import { generateNarratorReply, generateSceneForCharacter } from '../adapters/llmAdapter';
import { buildPromptPayloadWithDB as buildPromptPayload } from '../prompts/buildPromptPayloadWrapper';
import { buildCharacterTurnContext } from './characterTurnContext';
import { recordMemoryEvent } from '../services/memoryLayer';
import { executeCharacterSpeech } from '../services/characterSpeechExecutor';
import { deliverCharacterSpeech } from '../services/characterSpeechDelivery';
import { prepareCharacterSpeechStimuli } from '../services/characterSpeechStimulus';
import { applyInternalImpulseToFrame, applyVerbalInputToFrame, buildReactionSystemPrompt, buildReactionTurnMessage, type InternalImpulse } from '../narrative/reactionFrame';
import { deriveTelemetry, formatTelemetryForPrompt, formatVisibleConditionForPrompt } from '../narrative/telemetry';
import { buildPairedDialogueHistory } from '../narrative/dialogueHistory';
import { renderTemporalDialogue, selectCurrentDialogueSegment, TemporalDialogueEntry } from '../narrative/temporalDialogue';
import type { CommandPresentation } from '../narrative/commandPresentation';

function dialogueContextBeforeCurrent(history: TemporalDialogueEntry[], currentSpeech: string | undefined, speakerName: string, initiatorName = 'Калибратор') {
    const prior = [...history];
    if (currentSpeech && prior.at(-1)?.role === 'user' && prior.at(-1)?.content.trim() === currentSpeech.trim()) {
        prior.pop();
    }
    return renderTemporalDialogue(selectCurrentDialogueSegment(prior, 8), speakerName, initiatorName);
}

function frameAtCommandTransition(frame: NonNullable<TickBundle['prompt']['reactionFrame']>, actionLabel: string) {
    // The simulation state is committed for the UI before dialogue is made.
    // For this one reply, however, the character must experience the change as
    // a transition rather than receive the resulting pose as old knowledge.
    const isFinalPostureFact = (context: string) => /(?:текущее положение тела|^поза\s*:)/iu.test(context);
    const contexts = frame.scene.contexts.filter(context => !isFinalPostureFact(context));
    const roleContext = frame.scene.roleContext.filter(context => !isFinalPostureFact(context));
    return {
        ...frame,
        scene: { ...frame.scene, contexts: [...contexts, 'Положение тела меняется в ответ на обращение Калибратора.'], roleContext },
        event: {
            ...frame.event,
            action: actionLabel,
            experience: 'Ты слышишь прямое обращение Калибратора и начинаешь выполнять его в этот момент.',
            changes: [],
        },
    };
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

/**
 * The only background entrypoint for character speech. Background systems may
 * describe an internal impulse, but they never construct chat history, call a
 * model or write a reply themselves. This keeps autonomous speech in the same
 * prompt, persistence and portrait-emotion pipeline as an ordinary turn.
 */
export async function executeInternalImpulseConversation(input: {
    subjectId: string;
    latestResult?: any;
    eventId?: string;
    initiatorId?: string;
    impulse: InternalImpulse;
    event: Pick<NonNullable<TickBundle['prompt']['reactionFrame']>['event'], 'action' | 'target' | 'experience' | 'mandatoryPhysiologicalFocus'>;
    interactionContext: string;
}) {
    const eventId = input.eventId || 'scene_lab_calibrator';
    const turnContext = await buildCharacterTurnContext({
        subjectId: input.subjectId,
        stimulus: { kind: 'internal_impulse', impulseId: input.impulse.id },
        latestResult: input.latestResult,
        eventId,
        initiatorId: input.initiatorId || 'PL-1',
    });
    const payload = turnContext.payload;
    const prepared = prepareCharacterSpeechStimuli(payload, [{
        kind: 'internal_impulse',
        impulse: input.impulse,
        event: {
            ...input.event,
            directlyExperienced: true,
            affectedCharacter: payload.reactionFrame?.speaker.name || input.subjectId,
        },
    }]);
    if (!prepared) return null;
    const generated = await executeCharacterSpeech({
        source: 'internal_impulse',
        payload: prepared.payload,
        userInput: prepared.userInput,
        history: [],
    });
    if (!generated.success) throw new Error(generated.error);
    const reply = generated.speech;
    const actorState = subjectRepo.get(input.subjectId);
    const portraitEmotion = resolvePortraitEmotion({
        speech: reply,
        state: {
            tension: actorState?.tension,
            capacity: actorState?.capacity,
            attitude: actorState?.attitude,
            openness: actorState?.openness,
            plasticity: actorState?.plasticity,
            contexts: activeContextsRepo.getAllForSubject(input.subjectId).map(context => ({ actionId: context.actionId })),
        },
    });
    deliverCharacterSpeech({
        speakerId: input.subjectId,
        speech: reply,
        contextLabel: input.interactionContext,
        portraitEmotion,
    });
    return { speech: reply.trim(), portraitEmotion };
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
        mechanicalAction?: any;
    }> = [];
    let primaryReply: {
        speech: string;
        speechAct?: string;
        addressedTo?: string;
        reaction: string;
        portraitEmotion?: string;
        actorId?: string;
    } | null = null;
    let promptMessages: any = null;
    const speechErrors: Array<{ actorId: string; error: string }> = [];
    const commandIntent = (bundle.metadata as any)?.commandIntent;
    const resumedPendingCommand = Boolean((bundle.compiledAction as any)?.resumedPendingCommand || (bundle.metadata as any)?.resumedPendingCommand);
    const hasParsedCommand = Boolean(commandIntent?.type && commandIntent.type !== 'none' && !resumedPendingCommand);
    const resolvedCommandActionLabel = commandIntent?.type === 'perform_action'
        ? presetRepo.getActionPreset(commandIntent.actionId)?.label || commandIntent.actionId
        : actionLabel;
    const systemNotes = Array.isArray((bundle as any).systemNotes) ? (bundle as any).systemNotes.filter((note: unknown): note is string => typeof note === 'string' && note.trim().length > 0) : [];
    const commandPresentation = (bundle.metadata as any)?.commandPresentation as CommandPresentation | undefined;
    // A commanded NPC→NPC action is resolved by a second tick on its target.
    // Keep that result so the target's later speech is about the received
    // action, never about the player's imperative addressed to the executor.
    const commandedTargetBundles = new Map<string, TickBundle>();

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
            const targetBundle = await runGameTick({
                subjectId: commandIntent.targetId,
                pointId: commandIntent.pointId,
                playerId: bundle.event.playerId || 'PL-1',
                actingCharacterId: subjectId,
                sceneId: eventId,
                presetId: commandIntent.actionId,
            });
            commandedTargetBundles.set(commandIntent.targetId, targetBundle);
            const notice = `[Действие] ${executorName} → ${targetCharName}: ${cmdActionLabel} · ${cmdPointLabel}`;
            chatMemoryRepo.append(commandIntent.targetId, 'user', notice, interactionContext);
            chatMemoryRepo.append(subjectId, 'user', notice, interactionContext);
            // The target character must react to the received action. Add a
            // reactive ActorDecision so executeTurnConversations generates an
            // LLM reply for the target — the orchestration filter above
            // (line ~402) has already excluded everyone except directedActorId.
            orchestration.actorDecisions.push({
                actorId: commandIntent.targetId,
                kind: 'reactive',
                reason: `Получила действие «${cmdActionLabel}» от ${executorName} (${cmdPointLabel})`,
            });
        } catch (err) {
            console.error('[SceneOrchestrator] Failed to run commanded cross-character tick:', err);
        }
    }

    if (orchestration.actorDecisions.length) {
        const actorPromises = orchestration.actorDecisions.map(async decision => {
            const receivedCommandedAction = decision.kind === 'reactive'
                ? commandedTargetBundles.get(decision.actorId)
                : undefined;
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

            if (receivedCommandedAction) {
                // The target did not receive the command. Its authoritative
                // present is the physical tick performed by the executor.
                currentPayload = (await buildCharacterTurnContext({
                    subjectId: decision.actorId,
                    stimulus: { kind: 'external_action', tickId: receivedCommandedAction.tickId || eventId },
                    latestResult: receivedCommandedAction.output,
                    eventId,
                    initiatorId: subjectId,
                    addresseeId: subjectId,
                    suppressTickIds,
                })).payload;
                currentHistory = buildPairedDialogueHistory(
                    chatMemoryRepo.getRecent(decision.actorId, 32)
                        .filter(entry => !/^\[Действие\]|^\[Текущий контакт\]|^\*\(Без слов\)\*/.test(entry.content))
                        .slice(-16)
                        .map(entry => ({ role: entry.role, content: entry.content, worldMinute: entry.worldMinute, contextLabel: entry.contextLabel })),
                );
                userMsgOverride = `${buildReactionTurnMessage(currentPayload.reactionFrame)}

[Что происходит рядом]
${commandPresentation?.targetNow || `${subjectRepo.get(subjectId)?.name || subjectId} сейчас выполняет действие «${resolvedCommandActionLabel}».`}`;
            } else if (decision.actorId !== subjectId) {
                currentPayload = (await buildCharacterTurnContext({
                    subjectId: decision.actorId,
                    stimulus: { kind: 'external_action', tickId: bundle.tickId || eventId },
                    latestResult: bundle.output,
                    eventId,
                    initiatorId: bundle.event.playerId || 'PL-1',
                    suppressTickIds,
                })).payload;
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
                                  playerSpeech: autoUserMessage.trim(),
                                  commandOutcome: {
                                      status: bundle.actionApplied ? 'performed' : 'not_performed',
                                      actionLabel: resolvedCommandActionLabel,
                                  },
                              },
                              expressionMode: {
                                  ...currentPayload.reactionFrame.expressionMode,
                                  maxWords: Math.max(currentPayload.reactionFrame.expressionMode.maxWords, 40),
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
                    const observerRole = sceneCharacterRepo.list(eventId).find(pc => pc.character.subjectId === decision.actorId)?.role || '';
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
[Текущее действие]
${commandPresentation?.executorNow || `Ты сейчас выполняешь поручение Калибратора.`}
`
                        : `
[То, что происходит в этом ходе]
Ты сейчас только участвуешь в разговоре и не совершаешь нового физического действия.
`;
                    userMsgOverride = `${userMsgOverride || ''}

[Твоё непосредственное положение в этом ходе]
${
    isDirectedCommandActor
        ? `Калибратор обратился именно к тебе. ${
            commandIntent?.type === 'perform_action' && commandIntent?.targetId && commandIntent.targetId !== subjectId
                ? `Ты действуешь в отношении ${subjectRepo.get(commandIntent.targetId)?.name || commandIntent.targetId}.`
                : `Ты выполняешь поручение, касающееся тебя самой.`
        }`
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
                    const transitionFrame = frameAtCommandTransition(currentPayload.reactionFrame, resolvedCommandActionLabel);
                    currentPayload.reactionFrame = {
                        ...transitionFrame,
                        event: {
                            ...transitionFrame.event,
                            playerSpeech: autoUserMessage.trim(),
                            commandOutcome: {
                                status: bundle.actionApplied ? 'performed' : 'not_performed',
                                actionLabel: resolvedCommandActionLabel,
                            },
                        },
                        dramaticPosition: bundle.actionApplied
                            ? {
                                  primaryIntent: 'говорить и реагировать во время начавшегося действия',
                                  secondaryConflict: 'личное отношение окрашивает манеру исполнения и слова в этот момент',
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

[Текущее действие]
${commandPresentation?.executorNow || (bundle.actionApplied ? `Ты сейчас выполняешь действие «${resolvedCommandActionLabel}».` : 'Новое действие не начинается.')}`;
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

            if (decision.impulse && currentPayload.reactionFrame) {
                currentPayload.reactionFrame = applyInternalImpulseToFrame(currentPayload.reactionFrame, decision.impulse as any);
                currentPayload.systemPrompt = buildReactionSystemPrompt(currentPayload.reactionFrame);
                userMsgOverride = buildReactionTurnMessage(currentPayload.reactionFrame);
            }

            if (commandPresentation && decision.actorId !== subjectId && !receivedCommandedAction) {
                const visibleMoment = decision.actorId === commandPresentation.targetId
                    ? commandPresentation.targetNow
                    : commandPresentation.observerNow;
                userMsgOverride = userMsgOverride
                    ? `${userMsgOverride}\n\n[Текущее действие рядом]\n${visibleMoment}`
                    : `[Текущее действие рядом]\n${visibleMoment}`;
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
            const res = await executeCharacterSpeech({
                source: 'player_turn',
                payload: currentPayload,
                userInput: userMsgOverride,
                history: generationHistory,
                onToken: (chunk) => onToken?.(chunk, decision.actorId),
            });
            sentMessages = res.sentMessages;
            if (!res.success) {
                return { decision, structuredReply, sentMessages, error: res.error };
            }
            structuredReply = { speech: res.speech, speechAct: res.speechAct, addressedTo: res.addressedTo };
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

            return { decision, structuredReply, sentMessages, error: null };
        });

        const results = await Promise.all(actorPromises);

        for (const { decision, structuredReply, sentMessages, error } of results) {
            if (error) {
                speechErrors.push({ actorId: decision.actorId, error });
                continue;
            }
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
                    const notice = `[Действие] ${actorName} → ${targetName}: ${actionLabel2} · ${pointLabel2}`;
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
                mechanicalAction: decision.mechanicalAction || undefined,
            });

            if (decision.actorId === (directedActorId || subjectId) || !primaryReply) {
                primaryReply = {
                    speech: structuredReply.speech,
                    speechAct: structuredReply.speechAct,
                    addressedTo: structuredReply.addressedTo,
                    reaction: sceneForChar || '',
                    portraitEmotion,
                    actorId: decision.actorId,
                };
                promptMessages = sentMessages;
            }

            if (structuredReply.speech) {
                const messageId = deliverCharacterSpeech({
                    speakerId: decision.actorId,
                    speech: structuredReply.speech,
                    contextLabel: interactionContext,
                    portraitEmotion,
                }).originChatId;
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
        narratorReaction,
        speechErrors,
        error: speechErrors[0]?.error || null,
    };
}
