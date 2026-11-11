import 'dotenv/config';
import '../src/infrastructure/db';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';

// Социальный ход: Мира отвечает Эли (инициатор и адресат — Эли)
const p = await buildPromptPayloadWithDB('S-AV-01', 'S-AV-01', undefined, 'scene_lab_calibrator', {
    initiatorId: 'NPC-CAND-GEN-02',
    addresseeId: 'NPC-CAND-GEN-02',
});

const sys = p.systemPrompt || '';
const checks: [string, boolean][] = [
    ['identity: Мира от первого лица', /Ты — Мира/.test(sys) && /от первого лица/.test(sys)],
    ['собеседник: Эли', /Твой собеседник — Эли/.test(sys)],
    ['НЕ Калибратор как собеседник', !/Твой собеседник — Калибратор/.test(sys)],
    ['рядом с вами блок', /рядом с вами|Рядом с вами|также находятся/.test(sys)],
];
for (const [name, ok] of checks) console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
console.log('\n--- systemPrompt (первые 1300) ---');
console.log(sys.slice(0, 1300));
