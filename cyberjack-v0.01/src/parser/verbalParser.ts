import { ParsedVerbalAction } from './verbalSchemas';

/**
 * Простой парсер текста, который определяет базовые "интенции" (intents).
 * Пока что это заглушка, в будущем сюда можно подключить локальную нейросеть
 * (например, через transformers.js) или использовать API для классификации текста.
 */
export function parseVerbalInput(text: string): ParsedVerbalAction {
    const lowerText = text.toLowerCase();
    
    // Простая эвристика-заглушка
    if (lowerText.includes('good') || lowerText.includes('great') || lowerText.includes('beautiful')) {
        return {
            originalText: text,
            intent: 'praise',
            intensity: 0.7,
            topics: ['appearance', 'performance']
        };
    }
    
    if (lowerText.includes('stupid') || lowerText.includes('bad') || lowerText.includes('idiot')) {
        return {
            originalText: text,
            intent: 'insult',
            intensity: 0.8,
            topics: ['intelligence', 'character']
        };
    }
    
    if (lowerText.includes('?')) {
        return {
            originalText: text,
            intent: 'question',
            intensity: 0.5,
            topics: ['information']
        };
    }

    if (lowerText.startsWith('do ') || lowerText.startsWith('go ') || lowerText.startsWith('stop')) {
        return {
            originalText: text,
            intent: 'command',
            intensity: 0.9,
            topics: ['action']
        };
    }

    return {
        originalText: text,
        intent: 'neutral',
        intensity: 0.1,
        topics: ['general']
    };
}
