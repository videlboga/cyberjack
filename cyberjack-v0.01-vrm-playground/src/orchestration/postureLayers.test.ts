import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { activeContextsRepo, presetRepo, subjectRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { runGameTick } from './runGameTick';
import { ContextManager } from './contextManager';
const subject='TEST-POSTURE';
const apply=(id:string)=>ContextManager.applyContext(subject,id,presetRepo.getActionPreset(id)!);
const ids=()=>activeContextsRepo.getAllForSubject(subject).map(c=>c.actionId);
beforeEach(()=>{subjectRepo.save(subject,subject,{sensitivity:50,capacity:80,openness:50,plasticity:50,attitude:80,tension:0});db.prepare('DELETE FROM active_contexts WHERE subject_id = ?').run(subject)});
describe('independent posture layers',()=>{
 it('keeps seated base and head when replacing arms',()=>{apply('pose_sitting');apply('posture_arms_up');apply('posture_head_left');apply('posture_arms_front');expect(ids()).toEqual(expect.arrayContaining(['pose_sitting','posture_head_left','posture_arms_front']));expect(ids()).not.toContain('posture_arms_up')});
 it('preserves an arm goal when changing to lying',()=>{apply('pose_sitting');apply('posture_arms_up');apply('pose_lying_down');expect(ids()).toContain('posture_arms_up');expect(ids()).not.toContain('pose_sitting')});
 it('clears arms on adopting a supporting pose and blocks lifting them',()=>{apply('posture_arms_up');apply('pose_all_fours');expect(ids()).not.toContain('posture_arms_up');expect(apply('posture_arms_up').blocked).toBe(true);expect(ids()).not.toContain('posture_arms_up')});
});

it('executes a spoken partial goal while preserving the base', async()=>{
 db.prepare(`INSERT OR IGNORE INTO subject_point_states (subject_id,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness) SELECT ?,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness FROM subject_point_states WHERE subject_id='S-AV-01'`).run(subject);
 apply('pose_sitting');
 await runGameTick({subjectId:subject,playerId:'PL-1',sceneId:'scene_lab_calibrator',pointId:'systemic',presetId:'verbal_pressure',textMessage:'Подними руки',skipPrompt:true,dynamicModifiers:{intensity:0,valence:0,contact:0,sharpness:0,novelty:0,commandIntent:{type:'activate_context',targetContextId:'posture_arms_up'}} as any});
 expect(ids()).toContain('pose_sitting');expect(ids()).toContain('posture_arms_up');
});
it('does not claim a blocked spoken arm goal was applied', async()=>{
 apply('pose_all_fours');
 const result=await runGameTick({subjectId:subject,playerId:'PL-1',sceneId:'scene_lab_calibrator',pointId:'systemic',presetId:'verbal_pressure',textMessage:'Подними руки',skipPrompt:true,dynamicModifiers:{intensity:0,valence:0,contact:0,sharpness:0,novelty:0,commandIntent:{type:'activate_context',targetContextId:'posture_arms_up'}} as any});
 expect(result.actionApplied).toBe(false);expect(ids()).toContain('pose_all_fours');expect(ids()).not.toContain('posture_arms_up');
});
it('keeps seated base when extending one leg',()=>{apply('pose_sitting');apply('posture_leg_right_forward');expect(ids()).toContain('pose_sitting');expect(ids()).toContain('posture_leg_right_forward');expect(ids()).not.toContain('act_present_feet')});
it('parses the reported natural leg command and preserves the seated base through the core',async()=>{
 const {parseSemanticVerbalInput}=await import('../parser/semanticVerbalParser');
 const text='Я хочу на тебя полюбоваться. Вытяни правую ножку вперёд';
 const parsed=await parseSemanticVerbalInput(text,'Сидит',[{id:subject,name:'Мира'}],subject,subject);
 expect(parsed.commandIntent).toEqual({type:'activate_context',targetContextId:'posture_leg_right_forward'});
 db.prepare(`INSERT OR IGNORE INTO subject_point_states (subject_id,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness) SELECT ?,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness FROM subject_point_states WHERE subject_id='S-AV-01'`).run(subject);
 apply('pose_sitting');
 await runGameTick({subjectId:subject,playerId:'PL-1',sceneId:'scene_lab_calibrator',pointId:'systemic',presetId:'verbal_pressure',textMessage:text,skipPrompt:true,dynamicModifiers:parsed as any});
 expect(ids()).toContain('pose_sitting');expect(ids()).toContain('posture_leg_right_forward');expect(ids()).not.toContain('act_present_feet');
});
it('changes outfit exclusively while preserving the pose and limb goals',async()=>{
 const {parseSemanticVerbalInput}=await import('../parser/semanticVerbalParser');
 apply('pose_sitting');apply('posture_leg_right_forward');apply('eq_outfit_mira_jacket');
 const parsed=await parseSemanticVerbalInput('Надень кружевное бельё','Сидит',[{id:subject,name:'Мира'}],subject,subject);
 expect(parsed.commandIntent).toEqual({type:'activate_context',targetContextId:'eq_outfit_mira_lingerie'});
 db.prepare(`INSERT OR IGNORE INTO subject_point_states (subject_id,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness) SELECT ?,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness FROM subject_point_states WHERE subject_id='S-AV-01'`).run(subject);
 await runGameTick({subjectId:subject,playerId:'PL-1',sceneId:'scene_lab_calibrator',pointId:'systemic',presetId:'verbal_pressure',textMessage:'Надень кружевное бельё',skipPrompt:true,dynamicModifiers:parsed as any});expect(ids()).toContain('eq_outfit_mira_lingerie');expect(ids()).not.toContain('eq_outfit_mira_jacket');expect(ids()).toContain('pose_sitting');expect(ids()).toContain('posture_leg_right_forward');
});
