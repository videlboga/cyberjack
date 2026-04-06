const fs = require('fs');
let code = fs.readFileSync('src/api/server.ts', 'utf-8');

const oldWait = `        let stReply, promptMessages;
        if (callLLM) {
            const promptPayload = await buildPromptPayload(subjectId, lastOutput, eventId);
            const stRes = await sendToSillyTavern(promptPayload, \`[Прошло времени: \${ticks} тиков. Ничего нового не произошло.]\`);
            stReply = stRes.reply;
            promptMessages = stRes.sentMessages;
        }`;

const newWait = `        let stReply, promptMessages;
        if (callLLM) {
            const promptPayload = await buildPromptPayload(subjectId, lastOutput, eventId);
            
            let messageContext = \`[Прошло времени: \${ticks} тиков. Состояние могло измениться.]\`;
            if (req.body.customMessage) {
                messageContext = req.body.customMessage;
            }

            const stRes = await sendToSillyTavern(promptPayload, messageContext);
            stReply = stRes.reply;
            promptMessages = stRes.sentMessages;
        }`;

code = code.replace(oldWait, newWait);
fs.writeFileSync('src/api/server.ts', code);
