import { CompiledAction } from '../domain/types';
import { CommandIntent } from '../domain/resolver';
import { presetRepo, characterItemsRepo, itemRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';

export interface ParsedVerbalAction extends Partial<CompiledAction> {
    pointId?: string;
    raw?: string;
    model?: string;
    commandIntent: CommandIntent;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Extract text wrapped in *asterisks* — RP-style action descriptions.
// Returns the first match (trimmed) or null.
export function extractDescribedAction(text: string): string | null {
    // Match *...* but not **...** (bold) and not empty
    // We want single-asterisk RP actions: *Глажу по щеке*
    const match = text.match(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/);
    if (match && match[1].trim().length > 0) {
        return match[1].trim();
    }
    return null;
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
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
}

// ─── Described Action Parser ────────────────────────────────────────────────
// Parses RP-style actions like *Глажу по щеке* or *бью по спине хлыстом*.
// Returns a perform_described_action intent with either a matched preset
// or a refusal with reasoning (e.g. missing item).

interface DescribedActionLLMResult {
    matchedActionId: string | null;  // best matching action preset ID or null
    matchConfidence: number;          // 0.0–1.0 — how close the match is
    pointId: string;                  // body point target
    targetId?: string;                // target character name/id
    requiredItem?: string;            // item ID if the action implies a tool
    itemMentioned?: string;            // raw item name the user mentioned (for refusal message)
    modifiers: {
        intensity: number;
        valence: number;
        contact: number;
        sharpness: number;
        novelty: number;
    };
    refusalReason?: string;           // if LLM already knows it can't map
}

async function parseDescribedAction(
    actionText: string,
    sceneContextStr?: string,
    sceneCharacters?: { id: string; name: string }[]
): Promise<{ result: DescribedActionLLMResult; model: string }> {
    const ctxList = presetRepo.getAllActionPresets()
        .filter(act => act.contextConfig)
        .map(act => `- "${act.id}": ${act.label}`)
        .join('\n');

    const actionList = presetRepo.getAllActionPresets()
        .filter(act => !act.contextConfig && act.type !== 'system' && act.type !== 'wait')
        .map(act => `- "${act.id}": ${act.label} — ${act.vector?.description || ''}`)
        .join('\n');

    // Build items list for the LLM to reference
    const itemsList = itemRepo.getAll()
        .map(item => `- "${item.id}": ${item.name} (${item.type})`)
        .join('\n');

    let charactersListForPrompt = '';
    if (sceneCharacters && sceneCharacters.length) {
        charactersListForPrompt = '\nТекущие персонажи в сцене:' + sceneCharacters.map(c => `\n- "${c.name}" -> ${c.id}`).join('');
    }

    const messages: any[] = [
        {
            role: 'system',
            content: `Ты — классификатор описанных действий в RP-формате (текст в звёздочках).
Пользователь описывает физическое действие в формате *действие*. Твоя задача — сопоставить это описание с известными пресетами действий.

Текущий список доступных ID для контекстов/поз:
${ctxList}

Текущий список доступных ID для простых действий:
${actionList}

Текущий список предметов в игре:
${itemsList}

Правила:
1. Найди НАИБОЛЕЕ ПОХОЖИЙ пресет действия. Если есть прямое соответствие (например "глажу" → act_caress, "бью" → act_slap) — используй его ID.
2. Если прямого соответствия нет, выбери БЛИЖАЙШИЙ по смыслу (например "шлёпаю" → act_slap, "целую в лоб" → act_kiss).
3. Если действие требует предмета (оружие, инструмент, препарат) — укажи его ID в requiredItem. Если пользователь упоминает предмет, которого нет в списке — оставь requiredItem пустым и укажи refusalReason с описанием проблемы.
4. Определи точку воздействия (pointId) по русскому названию части тела.
5. Если действие вообще не сопоставимо ни с чем из списка — установи matchedActionId в null и объясни причину в refusalReason.

Синонимы частей тела: голова=head, лицо=face, губы=lips, шея=neck, плечи=shoulders, спина=back, грудь=chest, соски=nipples, живот=belly, талия=waist, бедра=hips, пах=groin, ягодицы=buttocks, икры=calves, колени=knees, ступни=feet, руки=hands, кисти=hands, запястья=wrists

Ответь ТОЛЬКО валидным JSON:
{
    "matchedActionId": "act_xxx" | null,
    "matchConfidence": 0.0-1.0,
    "pointId": "face",
    "targetId": "имя или null",
    "requiredItem": "eq_xxx" | null,
    "itemMentioned": "название предмета из текста или null",
    "modifiers": { "intensity": 0.0-1.0, "valence": -1.0-1.0, "contact": 0.0-1.0, "sharpness": 0.0-1.0, "novelty": 0.0-1.0 },
    "refusalReason": "текст или null"
}` + charactersListForPrompt
        },
        { role: 'user', content: `*${actionText}*` }
    ];

    console.log(`[VerbalParser] Analyzing described action: "*${actionText}*"`);

    const { parsed, model } = await parseVerbalInputWithLLM(messages);
    console.log('[VerbalParser] described action raw parsed:', JSON.stringify(parsed));

    // Normalize pointId
    const synonyms: Record<string, string> = {
        голова: 'head', лицо: 'face', губы: 'lips', шея: 'neck', плечи: 'shoulders',
        спина: 'back', грудь: 'chest', соски: 'nipples', живот: 'belly',
        талия: 'waist', бедра: 'hips', пах: 'groin', ягодицы: 'buttocks',
        икры: 'calves', колени: 'knees', ступни: 'feet',
        руки: 'hands', кисти: 'hands', запястья: 'wrists'
    };
    const normalizePoint = (candidate?: string, txt?: string) => {
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

    const result: DescribedActionLLMResult = {
        matchedActionId: parsed.matchedActionId ?? null,
        matchConfidence: parsed.matchConfidence ?? 0,
        pointId: normalizePoint(parsed.pointId, actionText),
        targetId: parsed.targetId && parsed.targetId !== 'null' ? parsed.targetId : undefined,
        requiredItem: parsed.requiredItem && parsed.requiredItem !== 'null' ? parsed.requiredItem : undefined,
        itemMentioned: parsed.itemMentioned && parsed.itemMentioned !== 'null' ? parsed.itemMentioned : undefined,
        modifiers: {
            intensity: parsed.modifiers?.intensity ?? 0.3,
            valence: parsed.modifiers?.valence ?? 0,
            contact: parsed.modifiers?.contact ?? 0.3,
            sharpness: parsed.modifiers?.sharpness ?? 0,
            novelty: parsed.modifiers?.novelty ?? 0.5
        },
        refusalReason: parsed.refusalReason && parsed.refusalReason !== 'null' ? parsed.refusalReason : undefined
    };

    return { result, model };
}

// ─── Main Parser ────────────────────────────────────────────────────────────

export async function parseVerbalInput(
    text: string,
    sceneContextStr?: string,
    sceneCharacters?: { id: string; name: string }[],
    playerId?: string
): Promise<ParsedVerbalAction> {
    if (!text || text.trim() === "") {
        return { intensity: 0.1, valence: 0, contact: 0.1, sharpness: 0, novelty: 0.5, pointId: 'systemic', commandIntent: { type: 'none' } };
    }

    // ── Check for described action in asterisks: *...* ──
    const describedAction = extractDescribedAction(text);
    if (describedAction) {
        try {
            const { result, model } = await parseDescribedAction(describedAction, sceneContextStr, sceneCharacters);

            // Resolve target character if needed
            // Default: the target is the subject (the character being acted upon).
            // If the LLM returned a targetId, try to resolve it against scene characters.
            // If no targetId, find the first non-player character in the scene (the subject).
            let resolvedTargetId: string | undefined = undefined;
            if (result.targetId && sceneCharacters && sceneCharacters.length) {
                const raw = result.targetId.toString().trim();
                const cleanName = (s?: string) => s ? s.toLowerCase().trim() : '';
                const parsedNorm = cleanName(raw);
                const found = sceneCharacters.find(c => {
                    const nameNorm = cleanName(c.name);
                    return nameNorm === parsedNorm || nameNorm.includes(parsedNorm) || parsedNorm.includes(nameNorm);
                });
                if (found) resolvedTargetId = found.id;
            }
            // If still unresolved, default to the first non-player character (the subject)
            if (!resolvedTargetId && sceneCharacters && sceneCharacters.length) {
                const subject = sceneCharacters.find(c => !c.id.startsWith('PL-'));
                if (subject) resolvedTargetId = subject.id;
            }

            // ── Check inventory for requiredItem ──
            let refusal: string | undefined;
            if (result.refusalReason) {
                // LLM already determined a refusal
                refusal = result.refusalReason;
            } else if (result.matchedActionId === null) {
                // No match found
                refusal = result.refusalReason || `Не удалось сопоставить действие "*${describedAction}*" с известными действиями.`;
            } else if (result.requiredItem && playerId) {
                // Check if the player has the required item
                // Find the player's character in the scene
                const sceneId = sceneContextStr; // not ideal but we don't have sceneId here directly
                // We need the character id for inventory lookup
                // The playerId might be a character id or a player id — try both paths
                let charId: string | undefined = playerId;
                // If sceneCharacters are available, try to find the player among them
                if (sceneCharacters && sceneCharacters.length) {
                    // Try to match playerId against scene character ids
                    const match = sceneCharacters.find(c => c.id === playerId || c.id === `PL-${playerId}`);
                    if (match) charId = match.id;
                }

                const item = characterItemsRepo.get(charId, result.requiredItem);
                if (!item || item.state === 'consumed' || item.state === 'broken') {
                    // Get the human-readable item name
                    const itemInfo = itemRepo.get(result.requiredItem);
                    const itemDisplayName = itemInfo?.name || result.itemMentioned || result.requiredItem;
                    refusal = `У вас нет предмета "${itemDisplayName}".`;
                }
            }

            const commandIntent: CommandIntent = {
                type: 'perform_described_action',
                description: describedAction,
                matchedActionId: result.matchedActionId,
                targetId: resolvedTargetId,
                pointId: result.pointId,
                requiredItem: result.requiredItem,
                refusal,
                modifiers: result.modifiers
            };

            return {
                intensity: result.modifiers.intensity,
                valence: result.modifiers.valence,
                contact: result.modifiers.contact,
                sharpness: result.modifiers.sharpness,
                novelty: result.modifiers.novelty,
                pointId: result.pointId,
                commandIntent,
                raw: JSON.stringify(result),
                model
            };
        } catch (error: any) {
            console.error('[VerbalParser] Described action parsing failed:', error.message);
            // Fallback: return a refusal
            return {
                intensity: 0.2,
                valence: 0,
                contact: 0.1,
                sharpness: 0.1,
                novelty: 0.5,
                pointId: 'systemic',
                commandIntent: {
                    type: 'perform_described_action',
                    description: describedAction,
                    matchedActionId: null,
                    pointId: 'systemic',
                    refusal: `Ошибка разбора действия: ${error.message}`
                },
                raw: error.message,
                model: 'google/gemini-3.1-flash-lite-preview'
            };
        }
    }

    // ── Regular verbal command parsing (existing logic) ──

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
ЕСЛИ текст является требованием или просьбой переместиться (например "подойди ко мне", "отойти в угол", "иди к Вексу"), добавь в JSON поле "intent": "move", а целевое место укажи в поле "targetLocation". В качестве "targetLocation" используй ТОЛЬКО имя зоны из списка, имя персонажа из списка, либо значение "initiator" (если запрос "подойди ко мне" или "ближе").
`;
    }

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

    const { parsed, model } = await parseVerbalInputWithLLM(messages); console.log('[VerbalParser] raw parsed:', JSON.stringify(parsed));

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
                return noDiac.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
            };

            const stemRussian = (s: string) => {
                if (!s) return '';
                const tokens = s.split(' ');
                const last = tokens.pop() || '';
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

            const parsedNorm = cleanName(raw);
            const parsedStem = stemRussian(parsedNorm);

            const idMatch = sceneCharacters.find(c => c.id.toLowerCase() === parsedNorm || c.id.toLowerCase() === raw.toLowerCase());
            if (idMatch) {
                resolvedTargetId = idMatch.id;
                console.log(`[VerbalParser] Resolved targetId '${raw}' -> id '${idMatch.id}' (exact id match)`);
            } else {
                const variants = sceneCharacters.map(c => {
                    const name = c.name || '';
                    const norm = cleanName(name);
                    const stem = stemRussian(norm);
                    return { id: c.id, rawName: name, norm, stem };
                });

                let found = variants.find(v => v.norm === parsedNorm || v.norm === parsedStem || v.stem === parsedStem);
                if (found) {
                    resolvedTargetId = found.id;
                    console.log(`[VerbalParser] Resolved by normalized equality '${raw}' -> id '${found.id}' (name: '${found.rawName}')`);
                }

                if (!resolvedTargetId) {
                    const contains = variants.find(v => v.norm.includes(parsedNorm) || parsedNorm.includes(v.norm) || v.stem.includes(parsedStem) || parsedStem.includes(v.stem));
                    if (contains) {
                        resolvedTargetId = contains.id;
                        console.log(`[VerbalParser] Resolved by contains/stem '${raw}' -> id '${contains.id}' (name: '${contains.rawName}')`);
                    }
                }

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
        console.error('[VerbalParser] Failed to classify text:', error.message);
        return { intensity: 0.3, valence: 0, contact: 0.1, sharpness: 0.1, novelty: 0.5, pointId: 'systemic', raw: error.message, model: 'google/gemini-3.1-flash-lite-preview', commandIntent: { type: 'none' } };
    }
}