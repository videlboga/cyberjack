import { buildPromptPayloadWithDB } from '../prompts/buildPromptPayloadWrapper';

/**
 * Formal stimulus contract for Этап 5. Every character turn is triggered by
 * one of these stimuli. The stimulus carries the identity and, where known,
 * the idempotency handle of the event that produced the turn.
 */
export type CharacterStimulus =
    | { kind: 'external_speech'; messageId: number; speakerId: string }
    | { kind: 'external_action'; tickId: string }
    | { kind: 'internal_impulse'; impulseId: string }
    | { kind: 'observed_event'; observationId: string };

export interface CharacterTurnContextInput {
    subjectId: string;
    stimulus: CharacterStimulus;
    /** The engine/other-character result driving this turn, if any. */
    latestResult?: unknown;
    eventId?: string;
    initiatorId?: string;
    addresseeId?: string;
    suppressTickIds?: string[];
}

export interface CharacterTurnContext {
    subjectId: string;
    stimulus: CharacterStimulus;
    payload: Awaited<ReturnType<typeof buildPromptPayloadWithDB>>;
}

/**
 * The single context assembler for a character turn. Given a stimulus and the
 * authoritative state snapshot, it builds the prompt payload through the one
 * shared builder (`buildPromptPayloadWithDB`). All turn paths (tick, proactive
 * impulse, social initiative, observed event) should converge here so no path
 * owns a private prompt constructor.
 */
export async function buildCharacterTurnContext(input: CharacterTurnContextInput): Promise<CharacterTurnContext> {
    const payload = await buildPromptPayloadWithDB(
        input.subjectId,
        input.subjectId,
        input.latestResult,
        input.eventId || 'scene_lab_calibrator',
        {
            initiatorId: input.initiatorId,
            addresseeId: input.addresseeId,
            suppressTickIds: input.suppressTickIds,
        },
    );
    return {
        subjectId: input.subjectId,
        stimulus: input.stimulus,
        payload,
    };
}
