import { describe, expect, it } from 'vitest';
import { extractSocialMemories } from './socialMemory';

describe('extractSocialMemories', () => {
  it('does not read «потому» as the future marker «потом»', () => {
    expect(extractSocialMemories('assistant', 'Я согласилась, потому что это было предписано.'))
      .toEqual([]);
  });

  it('keeps an actual future plan', () => {
    expect(extractSocialMemories('assistant', 'Потом вернёмся к этому разговору.')[0]?.kind)
      .toBe('shared_plan');
  });
});
