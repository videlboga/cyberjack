import 'dotenv/config';
import { parseSemanticVerbalInput } from '../src/parser/semanticVerbalParser';
import '../src/infrastructure/db';
import { chatMemoryRepo } from '../src/infrastructure/repositories';

const SUBJ = 'S-AV-01';

async function run(text: string) {
    // Реальный recentDialogue, как его формирует eventRouter: 8 последних
    // сообщений ДО текущего (текущее ещё не записано в БД в момент парсинга).
    const recentMessages = chatMemoryRepo.getRecent(SUBJ, 8);
    const recentDialogue = recentMessages
        .map((m: any) => `${m.role === 'assistant' ? 'персонаж' : 'игрок'}: ${m.content}`)
        .join('\n');
    const lastSpeech = [...recentMessages].reverse().find((m: any) => m.role === 'assistant')?.content || '';

    console.log('=== recentDialogue, который видит модель ===');
    console.log(recentDialogue);
    console.log('=== recentCharacterSpeech ===', lastSpeech.slice(0, 60));
    console.log('=======================================');

    const start = performance.now();
    try {
        const result = await parseSemanticVerbalInput(
            text,
            'Текущее место: Кресло ментальной коррекции. Персонажи рядом: Мира.',
            [{ id: SUBJ, name: 'Мира' }],
            SUBJ, SUBJ, lastSpeech, 'PL-1', null, recentDialogue,
        );
        const ms = Math.round(performance.now() - start);
        const ci = result.commandIntent as any;
        console.log(`[${ms}ms] "${text}"`);
        console.log('  commandIntent:', JSON.stringify(ci));
    } catch (e: any) {
        console.log(`[ERR] "${text}" — ${e?.message || e}`);
    }
}

await parseSemanticVerbalInput('тест', '', [], SUBJ, SUBJ).catch(() => {});
await run('Тогда возьми его в рот');
