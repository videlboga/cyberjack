import { readFileSync, writeFileSync } from 'fs';

let content = `import { buildPromptPayload } from './buildPromptPayload';
import { db } from '../infrastructure/db';
import { activeConfig } from './config';

export async function buildPromptPayloadWithDB(
    ownerId: string,
    targetId: string,
    latestResult?: any,
    eventId: string = 'lab',
    options?: { suppressTickIds?: string[]; initiatorId?: string }
) {
    const targetQueryId = targetId || ownerId;
    const ownerRow = db.prepare('SELECT * FROM subjects WHERE id = ?').get(ownerId) as any;
    if (!ownerRow) throw new Error(\`Subject \${ownerId} not found\`);

    const targetRow = db.prepare('SELECT * FROM subjects WHERE id = ?').get(targetQueryId) as any;
    
    const core = targetRow ? {
        sensitivity: targetRow.sensitivity,
        capacity: targetRow.capacity,
        openness: targetRow.openness,
        plasticity: targetRow.plasticity,
        attitude: targetRow.attitude
    } : { sensitivity: 50, capacity:50, openness:50, plasticity:50, attitude:50 };

    const recentLogLimit = activeConfig.perception?.recentEventLimit ?? 10;
    const logs = db.prepare(
        'SELECT * FROM event_logs WHERE subject_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(targetQueryId, recentLogLimit) as any[];

    const recentEvents = logs.map(log => ({
        id: Number(log.id),
        timestamp: log.timestamp,
        action_type: log.action_type,
        action_payload: log.action_payload,
        result_payload: log.result_payload
    })).reverse();

    const activeContextRow = db.prepare(\`
        SELECT cp.label
        FROM active_contexts ac
        JOIN action_presets cp ON ac.action_id = cp.id
        WHERE ac.subject_id = ?
    \`).all(targetQueryId) as {label: string}[];
    const activeContextNames = activeContextRow.map(r => r.label);

    const pointStatesRow = db.prepare(\`
        SELECT p.label, sps.local_sensitivity, sps.local_attitude
        FROM subject_point_states sps
        JOIN point_presets p ON sps.point_id = p.id
        WHERE sps.subject_id = ?
    \`).all(targetQueryId) as any[];

    return buildPromptPayload(
        ownerId,
        targetId,
        { name: targetRow?.name || targetQueryId, core },
        recentEvents,
        pointStatesRow,
        activeContextNames,
        latestResult,
        eventId,
        options
    );
}
`;
writeFileSync('src/prompts/buildPromptPayloadWrapper.ts', content);
