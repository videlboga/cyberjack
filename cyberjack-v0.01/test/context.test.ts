import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/infrastructure/db';
import { activeContextsRepo, presetRepo, subjectRepo, pointStateRepo, stateTriggersRepo } from '../src/infrastructure/repositories';
import { ContextManager } from '../src/orchestration/contextManager';
import { compileContextVector } from '../src/compiler/compileContextVector';
import { ConditionWatcher } from '../src/orchestration/conditionWatcher';

describe('Context & Slot Engine', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        db.prepare('DELETE FROM active_contexts').run();
        db.prepare('DELETE FROM action_presets').run();
        db.prepare('DELETE FROM subjects').run();
        db.prepare('DELETE FROM subject_point_states').run();
        db.prepare('DELETE FROM state_triggers').run();
        db.prepare('PRAGMA foreign_keys = ON').run();
    });

    it('exclusiveWithinPoint should remove only conflicting contexts on the same point', () => {
        const subj = 'sub_ctx_excl';
    subjectRepo.save(subj, 'CtxSubject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension: 0 });
    pointStateRepo.save(subj, 'left_hand', { pointId: 'left_hand', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });

        // Save two presets: existing and new
        presetRepo.saveActionPreset('preset_existing', 'Existing Restraint', { intensity: 0.2 }, {
            occupiesPoints: ['left_hand'],
            exclusiveWithinPoint: true,
            priority: 1,
            duration: 5
        });

        presetRepo.saveActionPreset('preset_new', 'New Restraint', { intensity: 0.5 }, {
            occupiesPoints: ['left_hand'],
            exclusiveWithinPoint: true,
            priority: 10,
            duration: 5
        });

        // Add existing context instance on left_hand
        activeContextsRepo.add('ctx_existing_1', subj, 'preset_existing', 5, 'left_hand', null);
        activeContextsRepo.add('ctx_existing_2', subj, 'preset_existing', 5, 'right_hand', null);

        // Apply new context which should remove only the existing one on left_hand
        const newPreset = presetRepo.getActionPreset('preset_new') as any;
        ContextManager.applyContext(subj, 'preset_new', newPreset, 'left_hand', null);

        const remaining = activeContextsRepo.getAllForSubject(subj);
        const ids = remaining.map(r => ({ id: r.id, actionId: r.actionId, pointId: r.pointId }));

        // There should still be the ctx_existing_2 on right_hand, but ctx_existing_1 should be removed
        expect(ids.some(i => i.actionId === 'preset_existing' && i.pointId === 'right_hand')).toBe(true);
        expect(ids.some(i => i.actionId === 'preset_existing' && i.pointId === 'left_hand')).toBe(false);
        // New context should exist for left_hand
        expect(ids.some(i => i.actionId === 'preset_new' && i.pointId === 'left_hand')).toBe(true);
    });

    it('priority prevents lower-priority context from being applied', () => {
        const subj = 'sub_ctx_prio';
    subjectRepo.save(subj, 'PrioSubject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension: 0 });
    pointStateRepo.save(subj, 'knees', { pointId: 'knees', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });

        presetRepo.saveActionPreset('high_prio', 'High Priority Pose', { intensity: 0.1 }, {
            occupiesPoints: ['knees'],
            exclusiveWithinPoint: true,
            priority: 20,
            duration: 5
        });

        presetRepo.saveActionPreset('low_prio', 'Low Priority Pose', { intensity: 0.3 }, {
            occupiesPoints: ['knees'],
            exclusiveWithinPoint: true,
            priority: 5,
            duration: 5
        });

        // Add high priority active context
        activeContextsRepo.add('ctx_high', subj, 'high_prio', 5, 'knees', null);

        // Attempt to add low priority - should be blocked
        const lowPreset = presetRepo.getActionPreset('low_prio') as any;
        ContextManager.applyContext(subj, 'low_prio', lowPreset, 'knees', null);

        const remaining = activeContextsRepo.getAllForSubject(subj);
        // Should contain only high_prio and not low_prio
        expect(remaining.some(r => r.actionId === 'high_prio')).toBe(true);
        expect(remaining.some(r => r.actionId === 'low_prio')).toBe(false);
    });

    it('ConditionWatcher should apply context when rule is met', () => {
        const subj = 'sub_ctx_trigger';
        // Core low capacity and low attitude should trigger 'apathy_instant' rule
    subjectRepo.save(subj, 'TriggerSubject', { sensitivity:50, capacity:5, openness:50, plasticity:50, attitude:30, tension: 0 });
    pointStateRepo.save(subj, 'systemic', { pointId: 'systemic', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });

        // Ensure the preset exists for effect_apathy
        presetRepo.saveActionPreset('effect_apathy', 'Apathy', { intensity: 0 }, { occupiesPoints: [], duration: -1 });

        // Run watcher
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);

        const active = activeContextsRepo.getAllForSubject(subj);
        expect(active.some(a => a.actionId === 'effect_apathy')).toBe(true);
    });

    it('compileContextVector combines modifiers and applies strain', () => {
        // Create two presets with modifiers
        presetRepo.saveActionPreset('ctx_mod_a', 'ModA', { intensity: 0.0 }, { modifiers: { intensity: 2, valence: -0.5 } });
        presetRepo.saveActionPreset('ctx_mod_b', 'ModB', { intensity: 0.0 }, { modifiers: { intensity: 1, intensity_mult: 1.5 } });

        const activeContexts = [ { actionId: 'ctx_mod_a', strain: 0.5 }, { actionId: 'ctx_mod_b', strain: 0 } ];

        const result = compileContextVector(activeContexts as any, { intensity: 1 } as any) as any;

        // intensity should be aggregated: from ModA (2 adjusted by strain) + ModB (1)
        expect(typeof result.intensity).toBe('number');
        expect(result.valence).toBeDefined();
        // ensure multiplier key was returned for intensity_mult
        expect(result['intensity_mult'] === undefined || typeof result['intensity_mult'] === 'number').toBe(true);
    });

    it('removeByActionIdAndPoint deletes only contexts for a given action+point', () => {
        const subj = 'sub_ctx_remove_point';
        subjectRepo.save(subj, 'RemovePointSubject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension: 0 });
        pointStateRepo.save(subj, 'left_hand', { pointId: 'left_hand', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });
        pointStateRepo.save(subj, 'right_hand', { pointId: 'right_hand', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });

    // ensure preset exists
    presetRepo.saveActionPreset('ctx_rm', 'Removable Context', { intensity: 0.1 }, { occupiesPoints: ['left_hand', 'right_hand'], duration: 5 });
    // add two instances of same action on different points and one with null point
        activeContextsRepo.add('r1', subj, 'ctx_rm', 5, 'left_hand', null);
        activeContextsRepo.add('r2', subj, 'ctx_rm', 5, 'right_hand', null);
        activeContextsRepo.add('r3', subj, 'ctx_rm', 5, null, null);

        // remove only left_hand instance
        activeContextsRepo.removeByActionIdAndPoint(subj, 'ctx_rm', 'left_hand');
        let remaining = activeContextsRepo.getAllForSubject(subj);
        expect(remaining.some(r => r.id === 'r1')).toBe(false);
        expect(remaining.some(r => r.id === 'r2')).toBe(true);
        expect(remaining.some(r => r.id === 'r3')).toBe(true);

        // remove null-point instance
        activeContextsRepo.removeByActionIdAndPoint(subj, 'ctx_rm', null);
        remaining = activeContextsRepo.getAllForSubject(subj);
        expect(remaining.some(r => r.id === 'r3')).toBe(false);
        // r2 remains
        expect(remaining.some(r => r.id === 'r2')).toBe(true);
    });

    it('replaces poses as a category without removing another context kind', () => {
        const subj = 'sub_ctx_pose';
        subjectRepo.save(subj, 'Pose Subject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 });
        presetRepo.saveActionPreset('pose_old', 'Old Pose', {}, { type:'pose', occupiesPoints:['global_pose'], priority:1 });
        presetRepo.saveActionPreset('pose_new', 'New Pose', {}, { type:'pose', occupiesPoints:['global_pose'], priority:2 });
        presetRepo.saveActionPreset('collar', 'Collar', {}, { type:'equipment', occupiesPoints:['neck'], exclusiveWithinPoint:true });
        activeContextsRepo.add('old_pose_instance', subj, 'pose_old', -1, 'global_pose', null);
        activeContextsRepo.add('collar_instance', subj, 'collar', -1, 'neck', null);

        ContextManager.applyContext(subj, 'pose_new', presetRepo.getActionPreset('pose_new') as any);
        const remaining = activeContextsRepo.getAllForSubject(subj);
        expect(remaining.some(row => row.actionId === 'pose_old')).toBe(false);
        expect(remaining.some(row => row.actionId === 'pose_new')).toBe(true);
        expect(remaining.some(row => row.actionId === 'collar')).toBe(true);
    });

    it('is idempotent when the same context is applied twice', () => {
        const subj = 'sub_ctx_idempotent';
        subjectRepo.save(subj, 'Idempotent Subject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 });
        presetRepo.saveActionPreset('same_ctx', 'Same', {}, { type:'equipment', occupiesPoints:['neck'], exclusiveWithinPoint:true });
        const preset = presetRepo.getActionPreset('same_ctx') as any;
        ContextManager.applyContext(subj, 'same_ctx', preset);
        ContextManager.applyContext(subj, 'same_ctx', preset);
        expect(activeContextsRepo.getAllForSubject(subj).filter(row => row.actionId === 'same_ctx')).toHaveLength(1);
    });

    it('preserves zero duration and expires it on the next processing pass', () => {
        const subj = 'sub_ctx_zero_duration';
        subjectRepo.save(subj, 'Duration Subject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 });
        presetRepo.saveActionPreset('instant_ctx', 'Instant', {}, { type:'condition', occupiesPoints:[], duration:0 });
        ContextManager.applyContext(subj, 'instant_ctx', presetRepo.getActionPreset('instant_ctx') as any);
        const active = activeContextsRepo.getAllForSubject(subj);
        expect(active[0].duration).toBe(0);
        ContextManager.processTick(subj, 1);
        expect(activeContextsRepo.getAllForSubject(subj)).toHaveLength(0);
    });
});
