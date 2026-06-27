import { activeConfig } from '../prompts/config.js';

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek/deepseek-chat';

export async function sendToLLM(systemPrompt: string): Promise<{ reply: string, sentMessages: ChatMessage[] }> {
    const LLM_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.SILLYTAVERN_API_KEY || '';
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
    const LLM_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.SILLYTAVERN_API_KEY || '';
    const PARSER_MODEL = process.env.PARSER_MODEL || process.env.SILLYTAVERN_MODEL || 'google/gemini-3.1-flash-lite-preview';

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




const ST_COMPLETIONS_URL =
    process.env.SILLYTAVERN_API_URL ||
    'http://127.0.0.1:8181/api/backends/chat-completions/generate';
const ST_COMPLETIONS_ORIGIN = (() => {
    try {
        return new URL(ST_COMPLETIONS_URL).origin;
    } catch {
        return 'http://127.0.0.1:8181';
    }
})();
const ST_HEALTH_URL = process.env.SILLYTAVERN_HEALTH_URL || `${ST_COMPLETIONS_ORIGIN}/`;
const ST_API_KEY = process.env.SILLYTAVERN_API_KEY;
const ST_MODEL =
    process.env.SILLYTAVERN_MODEL ||
    'google/gemini-2.5-flash';
const ST_SOURCE = process.env.SILLYTAVERN_SOURCE || 'openrouter';
const ST_REQUEST_TYPE = process.env.SILLYTAVERN_REQUEST_TYPE || 'external';
const ST_MAX_TOKENS = Number(process.env.SILLYTAVERN_MAX_TOKENS ?? 300);
const ST_TEMPERATURE = Number(process.env.SILLYTAVERN_TEMPERATURE ?? 0.85);
const ST_TOP_P = Number(process.env.SILLYTAVERN_TOP_P ?? 0.9);
const ST_FREQUENCY_PENALTY = Number(process.env.SILLYTAVERN_FREQUENCY_PENALTY ?? 0.5);
const ST_PRESENCE_PENALTY = Number(process.env.SILLYTAVERN_PRESENCE_PENALTY ?? 0.3);
const ST_JSON_RETRY_ATTEMPTS = Math.max(
    0,
    Number(process.env.SILLYTAVERN_JSON_RETRY_ATTEMPTS ?? 1)
);
const ST_REQUEST_TIMEOUT = Number(process.env.SILLYTAVERN_REQUEST_TIMEOUT ?? 20000);
const ST_HEALTH_TIMEOUT = Number(process.env.SILLYTAVERN_HEALTH_TIMEOUT ?? 3000);
const ST_HEALTH_ATTEMPTS = Math.max(1, Number(process.env.SILLYTAVERN_HEALTH_ATTEMPTS ?? 3));
const ST_HEALTH_BACKOFF_MS = Number(process.env.SILLYTAVERN_HEALTH_BACKOFF_MS ?? 1000);

const ST_CHARACTER_SCHEMA = {
    name: 'cyberjack_reply',
    strict: true,
    value: {
        type: 'object',
        properties: {
            speech: { type: 'string' }
        },
        required: ['speech'],
        additionalProperties: false
    }
};

const ST_NARRATOR_SCHEMA = {
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

/**
 * Ставит SillyTavern в роль выраженческого слоя: мы строим промпт,
 * а сам рендеринг делегируем локально поднятому экземпляру ST через его backend endpoint.
 */
function validateCharacterReply(candidate: any): candidate is { speech: string } {
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

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const mergedInit: RequestInit = { ...init, signal: controller.signal };
    return fetch(url, mergedInit).finally(() => clearTimeout(timer));
}

async function checkHealth(): Promise<boolean> {
    try {
        const response = await fetchWithTimeout(
            ST_HEALTH_URL,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            },
            ST_HEALTH_TIMEOUT
        );
        console.log(`[ST Adapter] Health check response: ${response.status} ${response.statusText} for ${ST_HEALTH_URL}`);
        return true; // We accept any response as ok if connection established
    } catch (err: any) {
        console.warn(`[ST Adapter] Health check failed: ${err.message || err}`);
        return false;
    }
}

async function ensureHealthy() {
    return;
}

async function requestCompletion(messages: ChatMessage[], schema: any): Promise<string> {
    const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    const LLM_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.SILLYTAVERN_API_KEY || '';
    const CURRENT_MODEL = process.env.LLM_MODEL || ST_MODEL || 'deepseek/deepseek-chat';

    const body: Record<string, any> = {
        model: CURRENT_MODEL,
        messages,
        max_tokens: ST_MAX_TOKENS,
        temperature: ST_TEMPERATURE,
        frequency_penalty: ST_FREQUENCY_PENALTY,
        presence_penalty: ST_PRESENCE_PENALTY,
        response_format: { type: 'json_object' }
    };

    if (Number.isFinite(ST_TOP_P)) {
        body.top_p = ST_TOP_P;
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
        ST_REQUEST_TIMEOUT
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
): Promise<{ reply: { speech: string } | string; sentMessages: ChatMessage[] }> {
    const messages = generateChatPayload(payload, userInput, history);

    console.log(`\n========== ОТПРАВЛЯЕМЫЙ ПРОМПТ В ST ==========`);
    messages.forEach(m => {
        console.log(`[Роль: ${m.role.toUpperCase()}]`);
        console.log(m.content);
        console.log(`----------------------------------------`);
    });

    try {
        await ensureHealthy();

        for (let attempt = 0; attempt <= ST_JSON_RETRY_ATTEMPTS; attempt++) {
            const rawText = await requestCompletion(messages, ST_CHARACTER_SCHEMA);
            console.log(`\n========== ПОЛУЧЕН ОТВЕТ ST ==========\n${rawText}\n========================================\n`);

            try {
                const parsed = JSON.parse(sanitizeJson(rawText));
                if (!validateStructuredReply(parsed)) {
                    throw new Error('invalid structure');
                }
                return {
                    reply: parsed,
                    sentMessages: messages
                };
            } catch (parseError) {
                if (attempt < ST_JSON_RETRY_ATTEMPTS) {
                    console.warn(
                        `[ST Adapter] Reply не в JSON-формате или нарушена структура (попытка ${
                            attempt + 1
                        }/${ST_JSON_RETRY_ATTEMPTS + 1}), повторяем запрос`
                    );
                    continue;
                }
                console.warn('[ST Adapter] Reply не в JSON-формате, возвращаем как plaintext');
                return {
                    reply: { speech: rawText },
                    sentMessages: messages
                };
            }
        }
    } catch (err: any) {
        console.error(`[ST Adapter] Ошибка связи с LLM: ${err.message}`);
        return {
            reply: {
                speech: `*Ошибка соединения с LLM: ${err.message}*`
            },
            sentMessages: messages
        };
    }

    return {
        reply: { speech: '*Нет ответа от LLM*' },
        sentMessages: messages
    };
}

export async function generateNarratorReply(
    prompt: NarratorPromptPayload
): Promise<{ reaction: string; sentMessages: ChatMessage[] }> {
    const messages = generateNarratorPayload(prompt);

    console.log(`\n========== НАРРАТОРСКИЙ ПРОМПТ В ST ==========`);
    messages.forEach(m => {
        console.log(`[Роль: ${m.role.toUpperCase()}]`);
        console.log(m.content);
        console.log(`----------------------------------------`);
    });

    try {
        await ensureHealthy();

        const rawText = await requestCompletion(messages, ST_NARRATOR_SCHEMA);
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
            console.warn('[ST Adapter] Narrator reply parsing failed, returning raw text');
            return {
                reaction: rawText,
                sentMessages: messages
            };
        }
    } catch (err: any) {
        console.error(`[ST Adapter] Narrator request failed: ${err.message}`);
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
        await ensureHealthy();
        const rawText = await requestCompletion(messages, ST_NARRATOR_SCHEMA);
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
        console.error(`[ST Adapter] Scene-for-character failed: ${err.message}`);
        return { reaction: '', sentMessages: messages };
    }
}
