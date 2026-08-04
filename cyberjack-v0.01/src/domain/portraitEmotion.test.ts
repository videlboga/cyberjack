import { describe, expect, it } from 'vitest';
import { PortraitEmotionInput, portraitEmotions, resolvePortraitEmotion } from './portraitEmotion';

const cases: Record<string, PortraitEmotionInput> = {
  afterglow: { state: { contexts: [{ actionId: 'effect_refractory' }] } },
  angry: { behavioralState: 'defiance', reaction: { appraisal: -.8 } },
  aroused: { reaction: { pleasure: 4 }, state: { tension: 60 } },
  blush: { reaction: { appraisal: .3, engagement: 2 }, state: { tension: 35, openness: 45 } },
  bored: { reaction: { engagement: 0 } },
  climax: { transitions: [{ kind: 'discharge' }] },
  crying: { transitions: [{ kind: 'breakdown' }] },
  curious: { reaction: { engagement: 5, appraisal: 0 } },
  defiant: { behavioralState: 'defiance', reaction: { appraisal: -.2 } },
  disgust: { reaction: { appraisal: -.8, discomfort: 1, engagement: 2 } },
  distressed: { reaction: { discomfort: 4, pleasure: 0 } },
  excited: { reaction: { engagement: 8, appraisal: .4 } },
  exhausted: { state: { capacity: 10 } },
  fear: { behavioralState: 'panic' },
  guarded: { reaction: { appraisal: -.3, engagement: 2 }, state: { attitude: 40, tension: 45 } },
  high_negative: { reaction: { appraisal: -.2 }, state: { tension: 90, attitude: 30 } },
  high_positive: { reaction: { appraisal: .2 }, state: { tension: 90, attitude: 70 } },
  mixed: { reaction: { pleasure: 4, discomfort: 4, mixed: true } },
  mixed_overload: { reaction: { pleasure: 4, discomfort: 4, overload: 6, mixed: true } },
  neutral: { state: { attitude: 50, openness: 50 } },
  pain: { reaction: { discomfort: 9, pleasure: 1 } },
  pleasure: { reaction: { pleasure: 10 } },
  receptive: { state: { attitude: 70, openness: 70 } },
  sad: { reaction: { appraisal: -.4, engagement: .5 }, state: { tension: 20, attitude: 50 } },
  shy: { reaction: { appraisal: .3, engagement: 2 }, state: { tension: 50, openness: 25 } },
  sleepy: { state: { capacity: 25, tension: 20 } },
  smile: { reaction: { appraisal: .4, engagement: 2 }, state: { tension: 20, openness: 55 } },
  smug: { reaction: { appraisal: .7, engagement: 2 }, state: { attitude: 80, tension: 20 } },
  submissive: { reaction: { appraisal: .2, engagement: 2 }, state: { openness: 70, plasticity: 80, contexts: [{ actionId: 'act_apply_handcuffs' }] } },
  subspace: { behavioralState: 'subspace' },
  surprise: { transitions: [{ kind: 'startle' }] },
  unconscious: { behavioralState: 'unresponsive' },
};

describe('portrait emotion coverage', () => {
  it.each(Object.entries(cases))('resolves %s from simulation context', (emotion, input) => {
    expect(resolvePortraitEmotion(input)).toBe(emotion);
  });

  it('has a state fixture for every authored portrait', () => {
    expect(Object.keys(cases).sort()).toEqual([...portraitEmotions].sort());
  });

  it('uses an explicit fearful spoken reaction over positive verbal appraisal', () => {
    expect(resolvePortraitEmotion({
      speech: 'Пожалуйста, не надо. Что вы со мной сделаете?',
      reaction: { engagement: 15, appraisal: .5, pleasure: 2 },
    })).toBe('fear');
  });

  it('uses an explicit demand to stop over positive mechanical appraisal', () => {
    expect(resolvePortraitEmotion({
      speech: 'Я не люблю, когда меня трогают без разрешения. Остановитесь!',
      reaction: { appraisal: 0.8, engagement: 8, pleasure: 2 },
      state: { attitude: 70, openness: 60, tension: 30 },
    })).toBe('fear');
  });
});
