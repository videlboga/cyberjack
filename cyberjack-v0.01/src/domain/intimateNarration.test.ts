import { describe, expect, it } from 'vitest';
import { intimateNarrationFor } from './intimateNarration';

describe('intimate prompt narration', () => {
  it('describes oral start and deepening from the character perspective', () => {
    expect(intimateNarrationFor('act_start_oral_giving', 'lips')).toMatchObject({
      description: 'Пенис входит тебе в рот; начинается минет.',
      sensory: { stimulus: 'Ты чувствуешь пенис во рту.' },
    });
    expect(intimateNarrationFor('act_deepen_oral', 'lips')?.sensory.stimulus)
      .toContain('глубже во рту');
  });

  it('keeps the stop description anatomically distinct', () => {
    expect(intimateNarrationFor('act_end_sexual_contact', 'lips')?.description)
      .toContain('выходит из твоего рта');
    expect(intimateNarrationFor('act_end_sexual_contact', 'anus')?.description)
      .toContain('выходит из твоего ануса');
  });

  it('uses its source action to describe each sustained intimate action', () => {
    expect(intimateNarrationFor('sustained_sexual_pulse', 'lips', 'act_start_oral_giving')?.sensory.stimulus)
      .toBe('Ты чувствуешь пенис во рту.');
    expect(intimateNarrationFor('sustained_sexual_pulse', 'vagina', 'finger_insertion')?.sensory.stimulus)
      .toContain('пальцы внутри: во влагалище');
  });
});
