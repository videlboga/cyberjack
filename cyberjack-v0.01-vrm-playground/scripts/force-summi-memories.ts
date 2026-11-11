import 'dotenv/config';
import { memoryRepo } from '../src/infrastructure/repositories';
import '../src/infrastructure/db';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';
import { queueSubjectiveEpisode, getSubjectiveEpisode } from '../src/services/subjectiveMemoryEpisodes';

const SUBJ = 'NPC-CAND-SUMI';
const NAME = 'Суми';

async function main() {
    console.log('=== Генерация субъективных воспоминаний для Суми (NPC-CAND-SUMI) ===\n');

    const atoms = memoryRepo.listRecent(SUBJ, 160, 'episode_v2');
    console.log(`Атомов памяти (episode_v2): ${atoms.length}`);

    const episodes = aggregateMemoryEpisodes(atoms, 12);
    console.log(`Эпизодов после агрегации: ${episodes.length}\n`);

    const missing = episodes.filter(e => !getSubjectiveEpisode(SUBJ, e));
    const have = episodes.filter(e => getSubjectiveEpisode(SUBJ, e));
    console.log(`С субъективным воспоминанием: ${have.length}`);
    console.log(`Без (ждёт генерации): ${missing.length}\n`);

    // Show which tags a long episode's coverage would require
    const longEp = missing.find(e => e.moments.length > 10);
    if (longEp) {
        console.log(`Кандидат для анализа покрытия: "${longEp.title}" (${longEp.moments.length} моментов)`);
        console.log(`Все теги эпизода: ${longEp.tags.join(', ')}`);
    }
    console.log();

    if (!missing.length) {
        console.log('Все эпизоды уже покрыты субъективными воспоминаниями. Принудительно регенерирую последний.');
        const target = episodes[episodes.length - 1];
        console.log(`Регенерация: "${target.title}" (key=${target.key})`);
        await queueSubjectiveEpisode(SUBJ, NAME, target, true);
        console.log('Готово.');
        process.exit(0);
    }

    // Показать первые 3 ожидающих
    console.log('Ожидающие эпизоды (первые 3):');
    missing.slice(0, 3).forEach((e, i) => {
        console.log(`  ${i + 1}. "${e.title}" | ${e.moments.length} моментов | теги: ${e.tags.slice(0,5).join(', ')}`);
    });
    console.log();

    let ok = 0, fail = 0;
    for (const ep of missing) {
        console.log(`→ Генерирую: "${ep.title}"`);
        try {
            const job = queueSubjectiveEpisode(SUBJ, NAME, ep, false, '', [], true);
            if (!job) { console.log('   пропущено (нет ключа/уже в очереди)'); continue; }
            await job;
            ok++;
        } catch (e: any) {
            fail++;
            console.log(`   ОШИБКА: ${e?.message || e}`);
        }
    }
    console.log(`\nИтог: успешно ${ok}, ошибок ${fail}.`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
