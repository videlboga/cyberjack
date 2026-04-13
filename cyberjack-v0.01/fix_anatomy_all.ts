import { db } from './src/infrastructure/db';
import { getBaseHumanAnatomy } from './src/domain/anatomy';

function regenerateAnatomies() {
    const chars = db.prepare('SELECT id, subject_id, profile_json FROM characters').all();
    let count = 0;
    for (const c of chars) {
        if (!c.profile_json) continue;
        const profile = JSON.parse(c.profile_json);
        if (!profile.base) continue;

        // Clear existing to avoid conflicts
        db.prepare('DELETE FROM subject_point_states WHERE subject_id = ?').run(c.subject_id);

        const points = getBaseHumanAnatomy(profile.base.gender, profile.base.anatomy);
        const stmt = db.prepare(`
            INSERT INTO subject_point_states 
            (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
            VALUES (?, ?, ?, ?, 0, 0, ?, ?)
        `);
        for (const p of points) {
            stmt.run(c.subject_id, p.id, p.sens, p.att, p.sens, p.att);
        }
        count++;
    }
    console.log(`Regenerated anatomy for ${count} characters.`);
}

regenerateAnatomies();
