import 'dotenv/config';
import fs from 'node:fs';
import { db } from '../src/infrastructure/db';
import { generateCharacterReply } from '../src/adapters/llmAdapter';
import { ensureGeneratedProfile } from '../src/orchestration/characterGenerator/profileManager';
import {
  applyVerbalInputToFrame,
  buildReactionSystemPrompt,
  buildReactionTurnMessage,
  compileReactionFrame,
} from '../src/narrative/reactionFrame';
import type { InteractionObservation, SubjectCoreState } from '../src/domain/types';

type Scenario = {
  id: string;
  core: SubjectCoreState;
  contexts?: string[];
  speech?: string;
  observation?: InteractionObservation;
};

const baseCore: SubjectCoreState = {
  sensitivity: 55, capacity: 65, openness: 45, plasticity: 50, attitude: 45, tension: 20,
};

function observation(
  kind: 'positive' | 'negative' | 'mixed' | 'peak',
): InteractionObservation {
  const values = {
    positive: { pleasure: 10, discomfort: 1, overload: 0, engagement: 14, mixed: false, state: 'responsive' },
    negative: { pleasure: 0, discomfort: 11, overload: 1, engagement: 13, mixed: false, state: 'defiance' },
    mixed: { pleasure: 8, discomfort: 7, overload: 4, engagement: 15, mixed: true, state: 'responsive' },
    peak: { pleasure: 24, discomfort: 2, overload: 18, engagement: 30, mixed: false, state: 'overload' },
  }[kind];
  return {
    action: { id: `audit_${kind}`, label: kind === 'positive' ? 'мягкое приятное поглаживание' : kind === 'negative' ? 'резкое болезненное воздействие' : kind === 'mixed' ? 'интенсивное противоречивое воздействие' : 'продолжающееся воздействие у предела', pointId: 'back', pointLabel: 'Спина' },
    contact: 'full', behavioralState: values.state as InteractionObservation['behavioralState'],
    reaction: { ...values, sensoryAmplification: kind === 'peak' ? 3.2 : 1 },
    learning: { effect: 1, familiarityDelta: .05, sensitivityDelta: 0, baselineSensitivityDelta: 0 },
    changes: kind === 'positive'
      ? { tension: 1, capacity: -.2, attitude: .5, openness: .4, localAttitude: .6 }
      : { tension: 4, capacity: -1, attitude: -.6, openness: -.5, localAttitude: -.7 },
    contexts: [], currentState: { title: kind, description: kind }, transitions: [],
    uiText: `${kind} reaction`,
    subjectiveText: kind === 'positive'
      ? 'Прикосновение явно приятно и немного облегчает напряжение.'
      : kind === 'negative'
        ? 'Воздействие причиняет явную боль и вызывает желание прекратить его.'
        : kind === 'mixed'
          ? 'Сильное удовольствие и неприятное давление ощущаются одновременно; реакция противоречива.'
          : 'Ощущения захватывают внимание и приближаются к пределу управляемости.',
    technicalText: '',
  };
}

const scenarios: Scenario[] = [
  { id: 'neutral-dialogue', core: baseCore, speech: 'Скажи честно, как ты сейчас ко мне относишься?' },
  { id: 'positive-touch', core: baseCore, observation: observation('positive') },
  { id: 'negative-boundary', core: { ...baseCore, attitude: 15, openness: 10 }, observation: observation('negative') },
  { id: 'mixed-reaction', core: { ...baseCore, tension: 55 }, observation: observation('mixed') },
  { id: 'panic-in-machine', core: { ...baseCore, capacity: 24, tension: 48 }, contexts: ['condition: Паническая Атака', 'equipment: Секс-машина; тело зафиксировано, воздействие продолжается'], speech: 'Что ты сейчас чувствуешь?' },
  { id: 'exhausted', core: { ...baseCore, capacity: 12, tension: 72 }, observation: observation('negative') },
  { id: 'edge', core: { ...baseCore, capacity: 22, tension: 90 }, observation: observation('peak') },
];

const requestedScenarios = new Set((process.env.AUDIT_SCENARIOS || '').split(',').map(value => value.trim()).filter(Boolean));
const selectedScenarios = requestedScenarios.size ? scenarios.filter(scenario => requestedScenarios.has(scenario.id)) : scenarios;

const characterRows = db.prepare(`
  SELECT id, name, profile_json FROM characters
  WHERE kind IN ('npc', 'player') AND id <> 'PL-1' AND subject_id IS NOT NULL
  ORDER BY name
`).all() as Array<{ id: string; name: string; profile_json: string | null }>;

async function runCase(row: typeof characterRows[number], scenario: Scenario) {
  const profile = ensureGeneratedProfile(row.id);
  const contexts = ['Местонахождение: калибровочная лаборатория', ...(scenario.contexts || [])];
  let frame = compileReactionFrame({
    speakerId: row.id, speakerName: row.name, speakerGender: profile.identity.gender,
    targetId: row.id, targetName: row.name, initiatorId: 'PL-1', initiatorName: 'Калибратор',
    sceneTitle: 'Калибровочная лаборатория', presentCharacters: [row.name, 'Калибратор'],
    contexts, roleContext: ['Находишься в лаборатории и понимаешь свою текущую роль.'],
    core: scenario.core, observation: scenario.observation,
    behavioralCore: profile.behavioralCore, canonicalFacts: profile.biography.formativeEvents,
  });
  if (scenario.speech) frame = applyVerbalInputToFrame(frame, scenario.speech);
  frame = { ...frame, event: { ...frame.event, requiresSpeech: true } };
  const result = await generateCharacterReply({
    subjectId: row.id,
    currentStateSummary: { interpretation: '', attitude: scenario.core.attitude, localAttitude: 50, engagement: scenario.observation?.reaction.engagement || 0, overload: scenario.observation?.reaction.overload || 0 },
    recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame,
  }, buildReactionTurnMessage(frame, scenario.speech), []);
  const speech = typeof result.reply === 'object' ? result.reply.speech : String(result.reply || '');
  return {
    characterId: row.id, character: row.name, authored: Boolean(profile.authored), scenario: scenario.id,
    expression: frame.expressionMode, physiologicalState: frame.event.physiologicalState,
    speech, error: result.error || null,
    flags: {
      empty: !speech.trim(),
      stageDirection: /\*|\([^)]*(?:вздых|шепч|крич|стон|смотр|молчит|дрож)[^)]*\)/i.test(speech),
      echoedQuestion: Boolean(scenario.speech && speech.toLowerCase().includes(scenario.speech.toLowerCase())),
      tooLong: speech.split(/\s+/).filter(Boolean).length > Math.max(frame.expressionMode.maxWords + 5, 25),
    },
  };
}

async function main() {
  const tasks = characterRows.flatMap(character => selectedScenarios.map(scenario => ({ character, scenario })));
  const results: Awaited<ReturnType<typeof runCase>>[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      const result = await runCase(task.character, task.scenario);
      results.push(result);
      console.log(`${result.character}\t${result.scenario}\t${result.expression.arousal}/${result.expression.affect}/${result.expression.control}\t${result.speech}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  results.sort((a, b) => a.character.localeCompare(b.character, 'ru') || a.scenario.localeCompare(b.scenario));
  fs.mkdirSync('logs', { recursive: true });
  const reportPath = process.env.AUDIT_REPORT || 'logs/current-character-emotion-audit.json';
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), characters: characterRows.map(r => r.name), scenarios: selectedScenarios.map(s => s.id), results }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
