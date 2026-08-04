import { db } from './db';
import type { InteractionStance } from '../domain/interactionStance';

const parse = (value: unknown): string[] => {
    try { return Array.isArray(JSON.parse(String(value || '[]'))) ? JSON.parse(String(value || '[]')) : []; }
    catch { return []; }
};

const map = (row: any): InteractionStance => ({
    subjectId: row.subject_id,
    actorId: row.actor_id,
    request: row.request,
    scopePoints: parse(row.scope_points),
    scopeTags: parse(row.scope_tags),
    intensity: Number(row.intensity || 0),
    sourceActionId: row.source_action_id,
    ignoredCount: Number(row.ignored_count || 0),
});

export const interactionStanceRepo = {
    get(subjectId: string, actorId: string): InteractionStance | null {
        const row = db.prepare(`SELECT * FROM interaction_stances WHERE subject_id=? AND actor_id=? AND status='active'`).get(subjectId, actorId);
        return row ? map(row) : null;
    },
    save(stance: InteractionStance) {
        db.prepare(`
            INSERT INTO interaction_stances
              (subject_id,actor_id,request,scope_points,scope_tags,intensity,source_action_id,ignored_count,status,updated_at)
            VALUES (?,?,?,?,?,?,?,?, 'active', CURRENT_TIMESTAMP)
            ON CONFLICT(subject_id,actor_id) DO UPDATE SET
              request=excluded.request, scope_points=excluded.scope_points, scope_tags=excluded.scope_tags,
              intensity=excluded.intensity, source_action_id=excluded.source_action_id,
              ignored_count=excluded.ignored_count, status='active', updated_at=CURRENT_TIMESTAMP
        `).run(stance.subjectId, stance.actorId, stance.request, JSON.stringify(stance.scopePoints), JSON.stringify(stance.scopeTags), stance.intensity, stance.sourceActionId || null, stance.ignoredCount);
    },
    recordIgnored(subjectId: string, actorId: string) {
        db.prepare(`UPDATE interaction_stances SET ignored_count=ignored_count+1, intensity=min(1, intensity+0.1), updated_at=CURRENT_TIMESTAMP WHERE subject_id=? AND actor_id=? AND status='active'`).run(subjectId, actorId);
    },
    soften(subjectId: string, actorId: string, amount = 0.25) {
        db.prepare(`UPDATE interaction_stances SET intensity=max(0, intensity-?), status=CASE WHEN intensity-? <= 0.05 THEN 'resolved' ELSE status END, updated_at=CURRENT_TIMESTAMP WHERE subject_id=? AND actor_id=? AND status='active'`).run(amount, amount, subjectId, actorId);
    },
    softenAll(subjectId: string, amount = 0.25) {
        db.prepare(`UPDATE interaction_stances SET intensity=max(0,intensity-?), status=CASE WHEN intensity-? <= .05 THEN 'resolved' ELSE status END, updated_at=CURRENT_TIMESTAMP WHERE subject_id=? AND status='active'`)
            .run(amount,amount,subjectId);
    },
};
