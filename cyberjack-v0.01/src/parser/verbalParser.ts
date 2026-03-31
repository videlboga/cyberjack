import { CompiledAction } from '../domain/types';

/**
 * Простой парсер текста, который определяет базовые "интенции" (intents),
 * теперь переведен на LLM-классификатор (OpenRouter).
 */
export async function parseVerbalInput(text: string): Promise<Partial<CompiledAction>> {
    const OPENROUTER_API_KEY = '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';
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Если ничего не передали, возвращаем нейтральный вектор
    if (!text || text.trim() === "") {
        return { intensity: 0.1, valence: 0, contact: 0.1, sharpness: 0, novelty: 0.5 };
    }

    const messages = [
        {
            role: 'system',
            content: `Ты — классификатор семантических параметров речи в симуляторе. Твоя задача — классифицировать пользовательскую фразу по 5 параметрам (от 0.0 до 1.0, кроме valence: от -1.0 до 1.0).
{
  "intensity": 0.0-1.0, // Сила эмоциональной нагрузки, громкость или угроза. Обычная речь ~0.3
  "valence": -1.0..1.0, // Негативная/Позитивная окраска. Оскорбления = -0.8, похвала = 0.8
  "contact": 0.0-1.0, // Насколько это личное или интимное обращение
  "sharpness": 0.0-1.0, // Резкость, внезапность, грубость
  "novelty": 0.5 // Оставь 0.5 по умолчанию
}

Оценивай именно семантику СЛОВ. Если это угроза — высокая intensity, низкая valence. Если нежное успокоение — низкая intensity, высокая valence.
Ответь ТОЛЬКО валидным JSON.`
        },
        { role: 'user', content: text }
    ];

    try {
        console.log(`[VerbalParser] Analyzing text: "${text}"`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}` // Hardcoded for prototype
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-v3.2', // fast, cheap and supports JSON output
                messages,
                temperature: 0.1,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }
        
        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content || "{}";
        const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        
        console.log(`[VerbalParser] Extracted semantics:`, parsed);
        return {
            intensity: parsed.intensity ?? 0.3,
            valence: parsed.valence ?? 0,
            contact: parsed.contact ?? 0.1,
            sharpness: parsed.sharpness ?? 0.1,
            novelty: parsed.novelty ?? 0.5,
        };
    } catch (error: any) {
        console.error("[VerbalParser] Failed to classify text:", error.message);
        // Fallback to neutral values if OpenRouter throws
        return { intensity: 0.3, valence: 0, contact: 0.1, sharpness: 0.1, novelty: 0.5 };
    }
}