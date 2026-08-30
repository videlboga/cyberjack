import { activeConfig } from '../prompts/config.js';
import { randomUUID } from 'crypto';
import { emitTrace, currentTraceRequestId } from '../orchestration/trace';
import { getModelAssignment } from './modelAssignments';
import { Agent, setGlobalDispatcher } from 'undici';

// Tailscale-прокси (openrouter.ai -> 100.104.97.70) иногда «залипает» на
// keep-alive соединении в долгоживущем процессе: undici переиспользует
// мёртвый сокет, все новые fetch встают на него и падают по таймауту.
// Короткий keepAliveTimeout + таймаут незанятого сокета вынуждают пул
// открывать свежее соединение, не цепляясь за залипший.
setGlobalDispatcher(new Agent({
    keepAliveTimeout: 1000,
    keepAliveMaxTimeout: 2000,
    keepAliveTimeoutThreshold: 1000,
    connections: 12,
    headersTimeout: 20000,
    bodyTimeout: 60000,
}));

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_TOP_P = Number(process.env.LLM_TOP_P ?? 0.9);
const LLM_FREQUENCY_PENALTY = Number(process.env.LLM_FREQUENCY_PENALTY ?? 0.5);
const LLM_PRESENCE_PENALTY = Number(process.env.LLM_PRESENCE_PENALTY ?? 0.3);

// Локальная Ollama. Используется как отдельный провайдер 'ollama' в списке
// providers. Нативный /api/chat (не OpenAI-совместимый /v1): только он умеет
// `think:false`, который реально отключает reasoning у deepseek-v4-flash:cloud.
// Без этого модель тратит ~100 токенов на внутренние рассуждения и обрезает
// реплику на полуслове при max_tokens=180.
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-v4-flash:cloud';

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || '';

export async function parseVerbalInputWithLLM(messages: ChatMessage[], jsonSchema?: any, purpose: string = 'parser'): Promise<any> {
    const LLM_API_KEY = getApiKey();
    const assignment = getModelAssignment(purpose);
    let lastError: unknown;
    // Legacy callers pass { type: 'json_object' } as the second argument to
    // request plain-JSON output. A real structured schema carries `.value`
    // (see PARSER_SCHEMA). Treat the legacy marker as "no schema".
    const schema = jsonSchema && jsonSchema.value ? jsonSchema : undefined;
    // One trace/request ID shared across every parser fallback attempt for
    // this logical request. Inherit the tick's requestId when present so the
    // fallback can be correlated with the tick that produced it; mint a new
    // one only for autonomous/standalone calls (Этап 10 сквозной trace).
    const traceId = currentTraceRequestId() || randomUUID();
    // attempts: providers (для основной модели) + fallback-модели. Провайдер
    // 'ollama' идёт через нативный /api/chat (format:json, think:false) — это
    // дешёвый локальный путь для summary/памяти.
    const attempts = [
        ...assignment.providers.map(provider => ({ model: assignment.models[0], provider })),
        ...assignment.models.slice(1).map(model => ({ model, provider: '' })),
    ];
    for (const [index, attempt] of attempts.entries()) {
        const { model, provider } = attempt;
        const isOllama = provider === 'ollama';
        const url = isOllama ? OLLAMA_API_URL : LLM_API_URL;
        const effectiveModel = isOllama ? OLLAMA_MODEL : model;
        const controller = new AbortController();
        let timer = setTimeout(() => controller.abort(), assignment.ttftTimeoutMs);
        const startedAt = performance.now();
        try {
            const body: Record<string, any> = isOllama
                ? { model: effectiveModel, messages, stream: false, think: false, format: 'json', options: { num_predict: assignment.maxTokens, temperature: assignment.temperature } }
                : { model: effectiveModel, messages, temperature: assignment.temperature, max_tokens: assignment.maxTokens };
            // Structured output: when a real schema is supplied, request a
            // strict JSON schema so the model is forced to return every field
            // (incl. command.contextId). Without it, models drop fields and
            // the downstream resolver silently degrades to "misunderstood".
            // Plain-JSON callers (memory, dossier, social) stay on json_object.
            // Ollama нативный /api/chat поддерживает только format:'json'.
            if (!isOllama) {
                if (schema) {
                    body.response_format = {
                        type: 'json_schema',
                        json_schema: { name: schema.name || 'cyberjack_parser', strict: true, schema: schema.value }
                    };
                } else {
                    body.response_format = { type: 'json_object' };
                }
            }
            const headers: Record<string, string> = isOllama
                ? { 'Content-Type': 'application/json', 'X-Request-Id': traceId }
                : { 'Content-Type': 'application/json', 'X-Request-Id': traceId, ...(LLM_API_KEY ? { 'Authorization': `Bearer ${LLM_API_KEY}` } : {}) };
            const response = await fetch(url, {
                method: 'POST',
                headers,
                signal: controller.signal,
                body: JSON.stringify(body)
            });
            // Headers arrived (TTFT satisfied); switch to the full-request timeout.
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(), assignment.requestTimeoutMs);
            if (!response.ok) throw new Error(`Parser network error ${response.status}: ${await response.text()}`);
            const data = await response.json() as any;
            const resultString = isOllama ? data.message?.content : data.choices?.[0]?.message?.content;
            if (!resultString) throw new Error('Parser returned an empty response');
            // Ollama может обернуть JSON в markdown-кодблок (```json ... ```).
            const cleaned = resultString.replace(/```json/gi, '').replace(/```/g, '').trim();
            return { parsed: JSON.parse(cleaned), model: effectiveModel };
        } catch (error: any) {
            lastError = error;
            emitTrace({
                traceId,
                requestId: traceId,
                stage: 'llm.fallback',
                startedAt,
                durationMs: Math.round(performance.now() - startedAt),
                purpose,
                model: effectiveModel,
                provider: provider || 'auto',
                attempt: index + 1,
                attemptsTotal: attempts.length,
                error: String(error?.message || error),
            });
            if (index < attempts.length - 1) {
                const next = attempts[index + 1];
                console.warn(`[LLM Adapter Parser] ${effectiveModel}/${provider || 'auto'} failed; trying ${next.model}/${next.provider || 'auto'}:`, error?.message || error);
            }
        } finally {
            clearTimeout(timer);
        }
    }
    console.error('[LLM Adapter Parser] All parser models failed:', (lastError as any)?.message || lastError);
    throw lastError instanceof Error ? lastError : new Error(String(lastError || 'All parser models failed'));
}

import { PromptPayload } from '../domain/types';



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

function sanitizeJson(text: string): string {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function requestCompletion(messages: ChatMessage[], options: { json?: boolean; purpose?: string; onToken?: (chunk: string) => void } = {}): Promise<string> {
    const LLM_API_KEY = getApiKey();
    const assignment = getModelAssignment(options.purpose === 'memory' ? 'memory' : 'reply');
    // One trace/request ID shared across every provider fallback attempt for
    // this logical request. Inherit the tick's requestId when present so the
    // fallback can be correlated with the tick that produced it; mint a new
    // one only for autonomous/standalone calls (Этап 10 сквозной trace).
    const traceId = currentTraceRequestId() || randomUUID();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Cyberjack Simulator',
        'X-Request-Id': traceId,
    };

    if (LLM_API_KEY) {
        headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
    }

    const attempts = [
        ...assignment.providers.map(provider => ({ model: assignment.models[0], provider })),
        ...assignment.models.slice(1).map(model => ({ model, provider: '' })),
    ];
    let lastError: unknown;
    for (const [index, attempt] of attempts.entries()) {
        const { model, provider } = attempt;
        // Локальная Ollama — отдельный транспорт: нативный /api/chat, своё имя
        // модели (с суффиксом :cloud), think:false (отключает reasoning), без
        // openrouter-полей (provider/reasoning/auth/response_format).
        const isOllama = provider === 'ollama';
        const url = isOllama ? OLLAMA_API_URL : LLM_API_URL;
        const effectiveModel = isOllama ? OLLAMA_MODEL : model;
        const body: Record<string, any> = isOllama
            ? {
                model: effectiveModel,
                messages,
                stream: Boolean(options.onToken && !options.json),
                think: false,
                options: {
                    num_predict: assignment.maxTokens,
                    temperature: assignment.temperature,
                    ...(Number.isFinite(LLM_TOP_P) ? { top_p: LLM_TOP_P } : {}),
                },
            }
            : {
                model: effectiveModel, messages, max_tokens: assignment.maxTokens,
                temperature: assignment.temperature,
                frequency_penalty: LLM_FREQUENCY_PENALTY,
                presence_penalty: LLM_PRESENCE_PENALTY,
                reasoning: { enabled: false },
            };
        if (!isOllama && provider) body.provider = { only: [provider], allow_fallbacks: false };
        if (!isOllama && options.json) body.response_format = { type: 'json_object' };
        if (!isOllama && options.onToken && !options.json) body.stream = true;
        if (!isOllama && Number.isFinite(LLM_TOP_P)) body.top_p = LLM_TOP_P;
        const t0 = performance.now();
        const controller = new AbortController();
        let timer = setTimeout(() => controller.abort(), assignment.ttftTimeoutMs);
        let result = '';
        try {
            const requestHeaders: Record<string, string> = isOllama
                ? { 'Content-Type': 'application/json', 'X-Request-Id': traceId }
                : headers;
            const response = await fetch(url, {
                method: 'POST', headers: requestHeaders, body: JSON.stringify(body), signal: controller.signal
            });
            const headersMs = Math.round(performance.now() - t0);
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(), assignment.requestTimeoutMs);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            if (isOllama && options.onToken && response.body) {
                // Нативный /api/chat стримит NDJSON: { message: { content }, done }.
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let pending = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    pending += decoder.decode(value, { stream: true });
                    const lines = pending.split('\n');
                    pending = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const event = JSON.parse(line);
                            const chunk = event.message?.content || '';
                            if (chunk) { result += chunk; options.onToken(chunk); }
                        } catch { /* keep-alive */ }
                    }
                }
            } else if (isOllama) {
                const data = await response.json() as any;
                result = data.message?.content || '';
            } else if (options.onToken && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let pending = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    pending += decoder.decode(value, { stream: true });
                    const lines = pending.split('\n');
                    pending = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
                        try {
                            const event = JSON.parse(line.slice(6));
                            const chunk = event.choices?.[0]?.delta?.content || '';
                            if (chunk) { result += chunk; options.onToken(chunk); }
                        } catch { /* provider keep-alive */ }
                    }
                }
            } else {
                const data = await response.json() as any;
                result = data.choices?.[0]?.message?.content || data.reply || '';
            }
            if (!result.trim()) throw new Error('Empty completion');
            console.log(`[Adapter][Timing] purpose=${options.purpose || 'completion'} model=${effectiveModel} provider=${provider || 'auto'} headersMs=${headersMs} totalMs=${Math.round(performance.now() - t0)}`);
            return result;
        } catch (error) {
            // If streaming already reached the player, keep the audible part
            // instead of starting a second provider and duplicating the line.
            if (result.trim()) {
                console.warn(`[Adapter] stream timed out after partial output model=${model} provider=${provider || 'auto'}; keeping ${result.length} chars`);
                return result;
            }
            lastError = error;
            emitTrace({
                traceId,
                requestId: traceId,
                stage: 'llm.fallback',
                startedAt: t0,
                durationMs: Math.round(performance.now() - t0),
                purpose: options.purpose,
                model: effectiveModel,
                provider: provider || 'auto',
                attempt: index + 1,
                attemptsTotal: attempts.length,
                error: String((error as any)?.message || error),
            });
            if (index < attempts.length - 1) {
                const next = attempts[index + 1];
                console.warn(`[Adapter] ${effectiveModel}/${provider || 'auto'} failed, falling back to ${next.model}/${next.provider || 'auto'}:`, (error as any)?.message || error);
            }
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError || 'All completion models failed'));
}

export async function generateCharacterReply(
    payload: PromptPayload,
    userInput?: string,
    history?: MemoryMessage[],
    onToken?: (chunk: string) => void
): Promise<{ reply: { speech: string; addressedTo?: string; speechAct?: string } | string; sentMessages: ChatMessage[]; error?: string }> {
    const messages = generateChatPayload(payload, userInput, history);
    console.log(`[Adapter] Character request: ${messages.length} messages`);

    try {
        const rawText = await requestCompletion(messages, { purpose: 'character-speech', onToken });
        let speech = rawText.trim();
        let modelSpeechAct: string | undefined;
        // Compatibility only: old providers/mocks may still return the former
        // object. This does not validate, reject, or retry model content.
        if (speech.startsWith('{')) {
            try {
                const legacy = JSON.parse(sanitizeJson(speech));
                if (typeof legacy?.speech === 'string') speech = legacy.speech;
                if (typeof legacy?.speechAct === 'string') modelSpeechAct = legacy.speechAct;
            } catch { /* plain speech beginning with a brace remains untouched */ }
        }
        const frame = payload.reactionFrame;
        console.log(`[Adapter] Character response received (${speech.length} chars)`);
        return {
            reply: {
                speech,
                speechAct: speech ? (modelSpeechAct || 'acknowledge') : 'silence',
                addressedTo: frame?.addressee?.id || ''
            },
            sentMessages: messages
        };
    } catch (err: any) {
        console.error(`[LLM Adapter] Ошибка связи с LLM: ${err.message}`);
        return {
            reply: { speech: '' },
            sentMessages: messages,
            error: err.message || String(err)
        };
    }

    return {
        reply: { speech: '' },
        sentMessages: messages,
        error: 'Нет ответа от LLM'
    };
}
