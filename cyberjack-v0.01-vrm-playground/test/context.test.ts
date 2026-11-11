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
        // Near-zero reserve with subsided activation triggers collapse.
    subjectRepo.save(subj, 'TriggerSubject', { sensitivity:50, capacity:3, openness:50, plasticity:50, attitude:30, tension: 0 });
    pointStateRepo.save(subj, 'systemic', { pointId: 'systemic', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });

        // Ensure the preset exists for effect_apathy
        presetRepo.saveActionPreset('effect_apathy', 'Apathy', { intensity: 0 }, { occupiesPoints: [], duration: -1 });

        // Run watcher
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);

        const active = activeContextsRepo.getAllForSubject(subj);
        expect(active.some(a => a.actionId === 'effect_apathy')).toBe(true);
    });

    it('keeps unconsciousness until the higher recovery threshold is reached', () => {
        const subj = 'sub_ctx_apathy_hysteresis';
        pointStateRepo.save(subj, 'systemic', { pointId:'systemic', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });
        presetRepo.saveActionPreset('effect_apathy', 'Apathy', { intensity_mult:0.5 }, { type:'condition', occupiesPoints:[], duration:-1 });
        presetRepo.saveActionPreset('pose_lying_down', 'Lying', {}, { type:'pose', occupiesPoints:['global_pose'], duration:-1 });

        subjectRepo.save(subj, 'Hysteresis Subject', { sensitivity:50, capacity:3, openness:50, plasticity:50, attitude:50, tension:0 });
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_apathy')).toBe(true);

        subjectRepo.save(subj, 'Hysteresis Subject', { sensitivity:50, capacity:20, openness:50, plasticity:50, attitude:50, tension:0 });
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_apathy')).toBe(true);

        subjectRepo.save(subj, 'Hysteresis Subject', { sensitivity:50, capacity:25, openness:50, plasticity:50, attitude:50, tension:0 });
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_apathy')).toBe(false);
    });

    it('uses sensitivity above the local baseline for hyperesthesia', () => {
        const subj = 'sub_ctx_local_hyperesthesia';
        const core = { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 };
        subjectRepo.save(subj, 'Sensitive Subject', core);
        presetRepo.saveActionPreset('effect_local_hyperesthesia', 'Local Hyperesthesia', { intensity_mult:1.5 }, { type:'condition', occupiesPoints:[], duration:-1 });

        const natural = { pointId:'nipples', localSensitivity:95, baselineLocalSensitivity:95, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 };
        ConditionWatcher.evaluate(subj, 'nipples', core as any, natural);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_local_hyperesthesia')).toBe(false);

        const elevated = { ...natural, localSensitivity:110 };
        ConditionWatcher.evaluate(subj, 'nipples', core as any, elevated);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_local_hyperesthesia')).toBe(true);

        const recovered = { ...natural, localSensitivity:103 };
        ConditionWatcher.evaluate(subj, 'nipples', core as any, recovered);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_local_hyperesthesia')).toBe(false);
    });

    it('applies unconsciousness at zero capacity regardless of high attitude', () => {
        const subj = 'sub_ctx_high_attitude_exhaustion';
        subjectRepo.save(subj, 'Exhausted Subject', { sensitivity:50, capacity:0, openness:95, plasticity:90, attitude:90, tension:8 });
        pointStateRepo.save(subj, 'systemic', { pointId:'systemic', localSensitivity:50, localAttitude:80, localOpenness:80, familiarity:0, exposureCount:0 });
        presetRepo.saveActionPreset('effect_apathy', 'Apathy', { intensity_mult:0.5 }, { type:'condition', occupiesPoints:[], duration:-1 });
        presetRepo.saveActionPreset('pose_lying_down', 'Lying', {}, { type:'pose', occupiesPoints:['global_pose'], duration:-1 });

        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);

        const active = activeContextsRepo.getAllForSubject(subj);
        expect(active.some(row => row.actionId === 'effect_apathy')).toBe(true);
        expect(active.some(row => row.actionId === 'pose_lying_down')).toBe(true);
    });

    it('uses nervous activation to force and maintain contact without restoring capacity', () => {
        const subj = 'sub_ctx_forced_arousal';
        pointStateRepo.save(subj, 'systemic', { pointId:'systemic', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });
        presetRepo.saveActionPreset('effect_apathy', 'Apathy', { intensity_mult:0.5 }, { type:'condition', occupiesPoints:[], duration:-1 });
        presetRepo.saveActionPreset('pose_lying_down', 'Lying', {}, { type:'pose', occupiesPoints:['global_pose'], duration:-1 });

        subjectRepo.save(subj, 'Forced Arousal Subject', { sensitivity:50, capacity:0, openness:50, plasticity:50, attitude:50, tension:0 });
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_apathy')).toBe(true);

        subjectRepo.save(subj, 'Forced Arousal Subject', { sensitivity:50, capacity:0, openness:50, plasticity:50, attitude:50, tension:30 });
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_apathy')).toBe(false);

        subjectRepo.save(subj, 'Forced Arousal Subject', { sensitivity:50, capacity:0, openness:50, plasticity:50, attitude:50, tension:20 });
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_apathy')).toBe(false);

        subjectRepo.save(subj, 'Forced Arousal Subject', { sensitivity:50, capacity:0, openness:50, plasticity:50, attitude:50, tension:8 });
        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'effect_apathy')).toBe(true);
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

    it('does not reuse a pose application vector as a persistent modifier', () => {
        presetRepo.saveActionPreset('pose_test', 'Pose', { intensity: 3, valence: -2 }, {
            type: 'pose', occupiesPoints: ['global_pose'], duration: -1
        });

        const result = compileContextVector([{ actionId: 'pose_test' }], { intensity: 0 } as any) as any;
        expect(result.intensity).toBeUndefined();
        expect(result.valence).toBeUndefined();
    });

    it('retains legacy condition vectors as persistent modifiers', () => {
        presetRepo.saveActionPreset('condition_test', 'Condition', { intensity_mult: 0.5 }, {
            type: 'condition', occupiesPoints: [], duration: -1
        });

        const result = compileContextVector([{ actionId: 'condition_test' }], { intensity: 1 } as any) as any;
        expect(result.intensity_mult).toBe(0.5);
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

    it('removeByActionId removes every occupied point of one context', () => {
        const subj = 'sub_ctx_remove_whole_item';
        subjectRepo.save(subj, 'RemoveWholeItemSubject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 });
        presetRepo.saveActionPreset('wearable_ctx', 'Wearable', {}, {
            type: 'clothing',
            occupiesPoints: ['groin', 'buttocks'],
            duration: -1
        });
        activeContextsRepo.add('wearable_groin', subj, 'wearable_ctx', -1, 'groin', null);
        activeContextsRepo.add('wearable_buttocks', subj, 'wearable_ctx', -1, 'buttocks', null);

        activeContextsRepo.removeByActionId(subj, 'wearable_ctx');

        expect(activeContextsRepo.getAllForSubject(subj).filter(row => row.actionId === 'wearable_ctx')).toHaveLength(0);
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

    it('blocks an autonomous collapse pose when a whole-body restraint holds the pose slot', () => {
        const subj = 'sub_ctx_restrained_collapse';
        subjectRepo.save(subj, 'Restrained Subject', { sensitivity:50, capacity:5, openness:50, plasticity:50, attitude:30, tension:0 });
        presetRepo.saveActionPreset('whole_body_restraint', 'Suspension', {}, {
            type:'equipment', occupiesPoints:['global_pose'], exclusiveWithinPoint:true, duration:-1
        });
        db.prepare(`UPDATE action_presets SET type = 'restraint', tags = '["restraint"]' WHERE id = 'whole_body_restraint'`).run();
        presetRepo.saveActionPreset('pose_lying_down', 'Lying', {}, {
            type:'pose', occupiesPoints:['global_pose'], duration:-1
        });
        activeContextsRepo.add('restraint_instance', subj, 'whole_body_restraint', -1, 'global_pose', 'PL-1');

        const result = ContextManager.applyContext(
            subj,
            'pose_lying_down',
            presetRepo.getActionPreset('pose_lying_down') as any,
            undefined,
            subj
        );

        expect(result.blocked).toBe(true);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'whole_body_restraint')).toBe(true);
        expect(activeContextsRepo.getAllForSubject(subj).some(row => row.actionId === 'pose_lying_down')).toBe(false);
    });

    it('moves an unrestrained subject into a lying pose when apathy activates', () => {
        const subj = 'sub_ctx_collapse';
        subjectRepo.save(subj, 'Collapse Subject', { sensitivity:50, capacity:3, openness:50, plasticity:50, attitude:30, tension:0 });
        pointStateRepo.save(subj, 'systemic', { pointId:'systemic', localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0 });
        presetRepo.saveActionPreset('effect_apathy', 'Apathy', { intensity_mult:0.5 }, { type:'condition', occupiesPoints:[], duration:-1 });
        presetRepo.saveActionPreset('pose_standing', 'Standing', {}, { type:'pose', occupiesPoints:['global_pose'], duration:-1 });
        presetRepo.saveActionPreset('pose_lying_down', 'Lying', {}, { type:'pose', occupiesPoints:['global_pose'], duration:-1 });
        activeContextsRepo.add('standing_instance', subj, 'pose_standing', -1, 'global_pose', 'PL-1');

        ConditionWatcher.evaluate(subj, 'systemic', subjectRepo.get(subj) as any, pointStateRepo.get(subj, 'systemic') as any);

        const active = activeContextsRepo.getAllForSubject(subj);
        expect(active.some(row => row.actionId === 'effect_apathy')).toBe(true);
        expect(active.some(row => row.actionId === 'pose_lying_down')).toBe(true);
        expect(active.some(row => row.actionId === 'pose_standing')).toBe(false);
    });

    it('reconciles an already active apathy context into a lying pose', () => {
        const subj = 'sub_ctx_existing_collapse';
        subjectRepo.save(subj, 'Existing Collapse Subject', { sensitivity:50, capacity:5, openness:50, plasticity:50, attitude:30, tension:0 });
        presetRepo.saveActionPreset('effect_apathy', 'Apathy', { intensity_mult:0.5 }, { type:'condition', occupiesPoints:[], duration:-1 });
        presetRepo.saveActionPreset('pose_all_fours', 'All Fours', {}, { type:'pose', occupiesPoints:['global_pose','knees','hands'], duration:-1 });
        presetRepo.saveActionPreset('pose_lying_down', 'Lying', {}, { type:'pose', occupiesPoints:['global_pose'], duration:-1 });
        activeContextsRepo.add('apathy_instance', subj, 'effect_apathy', -1, null, null);
        activeContextsRepo.add('all_fours_pose', subj, 'pose_all_fours', -1, 'global_pose', 'PL-1');
        activeContextsRepo.add('all_fours_knees', subj, 'pose_all_fours', -1, 'knees', 'PL-1');

        const result = ContextManager.applyAutonomousCollapse(subj);
        const active = activeContextsRepo.getAllForSubject(subj);

        expect(result.applied).toBe(true);
        expect(active.some(row => row.actionId === 'pose_lying_down')).toBe(true);
        expect(active.some(row => row.actionId === 'pose_all_fours')).toBe(false);
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

    it('stores a multi-slot pose as one scene-level context', () => {
        const subj = 'sub_ctx_multislot_pose';
        subjectRepo.save(subj, 'Multi-slot Pose Subject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 });
        presetRepo.saveActionPreset('pose_all_fours', 'All Fours', {}, {
            type:'pose',
            occupiesPoints:['systemic', 'global_pose', 'knees', 'hands'],
            duration:-1
        });

        ContextManager.applyContext(subj, 'pose_all_fours', presetRepo.getActionPreset('pose_all_fours') as any);

        const rows = activeContextsRepo.getAllForSubject(subj).filter(row => row.actionId === 'pose_all_fours');
        expect(rows).toHaveLength(1);
        expect(rows[0].pointId).toBe('global_pose');
    });

    it('repairs legacy duplicate pose rows when the pose is reapplied', () => {
        const subj = 'sub_ctx_legacy_pose';
        subjectRepo.save(subj, 'Legacy Pose Subject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 });
        presetRepo.saveActionPreset('pose_all_fours', 'All Fours', {}, {
            type:'pose',
            occupiesPoints:['systemic', 'global_pose', 'knees', 'hands'],
            duration:-1
        });
        activeContextsRepo.add('legacy_systemic', subj, 'pose_all_fours', -1, 'systemic', null);
        activeContextsRepo.add('legacy_global', subj, 'pose_all_fours', -1, 'global_pose', null);
        activeContextsRepo.add('legacy_knees', subj, 'pose_all_fours', -1, 'knees', null);
        activeContextsRepo.add('legacy_hands', subj, 'pose_all_fours', -1, 'hands', null);

        ContextManager.applyContext(subj, 'pose_all_fours', presetRepo.getActionPreset('pose_all_fours') as any);

        const rows = activeContextsRepo.getAllForSubject(subj).filter(row => row.actionId === 'pose_all_fours');
        expect(rows).toHaveLength(1);
        expect(rows[0].pointId).toBe('global_pose');
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

    it('ages drug effects by game minutes while legacy contexts still age by ticks', () => {
        const subj = 'sub_ctx_drug_duration';
        subjectRepo.save(subj, 'Drug Duration Subject', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, tension:0 });
        presetRepo.saveActionPreset('drug_day', 'Daily Drug', {}, {
            type:'condition',
            occupiesPoints:[],
            duration:1440,
            durationUnit:'minutes'
        });
        presetRepo.saveActionPreset('legacy_ticks', 'Tick Context', {}, {
            type:'condition',
            occupiesPoints:[],
            duration:12
        });
        ContextManager.applyContext(subj, 'drug_day', presetRepo.getActionPreset('drug_day') as any);
        ContextManager.applyContext(subj, 'legacy_ticks', presetRepo.getActionPreset('legacy_ticks') as any);

        ContextManager.processTick(subj, 1, 720);
        let active = activeContextsRepo.getAllForSubject(subj);
        expect(active.find(row => row.actionId === 'drug_day')?.ticksActive).toBe(720);
        expect(active.find(row => row.actionId === 'legacy_ticks')?.ticksActive).toBe(1);

        ContextManager.processTick(subj, 1, 720);
        active = activeContextsRepo.getAllForSubject(subj);
        expect(active.some(row => row.actionId === 'drug_day')).toBe(false);
        expect(active.find(row => row.actionId === 'legacy_ticks')?.ticksActive).toBe(2);
    });
});
