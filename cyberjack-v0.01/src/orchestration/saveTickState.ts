// src/orchestration/saveTickState.ts
import { subjectRepo, pointStateRepo, eventLogRepo, characterRepo, characterRelationRepo, presetRepo } from '../infrastructure/repositories';
import { subjectPreferencesRepo, activeContextsRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, CompiledAction, TickOutput, InteractionObservation } from '../domain/types';
import { db } from '../infrastructure/db';
import { DEFAULT_CONFIG } from '../engine/config';
import { dampTowardsBaseline, advanceBaseline } from '../engine/baselineUtils';
import { clamp } from '../engine/utils';
import { describeActionNarrative } from '../narrative/eventTemplates';
import {
    clothingConditioningTags,
    conditioningSignal,
    conditioningTags,
    contextConditioningTags,
    isLearnablePreferenceContext,
    LEARNABLE_PREFERENCE_TAGS,
} from '../domain/conditioning';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';

export function saveTickState(
    subjectId: string, 
    pointId: string, 
    actorId: string,
    presetId: string,
    action: CompiledAction, 
    output: TickOutput,
    tickId: string,
    observation?: InteractionObservation,
    eventMetadata?: Record<string, unknown>,
    learningScale: number = 1
) {
    const persistenceScale = clamp(Number(learningScale), 0, 1);
    // 1. Save new core state
    const currentSubject = subjectRepo.get(subjectId);
    const subjectName = currentSubject?.name || 'Unknown';
    subjectRepo.save(subjectId, subjectName, output.nextCore);
    characterRepo.ensureSubject(subjectId, subjectName);
    const actorCharacter = characterRepo.get(actorId) || characterRepo.ensureCharacter(actorId, actorId === 'PL-1' ? 'Калибратор' : actorId);
    const actorName = actorCharacter.name || 'Калибратор';
    const relationCfg = (DEFAULT_CONFIG.formulas.baseline?.relation) || {};
    const relation = characterRelationRepo.ensure(subjectId, actorCharacter.id, {
        attitude: output.nextCore.attitude,
        openness: currentSubject?.openness ?? output.nextCore.openness,
        plasticity: currentSubject?.plasticity ?? output.nextCore.plasticity,
        baselineAttitude: currentSubject?.baselineAttitude ?? output.nextCore.attitude
    });
    const relationBaseline = relation.baselineAttitude ?? relation.attitude;
    const boundary = observation?.reactionSnapshot?.boundary;
    const experiencedIntensity = Number(output.result.experiencedIntensity || 0);
    const relationalScale = Math.max(.15, Math.min(1.5, experiencedIntensity / 10));
    const boundarySignal = boundary?.ignored ? -2.5 : boundary?.respected ? .5 : 0;
    const relationalSignal = clamp(output.result.finalValence * relationalScale + boundarySignal, -4, 2) * persistenceScale;
    const proposedRelationAttitude = clamp(relation.attitude + relationalSignal, 0, 100);
    const dampedRelationAttitude = dampTowardsBaseline(proposedRelationAttitude, relationBaseline, {
        dampingBase: relationCfg.dampingBase,
        dampingDistanceScale: relationCfg.dampingDistanceScale,
        maxDamping: relationCfg.maxDamping
    });
    const relationDriver = {
        plasticity: relation.plasticity ?? output.nextCore.plasticity,
        openness: relation.openness ?? output.nextCore.openness,
        novelty: action.novelty ?? 0.5
    };
    const nextRelationBaseline = advanceBaseline(
        relationBaseline,
        dampedRelationAttitude,
        relationDriver,
        { baseRate: relationCfg.adaptBase, ...relationCfg }
    );
    characterRelationRepo.updateAttitude(subjectId, actorCharacter.id, dampedRelationAttitude, {
        baselineAttitude: nextRelationBaseline,
        openness: clamp((relation.openness ?? 0) + relationalSignal * .35, 0, 100),
        plasticity: relation.plasticity ?? output.nextCore.plasticity
    });
    characterRelationRepo.updateSocialStats(subjectId, actorCharacter.id, {
        familiarityDelta: Math.max(0.005, (action.novelty ?? 0.5) * 0.015)
    });
    const dynamics = relationshipDynamicsRepo.get(subjectId, actorCharacter.id);
    const ignored = Boolean(boundary?.ignored);
    const respected = Boolean(boundary?.respected);
    const lowReserve = Math.max(0, (45 - output.nextCore.capacity) / 45);
    const plasticity = Math.max(0, Math.min(1, output.nextCore.plasticity / 100));
    const activeIds = new Set(activeContextsRepo.getAllForSubject(subjectId).map(context => context.actionId));
    const constrained = [...activeIds].some(id =>
        /suspend|cuff|restraint|machine|collar|spread_eagle|hold_exposure/.test(id)
    );
    const lackOfControl = ignored ? 1 : constrained ? .55 : 0;
    const negativeAppraisal = Math.max(0, -Number(output.result.finalValence || 0));
    const repetition = Math.max(0, Math.min(1, Number(output.nextPoint?.exposureCount || 0) / 8));
    const resignationGain = negativeAppraisal * lackOfControl *
        (.45 + repetition * .9) * (.35 + plasticity * .65) * (.5 + dynamics.fear / 100);
    const neuroCalm = activeIds.has('capsule_infusion_neurostabilizer');
    const truthSerum = presetId === 'act_inject_truth_serum' || activeIds.has('act_inject_truth_serum');
    const distressState = [...activeIds].some(id => [
        'effect_panic', 'effect_sensory_overload', 'effect_freeze',
        'effect_apathy', 'effect_chronic_apathy',
    ].includes(id));
    const breakdown = output.notableEvent === 'breakdown';
    relationshipDynamicsRepo.change(subjectId, actorCharacter.id, {
        fear: ((ignored ? 1.2 + Math.max(0, -output.result.finalValence) * 1.8 : respected ? -1 : output.result.finalValence > .3 ? -.15 : 0) - (neuroCalm ? .35 : 0)) * persistenceScale,
        resistance: (ignored ? (output.nextCore.capacity > 40 ? .45 : -.35 - lowReserve * .45) : respected ? .25 : 0) * persistenceScale,
        learnedCompliance: (resignationGain +
            (ignored ? lowReserve * plasticity * (.35 + (boundary?.intensity || 0) * .45) : 0) +
            (truthSerum ? .7 : 0)) * persistenceScale,
        dissociation: ((ignored ? lowReserve * .3 + Math.max(0, output.result.overload) * .015 : respected ? -.2 : 0) + (truthSerum ? .2 : 0) - (neuroCalm ? .08 : 0)) * persistenceScale,
        dependency: (respected && dynamics.fear > 15 ? dynamics.fear / 100 * .18
            : output.result.finalValence > .4 && dynamics.fear > 20 ? output.result.pleasure * .012 : 0) * persistenceScale,
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
            delta: output.delta,
            ...eventMetadata
        },
        { result: output.result, delta: output.delta, observation }
    );

    // 4. Adjust preferences based on psychological and relationship factors
    try {
        const result = output.result;
        
        // --- TARGET (Receiver) Preference Update ---
        const targetRelation = characterRelationRepo.get(subjectId, actorId);
        const targetAttitude = targetRelation?.attitude ?? 50;
        const targetRelPlasticity = targetRelation?.plasticity ?? 50;
        const signal = conditioningSignal({
            pleasure: result.pleasure,
            discomfort: result.discomfort,
            overload: result.overload,
            finalValence: result.finalValence,
            attitudeShift: result.attitudeShift,
            learningEffect: result.learningEffect,
            engagement: result.engagement,
            corePlasticity: output.nextCore?.plasticity,
            relationAttitude: targetAttitude,
            relationPlasticity: targetRelPlasticity,
            learnedCompliance: dynamics.learnedCompliance + resignationGain,
            lackOfControl,
            distressState,
            breakdown,
        });
        const targetReward = signal.reward;
        const targetPlasticity = Math.max(0, Math.min(1, (output.nextCore?.plasticity ?? 50) / 100));
        const catalystMultiplier = activeContextsRepo.getAllForSubject(subjectId).some(context => context.actionId === 'capsule_infusion_plasticity') ? 1.75 : 1;
        const targetDelta = Math.sign(targetReward) * Math.min(1, Math.abs(targetReward)) * 0.5 * targetPlasticity * catalystMultiplier * persistenceScale;

        if (presetId) subjectPreferencesRepo.adjust(subjectId, 'actions', presetId, targetDelta);
        if (pointId) subjectPreferencesRepo.adjust(subjectId, 'points', pointId, targetDelta);

        const targetActive = activeContextsRepo.getAllForSubject(subjectId) || [];
        for (const ctx of targetActive) {
            if (ctx?.actionId && isLearnablePreferenceContext(ctx.actionId)) {
                subjectPreferencesRepo.adjust(subjectId, 'contexts', ctx.actionId, targetDelta * 0.6);
            }
        }

        // Semantic conditioning remains slower than learning one concrete
        // action, while accepted difficulty now accumulates at a visible pace.
        const preferences = subjectPreferencesRepo.get(subjectId);
        const directActionTags = conditioningTags(presetId, action.tags || []);
        for (const tag of directActionTags) {
            if (!LEARNABLE_PREFERENCE_TAGS.has(tag)) continue;
            const current = preferences.tags[tag] || 0;
            const saturation = Math.max(0.08, 1 - Math.abs(current) / 5);
            subjectPreferencesRepo.adjust(subjectId, 'tags', tag, signal.generalizedDelta * saturation * catalystMultiplier * persistenceScale);
        }

        // Ongoing embodied contexts participate in the same experience. Their
        // semantic tags learn more slowly than the immediate action, allowing
        // pleasant stimulation during painful restraint to condition both
        // restraint and pain without double-counting tags already on the action.
        const contextTags = presetId === 'wait' ? [] : contextConditioningTags(
                targetActive.map(ctx => {
                    const preset = presetRepo.getActionPreset(ctx.actionId);
                    return {
                        id: ctx.actionId,
                        type: preset?.contextConfig?.type || preset?.type,
                        tags: conditioningTags(ctx.actionId, preset?.tags || []),
                    };
                }),
                directActionTags,
            );
        for (const { tag, weight } of contextTags) {
            const current = preferences.tags[tag] || 0;
            const saturation = Math.max(0.08, 1 - Math.abs(current) / 5);
            subjectPreferencesRepo.adjust(subjectId, 'tags', tag, signal.generalizedDelta * saturation * weight);
        }
        const clothingTags = clothingConditioningTags({
            contextIds: targetActive.map(ctx => ctx.actionId),
            directTags: directActionTags,
            pointId,
            contact: Number(action.contact || 0),
        });
        for (const { tag, weight } of clothingTags) {
            const current = preferences.tags[tag] || 0;
            const saturation = Math.max(0.08, 1 - Math.abs(current) / 5);
            subjectPreferencesRepo.adjust(subjectId, 'tags', tag, signal.generalizedDelta * saturation * weight);
        }

        // --- ACTOR (Initiator) Preference Update ---
        // Actor evaluates the action based on their own relationship to the target (empathy, dominance/submission).
        const actorChar = characterRepo.get(actorId);
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
