import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';
import { presetRepo } from '../infrastructure/repositories';
import type { CommandIntent } from '../domain/resolver';
import { conditioningTags } from '../domain/conditioning';

type Candidate = { id: string; label: string; kind: 'action' | 'context' | 'point'; text: string; tags?: string[]; vector?: number[] };
type SceneCharacter = { id: string; name: string };

const CHARACTER_CONTROLLED_CONTEXT_TAGS = new Set(['pose', 'clothing', 'exposure']);

/**
 * Parser-boundary heuristic: a generic "undress" command (no specific garment
 * named) is resolved to the remove-worn-clothing action. This is the single
 * place that reinterprets command text; command resolution downstream only
 * collects the active clothing contexts to remove.
 */
export function isCharacterControlledContext(candidate: Pick<Candidate, 'tags'> | undefined) {
    return Boolean(candidate?.tags?.some(tag => CHARACTER_CONTROLLED_CONTEXT_TAGS.has(tag)));
}

export function hasVerifiedDirectiveEvidence(text: string, command: any) {
    if (command?.explicitDirective !== true) return false;
    const evidence = String(command?.directiveEvidence || '').trim();
    if (evidence.length < 2) return false;
    return text.toLocaleLowerCase('ru-RU').includes(evidence.toLocaleLowerCase('ru-RU'));
}

export function resolveRecipientSpeechValence(
    text: string,
    recentCharacterSpeech: string,
    recipientAppraisal: unknown,
    surfaceTone: unknown,
) {
    const line = text.toLocaleLowerCase('ru-RU');
    const previous = recentCharacterSpeech.toLocaleLowerCase('ru-RU');
    const refusal = /не надо|не хочу|останов(?:ись|итесь)|без разрешения|не име(?:ете|ешь) права|я отказываюсь|мне страш/.test(previous);
    const overridesRefusal = /не волнуй|ничего страшного|тебе понравится|вам понравится|расслабься|просто потерпи|привыкнешь/.test(line);
    // A pleasant surface formulation does not make ignoring an immediately
    // preceding refusal pleasant for its recipient.
    if (refusal && overridesRefusal) return -0.85;
    return clamp(recipientAppraisal, -1, 1, clamp(surfaceTone, -1, 1, 0));
}

async function verifyExecutableCommand(
    text: string,
    proposedCommand: Record<string, unknown>,
    addressedCharacter: string,
): Promise<boolean> {
    const messages: any[] = [{
        role: 'system',
        content: `Проверь только один факт: содержит ли сообщение прямую исполняемую просьбу или приказ персонажу ${addressedCharacter} что-либо сделать.

Исполняется только действие адресата. Рассказ игрока о том, что он сам сейчас или позже сделает, предупреждение о будущем воздействии, описание намерения, обсуждение, вопрос и упоминание действия — не команда.
Не оценивай близость к действию и не додумывай подразумеваемую просьбу. Для true в тексте должна существовать точная цитата, прямо предписывающая действие адресату.

Предложенный первым классификатором разбор: ${JSON.stringify(proposedCommand)}

Верни JSON: {"executable":true|false,"directiveEvidence":"точная цитата прямого предписания или пустая строка","reason":"кратко"}`,
    }, { role: 'user', content: text }];
    try {
        const { parsed } = await parseVerbalInputWithLLM(messages);
        return parsed?.executable === true && hasVerifiedDirectiveEvidence(text, {
            explicitDirective: true,
            directiveEvidence: parsed.directiveEvidence,
        });
    } catch {
        // A doubtful command remains dialogue; parser availability must never
        // authorize a scene mutation.
        return false;
    }
}

const EMBEDDING_MODEL = process.env.PARSER_EMBEDDING_MODEL || 'perplexity/pplx-embed-v1-0.6b';
const EMBEDDING_FALLBACK_MODELS = (process.env.PARSER_EMBEDDING_FALLBACK_MODELS || 'qwen/qwen3-embedding-8b')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => value !== EMBEDDING_MODEL);
let indexedCatalog: Promise<Candidate[]> | null = null;
let activeEmbeddingModel: string | null = null;

async function embed(input: string[]): Promise<number[][]> {
    const key = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || '';
    const models = activeEmbeddingModel
        ? [activeEmbeddingModel, ...[EMBEDDING_MODEL, ...EMBEDDING_FALLBACK_MODELS].filter(model => model !== activeEmbeddingModel)]
        : [EMBEDDING_MODEL, ...EMBEDDING_FALLBACK_MODELS];
    let lastError: unknown;
    for (const model of models) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
                body: JSON.stringify({ model, input })
            });
            if (!response.ok) throw new Error(`Embedding HTTP ${response.status}: ${await response.text()}`);
            const body = await response.json() as any;
            const vectors = (body.data || []).sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding);
            if (vectors.length !== input.length || vectors.some((vector: unknown) => !Array.isArray(vector) || vector.length === 0)) {
                throw new Error('Embedding response has no usable vectors');
            }
            activeEmbeddingModel = model;
            return vectors;
        } catch (error: any) {
            lastError = error;
            if (model !== models.at(-1)) console.warn(`[SemanticParser] embedding model ${model} failed; trying next model:`, error?.message || error);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError || 'All embedding models failed'));
}

function catalogEntries(): Candidate[] {
    const actions = presetRepo.getAllActionPresets()
        .filter(action => action.type !== 'system' && action.type !== 'wait')
        .map(action => ({
            id: action.id,
            label: action.label,
            tags: Array.isArray(action.tags) ? action.tags : [],
            kind: action.contextConfig ? 'context' as const : 'action' as const,
            text: `${action.contextConfig ? 'состояние, поза или процесс' : 'действие'}: ${action.label}. ${(action.vector as any)?.description || ''}`
        }));
    const points = presetRepo.getAllPointPresets().map(point => ({
        id: point.id, label: point.label, kind: 'point' as const,
        text: `часть или зона тела: ${point.label}`
    }));
    return [...actions, ...points];
}

async function getCatalog(): Promise<Candidate[]> {
    if (!indexedCatalog) indexedCatalog = (async () => {
        const entries = catalogEntries();
        const vectors = await embed(entries.map(entry => entry.text));
        return entries.map((entry, index) => ({ ...entry, vector: vectors[index] }));
    })().catch(error => {
        indexedCatalog = null;
        throw error;
    });
    return indexedCatalog;
}

export async function warmSemanticParser() {
    const started = performance.now();
    await getCatalog();
    console.log(`[SemanticParser] catalog warmed in ${Math.round(performance.now() - started)}ms`);
}

function cosine(a: number[], b: number[]) {
    let dot = 0, aa = 0, bb = 0;
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index++) {
        dot += a[index] * b[index]; aa += a[index] ** 2; bb += b[index] ** 2;
    }
    return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}

async function retrieve(text: string) {
    const [catalog, [query]] = await Promise.all([getCatalog(), embed([text])]);
    const ranked = catalog.map(entry => ({ ...entry, score: cosine(query, entry.vector || []) }))
        .sort((left, right) => right.score - left.score);
    return {
        actions: ranked.filter(item => item.kind === 'action').slice(0, 8),
        contexts: ranked.filter(item => item.kind === 'context').slice(0, 6),
        points: ranked.filter(item => item.kind === 'point').slice(0, 6)
    };
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function isPlayerPhysicalCommand(command: { type?: string; actorId?: string | null }, defaultActorId: string, playerId = 'PL-1') {
    if (command.type !== 'perform_action') return false;
    const actorId = String(command.actorId || defaultActorId).toLocaleLowerCase('ru-RU');
    const playerAliases = new Set(
        [playerId, 'PL-1', 'player', 'initiator', 'калибратор']
            .map(value => value.toLocaleLowerCase('ru-RU')),
    );
    return playerAliases.has(actorId);
}

/**
 * Strict JSON Schema для семантического парсера. Structured output заставляет
 * модель вернуть ВСЕ поля (включая command.contextId для change_pose), поэтому
 * эвристики (лексика/эмбеддинг) не нужны: правильную позу выбирает сам LLM
 * из явного списка доступных поз.
 */
export const PARSER_SCHEMA = {
    name: 'cyberjack_semantic_parser',
    strict: true,
    value: {
        type: 'object',
        additionalProperties: false,
        properties: {
            speechType: { type: 'string', enum: ['conversation', 'question', 'praise', 'insult', 'command'] },
            tone: {
                type: 'object', additionalProperties: false,
                properties: {
                    valence: { type: 'number' },
                    intensity: { type: 'number' },
                    sharpness: { type: 'number' },
                },
                required: ['valence', 'intensity', 'sharpness'],
            },
            recipientAppraisal: {
                type: 'object', additionalProperties: false,
                properties: { valence: { type: 'number' } },
                required: ['valence'],
            },
            mentions: {
                type: 'object', additionalProperties: false,
                properties: {
                    actionIds: { type: 'array', items: { type: 'string' } },
                    pointIds: { type: 'array', items: { type: 'string' } },
                },
                required: ['actionIds', 'pointIds'],
            },
            pendingCommandRelation: { type: 'string', enum: ['continue', 'abandon', 'unrelated'] },
            command: {
                type: 'object', additionalProperties: false,
                properties: {
                    type: { type: 'string', enum: ['none', 'perform_action', 'change_pose', 'activate_context', 'deactivate_context', 'remove_worn_clothing', 'move', 'change_current_interaction'] },
                    directedAtCharacter: { type: 'boolean' },
                    explicitDirective: { type: 'boolean' },
                    directiveEvidence: { type: 'string' },
                    actorId: { type: ['string', 'null'] },
                    targetId: { type: ['string', 'null'] },
                    actionId: { type: ['string', 'null'] },
                    contextId: { type: ['string', 'null'] },
                    location: { type: ['string', 'null'] },
                    goal: { type: ['string', 'null'] },
                    pointId: { type: ['string', 'null'] },
                    misunderstood: { type: ['string', 'null'], enum: ['pose_unknown', 'action_unknown', 'target_unknown', 'action_and_target_unknown', null] },
                },
                required: ['type', 'directedAtCharacter', 'explicitDirective', 'directiveEvidence', 'actorId', 'targetId', 'actionId', 'contextId', 'location', 'goal', 'pointId', 'misunderstood'],
            },
            confidence: { type: 'number' },
        },
        required: ['speechType', 'tone', 'recipientAppraisal', 'mentions', 'pendingCommandRelation', 'command', 'confidence'],
    },
};

export async function parseSemanticVerbalInput(
    text: string,
    sceneContext: string,
    characters: SceneCharacter[],
    defaultActorId: string,
    defaultTargetId: string,
    recentCharacterSpeech = '',
    playerId = 'PL-1',
    pendingCommand?: { description: string } | null,
    recentDialogue = '',
) {
    const started = performance.now();
    const candidates = await retrieve(text);
    const compact = (items: Array<{ id: string; label: string }>) => items.map(item => `${item.id}=${item.label}`).join('; ');
    const characterList = characters.map(character => `${character.id}=${character.name}`).join('; ');
    // Буквальный список всех доступных поз — LLM должен выбрать ID из него,
    // а не додумывать. Позы с тегом exposure/feet — это позы-демонстрации,
    // которые могут быть целью команды «сядь так, чтобы я видел X».
    const allPosesArr = presetRepo.getAllActionPresets()
        .filter(action => (action as any).contextConfig?.type === 'pose');
    const allPoses = allPosesArr.map(action => `${action.id}=${action.label}`).join('; ');
    const allPosesById = Object.fromEntries(allPosesArr.map(action => [action.id, action]));
    const messages: any[] = [{
        role: 'system',
        content: `Разбери одно сообщение игрока. Физическое действие самого игрока здесь невозможно: оно приходит только кнопкой. Звёздочки не означают действие.

Исполняемой командой считаются только явно сформулированная просьба/приказ, чтобы персонаж:
1) сделал действие сам;
2) сделал действие с другим присутствующим персонажем;
3) сменил позу;
4) переместился;
5) начал, изменил или прекратил текущий процесс.
Обсуждение, вопрос, желание игрока и упоминание действия командой не являются.
Сообщение может состоять из нескольких предложений и начинаться с пояснения, предложения или оговорки. Если хотя бы один последующий фрагмент прямо предписывает адресату конкретное действие, command.type не должен быть none, speechType должен быть command, а сам фрагмент нужно дословно поместить в directiveEvidence.
Фразы о намерении или необходимости без глагола, прямо предписывающего адресату действие, не являются командой: «нам нужно повысить чувствительность», «тебе предстоит процедура», «сейчас будет больно» — это разговор.
Предложение игрока о собственном плане (например, «предлагаю продолжить», «я потом добавлю», «сейчас кое-что сделаю») — не команда. Команда требует прямого обращения к персонажу с просьбой или требованием выполнить действие.
Не достраивай конкретное действие или точку из неопределённых слов «кое-что», «это», «так», «продолжим». Упоминание записывай только если конкретное действие, процесс или часть тела действительно названы либо однозначно описаны словами сообщения. Сходство с кандидатом само по себе не является упоминанием.

Ближайшие действия: ${compact(candidates.actions)}
Ближайшие состояния/процессы: ${compact(candidates.contexts)}
Ближайшие точки тела: ${compact(candidates.points)}
Доступные позы (ID выбирай ТОЛЬКО из этого списка для change_pose): ${allPoses || 'нет'}
Присутствующие: ${characterList || 'нет'}
Контекст места: ${sceneContext || 'не указан'}
Последняя реплика адресата: ${recentCharacterSpeech || 'нет'}
Контекст диалога (недавние реплики, чтобы понять, о чём речь): ${recentDialogue || 'нет'}
${pendingCommand ? `Последнее невыполненное поручение в этом разговоре: ${pendingCommand.description}. Определи, продолжает ли текущая реплика убеждение/обсуждение именно этого поручения, явно отменяет его или уже относится к другой теме.` : 'Невыполненного поручения в фокусе разговора нет.'}
pendingCommandRelation="continue" ставь только когда без невыполненного поручения смысл текущей реплики неполон: это довод, заверение, давление, уточнение или повторная просьба выполнить именно его. Новый самостоятельный вопрос или новая тема — "unrelated", даже если разговор всё ещё идёт с тем же персонажем. «Не бойся, ты справишься» после отказа — continue; «как тебе спалось?» — unrelated; «забудь, не надо» — abandon.
Адресат по умолчанию: ${defaultActorId}. Цель по умолчанию: ${defaultTargetId}.

Верни JSON:
{"speechType":"conversation|question|praise|insult|command","tone":{"valence":-1..1,"intensity":0..1,"sharpness":0..1},"recipientAppraisal":{"valence":-1..1},"mentions":{"actionIds":[],"pointIds":[]},"pendingCommandRelation":"continue|abandon|unrelated","command":{"type":"none|perform_action|change_pose|activate_context|deactivate_context|remove_worn_clothing|move|change_current_interaction","directedAtCharacter":false,"explicitDirective":false,"directiveEvidence":"точная цитата директивы из сообщения или пустая строка","actorId":null,"targetId":null,"actionId":null,"contextId":null,"location":null,"goal":null,"pointId":null,"misunderstood":null},"confidence":0..1}
Для remove_worn_clothing используй type="remove_worn_clothing" (без actionId/contextId), когда команда требует снять всю одежду целиком («разденься», «сними всё», «сними одежду»). Для снятия одного конкретного предмета используй deactivate_context с contextId этого предмета.
Для change_pose contextId обязан быть ID позы из «Доступных поз» (например pose_sitting, act_present_feet), а не change_current_interaction. change_current_interaction используй только для начала, изменения или остановки уже идущего процесса.
Если команда распознана, но не хватает деталей, заполни command.misunderstood (иначе null):
- "pose_unknown" — понял, что нужно сменить позу, но не понял какую (нет contextId);
- "action_unknown" — понял, что нужно совершить действие с другим персонажем, но не понял какое (нет actionId);
- "target_unknown" — понял, какое действие совершить, но не понял с кем (нет targetId, а действие направлено на другого).
При misunderstood command.type оставь соответствующим (change_pose/perform_action), directedAtCharacter=true, explicitDirective=true, а недостающее поле пустым.
tone.valence — только манера говорящего. recipientAppraisal.valence — насколько адресату приятен или неприятен смысл реплики с учётом его последней реплики. Игнорирование страха, отказа или границы оценивай отрицательно, даже если слова звучат мягко.
Запрет не совершать действие («не раздевайся», «не трогай», «не иди») не превращай в противоположное действие. Если он отменяет ожидающее поручение, используй pendingCommandRelation="abandon" и command.type="none".
ID выбирай только из кандидатов и присутствующих. Упоминания заполняй независимо от того, является ли сообщение командой.`
    }, { role: 'user', content: text }];

    const { parsed, model } = await parseVerbalInputWithLLM(messages, PARSER_SCHEMA);
    const command = parsed.command || {};
    let commandIntent: CommandIntent = { type: 'none' };
    const commandActorId = command.actorId || defaultActorId;
    const commandTargetId = command.targetId || defaultTargetId;
    // Asterisks are ordinary chat punctuation in the current UI. Keeping this
    // invariant outside the model prevents the retired RP-action syntax from
    // silently becoming executable again.
    const isPlayerPhysicalAction = isPlayerPhysicalCommand(command, defaultActorId, playerId);
    const commandCandidate = !text.includes('*')
        && command.type && command.type !== 'none'
        && parsed.speechType === 'command'
        && command.directedAtCharacter === true
        && hasVerifiedDirectiveEvidence(text, command)
        && clamp(parsed.confidence, 0, 1, 0) >= 0.78
        && !isPlayerPhysicalAction;
    const addressedCharacter = characters.find(character => character.id === defaultActorId)?.name || defaultActorId;
    const mayExecute = commandCandidate
        ? await verifyExecutableCommand(text, command, addressedCharacter)
        : false;
    if (mayExecute) {
        if (command.type === 'perform_action' && command.actionId) {
            const actionId = command.actionId;
            if (candidates.actions.some(item => item.id === actionId)) {
                commandIntent = { type: 'perform_action', actionId, targetId: command.targetId || defaultTargetId, pointId: command.pointId || 'systemic' };
            } else if (command.misunderstood === 'target_unknown' || (command.targetId && !characters.some(c => c.id === command.targetId))) {
                // Понял действие, но не понял, с кем его совершить.
                commandIntent = { type: 'misunderstood', partial: 'target_unknown' };
            }
        }
        else if (command.type === 'change_pose') {
            // Structured output гарантирует contextId от LLM. Здесь только
            // валидируем его по полному списку поз каталога (не по урезанному
            // top-6 candidates.contexts). Если LLM всё же вернул пустой/неверный
            // ID — это честное «не понял, какую позу».
            if (command.contextId && allPosesById[command.contextId]) {
                commandIntent = { type: 'change_pose', targetPoseId: command.contextId };
            } else if (command.misunderstood === 'pose_unknown') {
                commandIntent = { type: 'misunderstood', partial: 'pose_unknown' };
            } else if (command.contextId) {
                // Вернул ID, которого нет в каталоге — воспринимаем как непонимание.
                commandIntent = { type: 'misunderstood', partial: 'pose_unknown' };
            } else {
                commandIntent = { type: 'misunderstood', partial: 'pose_unknown' };
            }
        }
        else if (command.type === 'activate_context' && command.contextId) {
            const context = candidates.contexts.find(item => item.id === command.contextId);
            if (isCharacterControlledContext(context)) commandIntent = { type: 'activate_context', targetContextId: command.contextId };
        }
        else if (command.type === 'deactivate_context' && command.contextId) {
            commandIntent = command.contextId === 'act_end_exposure'
                ? { type: 'change_current_interaction', goal: 'stop', targetId: command.targetId || defaultTargetId, pointId: command.pointId || 'systemic' }
                : { type: 'deactivate_context', targetContextId: command.contextId };
        }
        else if (command.type === 'remove_worn_clothing') {
            commandIntent = { type: 'remove_worn_clothing' };
        }
        else if (command.type === 'move' && command.location) commandIntent = { type: 'move', targetLocation: command.location };
        else if (command.type === 'change_current_interaction') commandIntent = { type: 'change_current_interaction', goal: ['start', 'adjust', 'stop'].includes(command.goal) ? command.goal : 'stop', suggestedActionId: command.actionId || undefined, targetId: command.targetId || defaultTargetId, pointId: command.pointId || 'systemic' };
        else if (command.type === 'perform_action' && command.misunderstood === 'action_unknown') {
            // Понял, что нужно совершить действие с другим персонажем, но не понял какое.
            commandIntent = { type: 'misunderstood', partial: 'action_unknown' };
        }
    }
    const mentions: { actionIds: string[]; pointIds: string[] } = {
        actionIds: (Array.isArray(parsed.mentions?.actionIds) ? parsed.mentions.actionIds : []).filter((id: unknown) => candidates.actions.some(item => item.id === id)).map(String),
        pointIds: (Array.isArray(parsed.mentions?.pointIds) ? parsed.mentions.pointIds : []).filter((id: unknown) => candidates.points.some(item => item.id === id)).map(String)
    };
    const mentionedTags: string[] = [...new Set(mentions.actionIds.flatMap((id: string) => {
        const candidate = candidates.actions.find(item => item.id === id);
        return conditioningTags(id, (candidate?.tags || []).map(String));
    }))];
    const pointId = commandIntent.type !== 'none' && 'pointId' in commandIntent
        ? commandIntent.pointId || mentions.pointIds[0] || 'systemic'
        : mentions.pointIds[0] || 'systemic';
    console.log(`[SemanticParser][Timing] model=${model} totalMs=${Math.round(performance.now() - started)} candidates=${candidates.actions.length + candidates.contexts.length + candidates.points.length}`);
    console.info('[SemanticParser][Decision]', JSON.stringify({
        text,
        speechType: parsed.speechType,
        confidence: clamp(parsed.confidence, 0, 1, 0),
        command: {
            type: command.type || 'none',
            directedAtCharacter: command.directedAtCharacter === true,
            explicitDirective: command.explicitDirective === true,
            directiveEvidence: command.directiveEvidence || '',
        },
        commandCandidate,
        mayExecute,
        commandIntent: commandIntent.type,
    }));
    return {
        intensity: clamp(parsed.tone?.intensity, 0, 1, 0.3),
        valence: resolveRecipientSpeechValence(text, recentCharacterSpeech, parsed.recipientAppraisal?.valence, parsed.tone?.valence),
        contact: 0,
        sharpness: clamp(parsed.tone?.sharpness, 0, 1, 0),
        novelty: 0.5,
        pointId,
        verbalIntent: commandIntent.type !== 'none'
            ? 'command'
            : (isPlayerPhysicalAction ? 'conversation' : (parsed.speechType || 'conversation')),
        commandIntent,
        semanticMentions: mentions,
        pendingCommandRelation: pendingCommand && ['continue', 'abandon', 'unrelated'].includes(parsed.pendingCommandRelation)
            ? parsed.pendingCommandRelation
            : 'unrelated',
        mentionedTags,
        routing: commandIntent.type !== 'none' ? {
            actorId: commandActorId,
            targetId: commandTargetId,
            actionId: 'actionId' in commandIntent ? commandIntent.actionId : undefined,
            confidence: clamp(parsed.confidence, 0, 1, 0),
            source: 'semantic-command-parser-v2'
        } : undefined,
        raw: JSON.stringify(parsed),
        model: `${model}+${activeEmbeddingModel || EMBEDDING_MODEL}`
    };
}
