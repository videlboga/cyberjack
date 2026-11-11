import 'dotenv/config';
import '../src/infrastructure/db';
import { memoryRepo } from '../src/infrastructure/repositories';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';
import { regenerateSubjectiveEpisode } from '../src/services/subjectiveMemoryEpisodes';

// Старый эпизод Май «Разговор о Нике» (3198) - без tagExpansions
const atoms = memoryRepo.listRecent('NPC-CAND-GEN-04', 200, 'episode_v2');
const episodes = aggregateMemoryEpisodes(atoms, 12);
const ep = episodes.find(e => e.id === 3198);
if (!ep) { console.log('Эпизод 3198 не найден'); process.exit(1); }
console.log(`=== ВНУШЕНИЕ в старый эпизод id=${ep.id} «${ep.title}» ===`);
console.log(`теги: ${ep.tags.join(', ')}`);
const t0 = performance.now();
await regenerateSubjectiveEpisode(
    'NPC-CAND-GEN-04', 'Май', ep,
    'Ты чувствуешь, что разговор с Никой был важным и тёплым, несмотря на тревогу.',
    ['scene_observation'],
);
console.log(`done in ${Math.round(performance.now() - t0)}ms`);
