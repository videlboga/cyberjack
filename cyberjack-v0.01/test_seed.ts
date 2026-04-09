import { db } from './src/infrastructure/db.js';
console.log(db.prepare("SELECT * FROM action_presets WHERE id LIKE 'context_%'").all());
