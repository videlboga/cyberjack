import type { CompiledAction, InteractionObservation, ResourceState, SubjectCoreState, TickOutput } from '../domain/types';
import { db } from '../infrastructure/db';
import {
    characterItemsRepo,
    eventLogRepo,
    itemRepo,
    pointStateRepo,
    presetRepo,
    resourceRepo,
    subjectRepo,
} from '../infrastructure/repositories';
import { isPartnerPointAction, intimateActorPoints, recordPartnerPointExperience } from '../domain/intimatePartnerMechanics';
import { saveTickState } from './saveTickState';
import { appendTickEffectEvents, executeTickEffectPlan, type TickEffect } from './tickEffectPlan';

export interface TickCommitPlan {
    tickId: string;
    subjectId: string;
    pointId: string;
    initiatorId: string;
    presetId: string;
    compiledAction: CompiledAction;
    output: TickOutput;
    observation: InteractionObservation;
    eventMetadata?: Record<string, unknown>;
    learningScale: number;
    stateBefore: { core: SubjectCoreState };
    resources: ResourceState;
    peakEvent?: { presetId: string; narrative: string } | null;
    commandEvent?: { attempted: boolean; applied: boolean; narrative?: string };
    effects?: readonly TickEffect[];
}

/** Commits the finalized tick and its directly-owned projections in one SQLite transaction. */
export function commitTickOutcome(plan: TickCommitPlan) {
    db.transaction(() => {
        const effectResult = executeTickEffectPlan(plan.effects || [], { appendEvents: false });
        saveTickState(
            plan.subjectId,
            plan.pointId,
            plan.initiatorId,
            plan.presetId,
            plan.compiledAction,
            plan.output,
            plan.tickId,
            plan.observation,
            plan.eventMetadata,
            plan.learningScale,
        );
        appendTickEffectEvents(effectResult.applied);

        if (plan.initiatorId !== plan.subjectId && isPartnerPointAction(plan.compiledAction.actionKey, plan.compiledAction.tags || [], plan.pointId)) {
            const actorPoints = pointStateRepo.getAllForSubject(plan.initiatorId).map(point => point.pointId);
            const usedActorPoint = intimateActorPoints(plan.compiledAction.actionKey, plan.compiledAction.tags || [])
                .find(point => actorPoints.includes(point));
            const valence = Number(plan.output.result.finalValence || 0);
            subjectRepo.updatePreferences(plan.initiatorId, preferences =>
                recordPartnerPointExperience(preferences, plan.subjectId, plan.pointId, valence));
            if (usedActorPoint) {
                subjectRepo.updatePreferences(plan.subjectId, preferences =>
                    recordPartnerPointExperience(preferences, plan.initiatorId, usedActorPoint, valence, .08));
            }
        }

        const requiredItemId = presetRepo.getActionPreset(plan.presetId)?.requiresItem;
        if (requiredItemId && itemRepo.get(requiredItemId)?.type === 'consumable') {
            const item = characterItemsRepo.get(plan.initiatorId, requiredItemId);
            if (item && item.charges > 0) {
                const charges = item.charges - 1;
                characterItemsRepo.save({ ...item, charges, state: charges === 0 ? 'consumed' : item.state });
            }
        }

        resourceRepo.save(plan.resources);
        if (plan.peakEvent) {
            eventLogRepo.append(plan.subjectId, 'system_tick', {
                presetId: plan.peakEvent.presetId, action: null,
                actionLabel: plan.peakEvent.narrative, narrative: plan.peakEvent.narrative,
            }, { added: true });
        }
        if (plan.commandEvent?.applied && plan.commandEvent.attempted && plan.commandEvent.narrative) {
            eventLogRepo.append(plan.subjectId, 'system_trigger', {
                presetId: 'system_trigger', action: null,
                actionLabel: plan.commandEvent.narrative, narrative: plan.commandEvent.narrative,
            }, { added: true });
        }
    })();
}
