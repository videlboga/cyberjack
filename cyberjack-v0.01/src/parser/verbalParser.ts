import { CompiledAction } from '../domain/types';

/**
 * Простой парсер текста, который определяет базовые "интенции" (intents),
 * теперь переведен на LLM-классификатор (OpenRouter).
 */
export interface ParsedVerbalAction extends Partial<CompiledAction> {
    pointId?: string;
    raw?: string; // raw model output for debugging
    model?: string;
}

export async function parseVerbalInput(text: string): Promise<ParsedVerbalAction> {
    const OPENROUTER_API_KEY = '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';
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    // Если ничего не передали, возвращаем нейтральный вектор
    if (!text || text.trim() === "") {
        return { intensity: 0.1, valence: 0, contact: 0.1, sharpness: 0, novelty: 0.5, pointId: 'general' };
    }

    const messages = [
        {
            role: 'system',
            content: `Ты — классификатор семантических параметров речи в симуляторе. Твоя задача — классифицировать пользовательскую фразу по 5 параметрам (от 0.0 до 1.0, кроме valence: от -1.0 до 1.0) и определить цель воздействия (pointId).
{
  "intensity": 0.0-1.0, // Сила эмоциональной нагрузки, громкость или угроза. Обычный вопрос ~0.1, Угроза ~0.9
  "valence": -1.0..1.0, // Негативная/Позитивная окраска. Оскорбления = -0.8, забота = 0.8, нейтрально = 0.0
  "contact": 0.0-1.0, // Наличие физического сокращения дистанции или просьбы о прикосновении. Если это просто слова на расстоянии = 0.0
  "sharpness": 0.0-1.0, // Резкость, внезапность, грубость (от 0.0 для плавных слов, до 1.0 для крика)
  "novelty": 0.5, // Оставь 0.5 по умолчанию
  "pointId": "general" // Куда направлено действие. Выбери из: head, face, lips, neck, shoulders, back, chest, nipples, belly, arms, wrists, hands, waist, hips, groin, buttocks, inner_thighs, knees, calves, feet. Если это просто слова без указания части тела, возвращай "general".
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
                    model: 'google/gemini-3.1-flash-lite-preview', // Ultra-fast model for simple classification
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
        console.log(`[VerbalParser] Model raw output:`, rawText);

        const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        
        console.log(`[VerbalParser] Extracted semantics:`, parsed);
        // Normalize pointId using synonyms map (covers English and Russian variants)
        const synonyms: Record<string, string> = {
            // English -> canonical
            head: 'head', hair: 'head', scalp: 'head', face: 'face', cheek: 'face', cheeks: 'face', nose: 'face', eyes: 'face', mouth: 'lips', lips: 'lips', neck: 'neck', nape: 'neck', shoulders: 'shoulders', shoulder: 'shoulders', back: 'back', chest: 'chest', breasts: 'chest', nipples: 'nipples', stomach: 'belly', tummy: 'belly', belly: 'belly', waist: 'waist', hips: 'hips', hip: 'hips', groin: 'groin', crotch: 'groin', genitals: 'groin', butt: 'buttocks', buttocks: 'buttocks', ass: 'buttocks', inner_thighs: 'inner_thighs', thigh: 'inner_thighs', thighs: 'inner_thighs', legs: 'calves', leg: 'calves', knees: 'knees', knee: 'knees', calves: 'calves', calf: 'calves', shins: 'calves', feet: 'feet', foot: 'feet', toes: 'feet', soles: 'feet', arms: 'arms', arm: 'arms', hands: 'hands', hand: 'hands', palms: 'hands', fingers: 'hands', wrists: 'wrists', wrist: 'wrists',
            // Russian -> canonical
            голова: 'head', волосы: 'head', макушка: 'head', лицо: 'face', щека: 'face', щеки: 'face', нос: 'face', глаза: 'face', рот: 'lips', губы: 'lips', шея: 'neck', затылок: 'neck', плечи: 'shoulders', плечо: 'shoulders', спина: 'back', грудь: 'chest', соски: 'nipples', живот: 'belly', пузо: 'belly', талия: 'waist', бедра: 'hips', пах: 'groin', гениталии: 'groin', ягодицы: 'buttocks', попа: 'buttocks', икра: 'calves', икры: 'calves', ноги: 'calves', ножки: 'calves', колено: 'knees', колени: 'knees', стопы: 'feet', ступни: 'feet', палец: 'hands', пальцы: 'hands', кисти: 'hands', ладони: 'hands', запястья: 'wrists'
        };

        const normalize = (candidate?: string, text?: string) => {
            if (!candidate && !text) return 'general';
            if (candidate) {
                const c = candidate.toString().toLowerCase();
                if (synonyms[c]) return synonyms[c];
            }
            if (text) {
                const txt = text.toString().toLowerCase();
                for (const key of Object.keys(synonyms)) {
                    // word boundary check
                    const re = new RegExp(`\\b${key}\\b`, 'i');
                    if (re.test(txt)) return synonyms[key];
                }
            }
            return candidate ?? 'general';
        };

        const normalizedPoint = normalize(parsed.pointId, rawText);
        if (normalizedPoint !== (parsed.pointId ?? 'general')) {
            console.log(`[VerbalParser] Normalized pointId '${parsed.pointId}' -> '${normalizedPoint}'`);
        }

        return {
            intensity: parsed.intensity ?? 0.3,
            valence: parsed.valence ?? 0,
            contact: parsed.contact ?? 0.1,
            sharpness: parsed.sharpness ?? 0.1,
            novelty: parsed.novelty ?? 0.5,
            pointId: normalizedPoint ?? 'general',
            raw: rawText,
            model: 'google/gemini-3.1-flash-lite-preview'
        };
    } catch (error: any) {
        console.error("[VerbalParser] Failed to classify text:", error.message);
        console.log("[VerbalParser] Error stack / details:", error);
    // Fallback to neutral values if OpenRouter throws (include error for debugging)
    return { intensity: 0.3, valence: 0, contact: 0.1, sharpness: 0.1, novelty: 0.5, pointId: 'general', raw: error.message, model: 'google/gemini-3.1-flash-lite-preview' };
    }
}