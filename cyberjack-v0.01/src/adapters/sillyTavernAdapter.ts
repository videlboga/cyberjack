import { PromptPayload, NarratorPromptPayload } from '../domain/types';
import { activeConfig } from '../prompts/config';

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

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
        content: `${activeConfig.adapters.sillyTavernSystemPrefix}\n${payload.systemPrompt}`
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
        messages.push({
            role: 'user',
            content: userInput
        });
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
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: sections.filter(Boolean).join('\n\n')
        },
        {
            role: 'user',
            content: `Ознакомься с последними логами воздействий. Опиши ТОЛЬКО внешние физические реакции на самые последние события в логах. Требования:\n${prompt.instructions || activeConfig.adapters.narratorInputPrompt}`
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
        console.log(`[ST Adapter] Health check response: ${response.status} ${response.statusText} for ${ST_HEALTH_URL}`); return response.ok;
    } catch (err: any) {
        console.warn(`[ST Adapter] Health check failed: ${err.message || err}`);
        return false;
    }
}

async function ensureHealthy() {
    for (let attempt = 0; attempt < ST_HEALTH_ATTEMPTS; attempt++) {
        if (await checkHealth()) return;
        await new Promise(resolve => setTimeout(resolve, ST_HEALTH_BACKOFF_MS));
    }
    throw new Error('SillyTavern не отвечает (health-check)');
}

async function requestCompletion(messages: ChatMessage[], schema: any): Promise<string> {
    const body: Record<string, any> = {
        type: ST_REQUEST_TYPE,
        chat_completion_source: ST_SOURCE,
        model: ST_MODEL,
        messages,
        max_tokens: ST_MAX_TOKENS,
        temperature: ST_TEMPERATURE,
        frequency_penalty: ST_FREQUENCY_PENALTY,
        presence_penalty: ST_PRESENCE_PENALTY,
        stream: false,
        include_reasoning: false,
        request_images: false,
        json_schema: schema
    };

    if (Number.isFinite(ST_TOP_P)) {
        body.top_p = ST_TOP_P;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (ST_API_KEY) {
        headers['Authorization'] = `Bearer ${ST_API_KEY}`;
    }

    const response = await fetchWithTimeout(
        ST_COMPLETIONS_URL,
        {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        },
        ST_REQUEST_TIMEOUT
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

export async function sendToSillyTavern(
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
        console.error(`[ST Adapter] Ошибка связи с SillyTavern: ${err.message}`);
        return {
            reply: {
                speech: `*Ошибка соединения с SillyTavern: ${err.message}*`
            },
            sentMessages: messages
        };
    }

    return {
        reply: { speech: '*Нет ответа от SillyTavern*' },
        sentMessages: messages
    };
}

export async function sendNarratorDescription(
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
            if (!validateNarratorReply(parsed)) {
                throw new Error('invalid narrator structure');
            }
            return {
                reaction: parsed.reaction,
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
            reaction: `*Ошибка связи с SillyTavern (narrator): ${err.message}*`,
            sentMessages: messages
        };
    }
}
