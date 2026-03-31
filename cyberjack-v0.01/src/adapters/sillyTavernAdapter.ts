import { PromptPayload } from '../domain/types';

/**
 * Адаптер для взаимодействия с SillyTavern.
 * В будущем можно добавить интеграцию с REST API или веб-хуками ST.
 * 
 * Сейчас это заглушка, возвращающая сформатированный промпт для логов.
 */

export interface SillyTavernMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

export function generateSillyTavernPayload(payload: PromptPayload): SillyTavernMessage[] {
    const messages: SillyTavernMessage[] = [];

    // Инъекция состояния субъекта как системной заметки
    messages.push({
        role: 'system',
        content: payload.stateSummary
    });

    // Инъекция логов недавних действий (обычно как сообщение от системы для контекста)
    if (payload.recentEvents.length > 0) {
        messages.push({
            role: 'system',
            content: payload.recentEvents.join('\n\n')
        });
    }

    return messages;
}
