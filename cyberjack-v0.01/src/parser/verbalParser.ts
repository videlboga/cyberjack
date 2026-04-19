import { CompiledAction } from '../domain/types';
import { CommandIntent } from '../domain/resolver';
import { presetRepo } from '../infrastructure/repositories';
import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';

export interface ParsedVerbalAction extends Partial<CompiledAction> {
    pointId?: string;
    raw?: string;
    model?: string;
    commandIntent: CommandIntent;
}

export async function parseVerbalInput(text: string, sceneContextStr?: string): Promise<ParsedVerbalAction> {
    if (!text || text.trim() === "") {
        return { intensity: 0.1, valence: 0, contact: 0.1, sharpness: 0, novelty: 0.5, pointId: 'systemic', commandIntent: { type: 'none' } };
    }

    const ctxList = presetRepo.getAllActionPresets()
        .filter(act => act.contextConfig)
        .map(act => `- "${act.id}": ${act.label}`)
        .join('\n');

    const actionList = presetRepo.getAllActionPresets()
        .filter(act => !act.contextConfig && act.type !== 'system' && act.type !== 'wait')
        .map(act => `- "${act.id}": ${act.label}`)
        .join('\n');

    let moveInstructions = '';
    if (sceneContextStr) {
        moveInstructions = `Текущая сцена: ${sceneContextStr}
ЕСЛИ текст является приказом переместиться (например "подойди ко мне", "отойти в угол", "иди к Вексу"), добавь в JSON поле "intent": "move", а целевое место укажи в поле "targetLocation". В качестве "targetLocation" используй ТОЛЬКО имя зоны из списка, имя персонажа из списка, либо значение "initiator" (если приказ "подойди ко мне" или "ближе").\n`;
    }

    const messages: any[] = [
        {
            role: 'system',
            content: `Ты — классификатор семантических параметров речи в симуляторе. В симуляторе сейчас можно изменять позу, применять состояние или давать команду на действие.
Текущий список доступных ID для контекстов/поз:
${ctxList}

Текущий список доступных ID для простых действий:
${actionList}

ЕСЛИ текст пользователя является прямым приказом применить одно из этих состояний (например, "на колени!", "надень наручники", "сними это немедленно", "встань"), добавь в JSON поле "intent": "activate_context" и поле "targetContext" со значением соответствующего ID контекста. ЕСЛИ требуют снять, используй intent "deactivate_context" и соответствующий ID.
ЕСЛИ текст является приказом выполнить конкретное действие (например, "поцелуй Векса", "ударь меня", "погладь"), добавь "intent": "perform_action", укажи ID подходящего действия в поле "targetAction", цель действия в поле "targetId" (если требуют ударить себя, укажи "initiator", если другого персонажа — его имя из сцены) и точку в "pointId".
${moveInstructions}
Твоя задача — классифицировать фразу по 5 параметрам и намерению. Возможные дополнительные поля: "intent" ("activate_context", "deactivate_context", "move", "perform_action"), "targetContext" (для контекстов), "targetLocation" (для перемещения) или "targetAction" и "targetId" (для действий).
{
  "intensity": 0.0-1.0,
  "valence": -1.0..1.0,
  "contact": 0.0-1.0,
  "sharpness": 0.0-1.0,
  "novelty": 0.5,
  "pointId": "systemic"
}

Ответь ТОЛЬКО валидным JSON.`
        },
        { role: 'user', content: text }
    ];

    try {
        console.log(`[VerbalParser] Analyzing text: "${text}"`);
        
        const { parsed, model } = await parseVerbalInputWithLLM(messages); console.log("[VerbalParser] raw parsed:", JSON.stringify(parsed));

        const synonyms: Record<string, string> = {
            голова: 'head', лицо: 'face', губы: 'lips', шея: 'neck', плечи: 'shoulders',
            спина: 'back', грудь: 'chest', соски: 'nipples', живот: 'belly',
            талия: 'waist', бедра: 'hips', пах: 'groin', ягодицы: 'buttocks',
            икры: 'calves', колени: 'knees', ступни: 'feet',
            руки: 'hands', кисти: 'hands', запястья: 'wrists'
        };

        const normalize = (candidate?: string, txt?: string) => {
            if (!candidate && !txt) return 'systemic';
            if (candidate) {
                const c = candidate.toString().toLowerCase();
                if (synonyms[c]) return synonyms[c];
            }
            if (txt) {
                const lowerTxt = txt.toString().toLowerCase();
                for (const key of Object.keys(synonyms)) {
                    const re = new RegExp(`\\b${key}\\b`, 'i');
                    if (re.test(lowerTxt)) return synonyms[key];
                }
            }
            return candidate ?? 'systemic';
        };

        const normalizedPoint = normalize(parsed.pointId, text);
        if (normalizedPoint !== (parsed.pointId ?? 'systemic')) {
            console.log(`[VerbalParser] Normalized pointId '${parsed.pointId}' -> '${normalizedPoint}'`);
        }

        let commandIntent: CommandIntent = { type: 'none' };
        if ((parsed.intent === 'change_pose' || parsed.intent === 'activate_context') && parsed.targetContext) {
            commandIntent = { type: 'activate_context', targetContextId: parsed.targetContext };
        } else if (parsed.intent === 'change_context' && parsed.targetContext) {
            commandIntent = { type: 'activate_context', targetContextId: parsed.targetContext };
        } else if (parsed.intent === 'deactivate_context' && parsed.targetContext) {
            commandIntent = { type: 'deactivate_context', targetContextId: parsed.targetContext };
        } else if (parsed.intent === 'move' && parsed.targetLocation) {
            commandIntent = { type: 'move', targetLocation: parsed.targetLocation };
        } else if (parsed.intent === 'perform_action' && parsed.targetAction) {
            commandIntent = { type: 'perform_action', actionId: parsed.targetAction, targetId: parsed.targetId || 'initiator', pointId: normalizedPoint };
        }

        return {
            intensity: parsed.intensity ?? 0.3,
            valence: parsed.valence ?? 0,
            contact: parsed.contact ?? 0,
            sharpness: parsed.sharpness ?? 0,
            novelty: parsed.novelty ?? 0,
            pointId: normalizedPoint ?? 'systemic',
            commandIntent,
            raw: JSON.stringify(parsed),
            model: model ?? 'google/gemini-3.1-flash-lite-preview'
        };
    } catch (error: any) {
        console.error("[VerbalParser] Failed to classify text:", error.message);
        return { intensity: 0.3, valence: 0, contact: 0.1, sharpness: 0.1, novelty: 0.5, pointId: 'systemic', raw: error.message, model: 'google/gemini-3.1-flash-lite-preview', commandIntent: { type: 'none' } };
    }
}
