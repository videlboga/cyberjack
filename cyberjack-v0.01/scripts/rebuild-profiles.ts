import 'dotenv/config';
import '../src/infrastructure/seed';
import { ensureGeneratedProfile } from '../src/orchestration/characterGenerator/profileManager';
import { db } from '../src/infrastructure/db';

const IDs = ['NPC-CAND-SUMI', 'S-AV-01', 'NPC-LAB-01', 'NPC-CAND-01', 'NPC-CAND-GEN-02', 'NPC-CAND-GEN-04'];

for (const id of IDs) {
    try {
        const profile = ensureGeneratedProfile(id);
        const authored = (profile as any).authored === true;
        console.log(`${id}: authored=${authored} core=${JSON.stringify(profile.mechanicalSeed?.coreModifiers)} loreRefs=${profile.loreRefs?.length || 0}`);
    } catch (e: any) {
        console.log(`${id}: ERROR ${e?.message || e}`);
    }
}

// Verify social persisted
for (const id of IDs) {
    const row = db.prepare('SELECT profile_json FROM characters WHERE id = ?').get(id) as any;
    if (row) {
        const d = JSON.parse(row.profile_json);
        console.log(`${id} social: ${d.social ? d.social.defaultEgoState + '/' + d.social.lifePosition : 'NONE'}`);
    }
}
