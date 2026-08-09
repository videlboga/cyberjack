import { activeConfig } from '../prompts/config';
import { memoryRepo, chatSummaryRepo } from '../infrastructure/repositories';
import { buildEmbedding } from './embeddingService';
import { TickBundle, SubjectCoreState } from '../domain/types';
import { rememberSocialExchange } from './socialMemory';
import { getLaboratorySpatialContext } from '../scenario/spatialContext';
import { describeObservationSignal } from '../narrative/interactionObservation';

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

export function recordMemoryEvent(input: RecordMemoryInput) {
    const actionLabel = input.bundle.compiledAction.label || 'Неизвестное действие';
    const observation = input.bundle.diagnostics?.observation;
    const pointLabel = observation?.action.pointLabel || observation?.action.pointId || input.bundle.event.pointId || 'не указана';
    const parts = input.bundle.compiledAction.actionKey === 'wait'
        ? ['Событие: прошла пауза без нового воздействия']
        : [`Действие: ${actionLabel}; зона: ${pointLabel}`];
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
    if (objectiveFacts) {
        parts.push(`Объективные факты симуляции: место — ${objectiveFacts.location}. ${objectiveFacts.environment}`);
    }
    if (observation) parts.push(`Смысл телесной реакции: ${describeObservationSignal(observation)}`);
    else if (input.reactionText) parts.push(`Наблюдаемая реакция: ${input.reactionText}`);
    if (input.userText?.trim()) parts.push(`Высказывание собеседника (не объективный факт): «${input.userText.trim()}»`);
    if (input.assistantText?.trim()) parts.push(`Моя реплика в тот момент (не объективный факт): «${input.assistantText.trim()}»`);
    const text = parts.join('. ');
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
            playerSpeech: input.userText || '',
            characterSpeech: input.assistantText || '',
            speechAct: input.speechAct || null,
            addressedTo: input.addressedTo || null,
            observation: observation || null,
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
