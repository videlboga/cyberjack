import { describe, expect, it } from 'vitest';
import { extractAudibleSpeech } from './llmAdapter';

describe('audible character speech', () => {
    it('keeps only speech after an accidental delivery note', () => {
        expect(extractAudibleSpeech('Голос срывается на хриплый шёпот:\n— Я... сделала.')).toBe('Я... сделала.');
    });

    it('does not rewrite ordinary spoken language', () => {
        expect(extractAudibleSpeech('Нет. Я пока не готова.')).toBe('Нет. Я пока не готова.');
    });

    it('drops inline stage directions between quoted speech segments', () => {
        expect(
            extractAudibleSpeech('«Мягко?» — я сглатываю, пытаясь унять дрожь в голосе. «После всего, что было... ты спрашиваешь про "мягко"?»'),
        ).toBe('Мягко? После всего, что было... ты спрашиваешь про "мягко"?');
    });

    it('drops a trailing stage direction after a single quoted segment', () => {
        expect(extractAudibleSpeech('«Хватит» — я отворачиваюсь, сжимая кулаки.')).toBe('Хватит');
    });

    it('keeps a single quoted segment without a stage direction intact', () => {
        expect(extractAudibleSpeech('«Я... согласна»')).toBe('Я... согласна');
    });
});
