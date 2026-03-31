// src/infrastructure/eventQueries.ts
import { db } from './db';

export const eventQueries = {
    getRecentLogs(subjectId: string, limit: number = 10): any[] {
        const stmt = db.prepare('SELECT * FROM event_logs WHERE subject_id = ? ORDER BY timestamp DESC LIMIT ?');
        const rows = stmt.all(subjectId, limit) as any[];
        return rows.map(r => ({
            id: r.id,
            subjectId: r.subject_id,
            timestamp: r.timestamp,
            actionType: r.action_type,
            actionPayload: JSON.parse(r.action_payload),
            resultPayload: JSON.parse(r.result_payload)
        }));
    }
};