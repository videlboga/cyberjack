import { buildPromptPayload } from './src/prompts/buildPromptPayload';
buildPromptPayload('S-01').then(res => {
    console.log(res.systemPrompt);
});
