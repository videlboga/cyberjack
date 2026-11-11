import 'dotenv/config';
import '../src/infrastructure/db';
import { buildReactionSystemPrompt, compileReactionFrame } from '../src/narrative/reactionFrame';
import { subjectRepo, characterRelationRepo, activeContextsRepo } from '../src/infrastructure/repositories';
import { buildBehavioralCore } from '../src/narrative/reactionFrame';

import { db } from '../src/infrastructure/db';
const SUBJ = 'S-AV-01';
const core = subjectRepo.get(SUBJ)!;
const profile = JSON.parse(String((db.prepare('SELECT profile_json FROM characters WHERE id=? OR subject_id=? LIMIT 1').get(SUBJ, SUBJ) as any)?.profile_json || '{}'));
const behavioral = buildBehavioralCore(profile.profile_text || profile.base?.description || '');

const frame = compileReactionFrame({
    speakerId: SUBJ,
    speakerName: 'Мира',
    speakerGender: 'female',
    targetId: 'NPC-CAND-GEN-02',
    targetName: 'Эли',
    initiatorId: 'NPC-CAND-GEN-02',
    sceneTitle: 'Калибровочная',
    presentCharacters: ['Мира', 'Эли', 'Май'],
    contexts: ['Диагностический стол'],
    core,
    relation: characterRelationRepo.get(SUBJ, 'NPC-CAND-GEN-02'),
    behavioralCore: behavioral,
    profileText: profile.profile_text || profile.base?.description || '',
});

const prompt = buildReactionSystemPrompt(frame);
// показать identity-блок
const identity = prompt.split('\n\n')[0];
console.log('=== IDENTITY BLOCK ===');
console.log(identity);
console.log('\n=== содержит "я" усиление? ===');
console.log(identity.includes('говоришь от первого лица'), '| содержит имя:', identity.includes('Мира'));
