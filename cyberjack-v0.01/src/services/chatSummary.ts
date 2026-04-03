import { chatMemoryRepo, chatSummaryRepo } from '../infrastructure/repositories';

const SUMMARY_WINDOW = 10;

export function maybeSummarizeChat(subjectId: string) {
    if (!subjectId) return;
    let lastProcessedId = chatSummaryRepo.getLast(subjectId)?.lastMessageId || 0;

    while (true) {
        const window = chatMemoryRepo.getSince(subjectId, lastProcessedId, SUMMARY_WINDOW);
        if (window.length < SUMMARY_WINDOW) break;

        const summary = buildChatSummary(window);
        chatSummaryRepo.save({
            subjectId,
            summaryText: summary.summary,
            importantEvents: summary.highlights,
            startMessageId: window[0].id,
            endMessageId: window[window.length - 1].id
        });

        lastProcessedId = window[window.length - 1].id;
    }
}

function buildChatSummary(messages: Array<{ id: number; role: 'user' | 'assistant'; content: string }>) {
    const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content);
    const subjMsgs = messages.filter(m => m.role === 'assistant').map(m => m.content);

    const parts: string[] = [];
    if (userMsgs.length) {
        parts.push(`Калибратор направляет: ${describeIntent(userMsgs)}`);
    }
    if (subjMsgs.length) {
        parts.push(`С-01 отвечает: ${describeResponse(subjMsgs)}`);
    }
    const highlights = extractHighlights(messages);

    return {
        summary: parts.join(' / ') || 'Активно обменивались репликами. ',
        highlights
    };
}

function describeIntent(texts: string[]): string {
    let commands = 0;
    let comfort = 0;
    let general = 0;

    texts.forEach(text => {
        const normalized = (text || '').toLowerCase();
        if (normalized.includes('контекст')) commands++;
        else if (normalized.includes('удоб')) comfort++;
        else general++;
    });

    const parts: string[] = [];
    if (commands) parts.push('даёт указания/меняет условия');
    if (comfort) parts.push('проверяет состояние и удобство');
    if (general) parts.push('поддерживает нейтральный диалог');
    return parts.join(', ') || 'короткие реплики';
}

function describeResponse(texts: string[]): string {
    let compliant = 0;
    let dry = 0;
    let resistant = 0;

    texts.forEach(text => {
        const normalized = (text || '').toLowerCase();
        if (normalized.includes('понятно') || normalized.includes('продолжаем')) compliant++;
        if (normalized.includes('как обычно') || normalized.includes('в норме')) dry++;
        if (normalized.includes('не')) resistant++;
    });

    const parts: string[] = [];
    if (compliant) parts.push('выполняет приказы без споров');
    if (dry) parts.push('говорит сухо и отстранённо');
    if (resistant) parts.push('пытается обозначить границы');
    return parts.join(', ') || 'короткие односложные ответы';
}

const HIGHLIGHT_RULES: Array<{ regex: RegExp; label: string }> = [
    { regex: /(перегруз|overload)/i, label: 'Сигнал перегрузки' },
    { regex: /(страх|пани|дрож)/i, label: 'Страх/паника' },
    { regex: /(контекст|поза|состояние|позу)/i, label: 'Команды по контекстам' },
    { regex: /(сопротив|отказ)/i, label: 'Сопротивление' }
];

function extractHighlights(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string[] {
    const highlights: string[] = [];
    const seenSubjects = new Set<string>();
    for (const msg of messages) {
        for (const rule of HIGHLIGHT_RULES) {
            if (rule.regex.test(msg.content)) {
                highlights.push(`${rule.label}`);
            }
        }
        const mentions = msg.content.match(/S-\d+/gi);
        if (mentions) {
            mentions.forEach(m => seenSubjects.add(m.toUpperCase()));
        }
    }
    if (seenSubjects.size) {
        highlights.push(`Упомянуты субъекты: ${Array.from(seenSubjects).join(', ')}`);
    }
    return highlights.slice(0, 5);
}

function truncate(text: string, max = 80): string {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}
