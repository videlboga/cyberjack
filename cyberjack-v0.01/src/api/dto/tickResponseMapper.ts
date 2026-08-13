import type { TickBundle, DynamicModifiers } from '../../domain/types';
import type { TickResponse } from './tickDto';

/**
 * Этап 8. Маппер ответа тика.
 *
 * Отделяет построение HTTP/WS-ответа от бизнес-логики контроллера.
 * Контроллер собирает данные, маппер формирует транспортную форму.
 */

export interface TickResponseInput {
  bundle: TickBundle;
  state: unknown;
  telemetry: unknown;
  resources: unknown;
  dynamicModifiers?: DynamicModifiers | null;
  turnExecutionMetrics?: {
    reply?: unknown;
    promptMessages?: unknown;
    actorReplies?: unknown[];
    narratorReaction?: unknown;
    error?: string | null;
  } | null;
  llmError: string | null;
  llmChance: number;
  llmSkipped: boolean;
  replyPending: boolean;
  replyJobId: string | null;
  stateDescription: string;
  contractProgress: unknown;
  suggestedChips: unknown[];
  worldClock: unknown;
}

export function mapTickResponse(input: TickResponseInput): TickResponse {
  const { bundle, dynamicModifiers, turnExecutionMetrics } = input;
  return {
    success: true,
    tickResult: bundle.output.result,
    state: input.state,
    telemetry: input.telemetry,
    resources: input.resources as never,
    diagnostics: bundle.diagnostics,
    bundle,
    actionApplied: bundle.actionApplied || false,
    systemNotes: bundle.systemNotes || [],
    reply: turnExecutionMetrics?.reply ?? null,
    promptMessages: turnExecutionMetrics?.promptMessages ?? null,
    actorReplies: turnExecutionMetrics?.actorReplies ?? [],
    narratorReaction: turnExecutionMetrics?.narratorReaction ?? null,
    llmError: input.llmError,
    llmChance: input.llmChance,
    llmSkipped: input.llmSkipped,
    replyPending: input.replyPending,
    replyJobId: input.replyJobId,
    classifierLog: dynamicModifiers?.raw ?? null,
    classifierModel: dynamicModifiers?.model ?? null,
    stateDescription: input.stateDescription,
    contractProgress: input.contractProgress,
    suggestedChips: input.suggestedChips,
    worldClock: input.worldClock,
  };
}
