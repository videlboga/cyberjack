// src/orchestration/saveTickState.ts
import { subjectRepo, pointStateRepo, eventLogRepo, characterRepo, characterRelationRepo } from '../infrastructure/repositories';
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
}
