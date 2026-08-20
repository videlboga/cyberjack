import { db } from '../infrastructure/db';

/**
 * Контекст Поста наблюдения (room_control).
 *
 * Персонажи, находящиеся в Посте наблюдения, видят на терминале реальные
 * данные лаборатории: состояние активов, текущие процедуры, последние
 * события, контракты. Это даёт им факты для разговора вместо галлюцинаций.
 */

interface AssetRow {
    id: string;
    name: string;
    sensitivity: number;
    capacity: number;
    openness: number;
    plasticity: number;
    attitude: number;
    tension: number;
}

interface PresenceRow {
    character_id: string;
    room_id: string;
}

/** Текущее состояние активов (из subjects). */
function assetStatusLines(): string[] {
    let rows: AssetRow[] = [];
    try {
        rows = db.prepare(
            `SELECT id, name, sensitivity, capacity, openness, plasticity, attitude, tension
             FROM subjects WHERE id != 'PL-1' ORDER BY name`
        ).all() as AssetRow[];
    } catch { return []; }
    if (!rows.length) return [];
    return rows.map(r => {
        const params = `чувствительность ${Math.round(r.sensitivity)}, ёмкость ${Math.round(r.capacity)}, открытость ${Math.round(r.openness)}, пластичность ${Math.round(r.plasticity)}, отношение ${Math.round(r.attitude)}`;
        const tension = r.tension > 0 ? `, напряжение ${Math.round(r.tension)}` : '';
        return `- ${r.name}: ${params}${tension}.`;
    });
}

/** Кто где находится (из laboratory_room_assignments + laboratory_rooms). */
function presenceLines(): string[] {
    let rows: Array<{ character_id: string; room_id: string; room_name: string }> = [];
    try {
        rows = db.prepare(
            `SELECT a.character_id, a.room_id, r.name AS room_name
             FROM laboratory_room_assignments a
             JOIN laboratory_rooms r ON r.player_id = a.player_id AND r.room_id = a.room_id
             WHERE a.character_id != 'PL-1'`
        ).all() as Array<{ character_id: string; room_id: string; room_name: string }>;
    } catch { return []; }
    if (!rows.length) return [];
    let names: Array<{ id: string; name: string }> = [];
    try { names = db.prepare(`SELECT id, name FROM characters`).all() as Array<{ id: string; name: string }>; } catch { return []; }
    const nameById = new Map(names.map(n => [n.id, n.name]));
    return rows.map(r => `- ${nameById.get(r.character_id) || r.character_id} — в «${r.room_name}».`);
}

/** Последние события в лаборатории (из event_logs). */
function recentEventLines(limit = 5): string[] {
    let rows: Array<{ subject_id: string; action_type: string; action_payload: string }> = [];
    try {
        rows = db.prepare(
            `SELECT subject_id, action_type, action_payload FROM event_logs ORDER BY id DESC LIMIT ?`
        ).all(limit) as Array<{ subject_id: string; action_type: string; action_payload: string }>;
    } catch { return []; }
    if (!rows.length) return [];
    let names: Array<{ id: string; name: string }> = [];
    try { names = db.prepare(`SELECT id, name FROM characters`).all() as Array<{ id: string; name: string }>; } catch { return []; }
    const nameById = new Map(names.map(n => [n.id, n.name]));
    return rows.map(r => {
        let label = r.action_type;
        try {
            const payload = JSON.parse(r.action_payload);
            label = payload?.action?.label || r.action_type;
        } catch { /* ignore */ }
        return `- ${nameById.get(r.subject_id) || r.subject_id}: ${label}.`;
    });
}

/** Контракты активов (из asset_contracts). */
function contractLines(): string[] {
    let rows: Array<{ title: string; status: string }> = [];
    try {
        rows = db.prepare(
            `SELECT title, status FROM asset_contracts WHERE status != 'expired' ORDER BY title`
        ).all() as Array<{ title: string; status: string }>;
    } catch { return []; }
    if (!rows.length) return [];
    return rows.map(r => `- ${r.title} (${r.status}).`);
}

/** Полный контекст Поста наблюдения для промпта. */
export function buildObservationPostContext(characterId: string): string[] {
    const lines: string[] = [];
    const assets = assetStatusLines();
    if (assets.length) {
        lines.push('На терминале — текущее состояние активов:');
        lines.push(...assets);
    }
    const presence = presenceLines();
    if (presence.length) {
        lines.push('Расположение персонала и активов:');
        lines.push(...presence);
    }
    const events = recentEventLines();
    if (events.length) {
        lines.push('Последние события в лаборатории:');
        lines.push(...events);
    }
    const contracts = contractLines();
    if (contracts.length) {
        lines.push('Активные контракты:');
        lines.push(...contracts);
    }
    return lines;
}
