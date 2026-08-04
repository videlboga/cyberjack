import { describe, expect, it } from 'vitest';
import { resolveCurrentPostureFact, selectAuthoredFacts } from './buildPromptPayload';

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
