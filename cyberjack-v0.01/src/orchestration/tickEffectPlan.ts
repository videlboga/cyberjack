import type { CompiledAction } from '../domain/types';
import { activeContextsRepo, eventLogRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { clearCalibrationSetupContexts } from '../scenario/calibrationContextCleanup';
import { setLaboratoryPresence } from '../scenario/spatialContext';
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
        }

        if (applied) {
            if (options.appendEvents !== false && effect.kind !== 'lab.set-presence'
                && effect.kind !== 'lab.clear-setup-contexts' && effect.kind !== 'stance.soften-all') {
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
export function appendTickEffectEvents(effects: readonly TickEffect[]) {
    for (const effect of effects) {
        if (effect.kind === 'lab.set-presence' || effect.kind === 'lab.clear-setup-contexts' || effect.kind === 'stance.soften-all') continue;
        appendEffectEvent(effect.event);
    }
}
