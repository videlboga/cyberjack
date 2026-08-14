import { activeConfig } from '../prompts/config.js';
import { randomUUID } from 'crypto';
import { emitTrace, currentTraceRequestId } from '../orchestration/trace';
import { getModelAssignment } from './modelAssignments';

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_TOP_P = Number(process.env.LLM_TOP_P ?? 0.9);
const LLM_FREQUENCY_PENALTY = Number(process.env.LLM_FREQUENCY_PENALTY ?? 0.5);
const LLM_PRESENCE_PENALTY = Number(process.env.LLM_PRESENCE_PENALTY ?? 0.3);

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || '';

export async function parseVerbalInputWithLLM(messages: ChatMessage[], jsonSchema?: any, purpose: string = 'parser'): Promise<any> {
    const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    const LLM_API_KEY = getApiKey();
    const assignment = getModelAssignment(purpose);
    const models = assignment.models;
    let lastError: unknown;
    // One trace/request ID shared across every parser fallback attempt for
    // this logical request. Inherit the tick's requestId when present so the
    // fallback can be correlated with the tick that produced it; mint a new
    // one only for autonomous/standalone calls (Этап 10 сквозной trace).
    const traceId = currentTraceRequestId() || randomUUID();
    for (const model of models) {
        const controller = new AbortController();
        let timer = setTimeout(() => controller.abort(), assignment.ttftTimeoutMs);
        const startedAt = performance.now();
        try {
            const response = await fetch(LLM_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-Id': traceId,
                    ...(LLM_API_KEY ? { 'Authorization': `Bearer ${LLM_API_KEY}` } : {}),
                },
                signal: controller.signal,
                body: JSON.stringify({ model, messages, temperature: assignment.temperature, max_tokens: assignment.maxTokens, response_format: { type: 'json_object' } })
            });
            // Headers arrived (TTFT satisfied); switch to the full-request timeout.
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(), assignment.requestTimeoutMs);
            if (!response.ok) throw new Error(`Parser network error ${response.status}: ${await response.text()}`);
            const data = await response.json() as any;
            const resultString = data.choices?.[0]?.message?.content;
            if (!resultString) throw new Error('Parser returned an empty response');
            return { parsed: JSON.parse(resultString), model: data.model || model };
        } catch (error: any) {
            lastError = error;
            emitTrace({
                traceId,
                requestId: traceId,
                stage: 'llm.fallback',
                startedAt,
                durationMs: Math.round(performance.now() - startedAt),
                purpose,
                model,
                provider: 'auto',
                attempt: models.indexOf(model) + 1,
                attemptsTotal: models.length,
                error: String(error?.message || error),
            });
            if (model !== models.at(-1)) console.warn(`[LLM Adapter Parser] ${model} failed; trying next parser model:`, error?.message || error);
        } finally {
            clearTimeout(timer);
        }
    }
    console.error('[LLM Adapter Parser] All parser models failed:', (lastError as any)?.message || lastError);
    throw lastError instanceof Error ? lastError : new Error(String(lastError || 'All parser models failed'));
}

const socialPortraitEmotions = [
    'angry', 'crying', 'curious', 'defiant', 'disgust', 'distressed',
    'excited', 'fear', 'guarded', 'neutral', 'sad', 'shy', 'smile',
    'smug', 'surprise'
] as const;

export async function classifySpokenEmotion(input: {
    playerSpeech?: string | null;
    characterSpeech: string;
    previousEmotion?: string | null;
    simulationPrior?: string | null;
    tension?: number;
    attitude?: number;
    openness?: number;
}): Promise<{ emotion: string; confidence: number; valence: number; arousal: number; control: number }> {
    const messages: ChatMessage[] = [{
        role: 'system',
        content: `Определи внешне читаемую эмоцию персонажа после короткого диалога. Не оценивай тон слов собеседника вместо реакции персонажа. Учитывай, что персонаж может скрывать страх раздражением. Выбери primary только из: ${socialPortraitEmotions.join(', ')}. Верни JSON {"primary":"...","confidence":0..1,"valence":-1..1,"arousal":0..1,"control":-1..1}.`
    }, {
        role: 'user',
        content: [
            `Собеседник: ${input.playerSpeech || '(нет новой реплики)'}`,
            `Персонаж: ${input.characterSpeech}`,
            `Предыдущая эмоция: ${input.previousEmotion || 'неизвестна'}`,
            `Приоритет симуляции: ${input.simulationPrior || 'neutral'}`,
            `Состояние: напряжение ${Number(input.tension || 0).toFixed(1)}, отношение ${Number(input.attitude ?? 50).toFixed(1)}, открытость ${Number(input.openness ?? 50).toFixed(1)}.`
        ].join('\n')
    }];
    const { parsed } = await parseVerbalInputWithLLM(messages);
    const primary = socialPortraitEmotions.includes(parsed?.primary) ? parsed.primary : 'neutral';
    const bounded = (value: unknown, min: number, max: number, fallback: number) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
    };
    return {
        emotion: primary,
        confidence: bounded(parsed?.confidence, 0, 1, 0),
        valence: bounded(parsed?.valence, -1, 1, 0),
        arousal: bounded(parsed?.arousal, 0, 1, 0),
        control: bounded(parsed?.control, -1, 1, 0),
    };
}

import { PromptPayload, NarratorPromptPayload, ScenePromptPayload } from '../domain/types';




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

export function extractAudibleSpeech(text: string) {
    const trimmed = text.trim();
    // Some models occasionally render a third-person delivery note followed by
    // an em-dash despite the audible-speech-only prompt. Keep the spoken part;
    // do not otherwise rewrite or validate character language.
    const staged = trimmed.match(/^[^\n:]{3,120}:\s*(?:\n\s*)?[—–-]\s*(.+)$/su);
    return staged ? staged[1].trim() : trimmed;
}

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

function validateNarratorReply(candidate: any): candidate is { reaction: string } {
    if (!candidate || typeof candidate !== 'object') return false;
    return typeof candidate.reaction === 'string';
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
        const body: Record<string, any> = {
            model, messages, max_tokens: assignment.maxTokens,
            temperature: assignment.temperature,
            frequency_penalty: LLM_FREQUENCY_PENALTY,
            presence_penalty: LLM_PRESENCE_PENALTY,
            reasoning: { enabled: false },
        };
        if (provider) body.provider = { only: [provider], allow_fallbacks: false };
        if (options.json) body.response_format = { type: 'json_object' };
        if (options.onToken && !options.json) body.stream = true;
        if (Number.isFinite(LLM_TOP_P)) body.top_p = LLM_TOP_P;
        const t0 = performance.now();
        const controller = new AbortController();
        let timer = setTimeout(() => controller.abort(), assignment.ttftTimeoutMs);
        let result = '';
        try {
            const response = await fetch(LLM_API_URL, {
                method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal
            });
            const headersMs = Math.round(performance.now() - t0);
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(), assignment.requestTimeoutMs);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            if (options.onToken && response.body) {
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
            console.log(`[Adapter][Timing] purpose=${options.purpose || 'completion'} model=${model} provider=${provider || 'auto'} headersMs=${headersMs} totalMs=${Math.round(performance.now() - t0)}`);
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
                model,
                provider: provider || 'auto',
                attempt: index + 1,
                attemptsTotal: attempts.length,
                error: String((error as any)?.message || error),
            });
            if (index < attempts.length - 1) {
                const next = attempts[index + 1];
                console.warn(`[Adapter] ${model}/${provider || 'auto'} failed, falling back to ${next.model}/${next.provider || 'auto'}:`, (error as any)?.message || error);
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
        speech = extractAudibleSpeech(speech);
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

export async function generateNarratorReply(
    prompt: NarratorPromptPayload
): Promise<{ reaction: string; sentMessages: ChatMessage[] }> {
    const messages = generateNarratorPayload(prompt);

    console.log(`[LLM Adapter] Narrator request: ${messages.length} messages`);
    try {
        const rawText = await requestCompletion(messages, { json: true, purpose: 'narrator' });
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
        const rawText = await requestCompletion(messages, { json: true, purpose: 'scene-for-character' });
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
