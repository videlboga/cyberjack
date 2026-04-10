import { generateCharacterContext } from './src/orchestration/characterGenerator/generator';
import { composePromptSections } from './src/orchestration/characterGenerator/promptComposer';

const ctx = generateCharacterContext({ seed: 'xxx11', archetype: 'broker' });
const s = composePromptSections(ctx, {
        identity: 'test',
        history: 'test history',
        instructions: 'instruct',
        archetypeBlock: 'test arch',
        originBlocks: ctx.originStatements,
        assetBlocks: ctx.assetReasons,
        assetTitle: '[Твой путь в торговлю]'
});
console.log(s.systemPrompt);
