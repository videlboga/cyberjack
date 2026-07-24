import fs from 'fs';
import { db } from './db';
import { ensureAllStarterClothing } from './starterClothing';

type RawActionPreset = {
    id: string;
    name: string;
    categories?: string[];
    tags?: string[];
    vector?: Record<string, unknown>;
    contextConfig?: Record<string, unknown>;
    requireContexts?: string[];
    removeContexts?: string[];
    validTargets?: string[];
    removeNarrative?: string[];
    requiresItem?: string;
    model_url?: string;
    modelUrl?: string;
};

const actionsUrl = new URL('./data/presets/actions.json', import.meta.url);

/**
 * Refresh authored action content without touching subjects, histories or scene state.
 * This deliberately runs on every API start so JSON preset edits do not require a
 * destructive/full database seed.
 */
export function syncActionPresets(): void {
    const actions = JSON.parse(fs.readFileSync(actionsUrl, 'utf8')) as RawActionPreset[];

    db.transaction(() => {
        const upsert = db.prepare(`
            INSERT INTO action_presets
                (id, label, type, tags, values_json, context_config_json, requires_item, model_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                type = excluded.type,
                tags = excluded.tags,
                values_json = excluded.values_json,
                context_config_json = excluded.context_config_json,
                requires_item = excluded.requires_item,
                model_url = excluded.model_url
        `);

        for (const action of actions) {
            upsert.run(
                action.id,
                action.name,
                action.categories?.[0] || 'physical',
                JSON.stringify(action.tags || []),
                JSON.stringify({
                    ...(action.vector || {}),
                    requireContexts: action.requireContexts || null,
                    removeContexts: action.removeContexts || null,
                    validTargets: action.validTargets || null,
                    removeNarrative: action.removeNarrative || null
                }),
                action.contextConfig ? JSON.stringify(action.contextConfig) : null,
                action.requiresItem || null,
                action.model_url || action.modelUrl || null
            );
        }

        const authoredIds = actions.map(action => action.id);
        const sceneRows = db.prepare('SELECT id, available_actions FROM scenes').all() as Array<{
            id: string;
            available_actions: string;
        }>;
        const updateScene = db.prepare('UPDATE scenes SET available_actions = ? WHERE id = ?');

        for (const scene of sceneRows) {
            let available: string[] = [];
            try { available = JSON.parse(scene.available_actions || '[]'); } catch { available = []; }
            const merged = Array.from(new Set([...available, ...authoredIds]));
            if (merged.length !== available.length) {
                updateScene.run(JSON.stringify(merged), scene.id);
            }
        }

        // Additive prototype migration: never replaces existing inventory state.
        db.prepare(`
            INSERT OR IGNORE INTO character_items (character_id, item_id, state, charges, metadata)
            VALUES ('PL-1', 'eq_tens_unit', 'active', -1, '{}')
        `).run();
    })();

    const dressedCharacters = ensureAllStarterClothing();

    console.log(`[Content] Synced ${actions.length} action presets.${dressedCharacters.length ? ` Added starter clothing: ${dressedCharacters.join(', ')}.` : ''}`);
}
