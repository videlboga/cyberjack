// src/orchestration/saveTickState.ts
import { subjectRepo, pointStateRepo, eventLogRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, CompiledAction, TickOutput } from '../domain/types';
import { db } from '../infrastructure/db';

export function saveTickState(
    subjectId: string, 
    pointId: string, 
    presetId: string,
    action: CompiledAction, 
    output: TickOutput
) {
    // 1. Save new core state
    const currentSubject = subjectRepo.get(subjectId);
    subjectRepo.save(subjectId, currentSubject?.name || 'Unknown', output.nextCore);

    // 2. Save new point state
    pointStateRepo.save(subjectId, pointId, output.nextPoint);

    // Get formatting labels
    const actionPresetRow = db.prepare('SELECT label FROM action_presets WHERE id = ?').get(presetId) as any;
    const pointRow = db.prepare('SELECT label FROM point_presets WHERE id = ?').get(pointId) as any;

    const actionLabel = actionPresetRow ? actionPresetRow.label : presetId;
    const pointLabel = pointRow ? pointRow.label : pointId;

    // 3. Append event log
    eventLogRepo.append(
        subjectId, 
        'interaction', 
        { action, pointId, presetId, actionLabel, pointLabel },
        output.result
    );
}