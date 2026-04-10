const fs = require('fs');

let content = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');

// The block starts around `let userMsgOverride = autoUserMessage || actionLabelMessage || undefined;`
content = content.replace(/if \(decision\.kind === "proactive" && decision\.reason\) \{[\s\S]*?\}\s*if \(narratorReaction\) \{/m, 'if (narratorReaction) {');

const llmCallStart = content.indexOf('const { reply, sentMessages } = await generateCharacterReply(');
if (llmCallStart !== -1) {
    const endStr = `            return { decision, structuredReply, sentMessages };`;
    const llmCallEnd = content.indexOf(endStr, llmCallStart);

    if (llmCallEnd !== -1) {
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
        content = content.substring(0, llmCallStart) + replacement + content.substring(llmCallEnd);
    }
}

fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', content);
console.log("Patched!!");
