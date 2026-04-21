const fs = require('fs');
let code = fs.readFileSync('src/api/controllers/tickController.ts', 'utf-8');

const regex = /let promptDirty = false;.*?(let autoUserMessage: string \| null = baseUserMessage;)/s;
code = code.replace(regex, `
        let suppressActionNarrative = actionId === 'wait';
        const actorCharacter = characterRepo.ensureCharacter(playerId, playerId === 'PL-1' ? 'Калибратор' : playerId);

        let promptPayload = bundle.prompt;
        const suppressTickIds = suppressActionNarrative ? [bundle.tickId] : undefined;
        if (suppressTickIds) {
            promptPayload = await buildPromptPayloadWithDB(subjectId, subjectId, bundle.output, eventId, { suppressTickIds });
            bundle.prompt = promptPayload;
        }

        $1`);
fs.writeFileSync('src/api/controllers/tickController.ts', code);
console.log("patched!");
