import 'dotenv/config';
import { memoryRepo } from '../src/infrastructure/repositories';
import '../src/infrastructure/db';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';

const SUBJ = 'NPC-CAND-SUMI';

function main() {
    const atoms = memoryRepo.listRecent(SUBJ, 160, 'episode_v2');
    const episodes = aggregateMemoryEpisodes(atoms, 12);
    const ep = episodes.find(e => e.title.includes('NPC-CAND-01'));
    if (!ep) { console.log('Эпизод не найден'); process.exit(0); }

    console.log('=== ЭПИЗОД:', ep.title, '===');
    console.log('id:', ep.id);
    console.log('теги:', ep.tags.join(', '));
    console.log('итог (episode.text):', JSON.stringify(ep.text).slice(0, 400));
    console.log('моментов:', ep.moments.length);
    console.log('\n=== МОМЕНТЫ (факты, из которых строится память) ===\n');
    ep.moments.forEach((m, i) => {
        console.log(`--- Момент ${i + 1} (id=${m.id}) ---`);
        console.log('title:', m.title);
        console.log('text:', m.text);
        console.log();
    });
    process.exit(0);
}
main();
