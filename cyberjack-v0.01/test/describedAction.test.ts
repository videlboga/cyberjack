import { describe, it, expect } from 'vitest';
import { extractDescribedAction } from '../src/parser/verbalParser';

describe('extractDescribedAction', () => {
  it('extracts *Глажу по щеке*', () => {
    expect(extractDescribedAction('*Глажу по щеке*')).toBe('Глажу по щеке');
  });

  it('extracts *бью по спине хлыстом*', () => {
    expect(extractDescribedAction('*бью по спине хлыстом*')).toBe('бью по спине хлыстом');
  });

  it('returns null for plain text without asterisks', () => {
    expect(extractDescribedAction('Просто текст')).toBeNull();
  });

  it('returns null for bold (**text**)', () => {
    expect(extractDescribedAction('**жирный текст**')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractDescribedAction('')).toBeNull();
  });

  it('extracts from mixed text with asterisk action', () => {
    expect(extractDescribedAction('Привет! *глажу по волосам*')).toBe('глажу по волосам');
  });

  it('extracts *целую в лоб*', () => {
    expect(extractDescribedAction('*целую в лоб*')).toBe('целую в лоб');
  });

  it('returns null for just asterisk', () => {
    expect(extractDescribedAction('*')).toBeNull();
  });
});