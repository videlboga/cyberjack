import 'dotenv/config';
import '../src/infrastructure/db';
import { memoryRepo } from '../src/infrastructure/repositories';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';
import { queueSubjectiveEpisode } from '../src/services/subjectiveMemoryEpisodes';

// Реальный игровой сексуальный эпизод Миры: атомы 3303-3328
const atoms = memoryRepo.listRecent('S-AV-01', 1000, 'episode_v2')
    .filter(a => a.id >= 3303 && a.id <= 3328);

const episodes = aggregateMemoryEpisodes(atoms, 8);
// возьмём эпизод id=3313 (поцелуй + минет + похвала, 4 момента)
const ep = episodes.find(e => e.id === 3313);
if (!ep) { console.log('Эпизод 3313 не найден'); process.exit(1); }
console.log(`=== ГЕНЕРИРУЮ эпизод id=${ep.id} «${ep.title}» (force) ===`);
console.log(`теги: ${ep.tags.join(', ')}`);
const t0 = performance.now();
await queueSubjectiveEpisode('S-AV-01', 'Мира', ep, true);
console.log(`done in ${Math.round(performance.now() - t0)}ms`);
