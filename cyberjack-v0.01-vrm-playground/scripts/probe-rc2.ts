import 'dotenv/config';
import '../src/infrastructure/db';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';

const p = await buildPromptPayloadWithDB('NPC-CAND-GEN-02', 'NPC-CAND-GEN-02', undefined, 'scene_lab_calibrator', {
    initiatorId: 'S-AV-01',
    addresseeId: 'S-AV-01',
});
const frame = (p as any).reactionFrame;
console.log('presentCharacters:', JSON.stringify(frame?.scene?.presentCharacters));
console.log('roleContext count:', frame?.scene?.roleContext?.length);
// ищем блок рядом с вами
const has = (frame?.scene?.roleContext || []).some((x: string) => /рядом с вами/i.test(x));
console.log('has bystanders block:', has);
