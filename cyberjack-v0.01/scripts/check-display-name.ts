import 'dotenv/config';
import '../src/infrastructure/db';
import { characterRepo } from '../src/infrastructure/repositories';
console.log('PL-1 →', characterRepo.displayNameFor('PL-1'));
console.log('S-AV-01 →', characterRepo.displayNameFor('S-AV-01'));
console.log('NPC-CAND-GEN-02 →', characterRepo.displayNameFor('NPC-CAND-GEN-02'));
