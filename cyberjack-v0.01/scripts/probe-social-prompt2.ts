import 'dotenv/config';
import '../src/infrastructure/db';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';

// Эли (не изолирована) отвечает Мире
const p = await buildPromptPayloadWithDB('NPC-CAND-GEN-02', 'NPC-CAND-GEN-02', undefined, 'scene_lab_calibrator', {
    initiatorId: 'S-AV-01',
    addresseeId: 'S-AV-01',
});
const sys = p.systemPrompt || '';
const checks: [string, boolean][] = [
    ['identity: Эли', /Ты — Эли/.test(sys)],
    ['собеседник: Мира', /Твой собеседник — Мира/.test(sys)],
    ['рядом с вами блок', /рядом с вами|Рядом с вами|также находятся/.test(sys)],
];
for (const [name, ok] of checks) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
// показать блок рядом с вами
const m = sys.match(/Рядом с вами[^\n]*/);
if (m) console.log('\nБлок:', m[0]);
