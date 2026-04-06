import { db } from './src/infrastructure/db';
import { buildRecentEventsSummary, EventRecord } from './src/prompts/buildRecentEventsSummary';
const logs = db.prepare("SELECT * FROM event_logs WHERE subject_id = 'S-01' ORDER BY timestamp DESC LIMIT 3").all() as any[];
const recentEvents: EventRecord[] = logs.map(log => {
    let act = null, res = null;
    try { act = JSON.parse(log.action_payload); } catch(e) {}
    try { res = JSON.parse(log.result_payload); } catch(e) {}
    return { id: String(log.id), timestamp: log.timestamp, action_type: log.action_type, action_payload: log.action_payload, result_payload: log.result_payload } as EventRecord;
});
console.log(buildRecentEventsSummary(recentEvents));
