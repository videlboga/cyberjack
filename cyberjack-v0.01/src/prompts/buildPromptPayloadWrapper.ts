import { buildPromptPayload } from './buildPromptPayload';
import { db } from '../infrastructure/db';
import { activeConfig } from './config';

export async function buildPromptPayloadWithDB(
    ownerId: string,
    targetId: string,
    latestResult?: any,
    eventId: string = 'lab',
    options?: { suppressTickIds?: string[]; initiatorId?: string }
) {
    const ownerQueryId = ownerId === 'C-Gamma' ? 'PL-1' : ownerId;
    const targetQueryId = targetId || ownerQueryId;
    const ownerRow = db.prepare('SELECT * FROM subjects WHERE id = ?').get(ownerQueryId) as any;
    // For calibrators/players they don't have a rigid subject state in db sometimes
    // so we handle missing ownerRow gracefully if we can.
    if (!ownerRow && ownerQueryId !== 'PL-1' && ownerQueryId !== 'C-Gamma') {
        throw new Error(`Subject ${ownerQueryId} not found`);
    }

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

    const activeContextRow = db.prepare(`
        SELECT cp.label
        FROM active_contexts ac
        JOIN action_presets cp ON ac.action_id = cp.id
        WHERE ac.subject_id = ?
    `).all(targetQueryId) as {label: string}[];
    const activeContextNames = activeContextRow.map(r => r.label);

    const pointStatesRow = db.prepare(`
        SELECT sps.point_id as label, sps.local_sensitivity, sps.local_attitude
        FROM subject_point_states sps
        -- JOIN point_presets p ON sps.point_id = p.id
        WHERE sps.subject_id = ?
    `).all(targetQueryId) as any[];

    // Inject market catalog if the subject is a broker
    const brokerResRow = db.prepare('SELECT metadata FROM character_resources WHERE character_id = ? AND resource_key = ?').get(targetQueryId, 'store_catalog') as any;
    let extraLog = '';
    if (brokerResRow && brokerResRow.metadata) {
        try {
            const meta = JSON.parse(brokerResRow.metadata);
            if (meta && meta.assets && meta.assets.length > 0) {
                const discountFactor = 1 - ((core.attitude / 100) * (core.plasticity / 100));
                const catalogItems = meta.assets.map((a: any) => {
                    const price = Math.max(0, Math.floor(a.basePrice * discountFactor));
                    return `"${a.name}" (ID: ${a.id}) за ${price}cr`;
                });
                const discountPercent = Math.round((1 - discountFactor) * 100);
                
                extraLog = `[SYSTEM: Текущий ассортимент твоих товаров: ${catalogItems.join(', ')}. Твоя симпатия к клиенту и готовность торговаться УЖЕ заложены в эти цены (ты делаешь скидку в ${discountPercent}% от базовой стоимости). Назови клиенту цены и, если сочтешь нужным, между делом упомяни, почему даешь такую скидку, или наоборот — почему не делаешь поблажек.]`;
            }
        } catch(e) {}
    }

    const payload = await buildPromptPayload(
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

    if (extraLog) {
        payload.systemPrompt += `\n\n${extraLog}`;
    }

    return payload;
}
