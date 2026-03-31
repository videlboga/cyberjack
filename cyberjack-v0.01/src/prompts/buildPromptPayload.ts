import { SubjectCoreState, PromptPayload } from '../domain/types';
import { buildStateSummary } from './buildStateSummary';
import { buildRecentEventsSummary, EventRecord } from './buildRecentEventsSummary';

/**
 * Формирует общий объект данных для отправки в SillyTavern или другой LLM адаптер.
 */
export function buildPromptPayload(
    core: SubjectCoreState,
    recentEvents: EventRecord[]
): PromptPayload {
    return {
        stateSummary: buildStateSummary(core),
        recentEvents: [buildRecentEventsSummary(recentEvents)]
    };
}
