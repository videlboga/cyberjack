import { describe, expect, it } from 'vitest';
import { renderEpisodeForCharacter, resolveCurrentPostureFact, selectAuthoredFacts, selectGeneralPromptEpisodes } from './buildPromptPayload';
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

  it('renders an episode as a concise lived fact without replaying its old environment', () => {
    const rendered = renderEpisodeForCharacter({
      text: 'Long legacy text with stale environment.',
      type: 'episode_v2',
      metadata: {
        actionLabel: 'Щекотка пальцами',
        pointLabel: 'Ступни',
        memoryReaction: 'Мне это было неприятно.',
        objectiveFacts: { environment: 'A very long obsolete description.' },
      },
    });
    expect(rendered).toBe('Калибратор выполнил действие «Щекотка пальцами» в области «Ступни». Мне это было неприятно.');
    expect(rendered).not.toContain('obsolete');
  });

  it('recovers the concrete authored action from a legacy episode record', () => {
    const rendered = renderEpisodeForCharacter({
      text: 'Действие: Подать биоматериал; зона: Губы. Объективные факты симуляции: …',
      type: 'episode_v2',
      metadata: {
        actionLabel: 'Подать биоматериал',
        observation: { action: { description: 'Интимный контур капсулы подаёт в рот персонажа порцию семенной жидкости калибратора.' } },
      },
    });
    expect(rendered).toBe('Интимный контур капсулы подаёт в рот персонажа порцию семенной жидкости калибратора.');
  });
});

describe('context narration', () => {
  it('gives the feet-presentation pose a concrete non-standing description', () => {
    expect(contextPromptEffect('act_present_feet')).toBe('Ты сидишь с вытянутыми вперёд ногами и демонстрируешь ступни.');
  });
});
