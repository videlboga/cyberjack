import { PromptPayload } from '../domain/types';
import { activeConfig } from '../prompts/config';

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

const ST_COMPLETIONS_URL =
    process.env.SILLYTAVERN_API_URL ||
    'http://127.0.0.1:8181/api/backends/chat-completions/generate';
const ST_API_KEY = process.env.SILLYTAVERN_API_KEY;
const ST_MODEL =
    process.env.SILLYTAVERN_MODEL ||
    'google/gemini-2.5-flash';
const ST_SOURCE = process.env.SILLYTAVERN_SOURCE || 'openrouter';
const ST_REQUEST_TYPE = process.env.SILLYTAVERN_REQUEST_TYPE || 'external';
const ST_MAX_TOKENS = Number(process.env.SILLYTAVERN_MAX_TOKENS ?? 300);
const ST_TEMPERATURE = Number(process.env.SILLYTAVERN_TEMPERATURE ?? 0.8);
const ST_TOP_P = Number(process.env.SILLYTAVERN_TOP_P ?? 0.9);
const ST_JSON_RETRY_ATTEMPTS = Math.max(
    0,
    Number(process.env.SILLYTAVERN_JSON_RETRY_ATTEMPTS ?? 1)
);

const ST_JSON_SCHEMA = {
    name: 'cyberjack_reply',
    strict: true,
    value: {
        type: 'object',
        properties: {
            reaction: { type: 'string' },
            speech: { type: 'string' }
        },
        required: ['reaction', 'speech'],
        additionalProperties: false
    }
};

export function generateChatPayload(payload: PromptPayload, userInput?: string): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // System setup
    messages.push({
        role: 'system',
        content: `${activeConfig.adapters.sillyTavernSystemPrefix}\n${payload.systemPrompt}`
    });

    if (userInput) {
        messages.push({
            role: 'user',
            content: userInput
        });
    } else {
        messages.push({
            role: 'user',
            content: activeConfig.adapters.emptyInputPrompt
        });
    }

    return messages;
}

function sanitizeJson(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Ставит SillyTavern в роль выраженческого слоя: мы строим промпт,
 * а сам рендеринг делегируем локально поднятому экземпляру ST через его backend endpoint.
 */
function validateStructuredReply(candidate: any): candidate is { reaction: string; speech: string } {
    if (!candidate || typeof candidate !== 'object') return false;
    return typeof candidate.reaction === 'string' && typeof candidate.speech === 'string';
}

async function requestCompletion(messages: ChatMessage[]) {
        const body: Record<string, any> = {
            type: ST_REQUEST_TYPE,
            chat_completion_source: ST_SOURCE,
            model: ST_MODEL,
            messages,
            max_tokens: ST_MAX_TOKENS,
            temperature: ST_TEMPERATURE,
            stream: false,
            include_reasoning: false,
            request_images: false,
            json_schema: ST_JSON_SCHEMA
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

        const response = await fetch(ST_COMPLETIONS_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
}

export async function sendToSillyTavern(
    payload: PromptPayload,
    userInput?: string
): Promise<{ reply: { speech: string; reaction: string } | string; sentMessages: ChatMessage[] }> {
    const messages = generateChatPayload(payload, userInput);

    console.log(`\n========== ОТПРАВЛЯЕМЫЙ ПРОМПТ В ST ==========`);
    messages.forEach(m => {
        console.log(`[Роль: ${m.role.toUpperCase()}]`);
        console.log(m.content);
        console.log(`----------------------------------------`);
    });

    try {
        for (let attempt = 0; attempt <= ST_JSON_RETRY_ATTEMPTS; attempt++) {
            const rawText = await requestCompletion(messages);

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
                    reply: { reaction: rawText, speech: '' },
                    sentMessages: messages
                };
            }
        }
    } catch (err: any) {
        console.error(`[ST Adapter] Ошибка связи с SillyTavern: ${err.message}`);
        return {
            reply: {
                reaction: `*Ошибка соединения с SillyTavern: ${err.message}*`,
                speech: ''
            },
            sentMessages: messages
        };
    }
}
