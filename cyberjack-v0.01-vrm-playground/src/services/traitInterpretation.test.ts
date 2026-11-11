import { describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { subjectRepo, traitInterpretationRepo } from '../infrastructure/repositories';
import { traitInterpretationBlock, recordLearningDay, selectHistoryPoints } from './traitInterpretation';
import type { MemoryEpisode } from './memoryEpisodes';

function setupSubject(id: string, tags: Record<string, number>) {
    subjectRepo.save(id, 'Тест', {
        sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50,
        tension: 50, baselineCapacity: 50,
        preferences: JSON.stringify({ tags }),
    });
}

function episode(note: string): MemoryEpisode {
    return {
        id: 'ep-1',
        kind: 'lived',
        participants: ['Тест'],
        container: 'room',
        title: 'Событие',
        text: note,
        moments: [{ id: 'm1', text: note, tags: ['pain'] }],
        tags: ['pain'],
    } as any;
}
describe('recordLearningDay / traitInterpretationBlock', () => {
    it('записывает день обучения для метрики, относящейся к трейту', () => {
        // pain >= 3.25 → уровень 2 (trait_masochist).
        setupSubject('SUBJ-1', { pain: 3.5 });
        recordLearningDay('SUBJ-1', episode('Калибратор прижал иглу к бедру.'), ['pain']);
        const row = traitInterpretationRepo.get('SUBJ-1', 'pain');
        expect(row).not.toBeNull();
        expect(row!.history.length).toBe(1);
        expect(row!.history[0].note).toContain('прижал иглу');
        expect(row!.history[0].value).toBeGreaterThan(3);
    });

    it('не создаёт запись для метрики без трейта (нулевое обучение)', () => {
        setupSubject('SUBJ-2', {});
        recordLearningDay('SUBJ-2', episode('Что-то произошло.'), ['pain']);
        expect(traitInterpretationRepo.get('SUBJ-2', 'pain')).toBeNull();
    });

    it('сохраняет историю, если значение стало нулевым (запись была)', () => {
        setupSubject('SUBJ-3', { pain: 0 });
        // Раньше был трейт → запись существовала (в предыдущий день).
        traitInterpretationRepo.recordDay('SUBJ-3', 'pain', 0, 3.5, 'было больно');
        recordLearningDay('SUBJ-3', episode('Теперь не отзывается.'), ['pain']);
        const row = traitInterpretationRepo.get('SUBJ-3', 'pain');
        expect(row).not.toBeNull();
        // Запись осталась (не удалена) и значение обнулилось.
        expect(row!.history.length).toBeGreaterThanOrEqual(1);
        expect(row!.currentValue).toBe(0);
    });

    it('блок содержит историю по дням без чисел', () => {
        setupSubject('SUBJ-4', { pain: 3.5 });
        traitInterpretationRepo.recordDay('SUBJ-4', 'pain', 1, 3.5, 'Первый раз боль отозвалась.');
        traitInterpretationRepo.recordDay('SUBJ-4', 'pain', 5, 3.6, 'Стало привычно.');
        const block = traitInterpretationBlock('SUBJ-4');
        expect(block).not.toBeNull();
        expect(block).toContain('[Интерпретация обучения]');
        expect(block).toContain('боль');
        expect(block).toContain('первый день');
        expect(block).not.toMatch(/\d+\.\d+/); // без чисел
    });

    it('разрежение: при 20 днях свежие идут подряд', () => {
        const history = Array.from({ length: 20 }, (_, i) => ({ day: i + 1, value: i, note: `n${i + 1}` }));
        const selected = selectHistoryPoints(history, 10);
        const days = selected.map(p => p.day);
        expect(days[0]).toBe(1);
        expect(days[days.length - 1]).toBe(20);
        expect(days.slice(-6)).toEqual([15, 16, 17, 18, 19, 20]);
    });

    it('записывает день обучения для point-трейта (точка из момента эпизода)', () => {
        // clitoris >= 3.25 → уровень 2 (trait_point_clitoris).
        subjectRepo.save('SUBJ-P', 'Тест', {
            sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50,
            tension: 50, baselineCapacity: 50,
            preferences: JSON.stringify({ points: { clitoris: 3.5 } }),
        });
        const pointEpisode = {
            ...episode('Калибратор коснулся клитора'),
            moments: [{ id: 'm1', text: 'Калибратор коснулся клитора', tags: ['pleasure'], pointId: 'clitoris' }],
        } as any;
        recordLearningDay('SUBJ-P', pointEpisode, []);
        const row = traitInterpretationRepo.get('SUBJ-P', 'clitoris');
        expect(row).not.toBeNull();
        expect(row!.history[0].note).toContain('коснулся');
        expect(row!.currentValue).toBeGreaterThan(3);
    });
});
