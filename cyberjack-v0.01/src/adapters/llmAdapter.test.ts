import { describe, expect, it } from 'vitest';
import { extractAudibleSpeech } from './llmAdapter';

describe('audible character speech', () => {
    it('keeps only speech after an accidental delivery note', () => {
        expect(extractAudibleSpeech('Голос срывается на хриплый шёпот:\n— Я... сделала.')).toBe('Я... сделала.');
    });

    it('does not rewrite ordinary spoken language', () => {
        expect(extractAudibleSpeech('Нет. Я пока не готова.')).toBe('Нет. Я пока не готова.');
    });
});
