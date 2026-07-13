import { buildPromptPayload } from './buildPromptPayload';
import { db } from '../infrastructure/db';
import { activeConfig } from './config';

export async function buildPromptPayloadWithDB(
    ownerId: string,
    targetId: string,
    latestResult?: any,
    eventId: string = 'scene_lab_calibrator',
    options?: { suppressTickIds?: string[]; initiatorId?: string }
) {
    const ownerQueryId = ownerId;
    const targetQueryId = targetId || ownerQueryId;
    const ownerRow = db.prepare('SELECT * FROM subjects WHERE id = ?').get(ownerQueryId) as any;
    
    // For calibrators/players they don't have a rigid subject state in db sometimes
    // so we handle missing ownerRow gracefully if we can.
    if (!ownerRow && ownerQueryId !== 'PL-1') {
        // Log a warning instead of throwing to prevent systemic crashes
        console.warn(`Subject ${ownerQueryId} not found. Using neutral fallbacks.`);
    }

    const targetRow = db.prepare('SELECT * FROM subjects WHERE id = ?').get(targetQueryId) as any;
    
    const perspectiveRow = ownerRow || targetRow;
    const core = perspectiveRow ? {
        sensitivity: perspectiveRow.sensitivity,
        capacity: perspectiveRow.capacity,
        openness: perspectiveRow.openness,
        plasticity: perspectiveRow.plasticity,
        attitude: perspectiveRow.attitude,
        tension: perspectiveRow.tension
    } : { sensitivity: 50, capacity:50, openness:50, plasticity:50, attitude:50, tension: 0 };

    const recentLogLimit = activeConfig.perception?.recentEventLimit ?? 10;
    const logs = db.prepare(
        'SELECT * FROM event_logs WHERE subject_id = ? ORDER BY id DESC LIMIT ?'
    ).all(targetQueryId, recentLogLimit) as any[];

    const recentEvents = logs.map(log => ({
        id: Number(log.id),
        timestamp: log.timestamp,
        action_type: log.action_type,
        action_payload: log.action_payload,
        result_payload: log.result_payload
    })).reverse();

    const activeContextRow = db.prepare(`
        SELECT cp.label, cp.id, cp.context_config_json
        FROM active_contexts ac
        JOIN action_presets cp ON ac.action_id = cp.id
        WHERE ac.subject_id = ?
    `).all(targetQueryId) as {label: string; id: string; context_config_json?: string}[];
    const activeContextNames = activeContextRow.flatMap(r => {
        let role = 'other';
        try { role = JSON.parse(r.context_config_json || '{}')?.type || role; } catch { }
        const externallyVisible = ['pose', 'clothing', 'equipment', 'restraint', 'environment', 'social', 'other'];
        if (ownerQueryId !== targetQueryId && !externallyVisible.includes(role)) return [];
        return [`${role}: ${r.label}`];
    });

    const pointStatesRow = db.prepare(`
        SELECT sps.point_id as label, sps.local_sensitivity, sps.local_attitude
        FROM subject_point_states sps
        WHERE sps.subject_id = ?
    `).all(targetQueryId) as any[];

    // Removed the broker log generation from here logic, 
    // it belongs in specific character templates or scenario controllers,
    // not in the generic orchestration layer.
    let extraLog = '';

    const payload = await buildPromptPayload(
        ownerId,
        targetId,
        { name: ownerRow?.name || ownerQueryId, core: core as any },
        recentEvents,
        pointStatesRow,
        activeContextNames,
        latestResult,
        eventId,
        options
    );

    if (extraLog) {
        payload.systemPrompt += `\n\n${extraLog}`;
    }

    return payload;
}
