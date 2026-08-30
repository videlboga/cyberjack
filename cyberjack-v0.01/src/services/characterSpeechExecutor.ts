import { generateCharacterReply, type ChatMessage } from '../adapters/llmAdapter';
import type { PromptPayload } from '../domain/types';
import { shouldUseFixedReply, selectFixedReply } from '../narrative/fixedReplies';

export type CharacterSpeechSource = 'player_turn' | 'internal_impulse' | 'social_initiative';

export type CharacterSpeechResult =
    | { success: true; speech: string; speechAct?: string; addressedTo?: string; sentMessages: ChatMessage[]; fixed?: boolean }
    | { success: false; error: string; sentMessages: ChatMessage[] };

export interface CharacterSpeechRequest {
    source: CharacterSpeechSource;
    payload: PromptPayload;
    userInput?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    onToken?: (chunk: string) => void;
}

/** The single boundary between game orchestration and character-speech LLMs. */
export async function executeCharacterSpeech(request: CharacterSpeechRequest): Promise<CharacterSpeechResult> {
    // Детерминированный гейт: типовые физиологические состояния озвучиваются
    // заготовками из матрицы, а не LLM. Это снимает однообразие на самых
    // формульных ходах (оргазм, срыв, перегрузка, истощение) и экономит вызов.
    const frame = request.payload.reactionFrame;
    if (frame && shouldUseFixedReply(frame)) {
        const fixed = selectFixedReply(frame);
        if (fixed) {
            return {
                success: true,
                speech: fixed,
                speechAct: frame.dramaticPosition.preferredSpeechAct,
                addressedTo: frame.addressee?.id || '',
                sentMessages: [],
                fixed: true,
            };
        }
    }

    const generated = await generateCharacterReply(request.payload, request.userInput, request.history, request.onToken);
    const structured = generated.reply && typeof generated.reply === 'object'
        ? generated.reply
        : { speech: String(generated.reply || '') };
    const speech = String(structured.speech || '').trim();

    if (generated.error || !speech) {
        return {
            success: false,
            error: generated.error || `Модель вернула пустую реплику (${request.source})`,
            sentMessages: generated.sentMessages,
        };
    }
    return {
        success: true,
        speech,
        speechAct: structured.speechAct,
        addressedTo: structured.addressedTo,
        sentMessages: generated.sentMessages,
    };
}
