/**
 * @deprecated The SillyTavern adapter is legacy and kept only for backwards compatibility.
 * Current architecture routes LLM requests through `llmAdapter`. Do not add new code here.
 */
import { ChatMessage } from './llmAdapter';

export const SILLY_TAVERN_DEPRECATED = true;

export async function sendToSillyTavern(messages: ChatMessage[]) {
  // Minimal local implementation for tests and fallback runtime.
  // In production this would proxy to a local SillyTavern backend.
  return {
    reply: { speech: 'sillytavern-mock-speech' },
    sentMessages: messages
  };
}

export async function sendNarratorDescription(messages: ChatMessage[]) {
  return {
    reaction: 'sillytavern-mock-narration',
    sentMessages: messages
  };
}
