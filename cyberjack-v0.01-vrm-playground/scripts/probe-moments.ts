import 'dotenv/config';
import '../src/infrastructure/db';
import { memoryRepo } from '../src/infrastructure/repositories';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';

const atoms = memoryRepo.listRecent('NPC-CAND-GEN-04', 200, 'episode_v2');
const episodes = aggregateMemoryEpisodes(atoms, 12);
const ep = episodes.find(e => e.id === 3198);
if (!ep) { console.log('не найден'); process.exit(1); }
console.log("=== моменты эпизода 3198 ===");
for (const m of ep.moments) {
    console.log(`title: ${m.title}`);
    console.log(`  text: ${m.text.slice(0, 120)}`);
    console.log(`  tags: ${m.tags?.join(',')}`);
    console.log();
}
