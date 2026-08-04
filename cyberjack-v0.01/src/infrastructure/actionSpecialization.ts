import { db } from './db';

const targets: Record<string, string[]> = {
    gentle_stroke: ['hair','face','neck','shoulders','chest','belly','back','waist','arms','hands','inner_thighs','legs','feet','buttocks','vulva','penis'],
    tickle: ['neck','belly','waist','inner_thighs','feet','buttocks','vulva','clitoris','penis','testicles','anus'], light_kiss: ['face','lips','neck','shoulders','chest','nipples','belly','back','hands','inner_thighs','feet','buttocks','vulva','clitoris','penis'], deep_kiss: ['lips'],
    feather_stroke: ['head','hair','face','lips','neck','shoulders','chest','nipples','belly','back','waist','arms','hands','inner_thighs','legs','knees','feet','buttocks','vulva','clitoris','penis','testicles','anus','vagina','prostate'],
    deep_massage: ['shoulders','chest','belly','back','waist','arms','hands','inner_thighs','legs','feet','buttocks'], licking: ['lips','neck','nipples','inner_thighs','feet','vulva','clitoris','penis','testicles','anus'],
    firm_grip: ['shoulders','chest','waist','arms','hands','inner_thighs','legs','feet','buttocks','penis','testicles'], light_bite: ['lips','neck','shoulders','chest','nipples','inner_thighs','feet','buttocks','vulva','clitoris','penis','testicles'], hard_bite: ['lips','neck','shoulders','chest','inner_thighs','feet','buttocks','vulva','clitoris','penis','testicles'],
    pinch: ['chest','nipples','belly','waist','arms','inner_thighs','feet','buttocks','vulva','clitoris','penis','testicles','anus'], scratching: ['shoulders','chest','belly','back','arms','inner_thighs','legs','feet','buttocks'], slap: ['face','chest','inner_thighs','buttocks'], hard_slap: ['face','chest','inner_thighs','buttocks'],
    needle_prick: ['shoulders','arms','inner_thighs','legs','feet','buttocks'], whip_strike: ['shoulders','chest','back','inner_thighs','legs','feet','buttocks'], taser_shock: ['shoulders','chest','belly','back','arms','inner_thighs','legs','feet','buttocks'],
    ice_cube: ['head','hair','face','lips','neck','shoulders','chest','nipples','belly','back','waist','arms','hands','inner_thighs','legs','knees','feet','buttocks','vulva','clitoris','penis','testicles','anus','vagina','prostate'], hot_wax: ['shoulders','chest','belly','back','waist','arms','inner_thighs','legs','feet','buttocks','vulva','clitoris','penis','testicles','anus'],
    vibrator_pulse: ['neck','chest','nipples','belly','inner_thighs','vulva','clitoris','penis','testicles','anus'], hair_pull: ['hair'], breath_blow: ['face','lips','neck','chest','nipples','belly','inner_thighs','vulva','clitoris','penis','anus'], finger_insertion: ['anus','vagina']
};

export function ensureActionSpecialization() {
    db.transaction(() => {
        db.prepare(`UPDATE action_presets SET label = 'Беседа' WHERE id = 'verbal_pressure'`).run();
        const update = db.prepare(`UPDATE action_presets SET values_json = ? WHERE id = ?`);
        for (const [id, validTargets] of Object.entries(targets)) {
            const row = db.prepare(`SELECT values_json FROM action_presets WHERE id = ?`).get(id) as any;
            if (!row) continue;
            let values: Record<string, unknown> = {};
            try { values = JSON.parse(row.values_json || '{}'); } catch { values = {}; }
            update.run(JSON.stringify({ ...values, validTargets }), id);
        }
        // Legacy fallback only. Authored JSON owns this preset when present and
        // includes its continuous-interaction context configuration.
        db.prepare(`INSERT OR IGNORE INTO action_presets (id, label, type, tags, values_json) VALUES ('finger_insertion', 'Начать стимуляцию пальцами', 'physical', '["intimate","internal","continuous"]', ?)`)
            .run(JSON.stringify({ intensity: .45, valence: .25, contact: .9, sharpness: .25, novelty: .65, validTargets: targets.finger_insertion }));
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
