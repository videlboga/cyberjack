import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';

const seeds = ['A1', 'A2', 'A3', 'A4', 'A5'];

for (const seed of seeds) {
    const ctx = generateCharacterContext({ seed });
    console.log(`\n================================`);
    console.log(`[ГЕНЕРАТОР: СИСТЕМНЫЙ ПРОМПТ ПЕРСОНАЖА (SEED: ${seed})]`);
    
    const worldLore = ctx.grouped.world.map(t => t.summary || t.title).filter(Boolean);
    const factionLore = ctx.grouped.faction.map(t => t.summary || t.title).filter(Boolean);
    
    const promptParts = [
        `## ОБЩИЙ ЛОР И БАЗОВОЕ ЗНАНИЕ МИРА`,
        `Ты находишься на изолированной станции Омникрон. То, что тебе известно о мире вокруг:`,
        ...worldLore.map(w => `> ${w}`),
        ``,
        `## ЗНАНИЯ О ФРАКЦИЯХ`,
        `Твое понимание корпораций и сил, управляющих станцией:`,
        ...factionLore.map(f => `> ${f}`),
        ``,
        `## ИНДИВИДУАЛЬНЫЙ ПРОФИЛЬ ПЕРСОНАЖА (АКТИВА)`
    ];

    if (ctx.originStatements?.length) {
        promptParts.push(...ctx.originStatements.map(o => `- Происхождение: ${o}`));
    }
    if (ctx.assetReasons?.length) {
        promptParts.push(...ctx.assetReasons.map(a => `- Причина попадания: ${a}`));
    }

    promptParts.push(``, `## ЛИЧНЫЕ УСТАНОВКИ, ФИЗИОЛОГИЯ И ВОСПОМИНАНИЯ (ТВОЕ "Я")`);
    ctx.personaNotes.forEach(note => promptParts.push(`* ${note}`));

    console.log(promptParts.join('\n'));
}
