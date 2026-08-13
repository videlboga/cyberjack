import type {
  TickBundle,
  TickResult,
  ResourceState,
  DiagnosticsOutput,
  DynamicModifiers,
} from '../../domain/types';

/**
 * Этап 8. Единые DTO для тика.
 *
 * Транспортный контракт между HTTP/WS и application-слоем. Контроллер
 * валидирует ввод в `TickRequest`, вызывает один application service и
 * отображает результат через `TickResponse`.
 */

/** Ввод тика из HTTP-тела. Все поля опциональны — сервис подставляет дефолты. */
export interface TickRequest {
  subjectId?: string;
  playerId?: string;
  textMessage?: string;
  addressedCharacterId?: string;
  interactionContext?: string;
  sceneId?: string;
  presetId?: string;
  pointId?: string;
  deltaTime?: number;
  labelOverride?: string;
  llmMode?: 'speech_chance' | 'scene_chance' | string;
  deferLLM?: boolean;
  skipLLM?: boolean;
  skipImageGen?: boolean;
  [key: string]: unknown;
}

/** Публичная часть отложенного (deferred) LLM-ответа. */
export interface DeferredReplyJob {
  done: boolean;
  metrics?: unknown;
  error?: string | null;
  chunks?: string[];
}

/** Ответ тика, отдаваемый в HTTP/WS. */
export interface TickResponse {
  success: boolean;
  tickResult: TickResult;
  state: unknown;
  telemetry: unknown;
  resources: ResourceState;
  diagnostics: DiagnosticsOutput;
  bundle: TickBundle;
  actionApplied: boolean;
  systemNotes: string[];
  reply: unknown;
  promptMessages: unknown;
  actorReplies: unknown[];
  narratorReaction: unknown;
  llmError: string | null;
  llmChance: number;
  llmSkipped: boolean;
  replyPending: boolean;
  replyJobId: string | null;
  classifierLog: unknown;
  classifierModel: unknown;
  stateDescription: string;
  contractProgress: unknown;
  suggestedChips: unknown[];
  worldClock: unknown;
}

/** Семантические поля, извлечённые из dynamicModifiers для ответа. */
export interface TickClassifierInfo {
  log: unknown;
  model: unknown;
}

export function extractClassifierInfo(modifiers?: DynamicModifiers | null): TickClassifierInfo {
  return {
    log: modifiers?.raw ?? null,
    model: modifiers?.model ?? null,
  };
}
