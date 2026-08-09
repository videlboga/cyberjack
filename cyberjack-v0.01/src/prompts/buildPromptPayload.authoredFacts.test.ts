import { describe, expect, it } from 'vitest';
import { resolveCurrentPostureFact, selectAuthoredFacts, selectGeneralPromptEpisodes } from './buildPromptPayload';
import { contextPromptEffect } from '../domain/contextNarration';

const profile = {
  identity: { archetype: 'asset' },
  authoredProfile: {
    biography: {
      formativeEvents: [{
        fact: 'Она выросла при закрытом храме.',
        emotionalMeaning: 'Боится возвращения туда.',
        topics: ['храм', 'детство'],
      }],
      relationships: [],
    },
    knowledge: { personal: [], misconceptions: [], secrets: [] },
    roleAdaptations: { asset: { selfUnderstanding: 'Она понимает свою роль актива.' } },
  },
};

describe('selectAuthoredFacts', () => {
  it('does not inject unrelated biography into a physical interaction', () => {
    expect(selectAuthoredFacts(profile, [{ role: 'user', content: 'Что ты почувствовала от прикосновения пером?' }]))
      .toEqual(['Она понимает свою роль актива.']);
  });

  it('recalls biography when the current topic actually matches it', () => {
    expect(selectAuthoredFacts(profile, [{ role: 'user', content: 'Расскажи о детстве в храме.' }]).join(' '))
      .toContain('закрытом храме');
  });
});

describe('resolveCurrentPostureFact', () => {
  it('treats the visual default as standing', () => {
    expect(resolveCurrentPostureFact([])).toContain('ты стоишь');
  });

  it('prefers an explicit pose over the visual default', () => {
    expect(resolveCurrentPostureFact(['clothing: Нижнее бельё', 'pose: Сидит']))
      .toContain('Сидит');
  });

  it('uses equipment posture when no free pose exists', () => {
    expect(resolveCurrentPostureFact([], 'ты лежишь в фиксаторах'))
      .toContain('ты лежишь в фиксаторах');
  });
});

describe('general prompt memories', () => {
  it('keeps direct player experience ahead of newly written social chatter', () => {
    const selected = selectGeneralPromptEpisodes([
      { text: 'Новая реплика Суми', type: 'episode_v2', metadata: { socialTransaction: true }, relatedSubjects: ['NPC-CAND-SUMI'] },
      { text: 'Недавний разговор с игроком', type: 'episode_v2', metadata: {}, relatedSubjects: ['PL-1'] },
      { text: 'Наблюдение за игроком', type: 'episode_v2', metadata: { observed: true }, relatedSubjects: ['PL-1', 'NPC-CAND-SUMI'] },
    ], 'NPC-CAND-SUMI');
    expect(selected.map(record => record.text)).toEqual(['Недавний разговор с игроком', 'Наблюдение за игроком', 'Новая реплика Суми']);
  });
});

describe('context narration', () => {
  it('gives the feet-presentation pose a concrete non-standing description', () => {
    expect(contextPromptEffect('act_present_feet')).toBe('Ты сидишь с вытянутыми вперёд ногами и демонстрируешь ступни.');
  });
});
