import { describe, it, expect, beforeEach } from 'vitest';
import { runGameTick } from '../src/orchestration/runGameTick';
import { buildPromptPayload } from '../src/prompts/buildPromptPayload';
import { checkActionAccess } from '../src/scenario/checkActionAccess';
import { db } from '../src/infrastructure/db';

describe('Vertical Slice Integration (Full System Pipeline)', () => {
    beforeEach(() => {
        db.prepare('DELETE FROM event_logs').run();
        db.prepare('DELETE FROM subjects').run();
        db.prepare('DELETE FROM subject_point_states').run();
        db.prepare('DELETE FROM scenes').run();
        db.prepare('DELETE FROM players').run();

        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude) 
                    VALUES ('sub_vertical', 'V-Subject', 50, 50, 50, 50, 50)`).run();
        db.prepare(`INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude) 
                    VALUES ('sub_vertical', 'point_v', 50, 50)`).run();
        db.prepare(`INSERT INTO scenes (id, available_actions) 
                    VALUES ('scene_v', '["act_v_test"]')`).run();
        db.prepare(`INSERT INTO players (id, resources) 
                    VALUES ('player_v', '{"energy":100}')`).run();
    });

    it('should successfully pass data from Scenario -> Orchestration -> Engine -> DB -> Diagnostics', async () => {
        const scene = { id: 'scene_v', availableActions: ['act_v_test', 'act_other'] };
        const player = { id: 'player_v', resources: { energy: 100 } };
        
        expect(checkActionAccess('act_v_test', scene, player)).toBe(true);

        const tickResult = runGameTick({
            subjectId: 'sub_vertical',
            playerId: 'player_v',
            pointId: 'point_v',
            sceneId: 'scene_v',
            presetId: 'act_v_test',
            dynamicModifiers: { intensity: 0.9, valence: 0.8, contact: 0.6, sharpness: 0.3, novelty: 0.8 }
        });

        expect(tickResult.nextCore).toBeDefined();

        const logs = db.prepare('SELECT * FROM event_logs WHERE subject_id = ? ORDER BY timestamp DESC').all('sub_vertical') as any[];
        expect(logs.length).toBe(1);

        try {
           const promptInfo = await buildPromptPayload('sub_vertical', tickResult as any);
           expect(promptInfo.stateSummary).toContain('состояние');
           expect(promptInfo.recentEvents.length).toBeGreaterThan(0);
        } catch(e) {
           console.error("DEBUG PROMPT PAYLOAD ERROR", e);
           throw e;
        }
    });
});
