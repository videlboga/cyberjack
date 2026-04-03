import { activeConfig } from '../prompts/config';
import { memoryRepo, chatSummaryRepo } from '../infrastructure/repositories';
import { buildEmbedding } from './embeddingService';
import { TickBundle, SubjectCoreState } from '../domain/types';

interface RecordMemoryInput {
    subjectId: string;
    bundle: TickBundle;
    userText?: string;
    assistantText?: string;
    infoTag?: string;
}

export function recordMemoryEvent(input: RecordMemoryInput) {
    const parts: string[] = [];
    const actionLabel = input.bundle.compiledAction.label;
    if (input.userText && input.userText.trim().length > 0) {
        parts.push(`Команда/реплика: ${summarizeCommand(input.userText)}`);
    } else {
        parts.push(`Тактическое воздействие: ${actionLabel}`);
    }
    parts.push(`Тело ощущает: ${input.bundle.diagnostics.reactionSummary || 'короткий отклик'}`);
    if (input.assistantText && input.assistantText.trim().length > 0) {
        parts.push(`Вербальная реакция: ${summarizeSpeech(input.assistantText)}`);
    }

    const text = parts.join('. ');
    if (!text.trim()) return;

    memoryRepo.save({
        subjectId: input.subjectId,
        text,
        embedding: buildEmbedding(text),
        tags: collectMemoryTags(input.bundle),
        metadata: {
            actionId: input.bundle.event.payload?.presetId,
            sceneId: input.bundle.event.sceneId,
            userText: input.userText || '',
            assistantText: input.assistantText || '',
            infoTag: input.infoTag || null,
            timestamp: input.bundle.event.timestamp
        }
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
    return records.map(record => `- ${record.text}`);
}

export function getRecentSummaries(subjectId: string, limit = 3) {
    return chatSummaryRepo.getRecent(subjectId, limit);
}

function summarizeCommand(text: string): string {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('контекст')) return 'изменяет позу/ограничения';
    if (normalized.includes('удоб') || normalized.includes('комфорт')) return 'проверяет комфорт';
    if (normalized.includes('как себя') || normalized.includes('самочувств')) return 'интересуется самочувствием';
    if (normalized.includes('добрый') || normalized.includes('привет')) return 'поддерживает формальное приветствие';
    if (normalized.includes('будем') && normalized.includes('менять')) return 'предупреждает о грядущем воздействии';
    if (normalized.endsWith('?')) return 'задаёт уточняющий вопрос';
    return 'произносит короткую инструкцию';
}

function summarizeSpeech(text: string): string {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('понятно') || normalized.includes('продолжаем')) return 'послушно подтверждает изменения';
    if (normalized.includes('как обычно') || normalized.includes('в норме') || normalized.includes('стабиль')) return 'сухо сообщает о стабильности';
    if (normalized.includes('удоб') || normalized.includes('комфорт')) return 'оценивает комфорт без эмоций';
    if (normalized.includes('не') || normalized.includes('хватит')) return 'пытается возразить или обозначить границы';
    if (normalized.includes('не чувствую') || normalized.includes('привыкла')) return 'говорит устало, подчёркивая привычку к давлению';
    return 'отвечает коротко и сдержанно';
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
