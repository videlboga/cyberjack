const fs = require('fs');
let code = fs.readFileSync('src/api/controllers/tickController.ts', 'utf-8');
const s1 = code.indexOf('// Pre-LLM Orchestration Hook Processing');
const s2 = code.indexOf('let autoUserMessage: string | null = baseUserMessage;');
if(s1 > -1 && s2 > -1) {
    code = code.substring(0, s1) + `let suppressActionNarrative = actionId === 'wait';
        const actorCharacter = characterRepo.ensureCharacter(playerId, playerId === 'PL-1' ? 'Калибратор' : playerId);

        let promptPayload = bundle.prompt;
        const suppressTickIds = suppressActionNarrative ? [bundle.tickId] : undefined;
        if (suppressTickIds) {
            promptPayload = await buildPromptPayloadWithDB(subjectId, subjectId, bundle.output, eventId, { suppressTickIds });
            bundle.prompt = promptPayload;
        }

        ` + code.substring(s2);
    fs.writeFileSync('src/api/controllers/tickController.ts', code);
    console.log('patched successfully');
} else {
    console.log('not found: s1=' + s1 + ' s2=' + s2);
}
