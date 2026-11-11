import 'dotenv/config';
import { parseSemanticVerbalInput } from '../src/parser/semanticVerbalParser';
import '../src/infrastructure/db';

const SUBJ = 'S-AV-01';

async function run(text: string, dialogue: string, lastSpeech: string) {
    const start = performance.now();
    try {
        const result = await parseSemanticVerbalInput(
            text,
            'Текущее место: Кресло ментальной коррекции. Персонажи рядом: Мира.',
            [{ id: SUBJ, name: 'Мира' }],
            SUBJ,
            SUBJ,
            lastSpeech,
            'PL-1',
            null,
            dialogue,
        );
        const ms = Math.round(performance.now() - start);
        const ci = result.commandIntent as any;
        let ciStr = 'none';
        if (ci.type !== 'none' && ci.type !== 'misunderstood') {
            const extra = [ci.targetPoseId, ci.actionId, ci.targetContextId, ci.pointId].filter(Boolean).join(':');
            ciStr = `${ci.type}${extra ? ':' + extra : ''}`;
        } else if (ci.type === 'misunderstood') {
            ciStr = `misunderstood:${ci.partial}`;
        }
        console.log(`[${ms}ms] "${text}"`);
        console.log(`  commandIntent: ${ciStr}`);
        console.log(`  verbalIntent:  ${result.verbalIntent}`);
        console.log('---');
    } catch (e: any) {
        console.log(`[ERR] "${text}" — ${e?.message || e}`);
        console.log('---');
    }
}

// прогрев
await parseSemanticVerbalInput('тест', '', [], SUBJ, SUBJ).catch(() => {});

const dialogue = 'игрок: Ты такая чувствительная. Встань на колени\nМира: Хорошо... я встану.';

await run('Ты такая чувствительная. Встань на колени', dialogue, 'Хорошо... я встану.');
await run('встань на колени', dialogue, 'Хорошо... я встану.');
await run('встать на колени', '', '');
await run('Встань', '', '');
