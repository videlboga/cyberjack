import { PromptPayload, SubjectCoreState, TickOutput } from '../domain/types';
import { EventRecord } from './buildRecentEventsSummary';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';
import {
    characterRelationRepo,
    characterRepo,
    chatMemoryRepo,
    memoryRepo,
    presetRepo,
    subjectiveAssociationRepo,
    sceneCharacterRepo,
    sceneRepo
} from '../infrastructure/repositories';
import { buildInteractionObservation, buildCurrentStateObservationText, describeObservationSignal } from '../narrative/interactionObservation';
import { buildReactionSystemPrompt, compileReactionFrame } from '../narrative/reactionFrame';
import { deriveAcquiredTraits, deriveCompulsionSignals } from '../domain/conditioning';
import { getLaboratorySpatialContext } from '../scenario/spatialContext';
import { renderSocialMemories } from '../services/socialMemory';
import { renderTemporalDialogue, TemporalDialogueEntry } from '../narrative/temporalDialogue';
import { compactMemoryReaction } from '../services/memoryLayer';
import { aggregateMemoryEpisodes } from '../services/memoryEpisodes';
import { getSubjectiveEpisode, queueSubjectiveEpisode } from '../services/subjectiveMemoryEpisodes';

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

export function selectAuthoredFacts(profile: any, recentEntries: Array<{ role: string; content: string }>): string[] {
    const authored = profile?.authoredProfile;
    if (!authored) return [];
    const query = recentEntries
        .filter(entry => entry.role === 'user')
        .slice(-2)
        .map(entry => entry.content)
        .join(' ')
        .toLocaleLowerCase();
    const stopTerms = new Set(['тебя', 'тебе', 'твою', 'твоего', 'сейчас', 'будет', 'нужно', 'этого', 'тогда', 'просто', 'именно', 'начала', 'сильнее', 'всего', 'который', 'почему']);
    const terms = (query.match(/[а-яёa-z]{4,}/gi) || []).filter(term => !stopTerms.has(term.toLocaleLowerCase()));
    const candidates: Array<{ text: string; topics: string[]; weight: number }> = [];
    for (const event of authored.biography?.formativeEvents || []) candidates.push({
        text: `${event.fact} Значение для тебя: ${event.emotionalMeaning}`,
        topics: event.topics || [],
        weight: 2,
    });
    for (const relation of authored.biography?.relationships || []) candidates.push({
        text: `${relation.personOrGroup}: ${relation.relationship} ${relation.currentStatus} ${relation.emotionalMeaning}`,
        topics: relation.topics || [],
        weight: 1.5,
    });
    for (const fact of authored.knowledge?.personal || []) candidates.push({ text: fact, topics: [], weight: 1 });
    for (const misconception of authored.knowledge?.misconceptions || []) candidates.push({
        text: `Ты пока считаешь, что ${misconception.belief}`,
        topics: [],
        weight: 1,
    });
    for (const secret of authored.knowledge?.secrets || []) candidates.push({
        text: `Ты знаешь, но обычно скрываешь это без подходящей причины: ${secret.fact}`,
        topics: secret.topics || [],
        weight: .5,
    });
    const scored = candidates.map(candidate => {
        const haystack = `${candidate.text} ${candidate.topics.join(' ')}`.toLocaleLowerCase();
        const matches = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        const score = candidate.weight + matches * 2;
        return { ...candidate, matches, score };
    }).sort((left, right) => right.score - left.score);
    const role = profile.identity?.archetype === 'asset' ? 'asset' : 'candidate';
    const adaptation = authored.roleAdaptations?.[role];
    const roleFact = adaptation?.selfUnderstanding
        || adaptation?.onEntry?.knownFacts?.join(' ')
        || '';
    return Array.from(new Set([
        roleFact,
        // Biography is latent memory, not a mandatory topic. Previously every
        // formative event had enough base weight to enter every prompt, so a
        // feather touch could spontaneously evoke a cult or dead relative.
        ...scored.filter(item => item.matches > 0).slice(0, 2).map(item => item.text),
    ].filter(Boolean))).slice(0, 5);
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

const technicalInteractionMarker = /^\s*\[(?:Воздействие|Действие)\]/i;

export function selectRecentDialogue(entries: TemporalDialogueEntry[], ownerName: string, initiatorName: string) {
    const recent = entries
        .filter(entry => !technicalInteractionMarker.test(String(entry.content || '')))
        .slice(-8);
    return renderTemporalDialogue(recent, ownerName, initiatorName);
}

export function deriveOpenDialogueThreads(entries: Array<{ role: string; content: string }>, ownerName: string, initiatorName: string) {
    const recent = entries
        .filter(entry => !technicalInteractionMarker.test(String(entry.content || '')))
        .slice(-8);
    const threads: string[] = [];
    for (let index = 0; index < recent.length; index++) {
        const entry = recent[index];
        const speaker = entry.role === 'assistant' ? ownerName : initiatorName;
        const line = `${speaker}: «${entry.content}»`;
        const hasReply = recent.slice(index + 1).some(later => later.role !== entry.role);
        if (entry.content.includes('?') && !hasReply) threads.push(`Без явного ответа осталось: ${line}`);
        // A promise mentioned several turns ago is not automatically the
        // subject of every later reaction. Once the other side has answered,
        // longer-lived trust consequences belong to relationship memory.
        if (!hasReply && /(обеща|потом|верн[её]мся|поговорим|напомни|проверим)/i.test(line)) {
            threads.push(`Отложенная договорённость: ${line}`);
        }
    }
    return Array.from(new Set(threads)).slice(-3);
}

export function deriveRelationshipBeliefs(
    relation: { attitude?: number; openness?: number; familiarityLevel?: number } | null | undefined,
    episodes: EpisodeRecord[]
) {
    const beliefs: string[] = [];
    if (relation) {
        if ((relation.familiarityLevel ?? 0) < .25) beliefs.push('Я ещё плохо предсказываю его намерения и не считаю отдельный поступок устойчивой закономерностью.');
        else if ((relation.familiarityLevel ?? 0) >= .7) beliefs.push('Я уже знаю его привычный способ действовать и замечаю отклонения от него.');
        if ((relation.attitude ?? 50) >= 65) beliefs.push('Обычно я ожидаю от него скорее добросовестного отношения, хотя это не отменяет конкретных границ.');
        else if ((relation.attitude ?? 50) <= 35) beliefs.push('Я ожидаю давления или пренебрежения моими интересами, пока обратное не доказано поступками.');
        if ((relation.openness ?? 50) <= 30) beliefs.push('Я не считаю безопасным прямо показывать ему уязвимость.');
    }
    const recentText = episodes.slice(0, 6).map(entry => entry.text).join(' ');
    if (/(останов|снизил|ослабил).*(просьб|предупреж|границ)/i.test(recentText)) beliefs.push('Раньше он реагировал на прямо обозначенную границу.');
    if (/(продолжил|усилил|игнор).*(просьб|предупреж|границ)/i.test(recentText)) beliefs.push('Раньше он не отреагировал на обозначенную границу, поэтому словам доверять недостаточно.');
    return Array.from(new Set(beliefs)).slice(0, 4);
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

type EpisodeRecord = { text: string; type: string; metadata: Record<string, any>; relatedSubjects?: string[] };

export function renderEpisodeForCharacter(record: EpisodeRecord): string {
    const metadata = record.metadata || {};
    const parts: string[] = [];
    if (metadata.observed) {
        const actor = metadata.actorId === 'PL-1' || metadata.actorName === 'PL-1' ? 'Калибратор' : metadata.actorName || 'кто-то';
        const target = metadata.targetName || 'другой персонаж';
        if (metadata.actionLabel) {
            parts.push(`Наблюдение: ${actor} выполнил «${metadata.actionLabel}» для ${target}${metadata.pointLabel ? ` в области «${metadata.pointLabel}»` : ''}.`);
        }
        return parts.join(' ') || `Наблюдение: ${record.text.slice(0, 280)}`;
    }
    const actionDescription = String(metadata.observation?.action?.description || '').trim();
    if (actionDescription) {
        parts.push(actionDescription);
    } else if (metadata.actionLabel) {
        parts.push(`Калибратор выполнил действие «${metadata.actionLabel}»${metadata.pointLabel ? ` в области «${metadata.pointLabel}»` : ''}.`);
    }
    const reaction = String(metadata.memoryReaction || compactMemoryReaction(metadata.observation));
    if (reaction) parts.push(reaction);
    const quote = (value: unknown) => {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        return text.length > 180 ? `${text.slice(0, 179).trimEnd()}…` : text;
    };
    if (metadata.playerSpeech) parts.push(`Калибратор сказал: «${quote(metadata.playerSpeech)}».`);
    if (metadata.characterSpeech) parts.push(`Ты ответила: «${quote(metadata.characterSpeech)}».`);
    return parts.join(' ') || record.text.slice(0, 360);
}

export function ownCharacterFact(value: string): string {
    const fact = String(value || '').trim();
    if (!fact) return '';
    if (/^(?:ты|тебе|тебя|тобой|твой|твоя|твоё|твои)\b/iu.test(fact)) return fact;
    return `Ты знаешь это о себе и своей жизни: ${fact}`;
}

export function stripUnpromptedLoreFromEpisode(record: EpisodeRecord): EpisodeRecord {
    // Generated speech remains available in the short chat transcript, but it
    // must not return later disguised as engine-confirmed episodic truth.
    return {
        ...record,
        text: record.text
            .replace(/\.\s*Мой ответ:\s*«[^»]*»\s*$/u, '')
            .replace(/\.\s*Моя реплика в тот момент \(не объективный факт\):\s*«[^»]*»\s*$/u, '')
            .trim()
    };
}

export function selectReactionEpisodes(
    records: EpisodeRecord[],
    _currentActionId?: string,
    _currentPointId?: string
): EpisodeRecord[] {
    const result: EpisodeRecord[] = [];
    for (const record of records) {
        if (record && !result.some(existing => existing.text === record.text)) result.push(record);
        if (result.length === 3) break;
    }
    return result;
}

/** Keep lived history with the player and scene observations available even
 * after a fresh NPC-to-NPC exchange has written newer social memories. */
export function selectGeneralPromptEpisodes(records: EpisodeRecord[], addresseeId?: string): EpisodeRecord[] {
    const directPlayer = records.filter(record => (record.relatedSubjects || []).includes('PL-1') && !record.metadata?.observed);
    const observed = records.filter(record => Boolean(record.metadata?.observed));
    const withAddressee = addresseeId
        ? records.filter(record => (record.relatedSubjects || []).includes(addresseeId) && !record.metadata?.socialTransaction)
        : [];
    const selected: EpisodeRecord[] = [];
    const observedActionIds = new Set<string>();
    for (const record of [...directPlayer, ...observed, ...withAddressee, ...records]) {
        const observedActionId = record.metadata?.observed ? String(record.metadata?.actionId || record.metadata?.actionLabel || '') : '';
        if (observedActionId && observedActionIds.has(observedActionId)) continue;
        if (!selected.some(existing => existing.text === record.text)) selected.push(record);
        if (observedActionId) observedActionIds.add(observedActionId);
        if (selected.length === 3) break;
    }
    return selected;
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
    options?: { suppressTickIds?: string[]; initiatorId?: string; addresseeId?: string; worldPlayerId?: string; addresseeContextFacts?: string[]; compulsionCueTags?: string[]; compulsionCuePointIds?: string[]; edgeHoldMinutes?: number }
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
    const initiatorName = initiatorId === 'PL-1'
        ? 'Калибратор'
        : initiatorCharacter?.name || 'Собеседник';
    const addresseeId = options?.addresseeId || initiatorId;
    const addresseeCharacter = characterRepo.get(addresseeId);
    const addresseeName = addresseeId === 'PL-1' ? 'Калибратор' : addresseeCharacter?.name || initiatorName;
    const ownerName = ownerCharacter?.name || actorDetails.name || ownerId;
    const targetName = targetCharacter?.name || actorDetails.name || targetId;
    const profile = ensureGeneratedProfile(ownerCharacter?.subjectId || ownerId);
    const scene = sceneRepo.get(eventId);
    const spatial = eventId === 'scene_lab_calibrator' ? getLaboratorySpatialContext(ownerId, options?.worldPlayerId || 'PL-1') : null;
    const scenePresence = sceneCharacterRepo.list(eventId).find(entry => entry.character.id === ownerCharacter?.id || entry.character.subjectId === ownerId);
    const effectiveRole = scenePresence?.role || 'participant';
    const locationFact = spatial
        ? `Прямо сейчас ты находишься здесь: ${spatial.locationTitle}.`
        : `Прямо сейчас ты находишься здесь: ${scene?.title || eventId}.`;
    const roleContext = (() => {
        let facts: string[];
        if (effectiveRole === 'asset') facts = [
            'Твоя текущая роль здесь — актив лаборатории, а не сотрудник и не случайный посетитель.',
            'Ты знаешь, что находишься здесь для калибровки и подготовки к дальнейшим экспериментам.',
            'Термин «калибровка» тебе знаком: так здесь называют систематическую подготовку и изменение твоих телесных реакций, психики, привычек и отношения к воздействиям перед экспериментами.',
            'Ты понимаешь, что подготовка и эксперименты могут включать медицинские вмешательства, принуждение и насилие, изменение психики и формирование приобретённых влечений или девиаций, а также сексуальные действия.',
            'Ты знаешь общий смысл калибровки, но это не означает, что ты видела её внутренние регламенты. Не утверждай, что читала конкретный протокол, знаешь его номер или можешь определить «правильную» процедуру, если такого факта нет в твоей биографии или памяти.',
            'Само знание об этом не задаёт твою реакцию: желание, страх, отвращение, любопытство, сопротивление или принятие определяются твоим характером, отношением к Калибратору и текущим состоянием.',
            locationFact
        ];
        else if (effectiveRole === 'candidate') facts = [
            'Ты находишься здесь как кандидат: твой дальнейший статус ещё определяется, и ты понимаешь, что лаборатория оценивает возможность сделать тебя активом или сотрудником.',
            locationFact
        ];
        else if (['staff', 'assistant'].includes(effectiveRole)) facts = [
            'Ты находишься здесь как сотрудник лаборатории и понимаешь свою рабочую роль в происходящем.',
            locationFact
        ];
        else if (effectiveRole === 'broker') facts = [
            'Ты находишься здесь как посредник: твоя задача — сводить стороны, объяснять условия и защищать собственную выгоду и репутацию.',
            locationFact
        ];
        else if (effectiveRole === 'client') facts = [
            'Ты находишься здесь как клиент лаборатории и понимаешь, какой результат или услугу ожидаешь получить.',
            locationFact
        ];
        else if (effectiveRole === 'observer') facts = [
            'Ты находишься здесь как наблюдатель: происходящее не направлено на тебя, если сцена явно не изменилась.',
            locationFact
        ];
        else facts = [
            `Твоя текущая роль в этой сцене: ${effectiveRole}.`,
            locationFact
        ];
        return facts.filter(Boolean);
    })();
    if (addresseeId !== ownerId) {
        const addresseeProfile = ensureGeneratedProfile(addresseeCharacter?.subjectId || addresseeId);
        const gender = addresseeProfile.identity.gender === 'female' ? 'женщина' : addresseeProfile.identity.gender === 'male' ? 'мужчина' : 'персонаж с неуказанным грамматическим родом';
        roleContext.push(`Твой собеседник — ${addresseeName}; это ${gender}. Это отдельный персонаж со своей волей: не приписывай ему роль Калибратора и не отвечай за него.`);
        roleContext.push(...(options?.addresseeContextFacts || []));
    }
    if (initiatorId === 'PL-1') {
        roleContext.push('Ты разговариваешь с Калибратором — человеком, который управляет этой лабораторией и обращается к тебе как её оператор. Он не актив и не кандидат на калибровку.');
    }
    roleContext.push(resolveCurrentPostureFact(activeContextNames, spatial?.postureDescription));
    const embodiedTraits = deriveAcquiredTraits(actorDetails.core.preferences)
        .filter(trait => trait.level > 0)
        .map(trait => {
            const strength = trait.level >= 3 ? 'сильно выраженная' : trait.level === 2 ? 'выраженная' : 'заметная';
            return `У тебя есть ${strength} телесно-психологическая склонность «${trait.label}»; она меняет оценку релевантных ощущений и может влиять на твои решения.`;
        });
    roleContext.push(...embodiedTraits);
    const compulsionSignals = deriveCompulsionSignals(actorDetails.core.preferences, [
        ...(options?.compulsionCueTags || []),
        ...((latestResult?.tickMeta?.inputs?.action?.tags || []) as string[]),
    ], [
        ...(options?.compulsionCuePointIds || []),
        ...(latestResult?.tickMeta?.inputs?.point?.pointId ? [latestResult.tickMeta.inputs.point.pointId] : []),
    ]);
    const compulsionLines = compulsionSignals.map(signal => signal.level >= 3
        ? `Сейчас релевантный стимул запускает навязчивую компульсию «${signal.label}»: мысли снова возвращаются к импульсу ${signal.impulse}. Этот импульс конкурирует с твоими прежними намерениями и должен заметно влиять на то, что ты пытаешься сказать или сделать.`
        : signal.level === 2
            ? `Релевантный стимул заметно усиливает склонность «${signal.label}»: тебе трудно не думать об импульсе ${signal.impulse}.`
            : `Релевантный стимул слегка окрашен склонностью «${signal.label}».`
    );
    // Role context is intentionally capped in the reaction frame. Compulsions
    // must appear before addressee and posture boilerplate rather than being
    // silently cut off at the end of a dense laboratory scene.
    roleContext.splice(Math.min(6, roleContext.length), 0, ...compulsionLines);
    const presentCharacters = (spatial ? spatial.characterNames : sceneCharacterRepo.list(eventId)
        .filter(entry => entry.presenceState === 'present')
        .map(entry => entry.character.name));
    if (!presentCharacters.includes(ownerName)) presentCharacters.push(ownerName);
    if (!presentCharacters.includes(initiatorName)) presentCharacters.push(initiatorName);

    let observation;
    // runGameTick attaches the finalized observation onto engineOutput at
    // runtime (it is not part of the TickOutput type), so access it via any.
    const latestObservation = (latestResult as any)?.observation;
    if (latestObservation) {
        observation = latestObservation;
    } else if (latestResult?.tickMeta?.inputs?.action) {
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
    const currentActionTags = currentActionId ? presetRepo.getActionPreset(currentActionId)?.tags || [] : [];
    const relation = characterRelationRepo.get(ownerId, initiatorId);
    const recentDialogue = selectRecentDialogue(
        chatMemoryRepo.getRecent(ownerId, 20),
        ownerName,
        initiatorName
    );
    const recentChatEntries = chatMemoryRepo.getRecent(ownerId, 20);
    const authoredFacts = selectAuthoredFacts(profile, recentChatEntries);
    const allEpisodeRecords = memoryRepo.listRecent(ownerId, 24, 'episode_v2')
        .map(stripUnpromptedLoreFromEpisode);
    const recentSpeechActs = allEpisodeRecords
        .filter(entry => entry.metadata?.speechAct)
        .slice(0, 3)
        .map(entry => String(entry.metadata?.speechAct));
    const recentSpeechAct = recentSpeechActs[0];
    const socialMemory = renderSocialMemories(ownerId, initiatorId);
    const episodeRecords = selectGeneralPromptEpisodes(allEpisodeRecords, addresseeId);
    const subjectiveEpisodes = aggregateMemoryEpisodes(memoryRepo.listRecent(ownerId, 160, 'episode_v2'), 8)
        .flatMap(episode => {
            queueSubjectiveEpisode(ownerId, ownerName, episode);
            const memory = getSubjectiveEpisode(ownerId, episode);
            return memory ? [`Личное воспоминание: ${memory.summary}${memory.appraisal ? ` Оценка: ${memory.appraisal}` : ''}`] : [];
        });
    const activeAssociations = subjectiveAssociationRepo.activeForPrompt(ownerId, addresseeId, currentActionTags)
        .map((association: any) => `У тебя откликается связь «${association.target_label}»: ожидание ${association.expectation}, сила ${Math.round(Number(association.strength) * 100)}%.`);
    // Этап 10: блоки памяти хранятся как { kind, text }, чтобы телеметрия
    // считала по kind, а не по текстовым префиксам (устойчиво к смене формулировок).
    const memoryBlocks: Array<{ kind: 'association' | 'subjective' | 'episode'; text: string }> = [
        ...activeAssociations.map(text => ({ kind: 'association' as const, text })),
        ...subjectiveEpisodes.slice(0, 2).map(text => ({ kind: 'subjective' as const, text })),
        ...episodeRecords.map(renderEpisodeForCharacter).map(text => ({ kind: 'episode' as const, text })),
    ].slice(0, 3);
    const relevantEpisodes = memoryBlocks.map(block => block.text);
    const memorySelection = {
        associations: memoryBlocks.filter(block => block.kind === 'association').length,
        subjective: memoryBlocks.filter(block => block.kind === 'subjective').length,
        episodes: memoryBlocks.filter(block => block.kind === 'episode').length,
        total: memoryBlocks.length,
    };
    const repetitionFromLogs = countRepetitions(recentEvents, currentActionId, currentPointId);
    const exposureBeforeTick = Number(latestResult?.tickMeta?.inputs?.point.exposureCount ?? 0);
    const frame = compileReactionFrame({
        speakerId: ownerId,
        speakerName: ownerName,
        speakerGender: profile.identity.gender,
        targetId,
        targetName,
        initiatorId,
        initiatorName,
        sceneTitle: spatial?.locationTitle || scene?.title,
        presentCharacters,
        contexts: spatial ? [`Местонахождение: ${spatial.locationTitle}`, spatial.description, ...activeContextNames] : activeContextNames,
        roleContext,
        core: actorDetails.core,
        relation,
        edgeHoldMinutes: options?.edgeHoldMinutes,
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
        canonicalFacts: [
            ...authoredFacts.map(ownCharacterFact),
            `Тебя зовут ${profile.identity.name}. Тебе ${profile.identity.age} лет.`,
            ...profile.biography.origin,
            profile.biography.formerRole || '',
            profile.biography.statusCause || '',
            ...profile.biography.formativeEvents
        ].map(ownCharacterFact),
        recentSpeechAct,
        recentSpeechActs,
        relationshipBeliefs: [
            ...socialMemory.beliefs,
            ...deriveRelationshipBeliefs(relation, allEpisodeRecords)
        ],
        openThreads: [
            ...socialMemory.openThreads,
            ...deriveOpenDialogueThreads(recentChatEntries, ownerName, initiatorName)
        ],
        compulsions: compulsionSignals,
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
        memorySelection,
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
export function resolveCurrentPostureFact(activeContexts: string[], devicePosture?: string | null): string {
    const explicitPose = activeContexts.find(context => /^pose\s*:/i.test(context));
    if (explicitPose) {
        const pose = explicitPose.replace(/^pose\s*:\s*/i, '').trim();
        return `Текущее положение твоего тела задано состоянием: ${pose}. Не противоречь этой позе в реплике.`;
    }
    if (devicePosture) {
        return `Текущее положение твоего тела: ${devicePosture}. Не описывай другую позу.`;
    }
    return 'Текущее положение твоего тела: ты стоишь. Ты не сидишь и не лежишь, пока поза явно не изменится.';
}
