import { describe, expect, it } from 'vitest';
import { selectRecentDialogue } from './buildPromptPayload';

type Entry = { role: string; content: string; worldMinute?: number | null; contextLabel?: string | null };

const entry = (role: string, content: string, worldMinute?: number): Entry => ({
    role,
    content,
    worldMinute,
    contextLabel: 'Жилая камера B',
});

describe('selectRecentDialogue', () => {
    it('collapses verbatim repeats of the same line, keeping the first occurrence', () => {
        const entries: Entry[] = [
            entry('assistant', 'Да, этот трек подходит — он достаточно мягкий', 100),
            entry('user', 'Ты уже определилась с музыкой?', 101),
            entry('assistant', 'Да, этот трек подходит — он достаточно мягкий', 102), // repeat
            entry('user', 'Ты уже определилась с музыкой?', 103), // repeat
        ];
        const lines = selectRecentDialogue(entries, 'Ника', 'Суми');
        const joined = lines.join('\n');
        expect(joined.split('Да, этот трек подходит').length - 1).toBe(1);
        expect(joined.split('Ты уже определилась с музыкой').length - 1).toBe(1);
    });

    it('keeps distinct lines in chronological order', () => {
        const entries: Entry[] = [
            entry('assistant', 'Первая реплика', 100),
            entry('user', 'Вторая реплика', 101),
            entry('assistant', 'Третья реплика', 102),
        ];
        const lines = selectRecentDialogue(entries, 'Ника', 'Суми');
        expect(lines.length).toBe(3);
        expect(lines[0]).toContain('Первая реплика');
        expect(lines[1]).toContain('Вторая реплика');
        expect(lines[2]).toContain('Третья реплика');
    });

    it('filters technical interaction markers', () => {
        const entries: Entry[] = [
            entry('assistant', '[Воздействие] лёгкое касание', 100),
            entry('assistant', 'Обычная реплика', 101),
        ];
        const lines = selectRecentDialogue(entries, 'Ника', 'Суми');
        expect(lines.join('\n')).not.toContain('[Воздействие]');
        expect(lines.join('\n')).toContain('Обычная реплика');
    });
});
