import { describe, expect, it } from 'vitest';
import { aggregateMemoryEpisodes, EpisodeMemoryAtom } from './memoryEpisodes';

const atom = (id: number, overrides: Partial<EpisodeMemoryAtom> = {}): EpisodeMemoryAtom => ({
    id,
    text: 'raw memory',
    tags: ['pleasure'],
    relatedSubjects: ['PL-1'],
    metadata: {
        actionLabel: 'Беседа',
        objectiveFacts: { container: 'Модуль секс-машины', environment: 'подъём снова обрывается, удержание продолжается' },
        observation: { action: { label: 'Беседа', description: 'Ты слышишь голос.' }, reaction: {}, transitions: [] },
    },
    ...overrides,
});

describe('aggregateMemoryEpisodes', () => {
    it('links an unresolved scene to an adjacent outcome in another container', () => {
        const episodes = aggregateMemoryEpisodes([
            atom(10),
            atom(11, { metadata: { ...atom(11).metadata, actionLabel: 'Подать биоматериал', objectiveFacts: { container: 'Восстановительная капсула' }, observation: { action: { label: 'Подать биоматериал', description: 'Капсула подаёт порцию.' }, reaction: {}, transitions: [{ kind: 'discharge', title: 'Оргазм' }] } } }),
        ]);

        expect(episodes).toHaveLength(1);
        expect(episodes[0]).toMatchObject({ id: 11, atomCount: 2 });
        expect(episodes[0].title).toContain('→');
        expect(episodes[0].text).toContain('Оргазм');
        expect(episodes[0].moments).toHaveLength(2);
    });

    it('collapses contiguous observations of the same participants into one scene', () => {
        const observed = (id: number, actionLabel: string): EpisodeMemoryAtom => atom(id, {
            tags: ['scene_observation'],
            relatedSubjects: ['PL-1', 'NPC-ELI'],
            metadata: { observed: true, actorId: 'PL-1', targetId: 'NPC-ELI', targetName: 'Эли', actionLabel },
        });
        const episodes = aggregateMemoryEpisodes([observed(20, 'Вопрос'), observed(22, 'Беседа'), observed(24, 'Похвала')]);

        expect(episodes).toHaveLength(1);
        expect(episodes[0]).toMatchObject({ atomCount: 3, title: 'Наблюдение: Эли' });
        expect(episodes[0].text).toContain('3 момента');
    });

    it('keeps a substantial id gap as a boundary for a conversation', () => {
        const conversation = (id: number) => atom(id, {
            relatedSubjects: ['NPC-NIKA'],
            metadata: { socialTransaction: true },
        });
        const episodes = aggregateMemoryEpisodes([conversation(30), conversation(50)]);
        expect(episodes).toHaveLength(2);
    });

    it('keeps a subject in the same device across intervening events for others', () => {
        const later = atom(95, {
            metadata: {
                ...atom(95).metadata,
                actionLabel: 'Подать биоматериал',
                objectiveFacts: { container: 'Модуль секс-машины' },
            },
        });
        const episodes = aggregateMemoryEpisodes([atom(40), later]);
        expect(episodes).toHaveLength(1);
        expect(episodes[0].atomCount).toBe(2);
    });

    it('keeps a direct arc intact across observation and an explicit transfer', () => {
        const observed = atom(42, {
            tags: ['scene_observation'],
            relatedSubjects: ['PL-1', 'NPC-NIKA'],
            metadata: { observed: true, actorId: 'PL-1', targetId: 'NPC-NIKA', targetName: 'Ника', actionLabel: 'Вопрос' },
        });
        const transfer = atom(46, {
            metadata: {
                ...atom(46).metadata,
                actionLabel: 'Команда',
                playerSpeech: 'Я помещу тебя в капсулу для восстановления.',
            },
        });
        const capsule = atom(47, {
            metadata: {
                ...atom(47).metadata,
                actionLabel: 'Подать биоматериал',
                objectiveFacts: { container: 'Восстановительная капсула' },
            },
        });
        const episodes = aggregateMemoryEpisodes([atom(40), observed, transfer, capsule]);
        const directArc = episodes.find(episode => episode.id === 47)!;
        expect(directArc.atomCount).toBe(3);
        expect(directArc.title).toContain('→');
        expect(episodes.find(episode => episode.id === 42)?.atomCount).toBe(1);
    });
});
