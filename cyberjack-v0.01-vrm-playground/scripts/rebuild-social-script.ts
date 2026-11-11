import 'dotenv/config';
import '../src/infrastructure/seed';
import { applyAuthoredSocialToProfiles } from '../src/scenario/characters/authoredProfiles';
import { db } from '../src/infrastructure/db';

const applied = applyAuthoredSocialToProfiles();
console.log('applied:', applied.length, applied);

// Verify script/racket/game persisted
for (const id of applied) {
    const row = db.prepare('SELECT profile_json FROM characters WHERE id = ?').get(id) as any;
    const social = JSON.parse(row?.profile_json || '{}').social || {};
    console.log(`${id}: script="${social.script}" racket="${social.racket}" game="${social.game}"`);
}
