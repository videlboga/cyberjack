import type { CompiledAction, DynamicModifiers } from '../domain/types';
import type { EdgeProfile } from '../domain/edgeState';
import { calculateSituationalCompliance } from '../domain/edgeState';
import { activeContextsRepo, presetRepo, subjectiveAssociationRepo } from '../infrastructure/repositories';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { compileAction } from '../compiler/compileAction';
import { intimateNarrationFor } from '../domain/intimateNarration';
import { conditioningTags, preferenceValenceModifier } from '../domain/conditioning';
import { memoryAppraisalModifier } from '../domain/memoryCorrection';
import { resolveInteractionActionCandidate } from '../domain/resolver';
import { actionConflictsWithStance, actionRespectsStance, boundaryAcknowledgementStrength, boundaryValencePenalty } from '../domain/interactionStance';
import { clamp } from '../engine/utils';
import { ContextManager } from './contextManager';
import type { TickEffect } from './tickEffectPlan';

export interface CompileTickActionInput {
    payload: {
        subjectId: string;
        pointId: string;
        presetId: string;
        sceneId: string;
        playerIntensity?: number;
        dynamicModifiers?: DynamicModifiers;
        textMessage?: string;
        parserVersion?: string;
        customPayload?: { sustainedSource?: string } | null;
        actingCharacterId?: string;
        playerId?: string;
    };
    state: {
        core: { preferences?: unknown; attitude?: number; plasticity?: number };
        point: { familiarity?: number };
        relation?: { attitude?: number } | null;
    };
    history: unknown[];
    edgeProfile: EdgeProfile;
    relationalDynamics: { learnedCompliance: number; resistance: number; dependency: number };
    initiatorId: string;
    tickEffects: TickEffect[];
    preTickContextNotes: string[];
}

export interface CompileTickActionResult {
    compiledAction: CompiledAction;
    commandIntent: any;
    commandResolutionError?: string;
    commandActionPreset?: any;
    activeStance: any;
    ignoredBoundary: boolean;
    respectedBoundary: boolean;
    stanceSoftenedBeforeTick: boolean;
    complianceFor: (action?: { id?: string; label?: string; type?: string; pointId?: string }) => { total: number; base?: number; edgeModifier?: number };
}

/**
 * Stage: compile the action vector and resolve the parsed command. Applies
 * conditioning/memory modifiers, resolves change_current_interaction into a
 * concrete perform_action, and evaluates the interaction stance. Mutates only
 * the passed `tickEffects`/`preTickContextNotes`; performs no DB writes.
 */
export function compileTickAction(input: CompileTickActionInput): CompileTickActionResult {
    const { payload, state, history, edgeProfile, relationalDynamics, initiatorId, tickEffects, preTickContextNotes } = input;

    const complianceFor = (action: { id?: string; label?: string; type?: string; pointId?: string } = {}) => {
        const compliance = calculateSituationalCompliance({
            attitude: state.relation?.attitude ?? state.core.attitude ?? 0,
            plasticity: state.core.plasticity || 0,
            profile: edgeProfile,
            action,
        });
        const contextIds = new Set(activeContextsRepo.getAllForSubject(payload.subjectId).map(context => context.actionId));
        const stateModifier = (contextIds.has('effect_suggestibility') ? 15 : 0) +
            (contextIds.has('effect_subspace') ? 10 : 0) +
            (contextIds.has('act_inject_truth_serum') ? 25 : 0);
        const learnedModifier = relationalDynamics.learnedCompliance * .35 - relationalDynamics.resistance * .25 + relationalDynamics.dependency * .1;
        return { ...compliance, stateModifier, learnedModifier, total: Math.max(0, Math.min(150, compliance.total + stateModifier + learnedModifier)) };
    };

    // 4. Compile Action Vector
    let allContexts = activeContextsRepo.getAllForSubject(payload.subjectId);
    if (allContexts.some(context => context.actionId === 'effect_apathy') &&
        !allContexts.some(context => context.actionId === 'pose_lying_down')) {
        const collapse = ContextManager.planAutonomousCollapse(payload.subjectId);
        if (collapse.effect) {
            tickEffects.push(collapse.effect);
            allContexts = [...allContexts, {
                id: 'planned_lying_down', actionId: 'pose_lying_down', pointId: 'global_pose',
                subjectId: payload.subjectId, actorId: payload.subjectId,
            } as any];
        }
        if (collapse.narrative) preTickContextNotes.push(collapse.narrative);
    }
    const applicableContexts = allContexts.filter(c => !c.pointId || c.pointId === payload.pointId);

    let compiledAction = compileAction({
        presetId: payload.presetId,
        eventId: payload.sceneId,
        playerIntensity: payload.playerIntensity,
        history: history,
        dynamicModifiers: payload.dynamicModifiers as Partial<CompiledAction>,
        sourceText: payload.textMessage,
        parserVersion: payload.parserVersion,
        activeContexts: applicableContexts,
        familiarity: state.point.familiarity ?? 0
    });
    const intimateNarration = intimateNarrationFor(
        payload.presetId,
        payload.pointId,
        payload.customPayload?.sustainedSource,
    );
    if (intimateNarration) {
        compiledAction = { ...compiledAction, ...intimateNarration };
    }

    // 4.5 Apply Virtual Contexts (Mental and Body point overloads)
    const baseAction = (compiledAction as any)._baseAction;
    (compiledAction as any)._baseAction = baseAction || compiledAction;
    const classifiedVerbalTags = Array.isArray((payload.dynamicModifiers as any)?.tags)
        ? (payload.dynamicModifiers as any).tags
        : null;
    compiledAction.tags = classifiedVerbalTags || conditioningTags(compiledAction.actionKey, compiledAction.tags || []);
    (compiledAction as any)._baseAction = {
        ...(compiledAction as any)._baseAction,
        tags: compiledAction.tags,
    };
    const mentionInfluence = payload.presetId === 'verbal_pressure' ? 0.25 : 1;
    const conditioningModifier = payload.presetId === 'wait'
        ? 0
        : preferenceValenceModifier(compiledAction.tags || [], state.core.preferences) * mentionInfluence;
    if (conditioningModifier !== 0) {
        compiledAction.valence = clamp(compiledAction.valence + conditioningModifier, -1, 1);
        (compiledAction as any).conditioningModifier = conditioningModifier;
        (compiledAction as any)._baseAction = {
            ...(compiledAction as any)._baseAction,
            valence: clamp(((compiledAction as any)._baseAction?.valence || 0) + conditioningModifier, -1, 1),
            conditioningModifier,
        };
    }
    const memoryAssociationSignal = payload.presetId === 'wait'
        ? 0
        : subjectiveAssociationRepo.scoreAction(payload.subjectId, payload.actingCharacterId || payload.playerId || payload.subjectId, compiledAction.tags || []);
    const memoryModifier = memoryAppraisalModifier(memoryAssociationSignal, payload.presetId === 'verbal_pressure');
    if (memoryModifier !== 0) {
        compiledAction.valence = clamp(compiledAction.valence + memoryModifier, -1, 1);
        (compiledAction as any).memoryAssociationModifier = memoryModifier;
        (compiledAction as any)._baseAction = { ...(compiledAction as any)._baseAction, valence: clamp(((compiledAction as any)._baseAction?.valence || 0) + memoryModifier, -1, 1), memoryAssociationModifier: memoryModifier };
    }

    const parsedCommandIntent = payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent;
    let commandIntent = parsedCommandIntent ? { ...parsedCommandIntent } : parsedCommandIntent;
    let commandResolutionError: string | undefined;
    if (commandIntent?.type === 'change_current_interaction') {
        const semanticCommand = commandIntent;
        const activeIds = new Set(activeContextsRepo.getAllForSubject(payload.subjectId).map((context: any) => context.actionId));
        {
            const resolved = resolveInteractionActionCandidate({
                presets: presetRepo.getAllActionPresets(),
                activeContextIds: Array.from(activeIds) as string[],
                goal: semanticCommand.goal,
                suggestedActionId: semanticCommand.suggestedActionId,
                pointId: semanticCommand.pointId
            });
            if (resolved) {
                commandIntent = {
                    type: 'perform_action',
                    actionId: resolved.id,
                    targetId: semanticCommand.targetId,
                    pointId: (resolved.validTargets || []).includes(semanticCommand.pointId) ? semanticCommand.pointId : 'systemic'
                };
            } else {
                commandResolutionError = `Нет применимого действия, которое позволяет ${semanticCommand.goal === 'stop' ? 'прекратить' : semanticCommand.goal === 'adjust' ? 'изменить' : 'начать'} текущее взаимодействие.`;
                commandIntent = { type: 'none' };
            }
        }
        if (payload.dynamicModifiers) {
            (payload.dynamicModifiers as any).commandIntent = commandIntent;
        }
    }
    let commandActionPreset: any = undefined;
    if (commandIntent && commandIntent.type && commandIntent.type !== 'none') {
        (compiledAction as any).commandIntent = commandIntent;
        if ((compiledAction as any)._baseAction) {
            ((compiledAction as any)._baseAction as any).commandIntent = commandIntent;
        }
    }

    if (commandIntent && ['change_pose', 'activate_context', 'deactivate_context', 'deactivate_contexts', 'move'].includes(commandIntent.type)) {
        compiledAction = { ...compiledAction, intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 };
        (compiledAction as any)._baseAction = { ...(compiledAction as any)._baseAction, intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 };
    }

    let activeStance = interactionStanceRepo.get(payload.subjectId, initiatorId);
    const nonContactTurn = Number(compiledAction.contact || 0) <= 0.05;
    const acknowledgementStrength = nonContactTurn
        ? boundaryAcknowledgementStrength(payload.textMessage || compiledAction.source?.rawText)
        : 0;
    let stanceSoftenedBeforeTick = false;
    if (activeStance && nonContactTurn) {
        const softenAmount = acknowledgementStrength > 0 ? acknowledgementStrength : .2;
        tickEffects.push({ kind: 'stance.soften', subjectId: payload.subjectId, actorId: initiatorId, amount: softenAmount });
        activeStance = { ...activeStance, intensity: Math.max(0, activeStance.intensity - softenAmount) };
        stanceSoftenedBeforeTick = true;
    }
    const ignoredBoundary = actionConflictsWithStance(activeStance, compiledAction, payload.pointId);
    const respectedBoundary = Boolean(activeStance && actionRespectsStance(compiledAction));
    if (ignoredBoundary && activeStance) {
        const penalty = boundaryValencePenalty(activeStance);
        compiledAction.valence = clamp(compiledAction.valence - penalty, -1, 1);
        compiledAction.tags = [...new Set([...(compiledAction.tags || []), 'boundary_ignored'])];
        (compiledAction as any).interactionStance = { request: activeStance.request, ignored: true, penalty };
        tickEffects.push({ kind: 'stance.record-ignored', subjectId: payload.subjectId, actorId: initiatorId });
        preTickContextNotes.push(`Активная граница персонажа проигнорирована: действие продолжает нежелательный контакт.`);
    } else if (respectedBoundary && !stanceSoftenedBeforeTick) {
        tickEffects.push({ kind: 'stance.soften', subjectId: payload.subjectId, actorId: initiatorId });
        (compiledAction as any).interactionStance = { request: activeStance!.request, respected: true };
    }

    return {
        compiledAction,
        commandIntent,
        commandResolutionError,
        commandActionPreset,
        activeStance,
        ignoredBoundary,
        respectedBoundary,
        stanceSoftenedBeforeTick,
        complianceFor,
    };
}
