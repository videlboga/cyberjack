import { presetRepo, pointStateRepo } from '../infrastructure/repositories';
import { isPartnerPointAction, canPerformPartnerPointAction } from '../domain/intimatePartnerMechanics';
import * as checkActionAccess from '../scenario/checkActionAccess';
import { applyResourceCosts } from '../scenario/applyResourceCosts';
import { ContextManager } from './contextManager';
import type { ResourceState } from '../domain/types';

export interface ValidateTickRequestInput {
    subjectId: string;
    pointId: string;
    presetId: string;
    playerId: string;
    initiatorId: string;
    sceneId: string;
    resources: ResourceState;
    scene: unknown;
    dynamicModifiers?: unknown;
    customPayload?: { sustainedSource?: string } | null;
}

export interface ValidateTickRequestResult {
    resources: ResourceState;
}

/**
 * Stage: validate that a tick request is executable. Performs scenario
 * access, body-point block and resource-cost checks. Throws on a blocked
 * request; otherwise returns the resources after any applied costs.
 * Read-only for game state — it does not persist anything.
 */
export function validateTickRequest(input: ValidateTickRequestInput): ValidateTickRequestResult {
    const { subjectId, pointId, presetId, playerId, initiatorId } = input;

    const authoredPreset = presetRepo.getActionPreset(presetId);
    if (initiatorId !== subjectId && authoredPreset && isPartnerPointAction(presetId, authoredPreset.tags || [], pointId)) {
        const actorPointIds = pointStateRepo.getAllForSubject(initiatorId).map(point => point.pointId);
        if (!canPerformPartnerPointAction(actorPointIds, presetId, authoredPreset.tags || [], pointId)) {
            throw new Error('У исполнителя нет анатомической точки, необходимой для этого интимного действия');
        }
    }

    const validation = checkActionAccess.validateAction(
        presetId, input.scene as any, input.resources, subjectId, playerId, pointId
    );
    const internalSustainedPulse = [
        'sustained_vibration_pulse',
        'sustained_electro_pulse',
        'sustained_sexual_pulse',
    ].includes(presetId) && Boolean(input.customPayload?.sustainedSource);
    if (!validation.allowed && presetId !== 'wait' && !internalSustainedPulse) {
        throw new Error(validation.errorReason || `Action "${presetId}" blocked by scenario.`);
    }

    const blockCheck = ContextManager.isPointBlocked(subjectId, pointId);
    const parsedCommandType = (input.dynamicModifiers as any)?.commandIntent?.type;
    const nonContactSpeech = presetId === 'verbal_pressure'
        && Number((input.dynamicModifiers as any)?.contact || 0) <= 0
        && parsedCommandType !== 'perform_action';
    if (blockCheck.blocked && presetId !== 'wait' && !nonContactSpeech) {
        throw new Error(blockCheck.reason || `Точка "${pointId}" заблокирована.`);
    }

    let resources = input.resources;
    const actionCosts = ((input.scene as any)?.actionCosts as Record<string, Record<string, number>> | null | undefined)?.[presetId] || null;
    if (actionCosts && Object.keys(actionCosts).length) {
        try {
            resources = applyResourceCosts(resources, actionCosts);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to apply resource costs');
        }
    }

    return { resources };
}
