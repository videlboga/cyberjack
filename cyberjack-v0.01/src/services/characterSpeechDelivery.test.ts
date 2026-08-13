import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ append: vi.fn() }));
vi.mock('../infrastructure/repositories', () => ({ chatMemoryRepo: { append: mocks.append } }));
import { deliverCharacterSpeech } from './characterSpeechDelivery';

describe('character speech delivery', () => {
    beforeEach(() => mocks.append.mockReset());

    it('writes an ordinary character reply once with explicit authorship', () => {
        mocks.append.mockReturnValueOnce(11);
        expect(deliverCharacterSpeech({ speakerId: 'S-1', speech: '  Привет.  ', contextLabel: 'Комната' }))
            .toEqual({ originChatId: 11, deliveredChatIds: [11] });
        expect(mocks.append).toHaveBeenCalledWith('S-1', 'assistant', 'Привет.', 'Комната', undefined, 'S-1', undefined);
    });

    it('mirrors one social line while preserving speaker and origin id', () => {
        mocks.append.mockReturnValueOnce(21).mockReturnValueOnce(22);
        deliverCharacterSpeech({
            speakerId: 'S-1',
            speech: 'Как тебя зовут?',
            messageId: 'turn-1',
            transcriptOwnerIds: ['S-1', 'S-2', 'S-2'],
        });
        expect(mocks.append).toHaveBeenNthCalledWith(1, 'S-1', 'assistant', 'Как тебя зовут?', undefined, undefined, 'S-1', 'turn-1');
        expect(mocks.append).toHaveBeenNthCalledWith(2, 'S-2', 'assistant', 'Как тебя зовут?', undefined, undefined, 'S-1', 'turn-1', 21);
    });
});
