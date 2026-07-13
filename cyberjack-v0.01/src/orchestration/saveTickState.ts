// src/orchestration/saveTickState.ts
import { subjectRepo, pointStateRepo, eventLogRepo, characterRepo, characterRelationRepo } from '../infrastructure/repositories';
import { subjectPreferencesRepo, activeContextsRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, CompiledAction, TickOutput, InteractionObservation } from '../domain/types';
import { db } from '../infrastructure/db';
import { DEFAULT_CONFIG } from '../engine/config';
import { dampTowardsBaseline, advanceBaseline } from '../engine/baselineUtils';
import { describeActionNarrative } from '../narrative/eventTemplates';

export function saveTickState(
    subjectId: string, 
    pointId: string, 
    playerId: string,
    presetId: string,
    action: CompiledAction, 
    output: TickOutput,
    tickId: string,
    observation?: InteractionObservation
) {
    // 1. Save new core state
    const currentSubject = subjectRepo.get(subjectId);
    const subjectName = currentSubject?.name || 'Unknown';
    subjectRepo.save(subjectId, subjectName, output.nextCore);
    characterRepo.ensureSubject(subjectId, subjectName);
    const playerCharacter = characterRepo.ensureCharacter(playerId, playerId === 'PL-1' ? 'Калибратор' : playerId);
    const actorName = playerCharacter.name || 'Калибратор';
    const relationCfg = (DEFAULT_CONFIG.formulas.baseline?.relation) || {};
    const relation = characterRelationRepo.ensure(subjectId, playerCharacter.id, {
        attitude: output.nextCore.attitude,
        openness: currentSubject?.openness ?? output.nextCore.openness,
        plasticity: currentSubject?.plasticity ?? output.nextCore.plasticity,
        baselineAttitude: currentSubject?.baselineAttitude ?? output.nextCore.attitude
    });
    const relationBaseline = relation.baselineAttitude ?? relation.attitude;
    const dampedRelationAttitude = dampTowardsBaseline(output.nextCore.attitude, relationBaseline, {
        dampingBase: relationCfg.dampingBase,
        dampingDistanceScale: relationCfg.dampingDistanceScale,
        maxDamping: relationCfg.maxDamping
    });
    const relationDriver = {
        plasticity: output.nextCore.plasticity,
        openness: output.nextCore.openness,
        novelty: action.novelty ?? 0.5
    };
    const nextRelationBaseline = advanceBaseline(
        relationBaseline,
        dampedRelationAttitude,
        relationDriver,
        { baseRate: relationCfg.adaptBase, ...relationCfg }
    );
    characterRelationRepo.updateAttitude(subjectId, playerCharacter.id, dampedRelationAttitude, {
        baselineAttitude: nextRelationBaseline,
        openness: output.nextCore.openness,
        plasticity: output.nextCore.plasticity
    });
    characterRelationRepo.updateSocialStats(subjectId, playerCharacter.id, {
        familiarityDelta: Math.max(0.005, (action.novelty ?? 0.5) * 0.015)
    });

    // 2. Save new point state
    pointStateRepo.save(subjectId, pointId, output.nextPoint);

    // Get formatting labels
    const actionPresetRow = db.prepare('SELECT label FROM action_presets WHERE id = ?').get(presetId) as any;
    const pointRow = db.prepare('SELECT label FROM point_presets WHERE id = ?').get(pointId) as any;

    const actionLabel = actionPresetRow ? actionPresetRow.label : presetId;
    const pointLabel = pointRow ? pointRow.label : pointId;
    const actionNarrative = describeActionNarrative(presetId, actionLabel, actorName, pointLabel, pointId);

    // 3. Append event log
    eventLogRepo.append(
        subjectId, 
        'interaction', 
        {
            action,
            pointId,
            presetId,
            actionLabel,
            pointLabel,
            narrative: actionNarrative,
            actorName,
            tickId,
            delta: output.delta
        },
        { result: output.result, delta: output.delta, observation }
    );

    // 4. Adjust preferences based on psychological and relationship factors
    try {
        const result = output.result;
        
        // --- TARGET (Receiver) Preference Update ---
        // Base reward: direct sensations + relation shift
        let targetReward = (result.pleasure || 0) - (result.discomfort || 0) + (result.attitudeShift || 0) * 0.2;

        const targetRelation = characterRelationRepo.get(subjectId, playerId);
        const targetAttitude = targetRelation?.attitude ?? 50;
        const targetRelPlasticity = targetRelation?.plasticity ?? 50;
        const targetSympathy = (targetAttitude - 50) / 50; // [-1..1]
        // Dominance: low plasticity towards actor = dominant (>0), high plasticity = submissive (<0)
        const targetDominance = (50 - targetRelPlasticity) / 50; 

        // Masochistic/Submissive learning: if target is submissive and likes the actor, 
        // they can learn to prefer pain/discomfort from them (Stockholm/Masochism effect)
        if (targetDominance < 0 && targetSympathy > 0) {
            const submissiveness = -targetDominance; // [0..1]
            targetReward += (result.discomfort || 0) * submissiveness * targetSympathy;
        }

        const targetPlasticity = (output.nextCore?.plasticity ?? 50) / 100;
        const targetDelta = Math.sign(targetReward) * Math.min(1, Math.abs(targetReward)) * 0.5 * targetPlasticity;

        if (presetId) subjectPreferencesRepo.adjust(subjectId, 'actions', presetId, targetDelta);
        if (pointId) subjectPreferencesRepo.adjust(subjectId, 'points', pointId, targetDelta);

        const targetActive = activeContextsRepo.getAllForSubject(subjectId) || [];
        for (const ctx of targetActive) {
            if (ctx?.actionId) subjectPreferencesRepo.adjust(subjectId, 'contexts', ctx.actionId, targetDelta * 0.6);
        }

        // --- ACTOR (Initiator) Preference Update ---
        // Actor evaluates the action based on their own relationship to the target (empathy, dominance/submission).
        const actorChar = characterRepo.get(playerId); // playerId is actually actorId in this context
        if (actorChar && actorChar.subjectId) { // Only update preferences for NPCs with a subjectId
            const actorSubject = subjectRepo.get(actorChar.subjectId);
            if (actorSubject) {
                const actorRelation = characterRelationRepo.get(actorChar.id, subjectId);
                const actorAttitude = actorRelation?.attitude ?? 50;
                const actorRelPlasticity = actorRelation?.plasticity ?? 50;
                
                // Empathy: [-1..1] (1 = loves target, -1 = hates target)
                const actorSympathy = (actorAttitude - 50) / 50;
                // Dominance: [-1..1] (1 = dominant unyielding, -1 = submissive malleable)
                const actorDominance = (50 - actorRelPlasticity) / 50;
                
                const targetPleasure = result.pleasure || 0;
                const targetDiscomfort = result.discomfort || 0;
                const tensionShift = (output.nextCore?.tension ?? 0) - (currentSubject?.tension ?? 0);
                
                // 1. Empathy reward: "I want them to feel good/bad based on if I like them"
                const empathyReward = actorSympathy * (targetPleasure - targetDiscomfort);
                
                // 2. Submission reward: "I am submitting, so I get rewarded strictly by target's pleasure"
                const submissionDrive = Math.max(0, -actorDominance);
                const submissionReward = submissionDrive * targetPleasure;
                
                // 3. Dominance reward: "I want to see my impact (tension shift + total sensations)"
                // Sadistic dom (dislikes target) -> enjoys causing discomfort + high tension.
                // Benevolent dom (likes target) -> enjoys causing pleasure + high tension.
                const impact = targetPleasure + targetDiscomfort + (Math.abs(tensionShift) / 10);
                const dominantDrive = Math.max(0, actorDominance);
                const dominantReward = dominantDrive * (actorSympathy > 0 ? (targetPleasure + impact * 0.3) : (targetDiscomfort + impact * 0.3));
                
                // Blend internal drives (adding a tiny +0.05 so acting is slightly better than doing nothing)
                const actorReward = (empathyReward * 0.4) + (submissionReward * 0.3) + (dominantReward * 0.3) + 0.05;
                
                const actorPlasticity = (actorSubject.plasticity ?? 50) / 100;
                const actorDelta = Math.sign(actorReward) * Math.min(1, Math.abs(actorReward)) * 0.5 * actorPlasticity;
                
                if (presetId) subjectPreferencesRepo.adjust(actorSubject.id!, 'actions', presetId, actorDelta);
                if (pointId) subjectPreferencesRepo.adjust(actorSubject.id!, 'points', pointId, actorDelta);
                
                const actorActive = activeContextsRepo.getAllForSubject(actorSubject.id!) || [];
                for (const ctx of actorActive) {
                    if (ctx?.actionId) subjectPreferencesRepo.adjust(actorSubject.id!, 'contexts', ctx.actionId, actorDelta * 0.6);
                }
            }
        }

    } catch (err) {
        // don't fail the save if prefs adjustment fails
        console.warn('[saveTickState] preference adjustment failed', (err as Error).message);
    }
}
