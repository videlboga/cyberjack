// src/orchestration/saveTickState.ts
import { subjectRepo, pointStateRepo, eventLogRepo, characterRepo, characterRelationRepo } from '../infrastructure/repositories';
import { subjectPreferencesRepo, activeContextsRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, CompiledAction, TickOutput } from '../domain/types';
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
    tickId: string
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
        baselineAttitude: nextRelationBaseline
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
        { result: output.result, delta: output.delta }
    );

    // 4. Adjust preferences conservatively based on the tick result
    try {
        const result = output.result;
        // simple reward signal: pleasure minus discomfort plus small weight for attitude shift
        const reward = (result.pleasure || 0) - (result.discomfort || 0) + (result.attitudeShift || 0) * 0.2;
        
        // Target (Receiver) preference update
        const targetPlasticity = (output.nextCore?.plasticity ?? 50) / 100;
        const targetDelta = Math.sign(reward) * Math.min(1, Math.abs(reward)) * 0.5 * targetPlasticity;

        if (presetId) subjectPreferencesRepo.adjust(subjectId, 'actions', presetId, targetDelta);
        if (pointId) subjectPreferencesRepo.adjust(subjectId, 'points', pointId, targetDelta);

        const targetActive = activeContextsRepo.getAllForSubject(subjectId) || [];
        for (const ctx of targetActive) {
            if (ctx?.actionId) subjectPreferencesRepo.adjust(subjectId, 'contexts', ctx.actionId, targetDelta * 0.6);
        }

        // Actor (Initiator) preference update
        // Actor likes doing actions that yield positive results for the target, scaled by actor's plasticity
        const actorChar = characterRepo.get(playerId); // playerId is actually actorId in this context
        if (actorChar && actorChar.kind !== 'player' && actorChar.subjectId) { // Only update preferences for NPCs with a subjectId
            const actorSubject = subjectRepo.get(actorChar.subjectId);
            if (actorSubject) {
                const actorPlasticity = (actorSubject.plasticity ?? 50) / 100;
                // Actor's delta: slightly less than target's, based on the same reward signal
                const actorDelta = Math.sign(reward) * Math.min(1, Math.abs(reward)) * 0.3 * actorPlasticity;
                
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
