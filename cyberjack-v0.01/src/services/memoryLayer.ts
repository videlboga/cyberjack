import { activeConfig } from '../prompts/config';
import { memoryRepo, chatSummaryRepo } from '../infrastructure/repositories';
import { buildEmbedding } from './embeddingService';
import { TickBundle, SubjectCoreState } from '../domain/types';
import { rememberSocialExchange } from './socialMemory';
import { getLaboratorySpatialContext } from '../scenario/spatialContext';
import { InteractionObservation } from '../domain/types';

interface RecordMemoryInput {
    subjectId: string;
    bundle: TickBundle;
    userText?: string;
    assistantText?: string;
    infoTag?: string;
    reactionText?: string;
    speechAct?: string;
    addressedTo?: string;
}

const memoryQuote = (text: string, limit = 220) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
};

/** A memory stores the lived fact, not a prose version of engine telemetry. */
export function compactMemoryReaction(observation?: InteractionObservation | null): string {
    if (!observation) return '';
    const { pleasure = 0, discomfort = 0, overload = 0, mixed = false } = observation.reaction || {};
    const state = {
        responsive: '',
        subspace: 'Мне было трудно удерживать внимание.',
        overload: 'Ощущений оказалось слишком много.',
        freeze: 'Я застыла и не смогла сразу ответить.',
        panic: 'Я испугалась и попыталась отстраниться.',
        defiance: 'Я сопротивлялась происходящему.',
        unresponsive: 'У меня почти не осталось сил на осмысленную реакцию.',
    }[observation.behavioralState || 'responsive'];
    const feeling = mixed
        ? 'Ощущение было одновременно приятным и неприятным.'
        : pleasure > discomfort * 1.25 && pleasure > .5
            ? 'Мне это было приятно.'
            : discomfort > pleasure * 1.25 && discomfort > .5
                ? 'Мне это было неприятно.'
                : overload > 5 ? 'Это меня перегрузило.' : '';
    return [feeling, state].filter(Boolean).join(' ');
}

export function buildCompactEpisodeText(input: {
    actionLabel: string;
    pointLabel?: string;
    observation?: InteractionObservation | null;
    userText?: string;
    assistantText?: string;
    isWait?: boolean;
}): string {
    const actionDescription = String((input.observation as any)?.action?.description || '').trim();
    const parts = input.isWait
        ? ['Прошло немного времени без нового действия.']
        : [actionDescription || `Калибратор выполнил действие «${input.actionLabel}»${input.pointLabel ? ` в области «${input.pointLabel}»` : ''}.`];
    const reaction = compactMemoryReaction(input.observation);
    if (reaction) parts.push(reaction);
    if (input.userText?.trim()) parts.push(`Калибратор сказал: «${memoryQuote(input.userText)}».`);
    if (input.assistantText?.trim()) parts.push(`Я ответила: «${memoryQuote(input.assistantText)}».`);
    return parts.join(' ');
}

export function recordMemoryEvent(input: RecordMemoryInput) {
    const actionLabel = input.bundle.compiledAction.label || 'Неизвестное действие';
    const observation = input.bundle.diagnostics?.observation;
    const pointLabel = observation?.action.pointLabel || observation?.action.pointId || input.bundle.event.pointId || 'не указана';
    const spatialContext = getLaboratorySpatialContext(
        input.subjectId,
        input.bundle.event.playerId || 'PL-1',
    );
    const objectiveFacts = spatialContext ? {
        location: spatialContext.locationTitle,
        roomId: spatialContext.roomId,
        container: spatialContext.containerName,
        isolated: spatialContext.isolated,
        environment: spatialContext.description,
    } : null;
    const text = buildCompactEpisodeText({
        actionLabel,
        pointLabel,
        observation,
        userText: input.userText,
        assistantText: input.assistantText,
        isWait: input.bundle.compiledAction.actionKey === 'wait',
    });
    if (!text.trim()) return;

    memoryRepo.save({
        subjectId: input.subjectId,
        text,
        embedding: buildEmbedding(text),
        tags: collectMemoryTags(input.bundle),
        relatedSubjects: [input.bundle.event.playerId || 'PL-1'],
        type: 'episode_v2',
        metadata: {
            actionId: input.bundle.event.payload?.presetId,
            sceneId: input.bundle.event.sceneId,
            actionLabel,
            pointId: observation?.action.pointId || input.bundle.event.pointId || null,
            pointLabel,
            playerSpeech: input.userText || '',
            characterSpeech: input.assistantText || '',
            speechAct: input.speechAct || null,
            addressedTo: input.addressedTo || null,
            observation: observation || null,
            memoryReaction: compactMemoryReaction(observation),
            objectiveFacts,
            infoTag: input.infoTag || null,
            timestamp: input.bundle.event.timestamp
        }
    });

    rememberSocialExchange({
        subjectId: input.subjectId,
        relatedSubjectId: input.bundle.event.playerId || 'PL-1',
        userText: input.userText,
        assistantText: input.assistantText
    });
}

export function selectLongTermMemory(
    subjectId: string,
    events: Array<{ type: string; interpretation: string }>,
    core: SubjectCoreState,
    points: Array<{ label: string; localSensitivity: number; localAttitude: number }>
): string[] {
    const baseText = [
        activeConfig.character.identity,
        activeConfig.character.history,
        events.map(e => `${e.type}: ${e.interpretation}`).join('; '),
        `Attitude: ${core.attitude.toFixed(1)}, Openness: ${core.openness.toFixed(1)}`
    ].join('\n');
    const queryEmbedding = buildEmbedding(baseText);
    const tags: string[] = [];
    if (core.capacity < 30 || core.openness < 40) tags.push('overload');
    if (points.some(p => p.localAttitude < 30)) tags.push('pain');
    const records = memoryRepo.findRelevant(subjectId, queryEmbedding, 5, tags.length ? tags : undefined);
    return records.map(record => record.text);
}

export function getRecentSummaries(subjectId: string, limit = 3) {
    return chatSummaryRepo.getRecent(subjectId, limit);
}

function summarizeCommand(text: string): string {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('контекст')) return 'сменил позу или наложил другое ограничение';
    if (normalized.includes('удоб') || normalized.includes('комфорт')) return 'пытается убедиться, что мне терпимо';
    if (normalized.includes('как себя') || normalized.includes('самочувств')) return 'расспрашивает о самочувствии';
    if (normalized.includes('добрый') || normalized.includes('привет')) return 'поддержал формальный привет';
    if (normalized.includes('будем') && normalized.includes('менять')) return 'предупреждает, что сейчас всё изменит';
    if (normalized.endsWith('?')) return 'задает уточняющий вопрос';
    return 'произносит короткую команду';
}

function summarizeSpeech(text: string): string {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('понятно') || normalized.includes('продолжаем')) return 'что поняла его намерения и не сопротивляюсь';
    if (normalized.includes('как обычно') || normalized.includes('в норме') || normalized.includes('стабиль')) return 'что держусь в привычном состоянии, без сюрпризов';
    if (normalized.includes('удоб') || normalized.includes('комфорт')) return 'что оцениваю комфорт сухо, без эмоций';
    if (normalized.includes('не') || normalized.includes('хватит')) return 'что мне это не по душе и я пытаюсь обозначить границы';
    if (normalized.includes('не чувствую') || normalized.includes('привыкла')) return 'что привыкла к давлению и почти не реагирую';
    return 'коротко и сдержанно';
}

function collectMemoryTags(bundle: TickBundle): string[] {
    const tags: string[] = [];
    const result = bundle.output.result;
    if (result.overload > 0.5) tags.push('overload');
    if (result.pleasure > 0.4) tags.push('pleasure');
    if (result.discomfort > 0.4) tags.push('pain');
    if (bundle.compiledAction.type === 'context') tags.push('context');
    if (Array.isArray((bundle.compiledAction as any).tags)) {
        tags.push(...((bundle.compiledAction as any).tags as string[]));
    }
    return tags;
}
