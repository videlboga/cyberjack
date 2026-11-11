import { describe, expect, it } from 'vitest';
import { hasVerifiedDirectiveEvidence } from './semanticVerbalParser';

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
