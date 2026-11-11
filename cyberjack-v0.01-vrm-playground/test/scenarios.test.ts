import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runGameTick } from '../src/orchestration/runGameTick';
import { executeTurnConversations } from '../src/orchestration/sceneOrchestrator';
import { db } from '../src/infrastructure/db';
import { 
    subjectRepo, pointStateRepo, sceneRepo, playerRepo, 
    presetRepo, characterRepo, characterRelationRepo, activeContextsRepo 
} from '../src/infrastructure/repositories';
import { DEFAULT_CONFIG } from '../src/engine/config';
import * as llmAdapter from '../src/adapters/llmAdapter';

describe('Advanced Scenarios and Multi-Character Proactivity', () => {

    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        db.prepare('DELETE FROM character_relations').run();
        db.prepare('DELETE FROM scene_characters').run();
        db.prepare('DELETE FROM active_contexts').run();
        db.prepare('DELETE FROM chat_memory').run();
        db.prepare('DELETE FROM characters').run();
        db.prepare('DELETE FROM event_logs').run();
        db.prepare('DELETE FROM subjects').run();
        db.prepare('DELETE FROM subject_point_states').run();
        db.prepare('DELETE FROM scenes').run();
        db.prepare('DELETE FROM players').run();
        db.prepare('DELETE FROM action_presets').run();
        db.prepare('PRAGMA foreign_keys = ON').run();

        vi.spyOn(llmAdapter, 'generateCharacterReply').mockResolvedValue({
            reply: { speech: "I am responding proactively!" },
            sentMessages: []
        } as any);
        vi.spyOn(llmAdapter, 'generateNarratorReply').mockResolvedValue({
            reaction: "Narrator sees something.",
            sentMessages: []
        } as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should handle proactive interactions between characters', async () => {
        const sub1 = 'sub1_proactive';
        const sub2 = 'sub2_reactive';
        const playerId = 'player1';

        subjectRepo.save(sub1, 'Proactive Subject', { ...DEFAULT_CONFIG.core.defaults, openness: 90, capacity: 90 });
        pointStateRepo.save(sub1, 'point_a', DEFAULT_CONFIG.point.defaults);
        characterRepo.ensureSubject(sub1, 'Proactive Subject');

        subjectRepo.save(sub2, 'Reactive Subject', { ...DEFAULT_CONFIG.core.defaults, sensitivity: 90 });
        pointStateRepo.save(sub2, 'point_b', DEFAULT_CONFIG.point.defaults);
        characterRepo.ensureSubject(sub2, 'Reactive Subject');

        playerRepo.save({ id: playerId, resources: { energy: 100 } });
        characterRepo.ensurePlayer(playerId, 'player_name');

        sceneRepo.save({ id: 'scene_multiple', availableActions: ['act_social'] });

        presetRepo.saveActionPreset('act_social', 'Social Action', {
            intensity: 0.2, valence: 0.8, contact: 0.1, sharpness: 0.0, novelty: 0.5
        });

        // Set relations
        characterRelationRepo.ensure(sub1, sub2, { knows: true, present: true, canInteract: true, attitude: 80, baselineAttitude: 80 });
        characterRelationRepo.ensure(sub2, sub1, { knows: true, present: true, canInteract: true, attitude: 60, baselineAttitude: 60 });
        characterRelationRepo.ensure(playerId, sub1, { knows: true, present: true, canInteract: true, attitude: 50, baselineAttitude: 50 });
        characterRelationRepo.ensure(playerId, sub2, { knows: true, present: true, canInteract: true, attitude: 50, baselineAttitude: 50 });
        characterRelationRepo.ensure(sub1, playerId, { knows: true, present: true, canInteract: true, attitude: 50, baselineAttitude: 50 });

        // Player interacts with sub1
        const tickBundle = await runGameTick({
            subjectId: sub1,
            playerId,
            pointId: 'point_a',
            sceneId: 'scene_multiple',
            presetId: 'act_social'
        });

        expect(tickBundle.output.nextCore).toBeDefined();

        const res = await executeTurnConversations(tickBundle, {
            subjectId: sub1,
            eventId: 'scene_multiple',
            actionId: 'act_social',
            actionLabel: 'Social Action',
            pointLabel: 'Point A',
            pointIdUsed: 'point_a',
            autoUserMessage: 'Hello everyone',
            actionLabelMessage: null,
            fullStateName: 'Proactive Subject',
            promptPayload: tickBundle.prompt
        });

        expect(res.actorReplies).toBeDefined();
        const respondedIds = res.actorReplies.map(r => r.actorId);
        expect(respondedIds).toContain(sub1);
    expect(llmAdapter.generateCharacterReply).toHaveBeenCalled();
    });

    it('should process multiple sequential combination inputs properly', async () => {
        const sub = 'sub_combo';
        const playerId = 'player_combo';

        subjectRepo.save(sub, 'Combo Subject', DEFAULT_CONFIG.core.defaults);
        pointStateRepo.save(sub, 'point_c', DEFAULT_CONFIG.point.defaults);
        pointStateRepo.save(sub, 'point_d', DEFAULT_CONFIG.point.defaults);
        characterRepo.ensureSubject(sub, 'Combo Subject');

        playerRepo.save({ id: playerId, resources: { energy: 100 } });
        characterRepo.ensurePlayer(playerId, 'player_combo_name');
        characterRelationRepo.ensure(sub, playerId, { knows: true, present: true, canInteract: true, attitude: 50, baselineAttitude: 50 });

        sceneRepo.save({ id: 'scene_combo', availableActions: ['act_c', 'act_d'] });

        presetRepo.saveActionPreset('act_c', 'Action C', { intensity: 0.1, valence: 0.5, contact: 0.0, sharpness: 0.0, novelty: 0.1 });
        presetRepo.saveActionPreset('act_d', 'Action D', { intensity: 0.9, valence: 0.1, contact: 0.9, sharpness: 0.8, novelty: 0.9 });

        const tick1 = await runGameTick({
            subjectId: sub,
            playerId,
            pointId: 'point_c',
            sceneId: 'scene_combo',
            presetId: 'act_c'
        });
        const state1 = tick1.output.nextCore;

        const tick2 = await runGameTick({
            subjectId: sub,
            playerId,
            pointId: 'point_d',
            sceneId: 'scene_combo',
            presetId: 'act_d'
        });
        expect(tick2.output.nextCore.capacity).not.toEqual(state1.capacity);

    activeContextsRepo.add('test_ctx_id', sub, 'act_c', 5, null, null);
        const tick3 = await runGameTick({
            subjectId: sub,
            playerId,
            pointId: 'point_d',
            sceneId: 'scene_combo',
            presetId: 'act_d'
        });
        
        expect(tick3.compiledAction).toBeDefined();
    });
});
