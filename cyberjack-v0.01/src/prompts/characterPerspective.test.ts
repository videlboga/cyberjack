import { describe, expect, it } from 'vitest';
import { buildReactionSystemPrompt, buildReactionTurnMessage, compileReactionFrame } from '../narrative/reactionFrame';
import { ownCharacterFact, renderEpisodeForCharacter } from './buildPromptPayload';

describe('character-facing perspective', () => {
    it('renders the active turn as owned experience rather than an engine report', () => {
        const frame = compileReactionFrame({
            speakerId: 'eli', speakerName: 'Эли', speakerGender: 'female',
            targetId: 'eli', targetName: 'Эли', initiatorId: 'player', initiatorName: 'Калибратор',
            presentCharacters: ['Эли', 'Калибратор'], contexts: ['Ты чувствуешь фиксаторы на запястьях.'],
            core: { sensitivity: 50, capacity: 35, openness: 20, plasticity: 40, attitude: 25, tension: 65 } as any,
            observation: {
                behavioralState: 'panic',
                reaction: { pleasure: 0, discomfort: 8, overload: 4, engagement: 8, mixed: false, sensoryAmplification: 2 },
                changes: { tension: 4, capacity: -3, attitude: -1, openness: -1, localAttitude: -1 },
                action: { label: 'Продолжительное давление', pointLabel: 'Запястья' },
                learning: { sensitivityDelta: 0, baselineSensitivityDelta: 0, familiarityDelta: 0 },
                transitions: [],
                subjectiveText: 'Ты чувствуешь, как давление не отпускает запястья и не даёт отстраниться.',
            } as any,
        });
        const prompt = `${buildReactionSystemPrompt(frame)}\n${buildReactionTurnMessage(frame)}`;
        expect(prompt).toContain('Внутренний сигнал текущего момента');
        expect(prompt).toContain('Твой непосредственный внутренний импульс');
        expect(prompt).toContain('В тебе накопилось сильное напряжение');
        expect(prompt).not.toMatch(/\bequipment:|\bpose:|\bP \d|\bD \d|sensoryAmplification|systemic/i);
        expect(prompt).not.toContain('персонаж сильнее закрылся');
        expect(prompt).not.toContain('Ты чувствуешь, как давление не отпускает запястья и не даёт отстраниться.');
    });

    it('turns biography and episodic memory toward the character', () => {
        expect(ownCharacterFact('Работала оператором медицинской телеметрии.'))
            .toBe('Ты знаешь это о себе и своей жизни: Работала оператором медицинской телеметрии.');
        const memory = renderEpisodeForCharacter({
            type: 'episode_v2', text: 'technical fallback', metadata: {
                actionLabel: 'Мягкое поглаживание', pointId: 'hands',
                objectiveFacts: { location: 'Жилая камера', environment: 'Тихое помещение.' },
                observation: { subjectiveText: 'Ты чувствуешь осторожное тепло в ладонях.' },
                playerSpeech: 'Я скоро вернусь', characterSpeech: 'Я подожду.',
            },
        });
        expect(memory).toContain('Ты помнишь воздействие');
        expect(memory).toContain('общий смысл своей телесной реакции');
        expect(memory).not.toContain('Ты чувствуешь осторожное тепло в ладонях.');
        expect(memory).toContain('Собеседник сказал тебе');
        expect(memory).not.toContain('Объективные факты симуляции');
    });

    it('keeps witnessed actions distinct from own bodily experience', () => {
        const memory = renderEpisodeForCharacter({
            type: 'episode_v2', text: 'technical fallback', metadata: {
                observed: true,
                actorName: 'Калибратор',
                targetName: 'Суми',
                actionLabel: 'Мягкое поглаживание',
                pointLabel: 'Шея',
            },
        });
        expect(memory).toContain('наблюдаемое событие');
        expect(memory).toContain('от Калибратор');
        expect(memory).toContain('на Суми');
        expect(memory).not.toContain('В твоей памяти телесное переживание');
    });
});
