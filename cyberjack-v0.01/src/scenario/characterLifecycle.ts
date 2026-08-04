import { getBaseHumanAnatomy, Gender } from '../domain/anatomy';
import { db } from '../infrastructure/db';

export type RoleHistoryEntry = {
    role: string;
    previousRole?: string;
    worldMinute: number;
    title: string;
    description: string;
    sourceEventId?: number;
};

const readProfile = (characterId: string) => {
    const row = db.prepare(`SELECT profile_json FROM characters WHERE id = ?`).get(characterId) as any;
    try { return JSON.parse(row?.profile_json || '{}') as Record<string, any>; } catch { return {}; }
};

export function appendRoleHistory(characterId: string, entry: RoleHistoryEntry) {
    const profile = readProfile(characterId);
    const history: RoleHistoryEntry[] = Array.isArray(profile.roleHistory) ? profile.roleHistory : [];
    if (entry.sourceEventId && history.some(item => item.sourceEventId === entry.sourceEventId)) return;
    if (!entry.sourceEventId && history.some(item => item.role === entry.role && item.worldMinute === entry.worldMinute && item.title === entry.title)) return;
    profile.currentRole = entry.role;
    profile.roleHistory = [...history, entry].sort((a, b) => a.worldMinute - b.worldMinute);
    profile.base = { ...(profile.base || {}), status: entry.role };
    if (entry.role === 'asset' && entry.previousRole !== 'asset') {
        profile.roleState = {
            assignedRole: 'asset',
            previousRole: entry.previousRole || history.at(-1)?.role || 'candidate',
            awareness: 'partial',
            internalization: 'denial',
            assignedAt: entry.worldMinute,
        };
    } else if (entry.role === 'candidate') {
        profile.roleState = {
            assignedRole: 'candidate',
            previousRole: entry.previousRole,
            awareness: 'unaware',
            internalization: 'candidate',
            assignedAt: entry.worldMinute,
        };
    }
    db.prepare(`UPDATE characters SET profile_json = ? WHERE id = ?`).run(JSON.stringify(profile), characterId);
}

export function ensureCharacterAnatomy(characterId: string) {
    const character = db.prepare(`SELECT id, profile_json FROM characters WHERE id = ?`).get(characterId) as any;
    const core = db.prepare(`SELECT * FROM subjects WHERE id = ?`).get(characterId) as any;
    if (!character || !core) return;
    let profile: Record<string, any> = {};
    try { profile = JSON.parse(character.profile_json || '{}'); } catch { profile = {}; }
    const rawGender = profile.base?.gender || profile.generatedProfile?.identity?.gender || 'androgynous';
    const gender: Gender = rawGender === 'male' || rawGender === 'female' || rawGender === 'androgynous' ? rawGender : 'androgynous';
    const anatomy = getBaseHumanAnatomy(gender, profile.base?.anatomy === 'human' ? 'none' : profile.base?.anatomy || 'none');
    const insertPoint = db.prepare(`INSERT OR IGNORE INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) VALUES (?, ?, ?, ?, ?, ?)`);
    const insertState = db.prepare(`INSERT OR IGNORE INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, local_openness, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`);
    for (const point of anatomy) {
        insertPoint.run(point.id, point.label, JSON.stringify({ sens: point.sens, att: point.att }), point.parentId || null, JSON.stringify(point.providesFunctions || []), JSON.stringify(point.tags || []));
        insertState.run(characterId, point.id, point.sens, point.att, core.openness, point.sens, point.att, core.baseline_openness ?? core.openness);
    }
}

export function ensureCharacterLifecycle(characterId: string, fallbackRole?: string) {
    ensureCharacterAnatomy(characterId);
    const events = db.prepare(`SELECT * FROM scenario_events WHERE json_extract(metadata, '$.subjectId') = ? AND type IN ('recruitment', 'role_change') ORDER BY world_minute, id`).all(characterId) as any[];
    const existingProfile = readProfile(characterId);
    const existingHistory: RoleHistoryEntry[] = Array.isArray(existingProfile.roleHistory) ? existingProfile.roleHistory : [];
    const recruitment = events.find(event => event.type === 'recruitment');
    if (recruitment && !existingHistory.some(entry => entry.role === 'candidate')) {
        appendRoleHistory(characterId, { role: 'candidate', worldMinute: Math.max(0, Number(recruitment.world_minute) - 1), title: 'Кандидат', description: 'Предложена лаборатории для найма или оформления в иной роли.' });
    }
    for (const event of events) {
        let metadata: Record<string, any> = {};
        try { metadata = JSON.parse(event.metadata || '{}'); } catch { metadata = {}; }
        appendRoleHistory(characterId, {
            role: String(metadata.role || fallbackRole || 'person'), previousRole: metadata.from ? String(metadata.from) : undefined,
            worldMinute: Number(event.world_minute), title: event.title, description: event.description || '', sourceEventId: Number(event.id)
        });
    }
    const profile = readProfile(characterId);
    if (!Array.isArray(profile.roleHistory) || !profile.roleHistory.length) {
        const minute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
        appendRoleHistory(characterId, { role: fallbackRole || profile.base?.status || 'person', worldMinute: minute, title: 'Исходный статус', description: 'Статус на момент появления в истории.' });
    }
    const finalProfile = readProfile(characterId);
    const finalHistory: RoleHistoryEntry[] = Array.isArray(finalProfile.roleHistory) ? finalProfile.roleHistory : [];
    const latest = [...finalHistory].sort((a, b) => a.worldMinute - b.worldMinute).at(-1);
    if (latest) {
        finalProfile.currentRole = latest.role;
        finalProfile.base = { ...(finalProfile.base || {}), status: latest.role };
        db.prepare(`UPDATE characters SET profile_json = ? WHERE id = ?`).run(JSON.stringify(finalProfile), characterId);
    }
}

export function roleHistoryPrompt(characterId: string): string {
    const profile = readProfile(characterId);
    const history: RoleHistoryEntry[] = Array.isArray(profile.roleHistory) ? profile.roleHistory : [];
    if (!history.length) return '';
    const current = profile.currentRole || history[history.length - 1].role;
    const lines = history.slice(-5).map(entry => `День ${Math.floor(entry.worldMinute / 1440) + 1}: ${entry.title}. ${entry.description}`.trim());
    return `[Текущий статус]\n${current}\n\n[Изменения статуса — часть твоей биографии]\n${lines.join('\n')}`;
}

export function migrateCharacterLifecycles() {
    const rows = db.prepare(`
        SELECT c.id, COALESCE(sc.role, json_extract(c.profile_json, '$.base.status'), 'person') AS role
        FROM characters c JOIN subjects s ON s.id = COALESCE(c.subject_id, c.id)
        LEFT JOIN scene_characters sc ON sc.character_id = c.id AND sc.scene_id = c.current_scene_id
        WHERE c.kind != 'player'
    `).all() as any[];
    for (const row of rows) ensureCharacterLifecycle(row.id, row.role);
}
