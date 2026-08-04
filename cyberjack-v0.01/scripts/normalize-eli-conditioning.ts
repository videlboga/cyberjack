import { db } from '../src/infrastructure/db';
import { NON_LEARNABLE_STATE_CONTEXTS, parsePreferences } from '../src/domain/conditioning';

const SUBJECT_ID = 'NPC-CAND-GEN-02';
const APPLY = process.argv.includes('--apply');

const subject = db.prepare('SELECT id, name, preferences FROM subjects WHERE id = ?').get(SUBJECT_ID) as any;
if (!subject) throw new Error(`Subject ${SUBJECT_ID} not found`);

const dynamics = db.prepare(`
    SELECT resistance, learned_compliance AS learnedCompliance,
           dependency, dissociation, fear
    FROM relationship_dynamics WHERE subject_id = ? AND actor_id = 'PL-1'
`).get(SUBJECT_ID) as any;
const preferences = parsePreferences(subject.preferences);

// These associations were all present throughout the runaway machine episode.
// Compressing rather than deleting them preserves the beginning of adaptation
// while removing the false level-three saturation caused by 493 full-strength
// learning writes.
const implicated = {
    actions: new Set(['sustained_sexual_pulse']),
    contexts: new Set(['act_start_penetration', 'act_apply_collar', 'pose_spread_eagle']),
    tags: new Set(['penetration', 'sexual', 'exposure', 'restraint', 'vulnerable', 'control']),
};
const compress = (value: number) => value > 0 ? Math.tanh(value / 3) * 2 : value;
for (const [category, keys] of Object.entries(implicated) as Array<[keyof typeof implicated, Set<string>]>) {
    const bucket = preferences[category];
    for (const key of keys) {
        if (Number.isFinite(bucket[key])) bucket[key] = compress(bucket[key]);
    }
}
for (const actionId of NON_LEARNABLE_STATE_CONTEXTS) delete preferences.contexts[actionId];

const nextDynamics = dynamics ? {
    // Eight hours of ineffective resistance justify forced rationalization,
    // but not yet the >=80 assimilated-acceptance stage.
    resistance: Math.min(Number(dynamics.resistance || 0), 8),
    learnedCompliance: Math.max(Number(dynamics.learnedCompliance || 0), 55),
    dependency: Number(dynamics.dependency || 0),
    dissociation: Math.max(Number(dynamics.dissociation || 0), 18),
    fear: Number(dynamics.fear || 0),
} : null;

const report = {
    subject: { id: subject.id, name: subject.name },
    mode: APPLY ? 'apply' : 'dry-run',
    removedActivePanic: (db.prepare(`SELECT COUNT(*) AS count FROM active_contexts WHERE subject_id = ? AND action_id = 'effect_panic'`).get(SUBJECT_ID) as any).count,
    dynamics: { before: dynamics, after: nextDynamics },
    affectedPreferences: {
        actions: Object.fromEntries([...implicated.actions].map(key => [key, preferences.actions[key]])),
        contexts: Object.fromEntries([...implicated.contexts].map(key => [key, preferences.contexts[key]])),
        tags: Object.fromEntries([...implicated.tags].map(key => [key, preferences.tags[key]])),
    },
};

if (APPLY) {
    db.transaction(() => {
        db.prepare(`DELETE FROM active_contexts WHERE subject_id = ? AND action_id = 'effect_panic'`).run(SUBJECT_ID);
        db.prepare('UPDATE subjects SET preferences = ? WHERE id = ?').run(JSON.stringify(preferences), SUBJECT_ID);
        if (nextDynamics) {
            db.prepare(`
                UPDATE relationship_dynamics
                SET resistance = ?, learned_compliance = ?, dependency = ?,
                    dissociation = ?, fear = ?, updated_at = CURRENT_TIMESTAMP
                WHERE subject_id = ? AND actor_id = 'PL-1'
            `).run(
                nextDynamics.resistance, nextDynamics.learnedCompliance,
                nextDynamics.dependency, nextDynamics.dissociation,
                nextDynamics.fear, SUBJECT_ID,
            );
        }
    })();
}

console.log(JSON.stringify(report, null, 2));
