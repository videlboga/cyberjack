import { describe, expect, it } from 'vitest';
import { formatElapsedGameTime, formatWorldTimeContext, renderTemporalDialogue, selectCurrentDialogueSegment } from './temporalDialogue';

describe('temporal dialogue context', () => {
    it('starts a fresh literal exchange after a long absence', () => {
        const selected = selectCurrentDialogueSegment([
            { role: 'assistant', content: 'А это приятно?', worldMinute: 23000, contextLabel: 'Стол' },
            { role: 'user', content: 'Нужно вывести её в положительную.', worldMinute: 23002, contextLabel: 'Стол' },
            { role: 'assistant', content: 'Я вижу, вы начали без меня.', worldMinute: 24587, contextLabel: 'Стол' },
            { role: 'user', content: 'Хочешь присоединиться?', worldMinute: 24592, contextLabel: 'Стол' },
        ]);
        expect(selected.map(entry => entry.content)).toEqual([
            'Я вижу, вы начали без меня.',
            'Хочешь присоединиться?',
        ]);
    });

    it('starts a fresh literal exchange when the place changes', () => {
        const selected = selectCurrentDialogueSegment([
            { role: 'assistant', content: 'Я подожду здесь.', worldMinute: 100, contextLabel: 'Капсула' },
            { role: 'user', content: 'Что ты видишь?', worldMinute: 105, contextLabel: 'Диагностический стол' },
        ]);
        expect(selected).toHaveLength(1);
        expect(selected[0].content).toBe('Что ты видишь?');
    });

    it('formats game time into natural coarse intervals', () => {
        expect(formatElapsedGameTime(1)).toBe('');
        expect(formatElapsedGameTime(8)).toBe('несколько минут');
        expect(formatElapsedGameTime(65)).toBe('около часа');
        expect(formatElapsedGameTime(6351)).toBe('около 4 дней');
    });

    it('provides an absolute world clock and duration of the known stay', () => {
        expect(formatWorldTimeContext(32127, 11433)).toBe(
            'Сейчас день 23, примерно 07:27 по игровому времени. С первого зафиксированного момента твоего пребывания здесь прошло около 14 дней. Это факт хронологии: не описывай происходящее как только что начавшееся.'
        );
    });

    it('marks a substantial pause without changing literal dialogue', () => {
        expect(renderTemporalDialogue([
            { role: 'assistant', content: 'Я подожду.', worldMinute: 17472, contextLabel: 'Восстановительная капсула' },
            { role: 'user', content: 'Как самочувствие?', worldMinute: 23823, contextLabel: 'Жилая камера B' },
        ], 'Май', 'Калибратор')).toEqual([
            'Май: «Я подожду.»',
            '[Временной разрыв: После предыдущей реплики прошло около 4 дней. Место изменилось: Восстановительная капсула → Жилая камера B. Не воспринимай следующую реплику как мгновенное продолжение предыдущей.]',
            'Калибратор: «Как самочувствие?»',
        ]);
    });

    it('uses a location change to separate legacy messages without game time', () => {
        const lines = renderTemporalDialogue([
            { role: 'assistant', content: 'Я подожду.', contextLabel: 'Восстановительная капсула' },
            { role: 'user', content: 'Как самочувствие?', contextLabel: 'Жилая камера B' },
        ], 'Май', 'Калибратор');
        expect(lines[1]).toContain('Это уже другой момент разговора');
        expect(lines[1]).toContain('Восстановительная капсула → Жилая камера B');
    });

    it('does not clutter a continuous conversation', () => {
        const lines = renderTemporalDialogue([
            { role: 'user', content: 'Как ты?', worldMinute: 100 },
            { role: 'assistant', content: 'Нормально.', worldMinute: 101 },
        ], 'Май', 'Калибратор');
        expect(lines).toEqual(['Калибратор: «Как ты?»', 'Май: «Нормально.»']);
    });
});
