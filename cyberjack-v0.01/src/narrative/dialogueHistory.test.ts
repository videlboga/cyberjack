import { describe, expect, it } from 'vitest';
import { buildPairedDialogueHistory } from './dialogueHistory';

describe('buildPairedDialogueHistory', () => {
    it('keeps complete conversational exchanges', () => {
        expect(buildPairedDialogueHistory([
            { role:'user', content:'Как ты?' },
            { role:'assistant', content:'Нормально.' },
            { role:'user', content:'Продолжать?' },
            { role:'assistant', content:'Да.' },
        ])).toEqual([
            { role:'user', content:'Как ты?' },
            { role:'assistant', content:'Нормально.' },
            { role:'user', content:'Продолжать?' },
            { role:'assistant', content:'Да.' },
        ]);
    });

    it('does not attach an automatic reaction to an unrelated later input', () => {
        expect(buildPairedDialogueHistory([
            { role:'assistant', content:'Резко выдыхает от смены ритма.' },
            { role:'user', content:'Как ты себя чувствуешь?' },
        ])).toEqual([
            { role:'assistant', content:'Резко выдыхает от смены ритма.' },
            { role:'user', content:'Как ты себя чувствуешь?' },
        ]);
    });
});
