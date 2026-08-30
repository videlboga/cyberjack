import 'dotenv/config';
import { ensureGeneratedProfile } from '../src/orchestration/characterGenerator/profileManager';
import { db } from '../src/infrastructure/db';

// Verify what the actual prompt system sees for Sumi
const profile = ensureGeneratedProfile('NPC-CAND-SUMI');
console.log('=== Sumi: what the prompt system sees ===');
console.log('personaText length:', profile.personaText.length);
console.log('\n--- personaText ---');
console.log(profile.personaText.slice(0, 1200));
console.log('\n--- loreRefs resolved ---');
console.log(JSON.stringify(profile.loreRefs));
console.log('\n--- social ---');
const row = db.prepare("SELECT profile_json FROM characters WHERE id='NPC-CAND-SUMI'").get() as any;
console.log(JSON.stringify(JSON.parse(row.profile_json).social));
console.log('\n--- canonicalFacts that go into prompt ---');
console.log(JSON.stringify(profile.biography.origin));
console.log('formerRole:', profile.biography.formerRole);
console.log('formativeEvents:', JSON.stringify(profile.biography.formativeEvents));
