const fs = require('fs');

let content = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');

const regexToRemove = /if \(decision\.kind === "proactive" && decision\.reason\) \{[\s\S]*?\}\s*if \(narratorReaction\) \{/m;
content = content.replace(regexToRemove, 'if (narratorReaction) {');

const findString = 'const { reply, sentMessages } = await generateCharacterReply(';
const startIdx = content.indexOf(findString);

if (startIdx !== -1) {
    const endIdx = content.indexOf('return { decision, structuredReply, sentMessages };', startIdx);
    
    const replacement = `let structuredReply = { speech: '' };
            let sentMessages: any = null;

            if (decision.kind !== "proactive") {
                const res = await generateCharacterReply(
                    currentPayload,
                    userMsgOverride,
                    currentHistory
                );
                sentMessages = res.sentMessages;
                structuredReply = res.reply && typeof res.reply === 'object'
                    ? (res.reply as { speech: string })
                    : { speech: String(res.reply || '') };
            }

            `;
            
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
} else {
    console.error("Not found", startIdx);
}

fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', content);
console.log("Patched!!");
