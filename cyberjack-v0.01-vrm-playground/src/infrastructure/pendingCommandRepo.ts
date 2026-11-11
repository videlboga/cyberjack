import { db } from './db';
import type { CommandIntent } from '../domain/resolver';

export interface PendingCommandFocus {
    subjectId: string;
    playerId: string;
    sceneId: string;
    sourceText: string;
    description: string;
    intent: CommandIntent;
    routing?: { actorId?: string; targetId?: string };
}

export const pendingCommandRepo = {
    get(subjectId: string, playerId: string): PendingCommandFocus | null {
        const row = db.prepare(`
            SELECT subject_id AS subjectId, player_id AS playerId, scene_id AS sceneId,
                   source_text AS sourceText, description, intent_json AS intentJson,
                   routing_json AS routingJson
            FROM pending_command_focus WHERE subject_id = ? AND player_id = ?
        `).get(subjectId, playerId) as any;
        if (!row) return null;
        try {
            return {
                subjectId: row.subjectId,
                playerId: row.playerId,
                sceneId: row.sceneId,
                sourceText: row.sourceText,
                description: row.description,
                intent: JSON.parse(row.intentJson),
                routing: row.routingJson ? JSON.parse(row.routingJson) : undefined,
            };
        } catch {
            this.clear(subjectId, playerId);
            return null;
        }
    },

    save(focus: PendingCommandFocus) {
        db.prepare(`
            INSERT INTO pending_command_focus
                (subject_id, player_id, scene_id, source_text, description, intent_json, routing_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(subject_id, player_id) DO UPDATE SET
                scene_id = excluded.scene_id,
                source_text = excluded.source_text,
                description = excluded.description,
                intent_json = excluded.intent_json,
                routing_json = excluded.routing_json,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            focus.subjectId,
            focus.playerId,
            focus.sceneId,
            focus.sourceText,
            focus.description,
            JSON.stringify(focus.intent),
            focus.routing ? JSON.stringify(focus.routing) : null,
        );
    },

    clear(subjectId: string, playerId: string) {
        db.prepare('DELETE FROM pending_command_focus WHERE subject_id = ? AND player_id = ?').run(subjectId, playerId);
    },
};
