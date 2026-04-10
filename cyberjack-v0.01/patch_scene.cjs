const fs = require('fs');

const path = 'src/orchestration/sceneOrchestrator.ts';
let code = fs.readFileSync(path, 'utf8');

const importStr = "import { runGameTick } from './runGameTick';\n";
if (!code.includes("import { runGameTick }")) {
    code = importStr + code;
}

const targetCode = `        for (const { decision, structuredReply, sentMessages } of results) {
            actorReplies.push({`;

const newCode = `        for (const { decision, structuredReply, sentMessages } of results) {
            if (decision.kind === 'proactive' && decision.mechanicalAction) {
                // Execute the mechanical game tick for the proactive action
                try {
                    await runGameTick({
                        subjectId: decision.mechanicalAction.targetId || subjectId,
                        pointId: decision.mechanicalAction.pointId,
                        playerId: decision.actorId,
                        sceneId: eventId,
                        presetId: decision.mechanicalAction.actionId,
                        textMessage: structuredReply.speech
                    });
                } catch (err) {
                    console.error('Failed to run proactive tick for NPC:', err);
                }
            }

            actorReplies.push({`;

code = code.replace(targetCode, newCode);
fs.writeFileSync(path, code);
console.log('patched');
