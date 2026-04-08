import { activeConfig } from '../prompts/config.js';

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

const LLM_API_URL = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const LLM_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.SILLYTAVERN_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek/deepseek-chat';

export async function sendToLLM(systemPrompt: string): Promise<{ reply: string, sentMessages: ChatMessage[] }> {
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
