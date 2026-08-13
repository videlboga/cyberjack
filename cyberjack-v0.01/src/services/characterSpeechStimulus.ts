import type { PromptPayload } from '../domain/types';
import {
    applyInternalImpulseToFrame,
    applyVerbalInputToFrame,
    buildReactionSystemPrompt,
    buildReactionTurnMessage,
    type InternalImpulse,
    type ReactionFrame,
} from '../narrative/reactionFrame';

type EventPatch = Partial<ReactionFrame['event']>;

export type CharacterSpeechStimulus =
    | { kind: 'external_speech'; speech: string }
    | { kind: 'internal_impulse'; impulse: InternalImpulse; event?: EventPatch };

/** Applies factual stimuli to one ReactionFrame, regardless of who scheduled the turn. */
export function prepareCharacterSpeechStimuli(payload: PromptPayload, stimuli: CharacterSpeechStimulus[]) {
    if (!payload.reactionFrame) return null;
    let frame = payload.reactionFrame;
    for (const stimulus of stimuli) {
        if (stimulus.kind === 'external_speech') {
            frame = applyVerbalInputToFrame(frame, stimulus.speech);
            continue;
        }
        if (stimulus.event) {
            frame = {
                ...frame,
                event: { ...frame.event, ...stimulus.event },
            };
        }
        frame = applyInternalImpulseToFrame(frame, stimulus.impulse);
    }
    return {
        payload: {
            ...payload,
            reactionFrame: frame,
            systemPrompt: buildReactionSystemPrompt(frame),
        },
        frame,
        userInput: buildReactionTurnMessage(frame),
    };
}
