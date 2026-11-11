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

  it('tracks only unanswered questions (deferred plans come from social LLM memory)', () => {
    const threads = deriveOpenDialogueThreads([
      { role: 'assistant', content: 'Потом вернёмся к этому разговору.' },
    ], 'Суми', 'Калибратор');
    // Регекс-детекция отложенных договорённостей удалена: обещания/общие планы
    // выявляет LLM-слой социальной памяти, а не эвристика по языку.
    expect(threads.join(' ')).not.toContain('Отложенная договорённость');
  });
});
