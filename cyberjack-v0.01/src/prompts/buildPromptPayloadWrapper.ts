import { buildPromptPayload } from './buildPromptPayload';
import { db } from '../infrastructure/db';
import { activeConfig } from './config';
import { getActiveContextPromptText } from '../domain/contextPresentation';
import { formatWorldTimeContext } from '../narrative/temporalDialogue';

export async function buildPromptPayloadWithDB(
    ownerId: string,
    targetId: string,
    latestResult?: any,
    eventId: string = 'scene_lab_calibrator',
    options?: { suppressTickIds?: string[]; initiatorId?: string; addresseeId?: string }
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
        tension: perspectiveRow.tension,
        preferences: perspectiveRow.preferences
    } : { sensitivity: 50, capacity:50, openness:50, plasticity:50, attitude:50, tension: 0 };

    const recentLogLimit = activeConfig.perception?.recentEventLimit ?? 10;
    const logs = db.prepare(
        'SELECT * FROM event_logs WHERE subject_id = ? ORDER BY id DESC LIMIT ?'
    ).all(ownerQueryId, recentLogLimit) as any[];

    const recentEvents = logs.map(log => ({
        id: Number(log.id),
        timestamp: log.timestamp,
        action_type: log.action_type,
        action_payload: log.action_payload,
        result_payload: log.result_payload
    })).reverse();

    const activeContextRow = db.prepare(`
        SELECT cp.label, cp.id, cp.tags, cp.context_config_json, ac.point_id
        FROM active_contexts ac
        JOIN action_presets cp ON ac.action_id = cp.id
        WHERE ac.subject_id = ?
    `).all(ownerQueryId) as {label: string; id: string; tags?: string; context_config_json?: string; point_id?: string}[];
    const activeCueTags = activeContextRow.flatMap(row => {
        try { return JSON.parse(row.tags || '[]'); } catch { return []; }
    }).filter((tag: unknown): tag is string => typeof tag === 'string');
    const runningDeviceRows = db.prepare(`
        SELECT asset_id FROM laboratory_assets
        WHERE json_extract(metadata, '$.deviceSession.subjectId') = ?
          AND json_extract(metadata, '$.deviceSession.status') = 'running'
    `).all(ownerQueryId) as Array<{asset_id:string}>;
    for (const device of runningDeviceRows) {
        if (device.asset_id === 'lab_sex_machine') activeCueTags.push('machine', 'sexual', 'penetration');
    }
    const visibleContexts = activeContextRow.flatMap(r => {
        let role = 'other';
        let config:Record<string,any> = {};
        try { config = JSON.parse(r.context_config_json || '{}'); role = config.type || role; } catch { }
        return [{ role, id:r.id, label:getActiveContextPromptText({ label:r.label,contextConfig:config },r.id), pointId:r.point_id }];
    });
    const groupedContexts = new Map<string, { role:string; id:string; label:string; points:Set<string> }>();
    for (const context of visibleContexts) {
        const key = `${context.role}:${context.id}`;
        const grouped = groupedContexts.get(key) || { role:context.role, id:context.id, label:context.label, points:new Set<string>() };
        if (context.pointId && context.pointId !== 'systemic') grouped.points.add(context.pointId);
        groupedContexts.set(key, grouped);
    }
    const activeContextNames = [...groupedContexts.values()].map(context => {
        const points = [...context.points];
        // Clothing/equipment frequently has one DB row per covered anatomy
        // point. That is one worn object, not six separate facts worth drawing
        // the character's attention to.
        const scope = points.length === 1 && !['clothing', 'equipment'].includes(context.role)
            ? ` [зона: ${points[0]}]`
            : '';
        const label = `${context.label}${scope}`;
        if (context.role === 'pose') return `pose: ${label}`;
        if (context.role === 'clothing') return `На тебе сейчас: ${label}.`;
        if (['equipment', 'restraint'].includes(context.role)) return `Ты чувствуешь на своём теле: ${label}.`;
        if (context.role === 'environment') return `Ты замечаешь вокруг себя: ${label}.`;
        return `Ты замечаешь в собственном состоянии: ${label}.`;
    });
    const addresseeContextRows = ownerQueryId === targetQueryId ? [] : (db.prepare(`
        SELECT cp.label, cp.id, cp.context_config_json, ac.point_id
        FROM active_contexts ac JOIN action_presets cp ON ac.action_id = cp.id
        WHERE ac.subject_id = ?
    `).all(targetQueryId) as {label: string; id: string; context_config_json?: string; point_id?: string}[])
        .map(row => {
            let config: Record<string, any> = {};
            try { config = JSON.parse(row.context_config_json || '{}'); } catch { }
            const role = config.type || 'other';
            const detail = getActiveContextPromptText({ label:row.label, contextConfig:config }, row.id);
            return { role, detail };
        });
    const addresseeName = targetRow?.name || targetQueryId;
    const addresseeContextFacts = addresseeContextRows
        .filter(row => ['pose', 'clothing', 'equipment', 'restraint', 'environment', 'social', 'other'].includes(row.role))
        .sort((left, right) => Number(right.role === 'pose') - Number(left.role === 'pose'))
        .map(row => row.role === 'pose' ? `${addresseeName} сейчас находится в таком положении: ${row.detail}.` : `На ${addresseeName} сейчас заметно: ${row.detail}.`)
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 6);
    const worldMinute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
    const firstKnownMinuteValue = (db.prepare(`
        SELECT MIN(world_minute) AS minute
        FROM chat_memory
        WHERE subject_id = ? AND world_minute IS NOT NULL
    `).get(ownerQueryId) as any)?.minute;
    const firstKnownMinute = firstKnownMinuteValue == null ? null : Number(firstKnownMinuteValue);
    activeContextNames.unshift(formatWorldTimeContext(
        worldMinute,
        firstKnownMinute != null && Number.isFinite(firstKnownMinute) ? firstKnownMinute : null,
    ));

    const pointStatesRow = db.prepare(`
        SELECT sps.point_id, sps.point_id as label, sps.local_sensitivity, sps.local_attitude,
               sps.baseline_local_sensitivity
        FROM subject_point_states sps
        WHERE sps.subject_id = ?
    `).all(ownerQueryId) as any[];

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
        { ...options, worldPlayerId: options?.worldPlayerId || 'PL-1', addresseeContextFacts, compulsionCueTags:activeCueTags }
    );

    if (extraLog) {
        payload.systemPrompt += `\n\n${extraLog}`;
    }

    return payload;
}
