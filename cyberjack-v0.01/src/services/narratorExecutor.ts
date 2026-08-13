import { generateNarratorReply, generateSceneForCharacter } from '../adapters/llmAdapter';
import type { NarratorPromptPayload, ScenePromptPayload } from '../domain/types';

/**
 * Этап 5. Единый executor для нарратора.
 *
 * Обе обёртки (Narrator A — сцена для персонажа, Narrator B — хроника для
 * чата) раньше вызывались напрямую из sceneOrchestrator. Здесь они сведены к
 * одному контракту: `executeNarratorReply({ kind, prompt })` возвращает
 * `{ reaction, sentMessages }`. Оркестратор выбирает kind, но не владеет
 * отдельными LLM-путями.
 */

export type NarratorKind = 'scene' | 'chronicle';

export interface NarratorReplyRequest {
  kind: NarratorKind;
  prompt: NarratorPromptPayload | ScenePromptPayload;
}

export interface NarratorReplyResult {
  reaction: string;
  sentMessages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
}

/** The single boundary between game orchestration and narrator LLMs. */
export async function executeNarratorReply(request: NarratorReplyRequest): Promise<NarratorReplyResult> {
  if (request.kind === 'scene') {
    return generateSceneForCharacter(request.prompt as ScenePromptPayload);
  }
  return generateNarratorReply(request.prompt as NarratorPromptPayload);
}
