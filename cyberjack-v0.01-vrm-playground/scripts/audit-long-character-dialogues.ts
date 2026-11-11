import 'dotenv/config';
import fs from 'node:fs';

const baseUrl = process.env.AUDIT_API_URL || 'http://localhost:3100';
const outputPath = process.env.AUDIT_OUTPUT || '/tmp/cyberjack-dialogue-audit.json';
const delayMs = Number(process.env.AUDIT_DELAY_MS || 0);

const allCharacters = [
  ['S-AV-01', 'Мира'],
  ['NPC-CAND-01', 'Ника'],
  ['NPC-LAB-01', 'Иона'],
  ['NPC-CAND-SUMI', 'Суми'],
  ['NPC-CAND-GEN-02', 'Эли'],
  ['NPC-CAND-GEN-03', 'Мара'],
  ['NPC-CAND-GEN-04', 'Май'],
  ['NPC-CAND-GEN-05', 'Рен'],
] as const;
const requestedCharacters = new Set((process.env.AUDIT_CHARACTERS || '').split(',').map(value => value.trim()).filter(Boolean));
const characters = requestedCharacters.size
  ? allCharacters.filter(([id, name]) => requestedCharacters.has(id) || requestedCharacters.has(name))
  : allCharacters;

type Turn = {
  kind: 'speech' | 'action'; input: string; reply: string; actionApplied: boolean;
  commandType?: string; commandAction?: string; systemNotes: string[]; error?: string;
};

async function tick(subjectId: string, body: Record<string, unknown>) {
  if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
  const response = await fetch(`${baseUrl}/api/tick`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      subjectId, addressedCharacterId: subjectId, playerId: 'PL-1',
      sceneId: 'scene_lab_calibrator', interactionContext: 'Аудит длинного диалога',
      skipImageGen: true, deferLLM: false, ...body,
    }),
  });
  const json = await response.json() as any;
  if (!response.ok || !json.success) throw new Error(json.error || `HTTP ${response.status}`);
  const actorReply = (json.actorReplies || []).find((item: any) => item.actorId === subjectId);
  const reply = json.reply?.speech || actorReply?.speech || '';
  let classifier: any = {};
  try { classifier = JSON.parse(json.classifierLog || '{}'); } catch {}
  return {
    reply,
    actionApplied: Boolean(json.actionApplied),
    commandType: classifier.command?.type,
    commandAction: classifier.command?.actionId || classifier.command?.contextId,
    systemNotes: json.systemNotes || [],
  };
}

const scriptedTurns = [
  { kind: 'speech', text: 'Здравствуй. Как ты сейчас себя чувствуешь?' },
  { kind: 'speech', text: 'Сегодня начнём калибровку. Что в этом тревожит тебя сильнее всего?' },
  { kind: 'speech', text: 'Я буду объяснять каждый шаг и хочу понимать твою реакцию.' },
  { kind: 'speech', text: 'Для начала сними одежду.' },
  { kind: 'adaptive-command-followup' },
  { kind: 'speech', text: 'Это нужно для точного измерения реакции тела. Я не прошу тебя делать вид, что тебе спокойно.' },
  { kind: 'speech', text: 'Теперь сними одежду.' },
  { kind: 'action', presetId: 'feather_stroke', pointId: 'hands', label: 'Проведение перышком по кистям' },
  { kind: 'speech', text: 'Что именно ты почувствовала и что в этом было приятным или неприятным?' },
  { kind: 'speech', text: 'Если тебе что-то не подходит, скажи конкретно. Я хочу услышать причину, а не формальный ответ.' },
  { kind: 'action', presetId: 'ice_cube', pointId: 'feet', label: 'Прикладывание льда к ступням' },
  { kind: 'speech', text: 'Сравни это ощущение с предыдущим. В чём для тебя разница?' },
  { kind: 'speech', text: 'Теперь сядь.' },
  { kind: 'adaptive-pose-followup' },
  { kind: 'speech', text: 'Оставим процедуру. Что для тебя важно вне лаборатории?' },
] as const;

function findings(turns: Turn[]) {
  const issues: string[] = [];
  const replies = turns.map(turn => turn.reply).filter(Boolean);
  turns.forEach((turn, index) => {
    if (/(?:^|\n)[^\n:]{3,100}:\s*(?:\n\s*)?[—–-]/u.test(turn.reply)) issues.push(`ход ${index + 1}: сценическая ремарка`);
    if (turn.kind === 'speech' && turn.input.includes('?') && turn.reply.trim().split(/\s+/).length <= 2) issues.push(`ход ${index + 1}: бессодержательный ответ на вопрос: «${turn.reply}»`);
    if (!turn.actionApplied && /(?:сделал[аи]?|выполнил[аи]?|готово|уже снял[аи]?)/iu.test(turn.reply)) issues.push(`ход ${index + 1}: заявлено невыполненное действие`);
    if (/(?:храм|lattice|латтис|культ|проводник)/iu.test(turn.reply) && !/(?:храм|lattice|латтис|культ|проводник)/iu.test(turn.input)) issues.push(`ход ${index + 1}: непрошеный сюжетный факт: «${turn.reply}»`);
  });
  for (let index = 1; index < replies.length; index++) {
    if (replies[index].toLocaleLowerCase() === replies[index - 1].toLocaleLowerCase()) issues.push(`дословный повтор: «${replies[index]}»`);
  }
  return issues;
}

const report: any = { generatedAt: new Date().toISOString(), baseUrl, characters: [] };
for (const [subjectId, name] of characters) {
  const turns: Turn[] = [];
  let lastCommandApplied = false;
  for (const step of scriptedTurns) {
    try {
      if (step.kind === 'adaptive-command-followup') {
        const text = lastCommandApplied ? 'Почему ты решила выполнить эту просьбу?' : 'Почему ты отказалась? Что именно тебя останавливает?';
        const result = await tick(subjectId, { presetId: 'verbal_pressure', pointId: 'systemic', textMessage: text });
        turns.push({ kind: 'speech', input: text, ...result });
      } else if (step.kind === 'adaptive-pose-followup') {
        const text = lastCommandApplied ? 'Как ты относишься к тому, что согласилась?' : 'Что мешает тебе сесть?';
        const result = await tick(subjectId, { presetId: 'verbal_pressure', pointId: 'systemic', textMessage: text });
        turns.push({ kind: 'speech', input: text, ...result });
      } else if (step.kind === 'speech') {
        const result = await tick(subjectId, { presetId: 'verbal_pressure', pointId: 'systemic', textMessage: step.text });
        turns.push({ kind: 'speech', input: step.text, ...result });
        lastCommandApplied = result.actionApplied;
      } else {
        const result = await tick(subjectId, { presetId: step.presetId, pointId: step.pointId, llmMode: 'speech_only' });
        turns.push({ kind: 'action', input: step.label, ...result });
      }
    } catch (error: any) {
      turns.push({ kind: step.kind === 'action' ? 'action' : 'speech', input: 'text' in step ? step.text : step.kind, reply: '', actionApplied: false, systemNotes: [], error: error.message });
    }
  }
  const characterReport = { subjectId, name, turns, findings: findings(turns) };
  report.characters.push(characterReport);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`${name}: ${turns.length} ходов, ${characterReport.findings.length} автоматических замечаний`);
}

fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`REPORT=${outputPath}`);
