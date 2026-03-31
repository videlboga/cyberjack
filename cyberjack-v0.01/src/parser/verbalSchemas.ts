/**
 * Схемы для разбора вербальных действий и намерений.
 */

// Тип намерения (информационное, угроза, похвала и т.д.)
export type VerbalIntentType = 'praise' | 'insult' | 'question' | 'command' | 'neutral';

// Результат разбора реплики
export interface ParsedVerbalAction {
    originalText: string;
    intent: VerbalIntentType;
    intensity: number; // Насколько сильно выражено намерение (0.0 - 1.0)
    topics: string[]; // Ключевые темы, затронутые в тексте
}
