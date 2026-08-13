import { chatMemoryRepo } from '../infrastructure/repositories';

export interface CharacterSpeechDelivery {
    speakerId: string;
    speech: string;
    contextLabel?: string;
    portraitEmotion?: string;
    messageId?: string;
    transcriptOwnerIds?: string[];
}

/** Writes one authored line to every participant transcript without changing its author. */
export function deliverCharacterSpeech(delivery: CharacterSpeechDelivery) {
    const speech = delivery.speech.trim();
    if (!speech) return { originChatId: null, deliveredChatIds: [] as number[] };
    const owners = Array.from(new Set(
        (delivery.transcriptOwnerIds?.length ? delivery.transcriptOwnerIds : [delivery.speakerId])
            .filter(Boolean),
    ));
    const originOwner = owners.includes(delivery.speakerId) ? delivery.speakerId : owners[0];
    if (!originOwner) return { originChatId: null, deliveredChatIds: [] as number[] };

    const originChatId = chatMemoryRepo.append(
        originOwner,
        'assistant',
        speech,
        delivery.contextLabel,
        delivery.portraitEmotion,
        delivery.speakerId,
        delivery.messageId,
    );
    const deliveredChatIds = originChatId ? [originChatId] : [];
    for (const ownerId of owners) {
        if (ownerId === originOwner || !originChatId) continue;
        const chatId = chatMemoryRepo.append(
            ownerId,
            'assistant',
            speech,
            delivery.contextLabel,
            delivery.portraitEmotion,
            delivery.speakerId,
            delivery.messageId,
            originChatId,
        );
        if (chatId) deliveredChatIds.push(chatId);
    }
    return { originChatId, deliveredChatIds };
}
