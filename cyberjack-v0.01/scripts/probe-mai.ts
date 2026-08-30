import 'dotenv/config';
import '../src/infrastructure/db';
import { memoryRepo } from '../src/infrastructure/repositories';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';
import { getSubjectiveEpisode, queueSubjectiveEpisode } from '../src/services/subjectiveMemoryEpisodes';

// Форсируем генерацию для Май: найдём эпизод без субъективной памяти
const atoms = memoryRepo.listRecent('NPC-CAND-GEN-04', 200, 'episode_v2');
const episodes = aggregateMemoryEpisodes(atoms, 12);
console.log(`=== эпизодов Май: ${episodes.length} ===`);

// найдём первый без субъективной памяти
let target = null;
for (const e of episodes) {
    if (!getSubjectiveEpisode('NPC-CAND-GEN-04', e)) { target = e; break; }
}
if (!target) {
    console.log('Все эпизоды уже имеют субъективную память — беру самый свежий принудительно');
    target = episodes[0];
}
console.log(`\n=== ГЕНЕРИРУЮ эпизод id=${target.id} «${target.title}» ===`);
console.log(`теги: ${target.tags.join(', ')} | моментов: ${target.atomCount}`);
const t0 = performance.now();
await queueSubjectiveEpisode('NPC-CAND-GEN-04', 'Май', target, true);
console.log(`done in ${Math.round(performance.now() - t0)}ms`);
