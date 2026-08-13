import { describe, expect, it } from 'vitest';
import { hasVerifiedDirectiveEvidence, isGenericUndressCommand } from './semanticVerbalParser';

describe('directive evidence', () => {
  it('accepts an exact directive from a later sentence in any language', () => {
    expect(hasVerifiedDirectiveEvidence('Let us try. Please sit down.', {
      explicitDirective: true,
      directiveEvidence: 'Please sit down',
    })).toBe(true);
  });

  it('rejects an invented directive', () => {
    expect(hasVerifiedDirectiveEvidence('Давай попробуем.', {
      explicitDirective: true,
      directiveEvidence: 'Присядь',
    })).toBe(false);
  });
});

describe('generic undress command (parser boundary)', () => {
  it('recognizes a generic undress command', () => {
    expect(isGenericUndressCommand('Я рад. Сними одежду')).toBe(true);
    expect(isGenericUndressCommand('Разденься')).toBe(true);
    expect(isGenericUndressCommand('Сними всю одежду')).toBe(true);
  });

  it('does not reinterpret a specific clothing instruction', () => {
    expect(isGenericUndressCommand('Сними комбинезон')).toBe(false);
    expect(isGenericUndressCommand('Продолжай')).toBe(false);
  });
});
