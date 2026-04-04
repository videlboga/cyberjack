import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';

const seeds = ['A1', 'A2', 'A3', 'A4', 'A5'];

for (const seed of seeds) {
    const ctx = generateCharacterContext({ seed });
    console.log(`--- Seed ${seed} ---`);

    const tagLines: string[] = [];
    for (const [level, tags] of Object.entries(ctx.grouped)) {
        const levelTags = tags.map(tag => `${tag.id} (${tag.title})`).join(', ');
        tagLines.push(`${level}: ${levelTags}`);
    }
    console.log(tagLines.join('\n'));

    const personaBlock = ctx.personaNotes.map((note, idx) => `${idx + 1}. ${note}`).join('\n');
    const loreBlock = ctx.loreNotes.join('\n\n');

    const promptParts: string[] = ['[Профиль персонажа]', personaBlock || '(нет заметок)'];
    if (ctx.originStatements?.length) {
        promptParts.push('', '[Происхождение]', ctx.originStatements.join('\n'));
    }
    if (ctx.assetReasons?.length) {
        promptParts.push('', '[Почему стал активом]', ctx.assetReasons.join('\n'));
    }
    promptParts.push('', '[Записки из лора]', loreBlock || '(нет лора)');

    const prompt = promptParts.join('\n');

    console.log(prompt);
    console.log();
}
