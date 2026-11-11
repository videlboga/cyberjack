import { characterRepo, presetRepo } from '../infrastructure/repositories';
import type { CompiledAction, TickOutput } from '../domain/types';
import { recordSceneObservation } from '../services/sceneAwareness';

type SceneObservation = Parameters<typeof recordSceneObservation>[0];

export interface SceneObservationInput {
    observableAction: boolean;
    activeSceneId: string;
    playerId: string;
    actingCharacterId?: string;
    subjectId: string;
    pointId: string;
    presetId: string;
    actionApplied: boolean;
    compiledAction: CompiledAction;
    output: TickOutput;
    commandIntent?: unknown;
    customPayload?: { backgroundTime?: boolean } | null;
    textMessage?: string;
    worldMinute: number;
    hasTransitions: boolean;
}

/**
 * Stage: build the scene observation projection for a tick. Pure — produces
 * the observation object without writing to the database. Returns undefined
 * for non-observable actions (e.g. wait, silent background).
 */
export function buildSceneObservation(input: SceneObservationInput) {
    if (!input.observableAction) return undefined;
    const actorId = input.actingCharacterId || input.playerId || 'PL-1';
    const pointLabel = presetRepo.getPointPreset(input.pointId)?.label || input.pointId;
    const observedIntent = input.commandIntent as any;
    const observedOutcome = observedIntent?.type && observedIntent.type !== 'none' && input.actionApplied
        ? (() => {
            const executor = characterRepo.get(input.subjectId)?.name || input.subjectId;
            const target = observedIntent.targetId ? characterRepo.get(String(observedIntent.targetId))?.name || observedIntent.targetId : '';
            const label = observedIntent.actionId ? presetRepo.getActionPreset(String(observedIntent.actionId))?.label || observedIntent.actionId : 'указание';
            return `${executor} выполнила указание «${label}»${target ? ` для ${target}` : ''}`;
        })()
        : '';
    return {
        sceneId: input.activeSceneId,
        playerId: input.playerId,
        actorId,
        targetId: input.subjectId,
        actionId: input.compiledAction.actionKey || input.presetId,
        actionLabel: input.compiledAction.label || input.presetId,
        pointId: input.pointId,
        pointLabel,
        actionTags: input.compiledAction.tags || [],
        finalValence: input.output.result.finalValence,
        notable: input.hasTransitions,
        background: Boolean(input.customPayload?.backgroundTime),
        spokenText: String((input.compiledAction as any).source?.rawText || input.textMessage || '').trim(),
        outcomeText: observedOutcome,
        worldMinute: input.worldMinute,
    } as SceneObservation;
}
