import { describe, expect, it } from 'vitest';
import { buildCompactEpisodeText, compactMemoryReaction } from './memoryLayer';

describe('episode memory presentation', () => {
    it('keeps a compact lived event separate from scene telemetry', () => {
        const text = buildCompactEpisodeText({
            actionLabel: 'Щекотка пальцами',
            pointLabel: 'Ступни',
            observation: {
                behavioralState: 'panic',
                reaction: { pleasure: 0, discomfort: 3, overload: 0, mixed: false },
            } as any,
            userText: 'Скажи, что ты чувствуешь',
        });

        expect(text).toBe('Калибратор выполнил действие «Щекотка пальцами» в области «Ступни». Мне это было неприятно. Я испугалась и попыталась отстраниться. Калибратор сказал: «Скажи, что ты чувствуешь».');
        expect(text).not.toContain('Объективные факты');
        expect(text).not.toContain('телесной реакции');
    });

    it('uses direct language for a defensive reaction', () => {
        expect(compactMemoryReaction({ behavioralState: 'defiance', reaction: {} } as any))
            .toBe('Я сопротивлялась происходящему.');
    });
});
