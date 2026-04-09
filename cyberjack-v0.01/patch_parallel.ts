import * as fs from 'fs';

let content = fs.readFileSync('src/api/controllers/tickController.ts', 'utf-8');

const oldLoopStart = `if (orchestration.actorDecisions.length) {
            for (const decision of orchestration.actorDecisions) {`;
const newLoopStart = `if (orchestration.actorDecisions.length) {
            await Promise.all(orchestration.actorDecisions.map(async (decision) => {`;

const oldLoopEndBlock = `
                if (structuredReply.speech) {
                    chatMemoryRepo.append(decision.actorId, 'assistant', structuredReply.speech);
                }
            }
        } else {`;
const newLoopEndBlock = `
                if (structuredReply.speech) {
                    chatMemoryRepo.append(decision.actorId, 'assistant', structuredReply.speech);
                }
            }));
        } else {`;

content = content.replace(oldLoopStart, newLoopStart).replace(oldLoopEndBlock, newLoopEndBlock);

fs.writeFileSync('src/api/controllers/tickController.ts', content);
