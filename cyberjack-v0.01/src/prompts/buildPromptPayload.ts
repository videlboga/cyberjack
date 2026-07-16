import { PromptPayload, SubjectCoreState, TickOutput } from '../domain/types';
import { EventRecord } from './buildRecentEventsSummary';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';
import {
    characterRelationRepo,
    characterRepo,
    chatMemoryRepo,
    memoryRepo,
    sceneCharacterRepo,
    sceneRepo
} from '../infrastructure/repositories';
import { buildInteractionObservation, buildCurrentStateObservationText } from '../narrative/interactionObservation';
import { buildReactionSystemPrompt, compileReactionFrame } from '../narrative/reactionFrame';
import { getLaboratorySpatialContext } from '../scenario/spatialContext';

function parseEvent(event: EventRecord) {
    let action: any = {};
    let result: any = {};
    try { action = JSON.parse(event.action_payload || '{}'); } catch { }
    try { result = JSON.parse(event.result_payload || '{}'); } catch { }
    return { event, action, result };
}

function actionIdOf(event: EventRecord): string {
    const { action } = parseEvent(event);
    return action.presetId || action.actionId || action.action?.actionKey || '';
}

function pointIdOf(event: EventRecord): string {
    return parseEvent(event).action.pointId || '';
}

function countRepetitions(events: EventRecord[], currentActionId?: string, currentPointId?: string) {
    if (!currentActionId) return 1;
    // recentEvents already contains the current tick. Starting at one counted
    // every first action as its own repetition and forced the dialogue into the
    // repetitive-control branch immediately.
    let repeats = 0;
    for (let i = events.length - 1; i >= 0; i--) {
        if (actionIdOf(events[i]) === currentActionId && (!currentPointId || pointIdOf(events[i]) === currentPointId)) repeats++;
        else break;
    }
    return Math.max(1, repeats);
}

const technicalInteractionMarker = /^\s*\[Воздействие\]/i;

export function selectRecentDialogue(entries: Array<{ role: string; content: string }>, ownerName: string, initiatorName: string) {
    return entries
        .filter(entry => !technicalInteractionMarker.test(String(entry.content || '')))
        .slice(-8)
        .map(entry => `${entry.role === 'assistant' ? ownerName : initiatorName}: «${entry.content}»`);
}

const conditionalEquipmentTerms = [
    /ошейн/i,
    /наручник|фиксац/i,
    /кляп/i,
    /повязк.{0,8}глаз|вслепую/i,
    /пробк/i
];

export function contextualizeBehavioralCore<T extends {
    vulnerabilities: string[];
    conditionalReactions?: Array<{ facts: string[]; response: string }>;
}>(
    core: T,
    currentFacts: string[]
): T {
    const facts = currentFacts.join(' ');
    const activeConditional = (core.conditionalReactions || [])
        .filter(reaction => reaction.facts.some(term => facts.toLocaleLowerCase().includes(term.toLocaleLowerCase())))
        .map(reaction => reaction.response);
    return {
        ...core,
        vulnerabilities: [...core.vulnerabilities.filter(vulnerability => {
            const equipment = conditionalEquipmentTerms.find(pattern => pattern.test(vulnerability));
            return !equipment || equipment.test(facts);
        }), ...activeConditional]
    };
}

type EpisodeRecord = { text: string; type: string; metadata: Record<string, any> };

const mentionsLoreTerm = (text = '') => /(резонанс|пустот|бездн|аномали)/i.test(text);

export function stripUnpromptedLoreFromEpisode(record: EpisodeRecord): EpisodeRecord {
    const playerSpeech = String(record.metadata?.playerSpeech || '');
    const characterSpeech = String(record.metadata?.characterSpeech || '');
    if (!mentionsLoreTerm(characterSpeech) || mentionsLoreTerm(playerSpeech)) return record;
    return {
        ...record,
        text: record.text.replace(/\.?\s*Мой ответ: «[^»]*»\.?\s*$/i, '').trim(),
        metadata: { ...record.metadata, characterSpeech: '', speechAct: null }
    };
}

export function selectReactionEpisodes(
    records: EpisodeRecord[],
    currentActionId?: string,
    currentPointId?: string
): EpisodeRecord[] {
    const isDialogue = (record: EpisodeRecord) =>
        Boolean(record.metadata?.playerSpeech) || record.metadata?.actionId === 'verbal_pressure';
    const score = (record: EpisodeRecord, recency: number) =>
        (record.metadata?.actionId === currentActionId ? 4 : 0) +
        (record.metadata?.pointId === currentPointId ? 2 : 0) +
        (record.metadata?.observation?.reaction?.mixed ? 1 : 0) +
        ((record.metadata?.observation?.transitions?.length || 0) ? 3 : 0) -
        recency * 0.05;
    const ranked = (items: EpisodeRecord[]) => items
        .map(record => ({ record, recency: records.indexOf(record) }))
        .sort((a, b) => score(b.record, b.recency) - score(a.record, a.recency))
        .map(item => item.record);
    const physical = records.filter(record => !isDialogue(record));
    const dialogue = records.filter(isDialogue);
    const chosen = currentActionId === 'verbal_pressure'
        ? [physical[0], ...ranked(dialogue).slice(0, 2)]
        : [...ranked(physical).slice(0, 2), dialogue[0]];

    const result: EpisodeRecord[] = [];
    for (const record of [...chosen, ...records]) {
        if (record && !result.some(existing => existing.text === record.text)) result.push(record);
        if (result.length === 3) break;
    }
    return result;
}

/**
 * Compiles an actor-specific dramatic perspective. Mechanical truth stays in the
 * engine; the language model receives only facts available to this speaker.
 */
export async function buildPromptPayload(
    ownerId: string,
    targetId: string,
    actorDetails: { name: string; core: SubjectCoreState },
    recentEventsIn: EventRecord[],
    pointStatesRow: any[],
    activeContextNames: string[],
    latestResult?: TickOutput,
    eventId = 'scene_lab_calibrator',
    options?: { suppressTickIds?: string[]; initiatorId?: string }
): Promise<PromptPayload & { systemPrompt: string }> {
    const suppressed = new Set(options?.suppressTickIds || []);
    const recentEvents = recentEventsIn.filter(event => {
        const tickId = parseEvent(event).action.tickId;
        return !tickId || !suppressed.has(tickId);
    });
    const ownerCharacter = characterRepo.get(ownerId);
    const targetCharacter = characterRepo.get(targetId);
    const initiatorId = options?.initiatorId || 'PL-1';
    const initiatorCharacter = characterRepo.get(initiatorId);
    const ownerName = ownerCharacter?.name || actorDetails.name || ownerId;
    const targetName = targetCharacter?.name || actorDetails.name || targetId;
    const profile = ensureGeneratedProfile(ownerCharacter?.subjectId || ownerId);
    const scene = sceneRepo.get(eventId);
    const spatial = eventId === 'scene_lab_calibrator' ? getLaboratorySpatialContext(ownerId, initiatorId) : null;
    const presentCharacters = (spatial ? spatial.characterNames : sceneCharacterRepo.list(eventId)
        .filter(entry => entry.presenceState === 'present')
        .map(entry => entry.character.name));
    if (!presentCharacters.includes(ownerName)) presentCharacters.push(ownerName);
    if (initiatorCharacter?.name && !presentCharacters.includes(initiatorCharacter.name)) presentCharacters.push(initiatorCharacter.name);

    let observation;
    if (latestResult?.tickMeta?.inputs?.action) {
        observation = buildInteractionObservation({
            subjectId: targetId,
            pointId: latestResult.tickMeta.inputs.point.pointId,
            action: latestResult.tickMeta.inputs.action,
            previousCore: latestResult.tickMeta.inputs.core,
            output: latestResult,
            notableEvent: latestResult.notableEvent
        });
    }
    const currentActionId = latestResult?.tickMeta?.inputs?.action.actionKey;
    const currentPointId = latestResult?.tickMeta?.inputs?.point.pointId;
    const relation = characterRelationRepo.get(ownerId, initiatorId);
    const recentDialogue = selectRecentDialogue(
        chatMemoryRepo.getRecent(ownerId, 20),
        ownerName,
        initiatorCharacter?.name || 'Собеседник'
    );
    const allEpisodeRecords = memoryRepo.listRecent(ownerId, 12, 'episode_v2')
        .filter(entry => !entry.metadata?.sceneId || entry.metadata.sceneId === eventId)
        .map(stripUnpromptedLoreFromEpisode);
    const recentSpeechActs = allEpisodeRecords
        .filter(entry => entry.metadata?.speechAct)
        .slice(0, 3)
        .map(entry => String(entry.metadata?.speechAct));
    const recentSpeechAct = recentSpeechActs[0];
    const episodeRecords = selectReactionEpisodes(allEpisodeRecords, currentActionId, currentPointId);
    const relevantEpisodes = episodeRecords.map(entry => entry.text);
    const repetitionFromLogs = countRepetitions(recentEvents, currentActionId, currentPointId);
    const exposureBeforeTick = Number(latestResult?.tickMeta?.inputs?.point.exposureCount ?? 0);
    const frame = compileReactionFrame({
        speakerId: ownerId,
        speakerName: ownerName,
        speakerGender: profile.identity.gender,
        targetId,
        targetName,
        initiatorId,
        initiatorName: initiatorCharacter?.name || 'Калибратор',
        sceneTitle: spatial?.locationTitle || scene?.title,
        presentCharacters,
        contexts: spatial ? [`Местонахождение: ${spatial.locationTitle}`, spatial.description, ...activeContextNames] : activeContextNames,
        core: actorDetails.core,
        relation,
        observation,
        actionLabel: latestResult?.tickMeta?.inputs?.action.label,
        pointLabel: currentPointId,
        repetition: Math.min(repetitionFromLogs, exposureBeforeTick + 1),
        profileText: profile.personaText,
        behavioralCore: contextualizeBehavioralCore(profile.behavioralCore, [
            ...activeContextNames,
            latestResult?.tickMeta?.inputs?.action.label || '',
            observation?.action.label || ''
        ]),
        recentDialogue,
        relevantEpisodes,
        recentSpeechAct,
        recentSpeechActs
    });
    const averageLocalAttitude = pointStatesRow.length
        ? pointStatesRow.reduce((sum, row) => sum + Number(row.localAttitude ?? row.local_attitude ?? 50), 0) / pointStatesRow.length
        : actorDetails.core.attitude;
    const lastResult = latestResult?.result || {} as any;
    const structuredEvents = recentEvents.slice(-5).map(event => {
        const parsed = parseEvent(event);
        return {
            type: event.action_type,
            interpretation: parsed.action.narrative || parsed.action.actionLabel || parsed.action.presetId || event.action_type
        };
    });
    const stateText = observation?.subjectiveText || buildCurrentStateObservationText(ownerId, actorDetails.core);
    const relations = characterRelationRepo.listFor(ownerId);

    return {
        subjectId: ownerId,
        sceneId: eventId,
        systemPrompt: buildReactionSystemPrompt(frame),
        reactionFrame: frame,
        currentStateSummary: {
            interpretation: `[Субъективное состояние] ${stateText}`,
            attitude: actorDetails.core.attitude,
            localAttitude: averageLocalAttitude,
            engagement: Number(lastResult.engagement) || 0,
            overload: Number(lastResult.overload) || 0
        },
        recentEvents: structuredEvents,
        sceneContext: activeContextNames.join(', ') || undefined,
        relations
    };
}
