import 'dotenv/config';
import { memoryRepo } from '../src/infrastructure/repositories';
import '../src/infrastructure/db';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';
import { parseVerbalInputWithLLM } from '../src/adapters/llmAdapter';

const clean = (t: string, n: number) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

const SUBJ = 'NPC-CAND-SUMI';

async function main() {
    const atoms = memoryRepo.listRecent(SUBJ, 160, 'episode_v2');
    const episodes = aggregateMemoryEpisodes(atoms, 12);
    // target: 22-мoment dialogue
    const ep = episodes.find(e => e.title.includes('NPC-CAND-01'))!;
    console.log('=== Эпизод:', ep.title, '===');
    console.log('Теги:', ep.tags.join(', '));
    const facts = ep.moments.map(m => `- ${m.title}: ${clean(m.text, 300)}`).join('\n').slice(0, 7500);
    console.log('Фактов символов:', facts.length);

    const prompt = `Ты создаёшь эпизодическую память персонажа Суми. Только JSON. Факты ниже — исчерпывающая истина. Пиши по-русски от первого лица. Верни {title,summary,appraisal,agency,emotionalArc,associations,openLoops}. associations: создай 2-8 конкретных ассоциаций. У каждой есть target, tagLinks (массив из 1-8 ТОЧНЫХ тегов из списка), evidence (1-3 точных фрагмента из уже написанного summary, должны буквально встречаться), valence -1..1, strength 0..1, expectation: seek|avoid|freeze|endure|anticipate. Покрой КАЖДЫЙ допустимый тег хотя бы одной связью.
\nДОПУСТИМЫЕ ТЕГИ: ${ep.tags.join(', ')}\nФАКТЫ:\n${facts}`;

    const { parsed, model } = await parseVerbalInputWithLLM([{ role: 'system', content: prompt }], { type: 'json_object' }, 'memory');
    console.log('\n=== Ответ модели:', model, '===');
    console.log('parsed keys:', parsed ? Object.keys(parsed) : 'UNDEFINED');
    console.log('associations:', parsed?.associations?.length);
    if (parsed?.summary) console.log('summary:', parsed.summary.slice(0, 300));
    if (parsed?.associations) {
        // Determine which episode tags are covered by evidence (against facts+summary corpus)
        const corpus = `${parsed.summary}\n${facts}`.toLocaleLowerCase();
        const covered = new Set<string>();
        parsed.associations.forEach((a: any) => {
            const ev = (a.evidence||[]).filter((p: string) => corpus.includes(String(p).toLocaleLowerCase()));
            (a.tagLinks||[]).forEach((t: string) => { if (ev.length) covered.add(t); });
        });
        console.log('\n=== Покрытие тегов ===');
        ep.tags.forEach(t => console.log(`  ${covered.has(t) ? '✓' : '✗'} ${t}`));
        console.log(`\nparsed.associations: ${parsed.associations.length}`);
        parsed.associations.forEach((a: any, i: number) => {
            const ev = (a.evidence||[]).filter((p: string) => corpus.includes(String(p).toLocaleLowerCase()));
            console.log(`  ${i}. [${(a.tagLinks||[]).join(',')}] evidence_ok=${ev.length} :: ${a.evidence?.[0] || ''}`);
        });
    }
    process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
