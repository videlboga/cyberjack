import { db } from './src/infrastructure/db.ts';
import fs from 'fs';

const subjectId = 'S-ASSET-1';
const sceneId = 'scene_lab_calibrator';
const actionId = 'eq_clothe_jumpsuit';

db.prepare("UPDATE characters SET current_scene_id = ? WHERE id = ?").run(sceneId, subjectId);
db.prepare("INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role, can_act, presence_state) VALUES (?, ?, 'asset', 1, 'present')").run(sceneId, subjectId);

const rawActions = fs.readFileSync('./src/infrastructure/data/presets/actions.json', 'utf-8');
const actions = JSON.parse(rawActions);
const action = actions.find((a: any) => a.id === actionId);

if (!action) throw new Error("Action not found");

const pointsToOccupy = [...(action.contextConfig?.occupiesPoints || [])];
for (const point of pointsToOccupy) {
    const id = `${actionId}_${point}`;
    db.prepare(`
        INSERT OR REPLACE INTO active_contexts (id, subject_id, action_id, duration, ticks_active)
        VALUES (?, ?, ?, -1, 0)
    `).run(id, subjectId, actionId);
}

// Add systemic
db.prepare(`
    INSERT OR REPLACE INTO active_contexts (id, subject_id, action_id, duration, ticks_active)
    VALUES (?, ?, ?, -1, 0)
`).run(actionId, subjectId, actionId);

console.log("Moved S-ASSET-1 to calibrator room and applied jumpsuit directly to active_contexts!");
