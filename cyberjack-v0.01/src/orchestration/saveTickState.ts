// src/orchestration/saveTickState.ts
import { subjectRepo, pointStateRepo, eventLogRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, CompiledAction, TickOutput } from '../domain/types';

export function saveTickState(
    subjectId: string, 
    pointId: string, 
    action: CompiledAction, 
    output: TickOutput
) {
    // 1. Save new core state
    // We need to fetch the existing name to save it properly or just use a dummy for now 
    // In a real app we'd load the full entity, so we just pass "Unknown" if it's strictly required by schema.
    const currentSubject = subjectRepo.get(subjectId);
    subjectRepo.save(subjectId, currentSubject?.name || 'Unknown', output.nextCore);

    // 2. Save new point state
    pointStateRepo.save(subjectId, pointId, output.nextPoint);

    // 3. Append event log
    eventLogRepo.append(
        subjectId, 
        'interaction', 
        { action, pointId }, 
        output.result
    );
}
