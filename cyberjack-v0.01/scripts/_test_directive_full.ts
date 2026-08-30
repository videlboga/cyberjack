import 'dotenv/config';
import { parseSemanticVerbalInput } from '../src/parser/semanticVerbalParser';

const chars = [
  { id: 'NPC-CAND-SUMI', name: 'Суми' },
  { id: 'NPC-LAB-01', name: 'Иона' },
  { id: 'NPC-SUB-MIRA', name: 'Мира' },
  { id: 'NPC-CAND-GEN-03', name: 'Рин' },
  { id: 'NPC-CAND-GEN-02', name: 'Эли' },
];

const cases: Array<{ label: string; text: string; actor?: string; target?: string }> = [
  // ── contract ──
  { label: 'contract-1', text: 'Подготовь Миру к контракту 45' },
  { label: 'contract-2', text: 'Приведи Эли в соответствие с требованиями контракта №12' },
  { label: 'contract-3', text: 'Начни готовить Суми к сдаче по контракту' },
  // ── category ──
  { label: 'category-1', text: 'Натренируй Эли на болевые реакции' },
  { label: 'category-2', text: 'Работай над покорностью Рин' },
  { label: 'category-3', text: 'Развивай у Миры страх и подчинение' },
  // ── condition ──
  { label: 'condition-1', text: 'доведи чувствительность Миры до 400%, но так, чтобы выносливость не падала ниже 50' },
  { label: 'condition-2', text: 'держи Суми на грани оргазма, пока она не начнёт отключаться' },
  { label: 'condition-3', text: 'унижай Эли, но следи, чтобы отношение не упало ниже 30' },
  // ── interrupt ──
  { label: 'interrupt-1', text: 'остановись, Иона' },
  { label: 'interrupt-2', text: 'Иона, перестань' },
  { label: 'interrupt-3', text: 'прекрати сейчас же' },
  // ── НЕ кейсы (должны быть none или другой intent) ──
  { label: 'neg-third-party', text: 'Эли требует, чтобы Рин остановилась' },
  { label: 'neg-single-action', text: 'Ударь Миру по лицу' },
  { label: 'neg-question', text: 'Как ты себя чувствуешь?' },
  { label: 'neg-plain-action', text: 'Пощёчина' },
  { label: 'neg-routine', text: 'Сходи в туалет' },
  { label: 'neg-chat', text: 'Ты хорошо справляешься' },
];

async function run() {
  const results: any[] = [];
  for (const { label, text, actor, target } of cases) {
    try {
      const r = await parseSemanticVerbalInput(text, 'лаборатория калибратора', chars, actor || 'NPC-LAB-01', target || 'NPC-SUB-MIRA');
      const ci = r.commandIntent as any;
      results.push({
        label, text,
        type: ci?.type,
        goal: ci?.goal ?? null,
        algorithm: ci?.algorithm ?? null,
        executor: ci?.executorId ?? null,
        requester: ci?.requesterId ?? null,
        actor: ci?.targetId ?? null,
      });
    } catch (e: any) {
      results.push({ label, text, type: 'ERROR', error: e?.message });
    }
  }
  console.log('=== FULL RESULTS ===');
  for (const r of results) {
    console.log(JSON.stringify(r));
  }
}
run();
