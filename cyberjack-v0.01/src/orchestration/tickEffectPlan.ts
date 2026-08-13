import type { CompiledAction, SubjectPointState } from '../domain/types';
import type { InteractionStance } from '../domain/interactionStance';
import type { PendingCommandFocus } from '../infrastructure/pendingCommandRepo';
import { activeContextsRepo, eventLogRepo, pointStateRepo, sceneCharacterRepo, stateTriggersRepo, subjectEdgeStateRepo } from '../infrastructure/repositories';
import { pendingCommandRepo } from '../infrastructure/pendingCommandRepo';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { clearCalibrationSetupContexts } from '../scenario/calibrationContextCleanup';
import { setLaboratoryPresence } from '../scenario/spatialContext';
import { handleBuyAssetAction } from '../scenario/buyAssetHandler';
import { ContextManager } from './contextManager';

export type TickEffect =
    | {
        kind: 'event.append';
        event: TickEffectEvent;
    }
    | {
        kind: 'context.apply';
        subjectId: string;
        actionId: string;
        action: CompiledAction;
        pointId?: string;
        initiatorId?: string | null;
        event?: TickEffectEvent;
    }
    | {
        kind: 'context.remove-action';
        subjectId: string;
        actionId: string;
        event?: TickEffectEvent;
    }
    | {
        kind: 'context.remove-id';
        contextId: string;
        event?: TickEffectEvent;
    }
    | {
        kind: 'scene.set-slot';
        sceneId: string;
        characterId: string;
        slotId: string;
        event?: TickEffectEvent;
    }
    | {
        kind: 'lab.set-presence';
        characterId: string;
        slotId: string;
        roomId: string;
        status: string;
        playerId?: string;
    }
    | {
        kind: 'lab.clear-setup-contexts';
        subjectId: string;
    }
    | {
        kind: 'stance.soften-all';
        subjectId: string;
        amount: number;
    }
    | {
        kind: 'stance.soften';
        subjectId: string;
        actorId: string;
        amount?: number;
    }
    | {
        kind: 'stance.record-ignored';
        subjectId: string;
        actorId: string;
    }
    | {
        kind: 'stance.save';
        stance: InteractionStance;
    }
    | {
        kind: 'point.save';
        subjectId: string;
        point: SubjectPointState;
    }
    | {
        kind: 'edge.clear';
        subjectId: string;
    }
    | {
        kind: 'edge.update';
        subjectId: string;
        state: {
            enteredAtMinute: number;
            cycles: number;
            valence: 'positive' | 'negative' | 'mixed';
            sourceActionId?: string;
            sourcePointId?: string;
        };
        worldMinute: number;
    }
    | {
        kind: 'pending-command.clear';
        subjectId: string;
        playerId: string;
    }
    | {
        kind: 'pending-command.save';
        focus: PendingCommandFocus;
    }
    | {
        kind: 'state-trigger.set';
        subjectId: string;
        triggerCode: string;
        ticks: number;
    }
    | {
        kind: 'context.age';
        subjectId: string;
        deltaTime: number;
        elapsedMinutes: number;
    }
    | {
        kind: 'market.buy-asset';
        playerId: string;
        brokerId: string;
        sceneId: string;
        assetId: string;
    };

export interface TickEffectEvent {
    subjectId: string;
    type: 'context_change' | 'system_trigger';
    presetId: string;
    narrative: string;
    metadata?: Record<string, unknown>;
}

export interface TickEffectExecution {
    applied: TickEffect[];
    skipped: TickEffect[];
}

function appendEffectEvent(event?: TickEffectEvent) {
    if (!event) return;
    eventLogRepo.append(event.subjectId, event.type, {
        presetId: event.presetId,
        action: null,
        actionLabel: event.narrative,
        narrative: event.narrative,
    }, event.metadata || {});
}

/** Executes an already-authorized effect plan. Must be called inside the tick transaction. */
export function executeTickEffectPlan(
    effects: readonly TickEffect[],
    options: { appendEvents?: boolean } = {},
): TickEffectExecution {
    const result: TickEffectExecution = { applied: [], skipped: [] };
    for (const effect of effects) {
        let applied = false;
        if (effect.kind === 'event.append') {
            applied = true;
        } else if (effect.kind === 'context.apply') {
            applied = ContextManager.applyContext(
                effect.subjectId,
                effect.actionId,
                effect.action,
                effect.pointId,
                effect.initiatorId,
            ).applied;
        } else if (effect.kind === 'context.remove-action') {
            applied = activeContextsRepo.getAllForSubject(effect.subjectId)
                .some(context => context.actionId === effect.actionId);
            if (applied) activeContextsRepo.removeByActionId(effect.subjectId, effect.actionId);
        } else if (effect.kind === 'context.remove-id') {
            activeContextsRepo.remove(effect.contextId);
            applied = true;
        } else if (effect.kind === 'scene.set-slot') {
            sceneCharacterRepo.set(effect.sceneId, effect.characterId, { slotId: effect.slotId });
            applied = true;
        } else if (effect.kind === 'lab.set-presence') {
            setLaboratoryPresence({
                characterId: effect.characterId,
                slotId: effect.slotId,
                roomId: effect.roomId,
                status: effect.status,
                playerId: effect.playerId,
            });
            applied = true;
        } else if (effect.kind === 'lab.clear-setup-contexts') {
            clearCalibrationSetupContexts(effect.subjectId);
            applied = true;
        } else if (effect.kind === 'stance.soften-all') {
            interactionStanceRepo.softenAll(effect.subjectId, effect.amount);
            applied = true;
        } else if (effect.kind === 'stance.soften') {
            interactionStanceRepo.soften(effect.subjectId, effect.actorId, effect.amount);
            applied = true;
        } else if (effect.kind === 'stance.record-ignored') {
            interactionStanceRepo.recordIgnored(effect.subjectId, effect.actorId);
            applied = true;
        } else if (effect.kind === 'stance.save') {
            interactionStanceRepo.save(effect.stance);
            applied = true;
        } else if (effect.kind === 'point.save') {
            pointStateRepo.save(effect.subjectId, effect.point.pointId, effect.point);
            applied = true;
        } else if (effect.kind === 'edge.clear') {
            subjectEdgeStateRepo.clear(effect.subjectId);
            applied = true;
        } else if (effect.kind === 'edge.update') {
            subjectEdgeStateRepo.update(effect.subjectId, effect.state, effect.worldMinute);
            applied = true;
        } else if (effect.kind === 'pending-command.clear') {
            pendingCommandRepo.clear(effect.subjectId, effect.playerId);
            applied = true;
        } else if (effect.kind === 'pending-command.save') {
            pendingCommandRepo.save(effect.focus);
            applied = true;
        } else if (effect.kind === 'state-trigger.set') {
            stateTriggersRepo.set(effect.subjectId, effect.triggerCode, effect.ticks);
            applied = true;
        } else if (effect.kind === 'context.age') {
            ContextManager.processTick(effect.subjectId, effect.deltaTime, effect.elapsedMinutes);
            applied = true;
        } else if (effect.kind === 'market.buy-asset') {
            handleBuyAssetAction(effect.playerId, effect.brokerId, effect.sceneId, effect.assetId);
            applied = true;
        }

        if (applied) {
            if (options.appendEvents !== false && effect.kind !== 'lab.set-presence'
                && effect.kind !== 'lab.clear-setup-contexts' && effect.kind !== 'stance.soften-all'
                && effect.kind !== 'stance.soften' && effect.kind !== 'stance.record-ignored'
                && effect.kind !== 'stance.save' && effect.kind !== 'point.save'
                && effect.kind !== 'edge.clear' && effect.kind !== 'edge.update'
                && effect.kind !== 'pending-command.clear' && effect.kind !== 'pending-command.save'
                && effect.kind !== 'state-trigger.set' && effect.kind !== 'context.age'
                && effect.kind !== 'market.buy-asset') {
                appendEffectEvent(effect.event);
            }
            result.applied.push(effect);
        } else {
            result.skipped.push(effect);
        }
    }
    return result;
}

/** Writes events for effects that have already succeeded in the same transaction. */
const NO_EVENT_KINDS = new Set([
    'lab.set-presence', 'lab.clear-setup-contexts', 'stance.soften-all',
    'stance.soften', 'stance.record-ignored', 'stance.save', 'point.save',
    'edge.clear', 'edge.update', 'pending-command.clear', 'pending-command.save',
    'state-trigger.set', 'context.age', 'market.buy-asset',
]);

export function appendTickEffectEvents(effects: readonly TickEffect[]) {
    for (const effect of effects) {
        if (NO_EVENT_KINDS.has(effect.kind)) continue;
        if (effect.kind !== 'event.append' && !('event' in effect)) continue;
        if ('event' in effect && effect.event) appendEffectEvent(effect.event);
    }
}
