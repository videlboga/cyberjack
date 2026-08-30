import 'dotenv/config';
import '../src/infrastructure/db';
import { memoryRepo } from '../src/infrastructure/repositories';
import { aggregateMemoryEpisodes } from '../src/services/memoryEpisodes';

const atoms = memoryRepo.listRecent('NPC-CAND-GEN-04', 200, 'episode_v2');
const ep = atoms.find(a => a.id === 3198);
if (!ep) { console.log('не найден'); process.exit(1); }
console.log("атом 3198 metadata.observed:", ep.metadata?.observed);
console.log("атом 3198 metadata keys:", Object.keys(ep.metadata || {}));
console.log("атом 3198 tags:", ep.tags);
