import 'dotenv/config';
import '../src/infrastructure/db';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';

const p = await buildPromptPayloadWithDB('NPC-CAND-GEN-02', 'NPC-CAND-GEN-02', undefined, 'scene_lab_calibrator', {
    initiatorId: 'S-AV-01',
    addresseeId: 'S-AV-01',
});
const frame = (p as any).reactionFrame;
console.log('presentCharacters:', JSON.stringify(frame?.scene?.presentCharacters));
console.log('roleContext:', JSON.stringify(frame?.scene?.roleContext, null, 1));
