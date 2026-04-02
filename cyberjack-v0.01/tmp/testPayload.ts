import { buildPromptPayload } from '../src/prompts/buildPromptPayload';

(async () => {
  const payload = await buildPromptPayload('S-01');
  console.log('Diagnostics?', payload.diagnostics);
  console.log('System prompt preview:\n', payload.systemPrompt.slice(0, 800));
})();
