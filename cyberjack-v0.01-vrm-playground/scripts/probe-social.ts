import 'dotenv/config';
import '../src/infrastructure/seed';
import { applyAuthoredSocialToProfiles } from '../src/scenario/characters/authoredProfiles';
import { db } from '../src/infrastructure/db';

const applied = applyAuthoredSocialToProfiles();
console.log('applied social to:', applied);

// Verify Sumi social
const row = db.prepare("SELECT profile_json FROM characters WHERE id='NPC-CAND-SUMI'").get() as any;
const social = JSON.parse(row.profile_json).social;
console.log('Sumi social:', JSON.stringify(social, null, 2));
