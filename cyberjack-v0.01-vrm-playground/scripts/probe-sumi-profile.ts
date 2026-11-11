import 'dotenv/config';
import { compileAuthoredProfile } from '../src/scenario/characters/authoredProfiles';

const prof = compileAuthoredProfile('NPC-CAND-SUMI', 'candidate', {});
if (!prof) { console.log('NO PROFILE'); process.exit(1); }
console.log('=== Суми compiled profile ===');
console.log('identity:', prof.identity.name, prof.identity.age);
console.log('coreModifiers:', JSON.stringify(prof.mechanicalSeed.coreModifiers));
console.log('loreRefs:', JSON.stringify(prof.loreRefs));
console.log('biography.origin:', JSON.stringify(prof.biography.origin));
console.log('formativeEvents:', JSON.stringify(prof.biography.formativeEvents));
console.log('\n--- personaText ---');
console.log(prof.personaText);
