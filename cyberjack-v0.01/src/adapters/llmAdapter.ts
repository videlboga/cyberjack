import { activeConfig } from '../prompts/config.js';

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek/deepseek-chat';
const LLM_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS ?? 300);
const LLM_TEMPERATURE = Number(process.env.LLM_TEMPERATURE ?? 0.85);
const LLM_TOP_P = Number(process.env.LLM_TOP_P ?? 0.9);
const LLM_FREQUENCY_PENALTY = Number(process.env.LLM_FREQUENCY_PENALTY ?? 0.5);
const LLM_PRESENCE_PENALTY = Number(process.env.LLM_PRESENCE_PENALTY ?? 0.3);
const LLM_JSON_RETRY_ATTEMPTS = Math.max(0, Number(process.env.LLM_JSON_RETRY_ATTEMPTS ?? 1));
const LLM_REQUEST_TIMEOUT = Number(process.env.LLM_REQUEST_TIMEOUT ?? 20000);

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || '';

export async function sendToLLM(systemPrompt: string): Promise<{ reply: string, sentMessages: ChatMessage[] }> {
    const LLM_API_KEY = getApiKey();
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt }
    ];

    const payload = {
        model: LLM_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 300,
        top_p: 0.9,
    };

    console.log(`[LLM Adapter] Sending request to ${LLM_API_URL} for model ${LLM_MODEL} ...`);
    try {
        const response = await fetch(LLM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(LLM_API_KEY ? { 'Authorization': `Bearer ${LLM_API_KEY}` } : {}),
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Cyberjack Simulator'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`[LLM Adapter] Error ${response.status}: ${await response.text()}`);
            return { reply: '', sentMessages: messages };
        }

        const data = (await response.json()) as any;
        const replyText = data.choices?.[0]?.message?.content || data.reply || '';
        return { reply: replyText.trim(), sentMessages: messages };
    } catch (e: any) {
        console.error(`[LLM Adapter] Failed to connect to LLM API:`, e.message);
        return { reply: '', sentMessages: messages };
    }
}

export async function parseVerbalInputWithLLM(messages: ChatMessage[], jsonSchema?: any): Promise<any> {
    const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    const LLM_API_KEY = getApiKey();
    const PARSER_MODEL = process.env.PARSER_MODEL || 'google/gemini-3.1-flash-lite-preview';

    try {
        const response = await fetch(LLM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(LLM_API_KEY ? { 'Authorization': `Bearer ${LLM_API_KEY}` } : {}),
            },
            body: JSON.stringify({
                model: PARSER_MODEL,
                messages,
                temperature: 0.1,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errD = await response.text();
            console.error(`[LLM Adapter Parser] HTTP Error ${response.status}`, errD);
            throw new Error(`Parser network error ${response.status}`);
        }

        const data = await response.json();
        const resultString = data.choices[0].message.content;
        return {
            parsed: JSON.parse(resultString),
            model: data.model
        };
    } catch (e: any) {
        console.error('[LLM Adapter Parser] Error:', e.message);
        throw e;
    }
}

import { PromptPayload, NarratorPromptPayload, ScenePromptPayload } from '../domain/types';




const CHARACTER_SCHEMA = {
    name: 'cyberjack_reply',
    strict: true,
    value: {
        type: 'object',
        properties: {
            addressedTo: { type: 'string' },
            speechAct: { type: 'string' },
            speech: { type: 'string' }
        },
        required: ['speech'],
        additionalProperties: false
    }
};

const NARRATOR_SCHEMA = {
    name: 'cyberjack_narrator',
    strict: true,
    value: {
        type: 'object',
        properties: {
            reaction: { type: 'string' }
        },
        required: ['reaction'],
        additionalProperties: false
    }
};

type MemoryMessage = { role: 'user' | 'assistant'; content: string };

export function generateChatPayload(
    payload: PromptPayload,
    userInput?: string,
    history?: MemoryMessage[]
): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System setup
    messages.push({
        role: 'system',
        content: payload.systemPrompt || ''
    });

    if (history && history.length) {
        history.forEach(entry => {
            if (!entry.content) return;
            messages.push({
                role: entry.role,
                content: entry.content
            });
        });
    }

    if (userInput) {
        // User input should be passed as-is. Higher-level orchestration (sceneOrchestrator)
        // is responsible for detecting observer-case and injecting any observer notes into
        // the payload.systemPrompt before this function is called. Keeping this function
        // simple avoids duplicating parsing logic here.
        messages.push({ role: 'user', content: userInput });
    } else {
        let prompt = activeConfig.adapters.emptyInputPrompt;
        
        // Remove the last action from history if it's a *(Без слов)* marker
        // and inject it directly into the prompt so the LLM doesn't double-read it
        if (messages.length > 0 && messages[messages.length - 1].role === 'user' && messages[messages.length - 1].content.includes('*(Без слов)*')) {
            const lastAction = messages.pop()?.content;
            prompt = `${lastAction}\n\n${prompt}`;
        }
        
        messages.push({
            role: 'user',
            content: prompt
        });
    }

    return messages;
}

function generateNarratorPayload(prompt: NarratorPromptPayload): ChatMessage[] {
    const sections: string[] = [];
    if (activeConfig.adapters.narratorSystemPrefix) {
        sections.push(activeConfig.adapters.narratorSystemPrefix);
    }
    if (prompt.stateText) {
        sections.push(prompt.stateText);
    }
    if (prompt.recentEventsText) {
        sections.push(prompt.recentEventsText);
    }
    // Narrator B: include character speech and contexts if available
    const extras: string[] = [];
    if (prompt.activeContexts && prompt.activeContexts.length) {
        extras.push(`[Активные состояния]: ${prompt.activeContexts.join(', ')}`);
    }
    if (prompt.tickResultSummary) {
        extras.push(`[Результат воздействия]: ${prompt.tickResultSummary}`);
    }
    if (prompt.systemEvents && prompt.systemEvents.length) {
        extras.push(`[Системные события тика]:\n${prompt.systemEvents.join('\n')}`);
    }
    if (prompt.playerSpeech) {
        extras.push(`[Сказал Калибратор]: "${prompt.playerSpeech}"`);
    }
    if (prompt.characterSpeech && prompt.characterName) {
        extras.push(`[Ответила ${prompt.characterName}]: "${prompt.characterSpeech}"`);
    } else if (prompt.characterSpeech) {
        extras.push(`[Реплика персонажа]: "${prompt.characterSpeech}"`);
    }
    const userContent = extras.length
        ? `${extras.join('\n\n')}\n\n${prompt.instructions || activeConfig.adapters.narratorInputPrompt}`
        : `Ознакомься с последними логами воздействий. Опиши ТОЛЬКО внешние физические реакции на самые последние события в логах. Требования:\n${prompt.instructions || activeConfig.adapters.narratorInputPrompt}`;
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: sections.filter(Boolean).join('\n\n')
        },
        {
            role: 'user',
            content: userContent
        }
    ];
    return messages;
}

// Narrator A: compressed sensory scene FOR the character (injected into their prompt)
function generateSceneForCharacterPayload(prompt: ScenePromptPayload): ChatMessage[] {
    const sections: string[] = [];
    if (activeConfig.adapters.sceneForCharacterSystem) {
        sections.push(activeConfig.adapters.sceneForCharacterSystem);
    }
    const contextParts: string[] = [];
    if (prompt.actionLabel) {
        contextParts.push(`Воздействие: ${prompt.actionLabel} → ${prompt.pointLabel}`);
    }
    if (prompt.actorName && prompt.targetName) {
        contextParts.push(`От: ${prompt.actorName}, на: ${prompt.targetName}`);
    }
    if (prompt.stateText) {
        contextParts.push(prompt.stateText);
    }
    if (prompt.contextsText) {
        contextParts.push(prompt.contextsText);
    }
    if (prompt.tickResultText) {
        contextParts.push(prompt.tickResultText);
    }
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: sections.filter(Boolean).join('\n\n')
        },
        {
            role: 'user',
            content: `${contextParts.filter(Boolean).join('\n')}\n\n${activeConfig.adapters.sceneForCharacterInput}`
        }
    ];
    return messages;
}

function sanitizeJson(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function validateCharacterReply(candidate: any): candidate is { speech: string; addressedTo?: string; speechAct?: string } {
    if (!candidate || typeof candidate !== 'object') return false;
    return typeof candidate.speech === 'string';
}

function validateNarratorReply(candidate: any): candidate is { reaction: string } {
    if (!candidate || typeof candidate !== 'object') return false;
    return typeof candidate.reaction === 'string';
}

function validateStructuredReply(candidate: any): candidate is { speech: string } {
    return validateCharacterReply(candidate);
}

function evadesDirectAnswer(candidate: { speech: string; speechAct?: string }, payload: PromptPayload) {
    const frame = payload.reactionFrame;
    if (!frame || frame.dramaticPosition.preferredSpeechAct !== 'answer' || !candidate.speech.trim()) return false;
    const speech = candidate.speech.trim().toLowerCase();
    const explicitRefusal = /^(не скажу|не отвечу|не хочу отвечать|оставлю это без ответа)/i.test(speech);
    if (explicitRefusal) {
        candidate.speechAct = 'set_boundary';
        return false;
    }
    const answerLead = /^(да|нет|лучше|хуже|приятно|неприятно|больно|не больно|холодно|не холодно|тепло|можно|нельзя|хочу|не хочу|продолжай|остановись|убери|оставь|не знаю)/i.test(speech);
    const counterQuestion = /^(а\s+)?(ты|зачем|почему|что|как|когда|где|кто|какой|какая|какие|хочешь|можешь|понимаешь|чувствуешь)/i.test(speech);
    const deferredAnswer = /если[\s\S]*(скажу|отвечу)|сначала\s+(скажи|ответь|объясни)/i.test(speech);
    const invalidAct = Boolean(candidate.speechAct && !frame.dramaticPosition.allowedSpeechActs.includes(candidate.speechAct as any));
    const questionPresentedAsAnswer = candidate.speechAct === 'answer' && speech.endsWith('?') && !answerLead;
    return invalidAct || deferredAnswer || (counterQuestion && !answerLead) || questionPresentedAsAnswer;
}

function contradictsPhysiologicalEvent(candidate: { speech: string }, payload: PromptPayload) {
    const frame = payload.reactionFrame;
    if (!frame || frame.event.physiologicalEvent !== 'discharge') return false;
    // Loss of conscious contact takes precedence over the usual requirement to
    // name a completed peak. The transition is already shown by the engine;
    // demanding articulate speech here creates a contradiction the model cannot solve.
    if (frame.expressionMode.control === 'minimal' && !frame.event.requiresSpeech) return false;
    const speech = candidate.speech.trim().toLowerCase();
    if (!speech) return true;
    // The exact wording may remain character-specific, but the completed peak
    // must be legible. A generic request such as “be gentler” is not enough.
    return !/(конч|разряд|пик|накрыл|накрыва|сорвал|прорвало|отпустило|не удержал|не удержала|всё…|всё\.\.\.)/i.test(speech);
}

function contradictsAcceptanceChange(candidate: { speech: string }, payload: PromptPayload) {
    const frame = payload.reactionFrame;
    if (!frame) return false;
    const observation = payload.reactionFrame;
    const acceptanceDown = observation.event.changes.some(change =>
        change === 'отношение к контакту ухудшилось' || change === 'персонаж сильнее закрылся'
    );
    if (!acceptanceDown) return false;
    const speech = candidate.speech.trim().toLowerCase();
    return /(продолжай|повтори|повторяй|не останавливайся|не прекращай|ещ[её]\s+раз|давай\s+ещ[её]|сильнее|делай\s+так\s+же)/i.test(speech);
}

function contradictsExpressionMode(candidate: { speech: string }, payload: PromptPayload) {
    const mode = payload.reactionFrame?.expressionMode;
    const speech = candidate.speech.trim();
    if (!mode || !speech) return false;
    const words = speech.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || [];
    if (words.length > mode.maxWords) return true;
    if (!mode.requiresDisruption) return false;
    const hasDisruption = /[…!—]|\.\.\.|(^|\s)(а+|ах|ох|м-м+|мм+|ч[её]рт|нет)[,!.…—\s]/iu.test(speech);
    return !hasDisruption;
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const mergedInit: RequestInit = { ...init, signal: controller.signal };
    return fetch(url, mergedInit).finally(() => clearTimeout(timer));
}

function logRejectedCharacterReply(rawText: string, attempt: number, error: unknown) {
    const reason = error instanceof Error ? error.message : 'неизвестная ошибка';
    // JSON.stringify preserves the complete response while escaping line breaks
    // and control characters so one rejected generation remains one journal entry.
    console.warn(
        `[LLM Adapter][Rejected Character Reply] attempt=${attempt + 1}/${LLM_JSON_RETRY_ATTEMPTS + 1}; reason=${reason}; raw=${JSON.stringify(rawText)}`
    );
}

async function requestCompletion(messages: ChatMessage[], _schema: any): Promise<string> {
    const LLM_API_KEY = getApiKey();

    const body: Record<string, any> = {
        model: LLM_MODEL,
        messages,
        max_tokens: LLM_MAX_TOKENS,
        temperature: LLM_TEMPERATURE,
        frequency_penalty: LLM_FREQUENCY_PENALTY,
        presence_penalty: LLM_PRESENCE_PENALTY,
        response_format: { type: 'json_object' }
    };

    if (Number.isFinite(LLM_TOP_P)) {
        body.top_p = LLM_TOP_P;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Cyberjack Simulator'
    };

    if (LLM_API_KEY) {
        headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
    }

    const t0 = performance.now();
    
    const response = await fetchWithTimeout(
        LLM_API_URL,
        {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        },
        LLM_REQUEST_TIMEOUT
    );

    const t1 = performance.now();
    const elapsedMs = Math.round(t1 - t0);
    console.log(`[Adapter][Timing] Completion request to ${LLM_API_URL} took ${elapsedMs}ms`);

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || data.reply || '';
}

export async function generateCharacterReply(
    payload: PromptPayload,
    userInput?: string,
    history?: MemoryMessage[]
): Promise<{ reply: { speech: string; addressedTo?: string; speechAct?: string } | string; sentMessages: ChatMessage[]; error?: string }> {
    const messages = generateChatPayload(payload, userInput, history);
    const requestMessages = [...messages];

    console.log(`[Adapter] Character request: ${messages.length} messages`);

    try {
        for (let attempt = 0; attempt <= LLM_JSON_RETRY_ATTEMPTS; attempt++) {
            const rawText = await requestCompletion(requestMessages, CHARACTER_SCHEMA);
            console.log(`[Adapter] Character response received (${rawText.length} chars)`);

            try {
                const parsed = JSON.parse(sanitizeJson(rawText));
                if (!validateStructuredReply(parsed)) {
                    throw new Error('invalid structure');
                }
                if (payload.reactionFrame?.event.requiresSpeech && !parsed.speech.trim()) {
                    throw new Error('current physiological event requires a spoken reaction');
                }
                if (contradictsPhysiologicalEvent(parsed, payload)) {
                    throw new Error('discharge reaction does not make the completed peak explicit');
                }
                if (contradictsAcceptanceChange(parsed, payload)) {
                    throw new Error('speech asks to repeat an action while overall acceptance declines');
                }
                if (contradictsExpressionMode(parsed, payload)) {
                    throw new Error('speech form contradicts the current physiological expression mode');
                }
                if (evadesDirectAnswer(parsed, payload)) {
                    throw new Error('direct question was evaded instead of answered, refused, or deliberately left unanswered');
                }
                const frame = payload.reactionFrame;
                if (!parsed.speech.trim() && frame) {
                    parsed.speechAct = 'silence';
                    parsed.addressedTo = frame.addressee?.id || '';
                }
                if (parsed.speech && frame) {
                    const allowed = frame.dramaticPosition.allowedSpeechActs;
                    const normalizedSpeech = parsed.speech.trim().toLowerCase();
                    const repeatsCurrentInput = Boolean(
                        frame.event.playerSpeech &&
                        frame.event.playerSpeech.trim().toLowerCase() === normalizedSpeech
                    );
                    const duplicate = (history || []).some(entry =>
                        entry.role === 'assistant' && entry.content.trim().toLowerCase() === normalizedSpeech
                    );
                    // Give the model one chance to replace a verbatim repetition,
                    // but never discard a second otherwise valid line over it.
                    if ((duplicate || repeatsCurrentInput) && attempt < LLM_JSON_RETRY_ATTEMPTS) {
                        throw new Error(repeatsCurrentInput ? 'speech repeats current player input' : 'speech duplicates recent dialogue');
                    }
                    if (repeatsCurrentInput) {
                        parsed.speech = '';
                        parsed.speechAct = 'silence';
                    }

                    // These are engine-owned metadata. The model may suggest a valid
                    // speech act, but it cannot invalidate useful dialogue by mistyping
                    // an ID or an enum value.
                    if (!parsed.speechAct || !allowed.includes(parsed.speechAct)) {
                        parsed.speechAct = frame.dramaticPosition.preferredSpeechAct;
                    }
                    parsed.addressedTo = frame.addressee?.id || '';
                }
                return {
                    reply: parsed,
                    sentMessages: requestMessages
                };
            } catch (parseError) {
                logRejectedCharacterReply(rawText, attempt, parseError);
                if (attempt < LLM_JSON_RETRY_ATTEMPTS) {
                    console.warn(
                        `[LLM Adapter] Ответ нарушил контракт (попытка ${
                            attempt + 1
                        }/${LLM_JSON_RETRY_ATTEMPTS + 1}): ${parseError instanceof Error ? parseError.message : 'неизвестная ошибка'}, повторяем запрос`
                    );
                    requestMessages.push({ role: 'assistant', content: rawText });
                    requestMessages.push({
                        role: 'user',
                        content: `[Исправь ответ] ${parseError instanceof Error ? parseError.message : 'нарушен JSON-контракт'}. Не повторяй недавнюю реплику. Верни только исправленный JSON.`
                    });
                    continue;
                }
                console.warn(`[LLM Adapter] Ответ не прошёл проверку после повторной попытки: ${parseError instanceof Error ? parseError.message : 'неизвестная ошибка'}`);
                const frame = payload.reactionFrame;
                if (frame && !frame.event.requiresSpeech && frame.dramaticPosition.allowedSpeechActs.includes('silence')) {
                    return {
                        reply: { speech: '', speechAct: 'silence', addressedTo: frame.addressee?.id || '' },
                        sentMessages: requestMessages
                    };
                }
                return {
                    reply: { speech: '' },
                    sentMessages: requestMessages,
                    error: parseError instanceof Error ? parseError.message : 'Ответ нарушил контракт'
                };
            }
        }
    } catch (err: any) {
        console.error(`[LLM Adapter] Ошибка связи с LLM: ${err.message}`);
        return {
            reply: { speech: '' },
            sentMessages: requestMessages,
            error: err.message || String(err)
        };
    }

    return {
        reply: { speech: '' },
        sentMessages: requestMessages,
        error: 'Нет ответа от LLM'
    };
}

export async function generateNarratorReply(
    prompt: NarratorPromptPayload
): Promise<{ reaction: string; sentMessages: ChatMessage[] }> {
    const messages = generateNarratorPayload(prompt);

    console.log(`[LLM Adapter] Narrator request: ${messages.length} messages`);
    try {
        const rawText = await requestCompletion(messages, NARRATOR_SCHEMA);
        try {
            const parsed = JSON.parse(sanitizeJson(rawText));
            
            let reactionText = '';
            if (Array.isArray(parsed)) {
                reactionText = parsed.map((r: any) => typeof r === 'string' ? r : (r.reaction || r.description || Object.values(r)[0])).join(' ');
            } else if (typeof parsed.reaction === 'string') {
                reactionText = parsed.reaction;
            } else if (typeof parsed.description === 'string') {
                reactionText = parsed.description;
            } else if (Array.isArray(parsed.reactions)) {
                reactionText = parsed.reactions.map((r: any) => typeof r === 'string' ? r : (r.description || r.reaction || Object.values(r)[0])).join(' ');
            } else if (Object.keys(parsed).length > 0) {
                const firstVal = Object.values(parsed)[0];
                if (typeof firstVal === 'string') {
                    reactionText = firstVal;
                } else if (Array.isArray(firstVal)) {
                    reactionText = firstVal.map((v: any) => typeof v === 'string' ? v : (v.description || v.reaction || Object.values(v)[0])).join(' ');
                }
            }

            if (!reactionText || typeof reactionText !== 'string') {
                throw new Error('invalid narrator structure');
            }
            
            return {
                reaction: reactionText.trim(),
                sentMessages: messages
            };
        } catch (err) {
            console.warn('[LLM Adapter] Narrator reply parsing failed, returning raw text');
            return {
                reaction: rawText,
                sentMessages: messages
            };
        }
    } catch (err: any) {
        console.error(`[LLM Adapter] Narrator request failed: ${err.message}`);
        return {
            reaction: `*Ошибка связи с LLM (narrator): ${err.message}*`,
            sentMessages: messages
        };
    }
}

// Narrator A: compressed sensory scene for the character
export async function generateSceneForCharacter(
    prompt: ScenePromptPayload
): Promise<{ reaction: string; sentMessages: ChatMessage[] }> {
    const messages = generateSceneForCharacterPayload(prompt);

    console.log(`\n========== СЦЕНА ДЛЯ ПЕРСОНАЖА (Narrator A) ==========`);
    messages.forEach(m => {
        console.log(`[Роль: ${m.role.toUpperCase()}]`);
        console.log(m.content);
        console.log(`----------------------------------------`);
    });

    try {
        const rawText = await requestCompletion(messages, NARRATOR_SCHEMA);
        try {
            const parsed = JSON.parse(sanitizeJson(rawText));
            let reactionText = '';
            if (typeof parsed.reaction === 'string') {
                reactionText = parsed.reaction;
            } else if (typeof parsed === 'string') {
                reactionText = parsed;
            } else {
                reactionText = JSON.stringify(parsed);
            }
            return { reaction: reactionText.trim(), sentMessages: messages };
        } catch {
            return { reaction: rawText.trim(), sentMessages: messages };
        }
    } catch (err: any) {
        console.error(`[LLM Adapter] Scene-for-character failed: ${err.message}`);
        return { reaction: '', sentMessages: messages };
    }
}
