import { db } from './src/infrastructure/db';
const logs = db.prepare("SELECT * FROM event_logs ORDER BY timestamp DESC LIMIT 2").all();
console.log(JSON.stringify(logs, null, 2));
