import 'dotenv/config';
import '../src/infrastructure/seed';
import { compileAuthoredProfile } from '../src/scenario/characters/authoredProfiles';
import { db } from '../src/infrastructure/db';

const IDs = ['NPC-CAND-SUMI', 'S-AV-01', 'NPC-LAB-01', 'NPC-CAND-01', 'NPC-CAND-GEN-02', 'NPC-CAND-GEN-04'];

for (const id of IDs) {
    const row = db.prepare('SELECT profile_json FROM characters WHERE id = ?').get(id) as any;
    if (!row) continue;
    const canonical = JSON.parse(row.profile_json);
    const compiled = compileAuthoredProfile(id, canonical.roleState?.role || 'asset', canonical.roleState);
    // Обновить generatedProfile.systemPrompt
    canonical.generatedProfile = { ...canonical.generatedProfile, ...compiled };
    db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(JSON.stringify(canonical), id);
    const sp = compiled.systemPrompt || '';
    const i = sp.indexOf('[Инструкции]');
    console.log(`${id}: ${i >= 0 ? sp.slice(i, i + 60) : 'NO INSTRUCTIONS'}`);
}
