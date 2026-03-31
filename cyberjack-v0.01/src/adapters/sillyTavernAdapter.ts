import { PromptPayload } from '../domain/types';
import { activeConfig } from '../prompts/config';

export interface ChatMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

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

export async function sendToSillyTavern(payload: PromptPayload, userInput?: string): Promise<{reply: {speech: string, reaction: string} | string, sentMessages: ChatMessage[]}> {
    const messages = generateChatPayload(payload, userInput);
    
    console.log(`\n========== ОТПРАВЛЯЕМЫЙ ПРОМПТ ==========`);
    messages.forEach(m => {
        console.log(`[Роль: ${m.role.toUpperCase()}]`);
        console.log(m.content);
        console.log(`----------------------------------------`);
    });

    const OPENROUTER_API_KEY = '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';
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    
    console.log(`[ST Adapter] Sending to OpenRouter (deepseek/deepseek-chat)...`);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat', // Correct DeepSeek V3 ID for faster routing
                messages,
                max_tokens: 300,
                temperature: 0.8,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }
        
        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content || "";
        
        let parsedReply: any = {};
        try {
            // Strip markdown JSON wrappers if any
            const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
            parsedReply = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("[ST Adapter] Failed to parse JSON, returning raw text", rawText);
            parsedReply = { reaction: rawText, speech: "" };
        }

        return { 
            reply: parsedReply, 
            sentMessages: messages 
        };
    } catch (err: any) {
        console.error(`[ST Adapter] ERROR:`, err.message);
        return { 
            reply: { reaction: `*Ошибка соединения с OpenRouter: ${err.message}*`, speech: "" },
            sentMessages: messages 
        };
    }
}
