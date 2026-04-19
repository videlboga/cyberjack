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

export async function parseVerbalInput(text: string, sceneContextStr?: string, sceneCharacters?: { id: string; name: string }[]): Promise<ParsedVerbalAction> {
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
ЕСЛИ текст является требованием или просьбой переместиться (например "подойди ко мне", "отойти в угол", "иди к Вексу"), добавь в JSON поле "intent": "move", а целевое место укажи в поле "targetLocation". В качестве "targetLocation" используй ТОЛЬКО имя зоны из списка, имя персонажа из списка, либо значение "initiator" (если запрос "подойди ко мне" или "ближе").\n`;
    }

    // If we have a structured list of characters, include it in the system prompt so the
    // LLM can resolve names to scene characters (name -> id).
    let charactersListForPrompt = '';
    if (sceneCharacters && sceneCharacters.length) {
        charactersListForPrompt = '\nТекущие персонажи в сцене:' + sceneCharacters.map(c => `\n- "${c.name}" -> ${c.id}`).join('');
    }

        const messages: any[] = [
                {
                        role: 'system',
                        content: `Ты — классификатор семантических параметров речи в симуляторе. В симуляторе сейчас можно изменять позу, применять состояние или давать команду на действие.
Текущий список доступных ID для контекстов/поз:
${ctxList}

Текущий список доступных ID для простых действий:
${actionList}

ЕСЛИ текст пользователя является требованием/просьбой применить одно из этих состояний (например, "на колени!", "надень наручники", "сними это немедленно", "встань"), добавь в JSON поле "intent": "activate_context" и поле "targetContext" со значением соответствующего ID контекста. ЕСЛИ требуют снять, используй intent "deactivate_context" и соответствующий ID.
ЕСЛИ текст является запросом или указанием выполнить конкретное действие (например, "поцелуй Векса", "ударь меня", "погладь"), добавь "intent": "perform_action", укажи ID подходящего действия в поле "targetAction", цель действия в поле "targetId" (если требуют ударить себя, укажи "initiator", если другого персонажа — его имя из сцены) и точку в "pointId".
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

Ответь ТОЛЬКО валидным JSON.` + charactersListForPrompt
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

        // Resolve potential target names returned by the LLM against the provided
        // structured sceneCharacters list (if available). Use normalization + simple
        // russian stem heuristics and a small fuzzy matcher to handle inflection
        // and minor misspellings.
        let resolvedTargetId: string | undefined = undefined;
        if (parsed.targetId) resolvedTargetId = parsed.targetId;
        if (parsed.targetId && sceneCharacters && sceneCharacters.length) {
            const raw = parsed.targetId.toString().trim();

            const stripDiacritics = (s: string) => s.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
            const cleanName = (s?: string) => {
                if (!s) return '';
                const noDiac = stripDiacritics(s);
                // replace non-letters/numbers with space, collapse spaces, lowercase
                return noDiac.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
            };

            // crude russian stemmer: remove common case endings from the last token
            const stemRussian = (s: string) => {
                if (!s) return '';
                const tokens = s.split(' ');
                const last = tokens.pop() || '';
                // common simple endings (not exhaustive) to strip from names/roles
                const endings = ['а','я','у','ю','ом','ем','ой','ей','е','и','ы','ов','ев','ова','ева','ину','ину','ин','ын','ьи','ью','ях','ами','ами'];
                let base = last;
                for (const e of endings) {
                    if (base.length - e.length >= 2 && base.endsWith(e)) {
                        base = base.slice(0, -e.length);
                        break;
                    }
                }
                tokens.push(base);
                return tokens.join(' ');
            };

            // Levenshtein distance for fuzzy matching
            const levenshtein = (a: string, b: string) => {
                if (a === b) return 0;
                const la = a.length, lb = b.length;
                if (la === 0) return lb;
                if (lb === 0) return la;
                const v = new Array(lb + 1).fill(0).map((_, i) => i);
                for (let i = 0; i < la; i++) {
                    let prev = i + 1;
                    for (let j = 0; j < lb; j++) {
                        const cost = a[i] === b[j] ? 0 : 1;
                        const cur = Math.min(v[j + 1] + 1, prev + 1, v[j] + cost);
                        v[j] = prev;
                        prev = cur;
                    }
                    v[lb] = prev;
                }
                return v[lb];
            };

            const parsedNorm = cleanName(raw);
            const parsedStem = stemRussian(parsedNorm);

            // exact id match (case-insensitive)
            const idMatch = sceneCharacters.find(c => c.id.toLowerCase() === parsedNorm || c.id.toLowerCase() === raw.toLowerCase());
            if (idMatch) {
                resolvedTargetId = idMatch.id;
                console.log(`[VerbalParser] Resolved targetId '${raw}' -> id '${idMatch.id}' (exact id match)`);
            } else {
                // prepare normalized variants of scene characters
                const variants = sceneCharacters.map(c => {
                    const name = c.name || '';
                    const norm = cleanName(name);
                    const stem = stemRussian(norm);
                    return { id: c.id, rawName: name, norm, stem };
                });

                // 1) exact normalized name
                let found = variants.find(v => v.norm === parsedNorm || v.norm === parsedStem || v.stem === parsedStem);
                if (found) {
                    resolvedTargetId = found.id;
                    console.log(`[VerbalParser] Resolved by normalized equality '${raw}' -> id '${found.id}' (name: '${found.rawName}')`);
                }

                // 2) contains / startsWith checks
                if (!resolvedTargetId) {
                    const contains = variants.find(v => v.norm.includes(parsedNorm) || parsedNorm.includes(v.norm) || v.stem.includes(parsedStem) || parsedStem.includes(v.stem));
                    if (contains) {
                        resolvedTargetId = contains.id;
                        console.log(`[VerbalParser] Resolved by contains/stem '${raw}' -> id '${contains.id}' (name: '${contains.rawName}')`);
                    }
                }

                // 3) fuzzy match using Levenshtein (pick best with ratio threshold)
                if (!resolvedTargetId) {
                    let best: { id: string; score: number; rawName: string } | null = null;
                    for (const v of variants) {
                        const a = parsedNorm;
                        const b = v.norm;
                        const dist = levenshtein(a, b);
                        const maxLen = Math.max(a.length, b.length) || 1;
                        const ratio = 1 - (dist / maxLen);
                        if (!best || ratio > best.score) best = { id: v.id, score: ratio, rawName: v.rawName };
                    }
                    if (best && best.score >= 0.65) {
                        resolvedTargetId = best.id;
                        console.log(`[VerbalParser] Fuzzy resolved '${raw}' -> id '${best.id}' (score=${best.score.toFixed(2)}, name='${best.rawName}')`);
                    }
                }
            }
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
            commandIntent = { type: 'perform_action', actionId: parsed.targetAction, targetId: resolvedTargetId || parsed.targetId || 'initiator', pointId: normalizedPoint };
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
