import 'dotenv/config';
import '../src/infrastructure/db';
import { memoryRepo } from '../src/infrastructure/repositories';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';
import { queueSubjectiveEpisode } from '../src/services/subjectiveMemoryEpisodes';

// Реальный позитивный эпизод Суми с Калибратором (атомы 3011-3037)
const atoms = memoryRepo.listRecent('NPC-CAND-SUMI', 1000, 'episode_v2')
    .filter(a => a.id >= 3011 && a.id <= 3037);

const episodes = aggregateMemoryEpisodes(atoms, 8);
console.log(`=== эпизодов Суми: ${episodes.length} ===`);
for (const e of episodes) {
    console.log(`[id=${e.id}] теги=${e.tags.join(',')} моментов=${e.atomCount} | ${e.title}`);
}

// возьмём эпизод 3037 (последний, «Обожаю твои ножки») - принудительно
const ep = episodes.find(e => e.id === 3037);
if (!ep) { console.log('Эпизод 3037 не найден'); process.exit(1); }
console.log(`\n=== ГЕНЕРИРУЮ эпизод Суми id=${ep.id} (force) ===`);
const t0 = performance.now();
await queueSubjectiveEpisode('NPC-CAND-SUMI', 'Суми', ep, true);
console.log(`done in ${Math.round(performance.now() - t0)}ms`);
