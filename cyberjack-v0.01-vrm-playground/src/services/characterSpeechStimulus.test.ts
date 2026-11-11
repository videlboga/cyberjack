import { describe, expect, it } from 'vitest';
import { compileReactionFrame } from '../narrative/reactionFrame';
import { prepareCharacterSpeechStimuli } from './characterSpeechStimulus';

const frame = compileReactionFrame({
    speakerId: 'S-1', speakerName: 'Май', targetId: 'S-1', targetName: 'Май',
    initiatorId: 'S-2', initiatorName: 'Суми', presentCharacters: ['Май', 'Суми'], contexts: [],
    core: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 0, preferences: '{}' },
});
const payload = {
    subjectId: 'S-1',
    currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
    recentEvents: [],
    reactionFrame: frame,
};

describe('character speech stimuli', () => {
    it('represents an autonomous opener as an internal impulse', () => {
        const prepared = prepareCharacterSpeechStimuli(payload, [{
            kind: 'internal_impulse',
            event: { action: 'самостоятельный разговор', target: 'Суми', experience: 'Вы живёте в одной комнате.' },
            impulse: { id: 'social', primaryIntent: 'Ты решила первой познакомиться с Суми.', secondaryConflict: 'Близость ещё не сложилась.', allowedSpeechActs: ['probe'] },
        }]);
        expect(prepared?.frame.dramaticPosition.primaryIntent).toContain('первой познакомиться');
        expect(prepared?.frame.event.playerSpeech).toBeUndefined();
        expect(prepared?.userInput).toContain('Твой непосредственный внутренний импульс');
    });

    it('keeps an incoming line external while applying the character own response motive', () => {
        const prepared = prepareCharacterSpeechStimuli(payload, [
            { kind: 'external_speech', speech: 'Как тебя зовут?' },
            { kind: 'internal_impulse', impulse: { id: 'reply', primaryIntent: 'Ты решаешь, как ответить новой соседке.', secondaryConflict: 'Ты пока ей не доверяешь.', allowedSpeechActs: ['answer', 'set_boundary'] } },
        ]);
        expect(prepared?.frame.event.playerSpeech).toBe('Как тебя зовут?');
        expect(prepared?.frame.dramaticPosition.primaryIntent).toContain('как ответить');
    });
});
