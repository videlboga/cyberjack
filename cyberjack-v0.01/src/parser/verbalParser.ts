import { CompiledAction } from '../domain/types';
import { CommandIntent } from '../domain/resolver';

export interface ParsedVerbalAction extends Partial<CompiledAction> {
    pointId?: string;
    raw?: string;
    model?: string;
    commandIntent: CommandIntent;
}

export async function parseVerbalInput(text: string): Promise<ParsedVerbalAction> {
    const OPENROUTER_API_KEY = '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';
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    if (!text || text.trim() === "") {
        return { intensity: 0.1, valence: 0, contact: 0.1, sharpness: 0, novelty: 0.5, pointId: 'general', commandIntent: { type: 'none' } };
    }

    const messages = [
        {
            role: 'system',
            content: `Ты — классификатор семантических параметров речи в симуляторе. В симуляторе сейчас можно изменять позу (на колени, ложись, звездой).
ЕСЛИ пользователь явно приказывает сменить позу или состояние (например "Встань на колени", "Ложись", "Рогатка", "Звездой"), тогда помимо параметров добавь поле "intent": "change_pose" и поле "targetContext": со значением "pose_kneeling", "pose_lying" или "pose_spread_eagle".

Твоя задача — классифицировать пользовательскую фразу по 5 параметрам (от 0.0 до 1.0, кроме valence: от -1.0 до 1.0) и определить цель воздействия (pointId).
{
  "intensity": 0.0-1.0,
  "valence": -1.0..1.0,
  "contact": 0.0-1.0,
  "sharpness": 0.0-1.0,
  "novelty": 0.5,
  "pointId": "general"
}

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
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`
            },
            body: JSON.stringify({
                model: 'google/gemini-3.1-flash-lite-preview',
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
        
        const synonyms: Record<string, string> = {
            голова: 'head', лицо: 'face', губы: 'lips', шея: 'neck', плечи: 'shoulders',
            спина: 'back', грудь: 'chest', соски: 'nipples', живот: 'belly', 
            талия: 'waist', бедра: 'hips', пах: 'groin', ягодицы: 'buttocks', 
            икры: 'calves', колени: 'knees', ступни: 'feet', 
            руки: 'hands', кисти: 'hands', запястья: 'wrists'
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

        let commandIntent: CommandIntent = { type: 'none' };
        if (parsed.intent === 'change_pose' && parsed.targetContext) {
            commandIntent = { type: 'change_pose', targetPoseId: parsed.targetContext };
        } else if (parsed.intent === 'change_context' && parsed.targetContext) {
            // alias just in case
            commandIntent = { type: 'change_pose', targetPoseId: parsed.targetContext };
        }

        return {
            intensity: parsed.intensity ?? 0.3,
            valence: parsed.valence ?? 0,
            contact: parsed.contact ?? 0.1,
            sharpness: parsed.sharpness ?? 0.1,
            novelty: parsed.novelty ?? 0.5,
            pointId: normalizedPoint ?? 'general',
            commandIntent,
            raw: rawText,
            model: 'google/gemini-3.1-flash-lite-preview'
        };
    } catch (error: any) {
        console.error("[VerbalParser] Failed to classify text:", error.message);
        return { intensity: 0.3, valence: 0, contact: 0.1, sharpness: 0.1, novelty: 0.5, pointId: 'general', raw: error.message, model: 'google/gemini-3.1-flash-lite-preview', commandIntent: { type: 'none' } };
    }
}
