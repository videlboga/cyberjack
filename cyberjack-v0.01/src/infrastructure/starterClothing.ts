import { randomUUID } from 'crypto';
import { db } from './db';

export const STARTER_CLOTHING: Record<string, string[]> = {
    'PL-1': ['eq_clothe_jumpsuit'],
    'S-AV-01': ['eq_clothe_calibration_set'],
    'NPC-LAB-01': ['eq_clothe_underwear'],
    'NPC-CAND-01': ['eq_clothe_underwear'],
    'NPC-CAND-SUMI': ['eq_clothe_underwear'],
    'NPC-CAND-GEN-02': ['eq_clothe_underwear'],
    'NPC-CAND-GEN-04': ['eq_clothe_underwear']
};

function normalizeLegacyUnderwear(characterId: string) {
    const legacyCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM active_contexts WHERE subject_id = ? AND action_id = 'eq_clothe_panties'`).get(characterId) as any)?.count || 0);
    const unifiedCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM active_contexts WHERE subject_id = ? AND action_id = 'eq_clothe_underwear'`).get(characterId) as any)?.count || 0);
    if (!legacyCount && !unifiedCount) return;
    const preset = db.prepare(`SELECT context_config_json FROM action_presets WHERE id = 'eq_clothe_underwear'`).get() as any;
    if (!preset) return;
    let config: { duration?: number; occupiesPoints?: string[] } = {};
    try { config = JSON.parse(preset.context_config_json || '{}'); } catch { config = {}; }
    const points = config.occupiesPoints || [];
    db.transaction(() => {
        db.prepare(`DELETE FROM active_contexts WHERE subject_id = ? AND action_id = 'eq_clothe_panties'`).run(characterId);
        const exists = db.prepare(`SELECT 1 FROM active_contexts WHERE subject_id = ? AND action_id = 'eq_clothe_underwear' AND COALESCE(point_id, '') = ?`);
        const insert = db.prepare(`INSERT INTO active_contexts (id, subject_id, action_id, duration, point_id) VALUES (?, ?, 'eq_clothe_underwear', ?, ?)`);
        for (const pointId of points) {
            if (!exists.get(characterId, pointId)) insert.run(randomUUID(), characterId, config.duration ?? -1, pointId);
        }
    })();
}

/**
 * Applies a character's initial wardrobe exactly once. The seed flag is kept
 * separately from active contexts so removing clothes during play remains a
 * persistent choice and a restart does not silently dress the character again.
 */
export function ensureStarterClothing(characterId: string, actionIds: string[]): boolean {
    db.exec(`
        CREATE TABLE IF NOT EXISTS character_seed_flags (
            character_id TEXT NOT NULL,
            flag TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (character_id, flag),
            FOREIGN KEY(character_id) REFERENCES characters(id)
        )
    `);

    const characterExists = db.prepare(`SELECT 1 FROM characters WHERE id = ?`).get(characterId);
    if (!characterExists) return false;
    normalizeLegacyUnderwear(characterId);

    const flag = 'starter-clothing-v1';
    const alreadyApplied = db.prepare(`
        SELECT 1 FROM character_seed_flags WHERE character_id = ? AND flag = ?
    `).get(characterId, flag);
    if (alreadyApplied) return false;

    db.transaction(() => {
        const getPreset = db.prepare(`SELECT context_config_json FROM action_presets WHERE id = ?`);
        const hasContext = db.prepare(`
            SELECT 1 FROM active_contexts
            WHERE subject_id = ? AND action_id = ? AND COALESCE(point_id, '') = ?
        `);
        const insertContext = db.prepare(`
            INSERT INTO active_contexts (id, subject_id, action_id, duration, point_id)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const actionId of actionIds) {
            const row = getPreset.get(actionId) as { context_config_json?: string | null } | undefined;
            if (!row) continue;

            let config: { duration?: number; occupiesPoints?: string[] } = {};
            try { config = JSON.parse(row.context_config_json || '{}'); } catch { config = {}; }
            const points = config.occupiesPoints?.length ? config.occupiesPoints : [null];

            for (const pointId of points) {
                const normalizedPoint = pointId || '';
                if (!hasContext.get(characterId, actionId, normalizedPoint)) {
                    insertContext.run(randomUUID(), characterId, actionId, config.duration ?? -1, pointId);
                }
            }
        }

        db.prepare(`INSERT INTO character_seed_flags (character_id, flag) VALUES (?, ?)`)
            .run(characterId, flag);
    })();

    return true;
}

export function ensureAllStarterClothing(): string[] {
    return Object.entries(STARTER_CLOTHING)
        .filter(([characterId, actionIds]) => ensureStarterClothing(characterId, actionIds))
        .map(([characterId]) => characterId);
}
