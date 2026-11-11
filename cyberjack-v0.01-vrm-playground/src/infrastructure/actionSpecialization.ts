import { db } from './db';

export function ensureActionSpecialization() {
    db.transaction(() => {
        db.prepare(`UPDATE action_presets SET label = 'Беседа' WHERE id = 'verbal_pressure'`).run();
        // Legacy fallback only. Authored JSON owns this preset when present and
        // includes its continuous-interaction context configuration.
        db.prepare(`INSERT OR IGNORE INTO action_presets (id, label, type, tags, values_json) VALUES ('finger_insertion', 'Начать стимуляцию пальцами', 'physical', '["intimate","internal","continuous"]', ?)`)
            .run(JSON.stringify({ intensity: .45, valence: .25, contact: .9, sharpness: .25, novelty: .65, validTargets: ['anus','vagina'] }));
        const scene = db.prepare(`SELECT available_actions FROM scenes WHERE id = 'scene_lab_calibrator'`).get() as any;
        if (scene) {
            let actions: string[] = [];
            try { actions = JSON.parse(scene.available_actions || '[]'); } catch { actions = []; }
            if (!actions.includes('finger_insertion')) db.prepare(`UPDATE scenes SET available_actions = ? WHERE id = 'scene_lab_calibrator'`).run(JSON.stringify([...actions, 'finger_insertion']));
        }
        db.prepare(`INSERT INTO point_presets (id, label, values_json, parent_id, tags) VALUES ('hair', 'Волосы', '{"sens":25,"att":65}', 'head', '["hair"]') ON CONFLICT(id) DO UPDATE SET label = excluded.label, parent_id = excluded.parent_id, tags = excluded.tags`).run();
        db.prepare(`INSERT OR IGNORE INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, local_openness, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness) SELECT subject_id, 'hair', 25, 65, COALESCE(local_openness, 50), 0, 0, 25, 65, COALESCE(baseline_local_openness, local_openness, 50) FROM subject_point_states WHERE point_id = 'head'`).run();

        // A modifier cannot remain active after the interaction it modifies has
        // ended. Older saves could retain such orphaned contexts indefinitely.
        db.prepare(`
            DELETE FROM active_contexts AS dependent
            WHERE EXISTS (
                SELECT 1
                FROM action_presets AS preset,
                     json_each(json_extract(preset.values_json, '$.requireContexts')) AS required
                WHERE preset.id = dependent.action_id
                  AND NOT EXISTS (
                      SELECT 1
                      FROM active_contexts AS base
                      WHERE base.subject_id = dependent.subject_id
                        AND base.action_id = required.value
                  )
            )
        `).run();
    })();
}
