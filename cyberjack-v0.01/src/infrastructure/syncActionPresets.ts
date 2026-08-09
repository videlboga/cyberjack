import fs from 'fs';
import { db } from './db';
import { ensureAllStarterClothing } from './starterClothing';
import { AUTHORED_SENSORY_PROFILES, completeActionSensoryProfile, SensoryProfile } from './actionSensoryProfile';

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
    description?: string;
    sensory?: SensoryProfile;
};

const actionsUrl = new URL('./data/presets/actions.json', import.meta.url);
const itemsUrl = new URL('./data/presets/items.json', import.meta.url);
const retiredActionIds = new Set(['belt_strike']);

// These legacy actions are still authored by the original seed rather than
// actions.json. Reapply balance changes on startup so existing campaigns get
// the same vectors as newly-created databases without resetting any state.
export const LEGACY_ACTION_BALANCE_PATCH = {
    feather_stroke: { intensity: 0.16, valence: 0.5, contact: 0.18, sharpness: 0.02, novelty: 0.7 },
    deep_massage: { intensity: 0.48, valence: 0.5, contact: 0.82, sharpness: 0.2, novelty: 0.25 },
    hard_slap: { intensity: 0.72, valence: -0.6, contact: 0.65, sharpness: 0.85, novelty: 0.5 },
    breath_blow: { intensity: 0.16, valence: 0.4, contact: 0.12, sharpness: 0.08, novelty: 0.5 },
} as const;

/**
 * Refresh authored action content without touching subjects, histories or scene state.
 * This deliberately runs on every API start so JSON preset edits do not require a
 * destructive/full database seed.
 */
export function syncActionPresets(): void {
    const actions = JSON.parse(fs.readFileSync(actionsUrl, 'utf8')) as RawActionPreset[];
    const items = JSON.parse(fs.readFileSync(itemsUrl, 'utf8')) as Array<{
        id:string; name:string; type:string; tags?:string[]; description?:string;
    }>;

    db.transaction(() => {
        for (const id of retiredActionIds) db.prepare('DELETE FROM action_presets WHERE id = ?').run(id);
        const upsertItem = db.prepare(`
            INSERT INTO items (id,name,type,tags,description) VALUES (?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,
                tags=excluded.tags,description=excluded.description
        `);
        for (const item of items) {
            upsertItem.run(item.id,item.name,item.type,JSON.stringify(item.tags || []),item.description || '');
        }
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
            const perception = completeActionSensoryProfile(action);
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
                    removeNarrative: action.removeNarrative || null,
                    description: perception.description,
                    sensory: perception.sensory
                }),
                action.contextConfig ? JSON.stringify(action.contextConfig) : null,
                action.requiresItem || null,
                action.model_url || action.modelUrl || null
            );
        }

        const updateLegacyVector = db.prepare('UPDATE action_presets SET values_json = json_patch(values_json, ?) WHERE id = ?');
        for (const [id, vector] of Object.entries(LEGACY_ACTION_BALANCE_PATCH)) {
            updateLegacyVector.run(JSON.stringify(vector), id);
        }
        db.prepare("UPDATE action_presets SET label = 'Массаж' WHERE id = 'deep_massage'").run();
        const updateLegacySensory = db.prepare('UPDATE action_presets SET values_json = json_patch(values_json, ?) WHERE id = ?');
        for (const [id, sensory] of Object.entries(AUTHORED_SENSORY_PROFILES)) {
            updateLegacySensory.run(JSON.stringify({ description: sensory.stimulus, sensory }), id);
        }

        // Legacy databases seeded panic as permanent. Keep this lifecycle
        // migration beside content sync because the API does not run the full
        // seed module on every start.
        db.prepare(`
            UPDATE action_presets
            SET context_config_json = json_set(
                COALESCE(context_config_json, '{}'),
                '$.duration', 30,
                '$.durationUnit', 'minutes'
            )
            WHERE id = 'effect_panic'
        `).run();

        const authoredIds = actions.map(action => action.id);
        const sceneRows = db.prepare('SELECT id, available_actions FROM scenes').all() as Array<{
            id: string;
            available_actions: string;
        }>;
        const updateScene = db.prepare('UPDATE scenes SET available_actions = ? WHERE id = ?');

        for (const scene of sceneRows) {
            let available: string[] = [];
            try { available = JSON.parse(scene.available_actions || '[]'); } catch { available = []; }
            const merged = Array.from(new Set([...available.filter(id => !retiredActionIds.has(id)), ...authoredIds]));
            if (JSON.stringify(merged) !== JSON.stringify(available)) {
                updateScene.run(JSON.stringify(merged), scene.id);
            }
        }

        // The laboratory's topology is now represented by room:/device:/near:
        // presence slots. The generic table/terminal scene layout was the old
        // competing location model and must not be reintroduced from saves.
        db.prepare(`UPDATE scenes SET slots = '[]' WHERE id = 'scene_lab_calibrator'`).run();
        db.prepare(`
            INSERT INTO scene_objects (id, scene_id, node_id, item_id, owner_id, state, metadata)
            VALUES (
                'calibrator_suspension_mount',
                'scene_lab_calibrator',
                'device:lab_diagnostic_table',
                'eq_suspension',
                'PL-1',
                'active',
                '{"label":"Потолочный подвес диагностического стола"}'
            )
            ON CONFLICT(id) DO UPDATE SET
                scene_id = excluded.scene_id,
                node_id = excluded.node_id,
                item_id = excluded.item_id,
                state = excluded.state,
                metadata = excluded.metadata
        `).run();
    })();

    const dressedCharacters = ensureAllStarterClothing();

    console.log(`[Content] Synced ${actions.length} action presets and ${items.length} items.${dressedCharacters.length ? ` Added starter clothing: ${dressedCharacters.join(', ')}.` : ''}`);
}
