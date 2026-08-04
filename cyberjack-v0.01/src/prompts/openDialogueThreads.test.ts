import { describe, expect, it } from 'vitest';
import { deriveOpenDialogueThreads } from './buildPromptPayload';

describe('deriveOpenDialogueThreads', () => {
  it('does not keep a replied-to promise as the active topic forever', () => {
    const threads = deriveOpenDialogueThreads([
      { role: 'user', content: 'Я обещаю объяснять каждый шаг.' },
      { role: 'assistant', content: 'Хорошо, тогда продолжай.' },
      { role: 'user', content: 'Что ты чувствуешь сейчас?' },
    ], 'Суми', 'Калибратор');
    expect(threads.join(' ')).not.toContain('обещаю объяснять');
  });

  it('keeps a genuinely unanswered future agreement', () => {
    const threads = deriveOpenDialogueThreads([
      { role: 'assistant', content: 'Потом вернёмся к этому разговору.' },
    ], 'Суми', 'Калибратор');
    expect(threads.join(' ')).toContain('Отложенная договорённость');
  });
});
