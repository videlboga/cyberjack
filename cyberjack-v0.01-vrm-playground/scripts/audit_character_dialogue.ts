import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';
import { compileGeneratedProfile } from '../src/orchestration/characterGenerator/profileV2';
import { composePromptSections } from '../src/orchestration/characterGenerator/promptComposer';
import { applyVerbalInputToFrame, buildReactionSystemPrompt, buildReactionTurnMessage, compileReactionFrame } from '../src/narrative/reactionFrame';
import { generateCharacterReply } from '../src/adapters/llmAdapter';
import type { InteractionObservation, SubjectCoreState } from '../src/domain/types';

const identities = [
  ['Ада', 'female'], ['Брина', 'female'], ['Веста', 'female'], ['Грета', 'female'], ['Дана', 'female'],
  ['Кир', 'male'], ['Леон', 'male'], ['Марк', 'male'], ['Рен', 'male'], ['Тео', 'male']
] as const;

const core: SubjectCoreState = { sensitivity: 52, capacity: 70, openness: 48, plasticity: 55, attitude: 50, tension: 18 };

function observation(kind: 'pleasant' | 'unpleasant'): InteractionObservation {
  const pleasant = kind === 'pleasant';
  return {
    action: { id: pleasant ? 'gentle_stroke' : 'scratching', label: pleasant ? 'Мягкое поглаживание' : 'Царапанье ногтями', pointId: 'back', pointLabel: 'Спина' },
    contact: 'full', behavioralState: 'responsive',
    reaction: pleasant
      ? { pleasure: 7, discomfort: 1, overload: 0, engagement: 12, mixed: false }
      : { pleasure: 0, discomfort: 7, overload: 0, engagement: 10, mixed: false },
    learning: { effect: 2, familiarityDelta: .1, sensitivityDelta: .2, baselineSensitivityDelta: .02 },
    changes: pleasant
      ? { tension: 2, capacity: -.2, attitude: .4, openness: .3, localAttitude: .5 }
      : { tension: 3, capacity: -.4, attitude: -.5, openness: -.5, localAttitude: -.7 },
    contexts: [], currentState: { title: 'В контакте', description: 'Осмысленно реагирует на происходящее.' }, transitions: [],
    uiText: pleasant ? 'Воздействие воспринимается преимущественно приятно.' : 'Воздействие воспринимается неприятно.',
    subjectiveText: pleasant
      ? 'Прикосновение приятно и немного облегчает принятие контакта.'
      : 'Царапанье неприятно; после него хочется сильнее закрыться.',
    technicalText: ''
  };
}

function profileFor(name: string, gender: 'female' | 'male') {
  const context = generateCharacterContext({ seed: `universality-${name}`, archetype: 'asset', identity: { name, age: 20 + name.length, gender, anatomy: 'human' } });
  const sections = composePromptSections(context, { identity: '', history: '', instructions: 'Верни JSON с прямой речью.' });
  return compileGeneratedProfile(`audit-${name}`, context, sections);
}

async function main() {
  const report: any[] = [];
  for (const [name, gender] of identities) {
    const profile = profileFor(name, gender);
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const replies: any[] = [];
    const base = {
      speakerId: `audit-${name}`, speakerName: name, targetId: `audit-${name}`, targetName: name,
      speakerGender: gender,
      initiatorId: 'PL-1', initiatorName: 'Калибратор', presentCharacters: [name, 'Калибратор'],
      contexts: ['Калибровочная', 'На персонаже нет надетого оборудования'], core,
      behavioralCore: profile.behavioralCore
    };

    const turns = [
      { kind: 'question', speech: 'Что ты сейчас думаешь о происходящем?', obs: observation('pleasant'), repetition: 1 },
      { kind: 'pleasant-first', obs: observation('pleasant'), repetition: 1 },
      { kind: 'pleasant-repeat', obs: observation('pleasant'), repetition: 3 },
      { kind: 'unpleasant', obs: observation('unpleasant'), repetition: 1 }
    ];

    for (const turn of turns) {
      let frame = compileReactionFrame({ ...base, observation: turn.obs, repetition: turn.repetition, recentDialogue: history.map(h => `${h.role}: ${h.content}`) });
      if (turn.speech) frame = applyVerbalInputToFrame(frame, turn.speech);
      const userMessage = buildReactionTurnMessage(frame, turn.speech);
      const result = await generateCharacterReply({
        subjectId: `audit-${name}`, currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: turn.obs.reaction.engagement, overload: 0 },
        recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
      }, userMessage, history);
      const structured = typeof result.reply === 'object' ? result.reply : { speech: String(result.reply || '') };
      replies.push({ turn: turn.kind, ...structured, error: result.error || null });
      if (turn.speech) history.push({ role: 'user', content: turn.speech });
      if (structured.speech) history.push({ role: 'assistant', content: structured.speech });
    }
    report.push({
      name,
      sourceTags: profile.sourceTags.filter(id => /^(role_|psy_|response_|trait_)/.test(id)),
      core: profile.behavioralCore,
      replies
    });
    console.log(JSON.stringify(report[report.length - 1]));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
