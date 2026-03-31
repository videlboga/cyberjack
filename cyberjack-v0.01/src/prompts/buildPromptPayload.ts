import { SubjectCoreState, PromptPayload, TickOutput } from '../domain/types';
import { buildStateSummary } from './buildStateSummary';
import { buildRecentEventsSummary, EventRecord } from './buildRecentEventsSummary';
import { db } from '../infrastructure/db';
import { activeConfig } from './config';

/**
 * Builds the payload for LLM/SillyTavern, grabbing history right from the DB.
 */
export async function buildPromptPayload(
    subjectId: string,
    latestResult?: TickOutput
): Promise<PromptPayload & { systemPrompt: string }> {
    const subjectRow = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId) as any;
    if (!subjectRow) throw new Error("Subject not found for prompt building");

    const core: SubjectCoreState = {
        sensitivity: subjectRow.sensitivity,
        capacity: subjectRow.capacity,
        openness: subjectRow.openness,
        plasticity: subjectRow.plasticity,
        attitude: subjectRow.attitude
    };

    const logs = db.prepare('SELECT * FROM event_logs WHERE subject_id = ? ORDER BY timestamp DESC LIMIT 3').all(subjectId) as any[];
    
    // Map to EventRecord
    const recentEvents: EventRecord[] = logs.map(log => {
        return {
            id: Number(log.id),
            timestamp: log.timestamp,
            action_type: log.action_type,
            action_payload: log.action_payload, // needs to remain string for buildRecentEventsSummary
            result_payload: log.result_payload  // needs to remain string
        } as EventRecord;
    }).reverse(); // Chronological order

    const stateSummary = buildStateSummary(core);
    const eventsText = buildRecentEventsSummary(recentEvents);
    
    const cfg = activeConfig.character;
    const characterProfile = `${cfg.identity}\n${cfg.history}\n[Инструкции]: ${cfg.formatInstructions}`;

    const systemPrompt = `${characterProfile}\n\n${stateSummary}\n\n${eventsText}`;

    return {
        stateSummary,
        recentEvents: [eventsText],
        systemPrompt
    };
}
