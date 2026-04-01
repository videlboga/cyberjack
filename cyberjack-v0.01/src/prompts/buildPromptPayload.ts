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
    latestResult?: TickOutput,
    eventId: string = 'lab' // TODO: Pass actual scene instead of hardcoding
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

    // Fetch active contexts
    const activeContextRow = db.prepare(`
        SELECT cp.label 
        FROM active_contexts ac
        JOIN context_presets cp ON ac.context_id = cp.id
        WHERE ac.event_id = ?
    `).all(eventId) as {label: string}[];

    // Fetch point states for body overload calculations
    const pointStatesRow = db.prepare(`
        SELECT p.label, sps.local_sensitivity, sps.local_attitude
        FROM subject_point_states sps
        JOIN point_presets p ON sps.point_id = p.id
        WHERE sps.subject_id = ?
    `).all(subjectId) as any[];
    
    const activeContextNames = activeContextRow.map(r => r.label);
    const contextText = activeContextNames.length > 0 
        ? `\n[Физическое состояние и влияние среды]: ${activeContextNames.join(', ')}`
        : '';

    const mappedPoints = pointStatesRow.map(row => ({
        label: row.label,
        localSensitivity: row.local_sensitivity,
        localAttitude: row.local_attitude
    }));

    const stateSummary = buildStateSummary(core, mappedPoints);
    const eventsText = buildRecentEventsSummary(recentEvents);
    
    const cfg = activeConfig.character;
    const characterProfile = `${cfg.identity}\n${cfg.history}\n[Инструкции]: ${cfg.formatInstructions}`;

    const systemPrompt = `${characterProfile}\n\n${stateSummary}${contextText}\n\n${eventsText}`;
    
    return {
        stateSummary: stateSummary + contextText,
        recentEvents: [eventsText],
        systemPrompt
    };
}