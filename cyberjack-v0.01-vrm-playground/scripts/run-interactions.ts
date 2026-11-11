// Прогон насыщенных взаимодействий на живой базе.
// Разговоры + действия + задания ассистентам + устройства.
const API = 'http://127.0.0.1:3001';

async function tick(body: Record<string, any>) {
  const resp = await fetch(`${API}/api/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await resp.json();
  return d;
}

async function talk(subjectId: string, text: string) {
  const d = await tick({ subjectId, playerId: 'PL-1', textMessage: text, sceneId: 'scene_lab_calibrator' });
  const speech = d?.reply?.speech || d?.reply || '';
  console.log(`  [${subjectId}] "${text}" → "${speech}"`);
  return d;
}

async function act(subjectId: string, presetId: string, pointId: string) {
  const d = await tick({ subjectId, playerId: 'PL-1', presetId, pointId, sceneId: 'scene_lab_calibrator', skipLLM: true });
  console.log(`  [${subjectId}] действие ${presetId}@${pointId} → ok=${d?.success !== false}`);
  return d;
}

async function directive(executorId: string, subjectId: string, goal: string) {
  const resp = await fetch(`${API}/api/staff/directives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executorId, subjectId, goal }),
  });
  const d = await resp.json();
  console.log(`  [директива] ${executorId} → ${subjectId}: "${goal}" → ok=${d?.success}`);
  return d;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('=== ДЕНЬ 1: разговоры и действия ===\n');

  // Разговоры с разными персонажами.
  await talk('S-AV-01', 'Мира, расскажи, как ты оказалась на станции.');
  await sleep(300);
  await talk('NPC-CAND-01', 'Ника, ты помнишь, что было до лаборатории?');
  await sleep(300);
  await talk('NPC-CAND-SUMI', 'Суми, как ты себя чувствуешь?');
  await sleep(300);
  await talk('NPC-CAND-GEN-04', 'Май, что ты думаешь о калибровке?');
  await sleep(300);

  // Действия (физические воздействия).
  await act('S-AV-01', 'act_caress', 'back');
  await sleep(200);
  await act('S-AV-01', 'act_kiss', 'lips');
  await sleep(200);
  await act('NPC-CAND-01', 'act_caress', 'thighs');
  await sleep(200);
  await act('NPC-CAND-SUMI', 'act_praise', 'systemic');
  await sleep(200);

  // Задания ассистентам (Иона — ассистент).
  await directive('NPC-LAB-01', 'S-AV-01', 'Подготовь Миру к контракту: проверь её состояние и доложи.');
  await sleep(300);
  await directive('NPC-LAB-01', 'NPC-CAND-01', 'Проведи осмотр Ники и зафиксируй реакцию.');

  console.log('\n=== ДЕНЬ 1 завершён. Ждём фоновый clock (консолидация во сне) ===\n');
  await sleep(2000);

  console.log('=== ДЕНЬ 2: продолжение ===\n');
  await talk('S-AV-01', 'Мира, как прошла ночь? Что тебе снилось?');
  await sleep(300);
  await talk('NPC-CAND-GEN-03', 'Рин, тебе удобно в устройстве?');
  await sleep(300);
  await talk('NPC-CAND-GEN-02', 'Эли, что ты чувствуешь в кресле?');
  await sleep(300);

  await act('S-AV-01', 'act_caress', 'neck');
  await sleep(200);
  await act('NPC-CAND-GEN-03', 'act_caress', 'buttocks');
  await sleep(200);

  await directive('NPC-LAB-01', 'NPC-CAND-GEN-03', 'Проверь реакцию Рин на анальную стимуляцию и доложи.');

  console.log('\n=== ГОТОВО ===');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
