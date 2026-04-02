const fs = require('fs');
let code = fs.readFileSync('src/adapters/sillyTavernAdapter.ts', 'utf-8');

// replace generateChatPayload and add history
const historyMod = `
const chatHistory: ChatMessage[] = [];

export function generateChatPayload(payload: PromptPayload, userInput?: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    // System setup
    messages.push({
        role: 'system',
        content: \`\${activeConfig.adapters.sillyTavernSystemPrefix}\\n\${payload.systemPrompt}\`
    });

    // Add previous history
    messages.push(...chatHistory);

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

export function saveToHistory(userMsg: string, aiReply: any) {
    if (userMsg) {
        chatHistory.push({ role: 'user', content: userMsg });
    }
    chatHistory.push({ 
        role: 'assistant', 
        content: JSON.stringify(aiReply) 
    });
    
    // Keep last 10 messages to avoid context overflow
    if (chatHistory.length > 20) {
        chatHistory.splice(0, chatHistory.length - 20);
    }
}
`;

code = code.replace(/export function generateChatPayload[\s\S]*?return messages;\n}/, historyMod.trim());

// Save to history after success
const saveMod = `
        return { 
            reply: parsedReply,
            sentMessages: messages
        };
`;
const saveModRepl = `
        saveToHistory(userInput || activeConfig.adapters.emptyInputPrompt, parsedReply);

        return { 
            reply: parsedReply,
            sentMessages: messages
        };
`;
code = code.replace(saveMod, saveModRepl);

fs.writeFileSync('src/adapters/sillyTavernAdapter.ts', code);
