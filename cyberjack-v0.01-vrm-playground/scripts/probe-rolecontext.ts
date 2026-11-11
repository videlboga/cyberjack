import 'dotenv/config';
import '../src/infrastructure/db';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';

const p = await buildPromptPayloadWithDB('S-AV-01', 'S-AV-01', undefined, 'scene_lab_calibrator', {
    initiatorId: 'NPC-CAND-GEN-02',
    addresseeId: 'NPC-CAND-GEN-02',
});
const sys = p.systemPrompt;
// показать roleContext и блок про собеседника
const idx = sys.indexOf('[Твоё положение');
const roleEnd = idx >= 0 ? sys.indexOf('\n\n', idx) : -1;
console.log('=== roleContext / положение ===');
console.log(idx >= 0 ? sys.slice(idx, roleEnd > 0 ? roleEnd : idx + 1200) : '(блок не найден)');
console.log('\n=== строки про собеседника / Калибратора ===');
sys.split('\n').filter(l => /собеседник|Калибратор/i.test(l)).forEach(l => console.log('-', l.trim().slice(0, 120)));
