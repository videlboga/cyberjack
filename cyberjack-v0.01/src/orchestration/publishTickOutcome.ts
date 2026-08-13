import type { SubjectCoreState } from '../domain/types';
import { emitSubjectMetricChanges } from '../scenario/eventDirector';
import { recordSceneObservation } from '../services/sceneAwareness';
import { syncLaboratorySpatialRelations } from '../services/sceneRelations';

type SceneObservation = Parameters<typeof recordSceneObservation>[0];

export interface TickPublicationPlan {
    tickId: string;
    subjectId: string;
    before: SubjectCoreState;
    after: SubjectCoreState;
    sceneObservation?: SceneObservation;
    /** Recompute laboratory social reachability after a relocation commit. */
    syncLabSpatialRelations?: boolean;
}

/**
 * Publishes reactions to an already committed tick. These projections are
 * deliberately outside the state transaction: their failure cannot roll back
 * a completed player action or leave its primary state half-written.
 */
export function publishTickOutcome(plan: TickPublicationPlan) {
    try {
        emitSubjectMetricChanges({
            tickId: plan.tickId,
            subjectId: plan.subjectId,
            before: plan.before,
            after: plan.after,
        });
    } catch (error) {
        console.warn('[EventDirector] metric signal skipped:', error);
    }

    if (plan.sceneObservation) {
        try {
            recordSceneObservation(plan.sceneObservation);
        } catch (error) {
            console.warn('[SceneAwareness] observation recording failed:', error);
        }
    }

    if (plan.syncLabSpatialRelations) {
        try {
            syncLaboratorySpatialRelations();
        } catch (error) {
            console.warn('[SceneRelations] laboratory social sync failed:', error);
        }
    }
}
