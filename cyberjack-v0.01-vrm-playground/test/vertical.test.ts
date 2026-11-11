import { describe, it, expect, beforeEach } from 'vitest';
import { runGameTick } from '../src/orchestration/runGameTick';
import { checkActionAccess } from '../src/scenario/checkActionAccess';
import { db } from '../src/infrastructure/db';
import { subjectRepo, pointStateRepo, sceneRepo, resourceRepo, presetRepo, characterItemsRepo } from '../src/infrastructure/repositories';
import { DEFAULT_CONFIG } from '../src/engine/config';

describe('Vertical Slice Integration (Full System Pipeline)', () => {
    beforeEach(() => {
        db.prepare("DELETE FROM active_contexts").run();
        db.prepare('DELETE FROM character_relations').run();
        db.prepare('DELETE FROM scene_characters').run();
        db.prepare('DELETE FROM characters').run();
        db.prepare('DELETE FROM event_logs').run();
        db.prepare('DELETE FROM subjects').run();
        db.prepare('DELETE FROM subject_point_states').run();
        db.prepare('DELETE FROM scenes').run();
        db.prepare('DELETE FROM character_resources').run();
        db.prepare('DELETE FROM action_presets').run();

        subjectRepo.save('sub_vertical', 'V-Subject', DEFAULT_CONFIG.core.defaults);
        pointStateRepo.save('sub_vertical', 'point_v', DEFAULT_CONFIG.point.defaults);
        sceneRepo.save({ id: 'scene_v', availableActions: ['act_v_test'] });
        resourceRepo.save({ id: 'player_v', resources: { energy: 100 } });
        presetRepo.saveActionPreset('act_v_test', 'Vertical Test Action', {
            intensity: 0.6,
            valence: 0.4,
            contact: 0.5,
            sharpness: 0.2,
            novelty: 0.7
        });
    });

    it('should successfully pass data from Scenario -> Orchestration -> Engine -> DB -> Diagnostics', async () => {
        const scene = { id: 'scene_v', availableActions: ['act_v_test', 'act_other'] };
        const player = { id: 'player_v', resources: { energy: 100 } };
        
        expect(checkActionAccess('act_v_test', scene, player)).toBe(true);

        const tickBundle = await runGameTick({
            subjectId: 'sub_vertical',
            playerId: 'player_v',
            pointId: 'point_v',
            sceneId: 'scene_v',
            presetId: 'act_v_test',
            dynamicModifiers: { intensity: 0.9, valence: 0.8, contact: 0.6, sharpness: 0.3, novelty: 0.8 }
        });

        expect(tickBundle.output.nextCore).toBeDefined();

        try {
           const promptInfo = tickBundle.prompt;
           expect(promptInfo.currentStateSummary.interpretation).toContain('состояние');
           expect(promptInfo.recentEvents.length).toBeGreaterThan(0);
        } catch(e) {
           console.error("DEBUG PROMPT PAYLOAD ERROR", e);
           throw e;
        }
    });

    it('consumes one capsule ampoule and blocks the next infusion at zero charges', async () => {
        db.prepare(`
            INSERT OR REPLACE INTO items (id,name,type,tags,description)
            VALUES ('drug_test_ampoule','Test ampoule','consumable','[]','')
        `).run();
        presetRepo.saveActionPreset('capsule_test_infusion', 'Test infusion', {
            intensity:0.1,valence:0.1,contact:0.1,sharpness:0,novelty:0.2,
            requiresItem:'drug_test_ampoule',
        }, { type:'condition',duration:2,occupiesPoints:['capsule_medication'] });
        sceneRepo.save({ id:'scene_v',availableActions:['capsule_test_infusion'] });
        db.prepare(`
            INSERT OR REPLACE INTO scene_characters
                (scene_id,character_id,role,can_act,presence_state)
            VALUES ('scene_v','player_v','player',1,'present')
        `).run();
        characterItemsRepo.save({
            characterId:'player_v',itemId:'drug_test_ampoule',state:'active',charges:1,
        });

        await runGameTick({
            subjectId:'sub_vertical',playerId:'player_v',pointId:'point_v',
            sceneId:'scene_v',presetId:'capsule_test_infusion',skipPrompt:true,
        });
        expect(characterItemsRepo.get('player_v','drug_test_ampoule')).toMatchObject({
            charges:0,state:'consumed',
        });
        await expect(runGameTick({
            subjectId:'sub_vertical',playerId:'player_v',pointId:'point_v',
            sceneId:'scene_v',presetId:'capsule_test_infusion',skipPrompt:true,
        })).rejects.toThrow(/Требуется предмет/);
    });
});
