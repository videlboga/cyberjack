import { db } from './src/infrastructure/db.ts';
import fs from 'fs';

const subjectId = 'S-ASSET-1';
const actionId = 'eq_clothe_jumpsuit';

// Remove old ones
db.prepare(`DELETE FROM active_contexts WHERE subject_id = ? AND action_id = ?`).run(subjectId, actionId);

const rawActions = fs.readFileSync('./src/infrastructure/data/presets/actions.json', 'utf-8');
const actions = JSON.parse(rawActions);
const action = actions.find((a: any) => a.id === actionId);

if (!action) throw new Error("Action not found");

const pointsToOccupy = [...(action.contextConfig?.occupiesPoints || [])];
for (const point of pointsToOccupy) {
    const id = `${actionId}_${point}`;
    db.prepare(`
        INSERT OR REPLACE INTO active_contexts (id, subject_id, action_id, duration, ticks_active, point_id)
        VALUES (?, ?, ?, -1, 0, ?)
    `).run(id, subjectId, actionId, point);
}

console.log("Fixed S-ASSET-1 active_contexts with explicit point_id!");
