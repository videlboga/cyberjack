import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../src/infrastructure/db';
import { subjectRepo, pointStateRepo, resourceRepo, sceneRepo, presetRepo } from '../src/infrastructure/repositories';
import { DEFAULT_CONFIG } from '../src/engine/config';
import { dispatchEvent } from '../src/orchestration/eventRouter';
import { eventQueries } from '../src/infrastructure/eventQueries';

describe('Orchestration Integration', () => {
    beforeEach(() => {
        db.exec('DELETE FROM scene_characters; DELETE FROM character_relations; DELETE FROM event_logs; DELETE FROM active_contexts; DELETE FROM subjects; DELETE FROM subject_point_states; DELETE FROM character_resources; DELETE FROM scenes; DELETE FROM action_presets; DELETE FROM characters;');
        
        // Seed DB
        subjectRepo.save('sub_1', 'Test Subject', DEFAULT_CONFIG.core.defaults);
        pointStateRepo.save('sub_1', 'point_A', DEFAULT_CONFIG.point.defaults);
        expect(pointStateRepo.get('sub_1', 'POINT_A')?.pointId).toBe('point_a');
        resourceRepo.save({ id: 'player_1', resources: { energy: 100 } });
        sceneRepo.save({ id: 'scene_main', availableActions: ['act_soft_touch'] });
        presetRepo.saveActionPreset('act_soft_touch', 'Soft Touch', { intensity: 0.35, valence: 0.45, contact: 0.75, sharpness: 0.15, novelty: 0.8 });
    });

    it('should run a full game tick entirely from DB state', async () => {
        const payload = {
            subjectId: 'sub_1',
            pointId: 'point_A',
            playerId: 'player_1',
            sceneId: 'scene_main',
            presetId: 'act_soft_touch'
        };

        const result = await dispatchEvent(payload);
        const engineOutput = result.bundle.output;

        // Core constraints
        expect(engineOutput.nextCore).toBeDefined();

        // Check persistence updated
        const updatedCore = subjectRepo.get('sub_1');
        expect(updatedCore?.attitude).toEqual(engineOutput.nextCore.attitude);

        const logs = eventQueries.getRecentLogs('sub_1', 10);
        expect(logs.length).toBe(1);
        expect(logs[0].actionType).toBe('interaction');
        expect(logs[0].actionPayload.pointId).toBe('point_A');
    });
});
