import { characterRepo, presetRepo, characterRelationRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { presentCommand } from '../narrative/commandPresentation';
import type { CompiledAction, GameEvent, TickBundle, TickOutput } from '../domain/types';
import type { TickEffect } from './tickEffectPlan';

export interface BuildTickResponseInput {
    tickId: string;
    payload: {
        subjectId: string;
        playerId: string;
        sceneId: string;
        pointId: string;
        presetId: string;
        playerIntensity?: number;
        eventType?: string;
        textMessage?: string;
        dynamicModifiers?: unknown;
        customPayload?: Record<string, unknown> | null;
    };
    activeSceneId: string;
    compiledAction: CompiledAction;
    output: TickOutput;
    stateBefore: { core: any; point: any };
    diagnostics: any;
    prompt: TickBundle['prompt'];
    scenarioResult: any;
    initiatorId: string;
    state: { core: any; relation?: any };
    relationalDynamics: any;
    actionApplied: boolean;
    addedContextNotes: string[];
    commandActionPreset?: any;
    commandIntent?: any;
    tickEffects: TickEffect[];
}

export interface BuildTickResponseResult {
    event: GameEvent;
    actionTrace: Array<{ label: string; values: any }>;
    commandPresentation?: any;
    pendingCommandEffect?: TickEffect;
    response: {
        tickId: string;
        event: GameEvent;
        compiledAction: CompiledAction;
        output: TickOutput;
        stateBefore: { core: any; point: any };
        stateAfter: { core: any; point: any };
        diagnostics: any;
        prompt: TickBundle['prompt'];
        scenario: any;
        metadata: Record<string, any>;
        actionApplied: boolean;
        systemNotes: string[];
    };
}

/**
 * Stage: build the tick response object and its side projections (event,
 * action trace, command presentation, pending-command effect). Pure — no
 * database writes. The returned `pendingCommandEffect` is pushed by the
 * caller into the effect plan.
 */
export interface BuildPendingCommandEffectInput {
    payload: {
        subjectId: string;
        playerId: string;
        sceneId: string;
        textMessage?: string;
        dynamicModifiers?: unknown;
    };
    actionApplied: boolean;
    addedContextNotes: string[];
}

/**
 * Pure: computes the pending-command effect (clear on success, save on a
 * willingness refusal). Depends only on the command intent, whether it was
 * applied, and the refusal notes — all known before the tick commit. This
 * must run BEFORE the commit so the effect is part of the same transaction.
 */
export function buildPendingCommandEffect(input: BuildPendingCommandEffectInput): TickEffect | undefined {
    const { payload, actionApplied, addedContextNotes } = input;
    const dynamicModifiers = payload.dynamicModifiers as any;
    const finalCommandIntent = dynamicModifiers?.commandIntent;
    if (!finalCommandIntent?.type || finalCommandIntent.type === 'none') return undefined;
    const refusalWasAboutWillingness = addedContextNotes.some(note =>
        /отклоняет|недостаточ|не выполняет указание|подчинение .*требуется/i.test(note),
    );
    if (actionApplied || !refusalWasAboutWillingness) {
        return { kind: 'pending-command.clear', subjectId: payload.subjectId, playerId: payload.playerId };
    }
    return {
        kind: 'pending-command.save',
        focus: {
            subjectId: payload.subjectId,
            playerId: payload.playerId,
            sceneId: payload.sceneId,
            sourceText: dynamicModifiers.pendingCommandSourceText || dynamicModifiers.commandSourceText || payload.textMessage || '',
            description: dynamicModifiers.pendingCommandDescription || dynamicModifiers.commandDescription || payload.textMessage || 'невыполненное поручение',
            intent: finalCommandIntent,
            routing: dynamicModifiers.routing,
        },
    };
}

export function buildTickResponse(input: BuildTickResponseInput): BuildTickResponseResult {
    const { payload, activeSceneId, compiledAction, output, stateBefore, diagnostics, prompt, scenarioResult, initiatorId, state, relationalDynamics, actionApplied, addedContextNotes, commandActionPreset, commandIntent, tickEffects } = input;

    const event: GameEvent = {
        id: input.tickId,
        type: (payload.eventType || (payload.textMessage ? 'verbal_input' : 'ui_action')) as GameEvent['type'],
        subjectId: payload.subjectId,
        playerId: payload.playerId,
        sceneId: activeSceneId,
        pointId: payload.pointId,
        timestamp: new Date().toISOString(),
        payload: {
            presetId: payload.presetId,
            playerIntensity: payload.playerIntensity,
            dynamicModifiers: payload.dynamicModifiers,
            ...payload.customPayload
        }
    };

    const actionTrace = [
        { label: 'State before (core)', values: stateBefore.core },
        { label: 'State before (point)', values: stateBefore.point },
        { label: 'Compiled action', values: compiledAction },
        {
            label: 'Engine result',
            values: {
                delta: output.delta?.core,
                result: output.result
            }
        },
        { label: 'State after (core)', values: output.nextCore },
        { label: 'State after (point)', values: output.nextPoint }
    ];

    const finalCommandIntent = payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent;
    const commandPresentation = finalCommandIntent?.type && finalCommandIntent.type !== 'none'
        ? (() => {
            const targetId = finalCommandIntent.targetId && finalCommandIntent.targetId !== payload.subjectId
                ? String(finalCommandIntent.targetId)
                : undefined;
            const targetName = targetId
                ? characterRepo.get(targetId)?.name || targetId
                : undefined;
            const actionLabel = commandActionPreset?.label
                || (finalCommandIntent.actionId ? presetRepo.getActionPreset(finalCommandIntent.actionId)?.label : undefined)
                || finalCommandIntent.targetPoseId
                || finalCommandIntent.targetContextId
                || finalCommandIntent.targetLocation
                || 'указанное действие';
            const presence = sceneCharacterRepo.list(payload.sceneId).find(entry =>
                entry.character.id === payload.subjectId || entry.character.subjectId === payload.subjectId,
            );
            return presentCommand({
                performed: actionApplied,
                executorId: payload.subjectId,
                executorName: characterRepo.get(payload.subjectId)?.name || payload.subjectId,
                targetId,
                targetName,
                actionLabel,
                requesterName: characterRepo.get(initiatorId)?.name || (initiatorId === 'PL-1' ? 'Калибратор' : initiatorId),
                relationToRequester: state.relation,
                relationToTarget: targetId ? characterRelationRepo.get(payload.subjectId, targetId) : null,
                dynamics: relationalDynamics,
                core: state.core,
                role: presence?.role,
            });
        })()
        : undefined;

    let pendingCommandEffect: TickEffect | undefined = buildPendingCommandEffect({ payload, actionApplied, addedContextNotes });

    const response = {
        tickId: input.tickId,
        event,
        compiledAction,
        output,
        stateBefore,
        stateAfter: {
            core: output.nextCore,
            point: output.nextPoint
        },
        diagnostics,
        prompt,
        scenario: scenarioResult,
        metadata: {
            commandIntent: payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent,
            resumedPendingCommand: Boolean(payload.dynamicModifiers && (payload.dynamicModifiers as any).resumedPendingCommand),
            pendingCommandDescription: payload.dynamicModifiers && (payload.dynamicModifiers as any).pendingCommandDescription,
            commandPresentation,
        },
        actionApplied,
        systemNotes: addedContextNotes,
    };

    return { event, actionTrace, commandPresentation, pendingCommandEffect, response };
}
