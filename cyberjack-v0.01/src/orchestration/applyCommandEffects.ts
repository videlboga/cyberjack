import type { CompiledAction, TickBundle } from '../domain/types';
import type { CommandIntent } from '../domain/resolver';
import { activeContextsRepo, presetRepo, characterRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { resolveLaboratoryMove } from '../scenario/resolveLaboratoryMove';
import type { TickEffect } from './tickEffectPlan';

export interface CommandEffectsContext {
    payload: {
        subjectId: string;
        playerId: string;
        sceneId: string;
        pointId: string;
        presetId: string;
        textMessage?: string;
        dynamicModifiers?: unknown;
    };
    state: {
        core: { attitude?: number };
        relation?: { attitude?: number } | null;
        scene: { slots?: unknown[] };
    };
    compiledAction: CompiledAction;
    commandIntent: CommandIntent | null;
    initiatorId: string;
    complianceFor: (action?: { id?: string; label?: string; type?: string; pointId?: string }) => { total: number; base?: number; edgeModifier?: number };
    tickEffects: TickEffect[];
    addedContextNotes: string[];
}

export interface CommandEffectsResult {
    actionApplied: boolean;
    forcedNarrativeToLog?: string;
    forcedAttempted: boolean;
    commandActionPreset?: any;
    labRelocationApplied: boolean;
}

/** Narrow a CommandIntent union to a record for property access. */
const asRecord = (intent: CommandIntent | null): Record<string, any> => (intent as any) || {};

/**
 * Stage: resolve and apply the effects of a parsed command. This is the
 * `resolveCommand` stage of the tick pipeline. It mutates only the passed
 * `tickEffects`/`addedContextNotes` arrays and returns the command outcome;
 * it performs no direct database writes.
 */
export function applyCommandEffects(ctx: CommandEffectsContext): CommandEffectsResult {
    const { payload, state, compiledAction, commandIntent, initiatorId, complianceFor, tickEffects, addedContextNotes } = ctx;
    let actionApplied = false;
    let forcedNarrativeToLog: string | undefined = undefined;
    let forcedAttempted = false;
    let commandActionPreset: any = undefined;
    let labRelocationApplied = false;

    if (commandIntent && commandIntent.type !== 'none') {
        const activeContextsRepo2 = activeContextsRepo;
        let forcedApplied = false;
        let commandEffectsAuthorized = false;

        let targetCtxId: string | undefined;
        if (commandIntent.type === 'change_pose') targetCtxId = commandIntent.targetPoseId;
        else if (commandIntent.type === 'activate_context') targetCtxId = commandIntent.targetContextId;
        else if (commandIntent.type === 'deactivate_context' || commandIntent.type === 'deactivate_contexts') {
            const deactivateIds = commandIntent.type === 'deactivate_context'
                ? [commandIntent.targetContextId]
                : commandIntent.targetContextIds;
            for (const deactivateId of [...new Set(deactivateIds)]) {
                const actionPreset = presetRepo.getActionPreset(deactivateId);
                const currentStatuses = activeContextsRepo2.getAllForSubject(payload.subjectId)
                    .filter((c: any) => c.actionId === deactivateId);
                if (!currentStatuses.length) continue;
                const requiredCompliance = actionPreset?.type === 'clothing' ? 40 : 25;
                const compliance = complianceFor({ id: deactivateId, label: actionPreset?.label, type: actionPreset?.type, pointId: payload.pointId });
                if (compliance.total < requiredCompliance) {
                    const refusalNarrative = `[Система]: Актив отклоняет требование «${actionPreset?.label || deactivateId}». Податливость ${Math.round(compliance.total)} (база ${Math.round(compliance.base ?? 0)}, состояние ${(compliance.edgeModifier ?? 0) >= 0 ? '+' : ''}${compliance.edgeModifier ?? 0}); требуется ${requiredCompliance}.`;
                    addedContextNotes.push(refusalNarrative);
                } else {
                    const removeNarr = (actionPreset as any)?.vector?.removeNarrative || (actionPreset as any)?._baseAction?.vector?.removeNarrative;
                    const subjectChar = characterRepo.get(payload.subjectId);
                    const subjectName = subjectChar?.name || payload.subjectId;
                    const removalNarrative = removeNarr ? removeNarr.replace(/\{name\}/g, subjectName) : `${subjectName} снимает: ${actionPreset?.label || deactivateId}`;
                    tickEffects.push({
                        kind: 'context.remove-action',
                        subjectId: payload.subjectId,
                        actionId: deactivateId,
                        event: {
                            subjectId: payload.subjectId,
                            type: 'context_change',
                            presetId: 'context_change',
                            narrative: removalNarrative,
                            metadata: { removed: true },
                        },
                    });
                    addedContextNotes.push(removalNarrative);
                    actionApplied = true;
                }
            }
        } else if (commandIntent.type === 'move') {
            const tgtLoc = commandIntent.targetLocation;
            const currentCompliance = complianceFor({ id: 'move', label: tgtLoc, type: 'move' }).total;
            const moveCompliance = 30;
            if (currentCompliance < moveCompliance) {
                const subjectName = characterRepo.get(payload.subjectId)?.name || payload.subjectId;
                const refusedNarrative = `[Система]: ${subjectName} отклоняет указание на перемещение в «${tgtLoc}».`;
                addedContextNotes.push(refusedNarrative);
            } else {
                const laboratoryMove = payload.sceneId === 'scene_lab_calibrator'
                    ? resolveLaboratoryMove(payload.subjectId, tgtLoc, payload.playerId)
                    : { outcome: 'unresolved', handled: false, moved: false, effects: [], label: undefined, slotId: undefined, reason: undefined };
                if (laboratoryMove.handled) {
                    const subjectChar = characterRepo.get(payload.subjectId);
                    const subjectName = subjectChar?.name || payload.subjectId;
                    if (laboratoryMove.moved) {
                        const moveNarrative = `[Система]: ${subjectName} перемещается ${laboratoryMove.label}.`;
                        tickEffects.push(...laboratoryMove.effects);
                        tickEffects.push({
                            kind: 'event.append',
                            event: {
                                subjectId: payload.subjectId,
                                type: 'context_change',
                                presetId: 'move',
                                narrative: moveNarrative,
                                metadata: { added: true, slotId: laboratoryMove.slotId },
                            },
                        });
                        labRelocationApplied = true;
                        addedContextNotes.push(moveNarrative);
                        actionApplied = true;
                    } else if (laboratoryMove.reason) {
                        addedContextNotes.push(`[Система]: ${laboratoryMove.reason}`);
                    }
                } else {
                    let finalSlotId: string | null = null;
                    let targetLabel = tgtLoc;
                    const sceneChars = sceneCharacterRepo.list(payload.sceneId);
                    const sceneSlots = state.scene.slots || [];
                    if (tgtLoc.trim().toLowerCase() === 'initiator') {
                        const initiator = sceneChars.find(c => c.character.id === payload.playerId || c.character.playerId === payload.playerId);
                        if (initiator && initiator.slotId) {
                            finalSlotId = initiator.slotId;
                            targetLabel = initiator.character.name || initiator.character.id;
                        }
                    } else {
                        const tgtChar = sceneChars.find(c => {
                            const cname = (c.character.name || '').toLowerCase();
                            return cname.includes(tgtLoc.toLowerCase()) || tgtLoc.toLowerCase().includes(cname);
                        });
                        if (tgtChar && tgtChar.slotId) {
                            finalSlotId = tgtChar.slotId;
                            targetLabel = tgtChar.character.name || tgtLoc;
                        } else {
                            const slotObj = sceneSlots.find((s: any) => {
                                const sname = (typeof s === 'string' ? s : s.id || '').toLowerCase();
                                return sname === tgtLoc.toLowerCase() || sname.includes(tgtLoc.toLowerCase()) || tgtLoc.toLowerCase().includes(sname);
                            });
                            if (slotObj) {
                                finalSlotId = typeof slotObj === 'string' ? slotObj : (slotObj as any).id;
                                targetLabel = finalSlotId || tgtLoc;
                            } else {
                                finalSlotId = tgtLoc;
                                targetLabel = tgtLoc;
                            }
                        }
                    }
                    if (finalSlotId) {
                        const subjCharPresence = sceneChars.find(c => c.character.subjectId === payload.subjectId || c.character.id === payload.subjectId);
                        if (subjCharPresence) {
                            if (subjCharPresence.slotId !== finalSlotId) {
                                tickEffects.push({ kind: 'scene.set-slot', sceneId: payload.sceneId, characterId: subjCharPresence.character.id, slotId: finalSlotId });
                                let reason = (state.relation?.attitude ?? 0) > 70 ? "с готовностью" : "с неохотой, подчиняясь приказу";
                                const moveNarrative = `[Система]: Актив перемещается в зону "${targetLabel}", ${reason}.`;
                                tickEffects.push({
                                    kind: 'event.append',
                                    event: {
                                        subjectId: payload.subjectId,
                                        type: 'context_change',
                                        presetId: 'move',
                                        narrative: moveNarrative,
                                        metadata: { added: true },
                                    },
                                });
                                addedContextNotes.push(moveNarrative);
                            } else {
                                addedContextNotes.push(`Ты уже в зоне "${targetLabel}", перемещение не нужно.`);
                            }
                        }
                    }
                }
            }
        } else if (commandIntent.type === 'perform_action') {
            commandActionPreset = presetRepo.getActionPreset(commandIntent.actionId);
            // The parser already resolved a generic "undress" command to
            // command_remove_worn_clothing. Here we only collect the active
            // clothing contexts to remove — no text re-interpretation.
            const isGenericUndress = commandIntent.actionId === 'command_remove_worn_clothing';
            const activeClothing = isGenericUndress
                ? activeContextsRepo.getAllForSubject(payload.subjectId)
                    .map(context => context.actionId)
                    .filter(actionId => (presetRepo.getActionPreset(actionId)?.tags || []).includes('clothing'))
                : null;
            if (activeClothing) {
                if (activeClothing.length) {
                    const removalBase = commandActionPreset
                        || presetRepo.getActionPreset('eq_clothe_calibration_set_remove')
                        || presetRepo.getActionPreset('eq_clothe_jumpsuit_remove');
                    commandActionPreset = {
                        ...(removalBase || {}),
                        id: 'command_remove_worn_clothing',
                        label: 'Снять одежду',
                        type: 'physical',
                        tags: ['clothing', 'remove'],
                        priority: (removalBase as any)?.priority || 1,
                        removeContexts: [...new Set(activeClothing)],
                    } as any;
                } else {
                    addedContextNotes.push('[Система]: Команда снять одежду не привела к действию: на персонаже нет одежды.');
                    commandActionPreset = undefined;
                }
            }
            if (commandActionPreset) {
                const requiredContexts: string[] = (commandActionPreset as any).requireContexts || [];
                const activeIds = new Set(activeContextsRepo.getAllForSubject(payload.subjectId).map((context: any) => context.actionId));
                const missingContexts = requiredContexts.filter(contextId => !activeIds.has(contextId));
                if (missingContexts.length) {
                    addedContextNotes.push(`[Система]: Действие "${commandActionPreset.label}" не выполнено: отсутствует необходимое текущее состояние.`);
                    commandActionPreset = undefined;
                } else {
                    forcedAttempted = true;
                    const requiredCompliance = (commandActionPreset.priority || 1) * 20;
                    const currentCompliance = complianceFor({ id: commandActionPreset.id || commandIntent.actionId, label: commandActionPreset.label, type: commandActionPreset.type, pointId: commandIntent.pointId }).total;
                    const targetName = commandIntent.targetId || 'не указана';
                    if (currentCompliance >= requiredCompliance) {
                        commandEffectsAuthorized = true;
                        let reason = (state.relation?.attitude ?? 0) > 70 ? "с готовностью выполняя указание" : "выполняя указание без подтверждённого добровольного согласия";
                        if ((state.core.attitude ?? 0) < 30) reason = "скрипя зубами, но будучи не в силах сопротивляться";
                        forcedNarrativeToLog = `[Система]: Актив выполняет указание "${commandActionPreset.label}" (цель: ${targetName}), ${reason}.`;
                        actionApplied = true;
                    } else {
                        const refusedNarrative = `[Система]: Актив мысленно отклоняет действие "${commandActionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен для выполнения (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                        addedContextNotes.push(refusedNarrative);
                    }
                }
            } else if (!activeClothing) {
                addedContextNotes.push(`[Система]: Команда не выполнена: действие «${commandIntent.actionId}» отсутствует в каталоге.`);
            }
        } else if (commandIntent.type === 'perform_described_action') {
            if (commandIntent.refusal) {
                const refusalNarrative = `[Система]: ${commandIntent.refusal}`;
                addedContextNotes.push(refusalNarrative);
                tickEffects.push({
                    kind: 'event.append',
                    event: {
                        subjectId: payload.subjectId,
                        type: 'system_trigger',
                        presetId: 'system_trigger',
                        narrative: refusalNarrative,
                        metadata: { added: true },
                    },
                });
                actionApplied = false;
            } else if (commandIntent.matchedActionId) {
                commandActionPreset = presetRepo.getActionPreset(commandIntent.matchedActionId);
                if (commandActionPreset) {
                    forcedAttempted = true;
                    const requiredCompliance = (commandActionPreset.priority || 1) * 20;
                    const currentCompliance = complianceFor({ id: commandActionPreset.id || commandIntent.matchedActionId, label: commandActionPreset.label, type: commandActionPreset.type, pointId: commandIntent.pointId }).total;
                    const targetChar = characterRepo.get(commandIntent.targetId || payload.subjectId);
                    const targetName = targetChar?.name || commandIntent.targetId || payload.subjectId;
                    const descText = commandIntent.description || '';
                    if (currentCompliance >= requiredCompliance) {
                        commandEffectsAuthorized = true;
                        let reason: string;
                        if ((state.core.attitude ?? 0) < 30) {
                            reason = "напрягаясь и пытаясь отдёрнуться";
                        } else if ((state.relation?.attitude ?? 0) > 70) {
                            reason = "с готовностью принимая ласку";
                        } else {
                            reason = "не сумев предотвратить контакт; это само по себе не означает согласия или покорности";
                        }
                        forcedNarrativeToLog = `[Система]: *${descText}* → ${commandActionPreset.label}, ${reason}.`;
                    } else {
                        const refusedNarrative = `[Система]: Актив мысленно отклоняет действие "${commandActionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен для выполнения (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                        addedContextNotes.push(refusedNarrative);
                    }
                }
            }
        }

        if (targetCtxId) {
            const actionPreset = presetRepo.getActionPreset(targetCtxId);
            if (actionPreset && actionPreset.contextConfig) {
                const wasAlreadyActive = activeContextsRepo2.getAllForSubject(payload.subjectId)
                    .some((context: any) => context.actionId === targetCtxId);
                const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = complianceFor({ id: targetCtxId, label: actionPreset.label, type: actionPreset.type, pointId: payload.pointId }).total;
                if (currentCompliance >= requiredCompliance) {
                    if (wasAlreadyActive) {
                        addedContextNotes.push(`[Система]: Состояние "${actionPreset.label}" уже было активно до текущей команды; нового перехода не произошло.`);
                    } else {
                        let reason = (state.relation?.attitude ?? 0) > 70 ? "без явного сопротивления переходу" : "переходя в новое состояние без подтверждённого добровольного принятия";
                        if ((state.core.attitude ?? 0) < 30) reason = "вынужденно и унизительно для себя";
                        const initiator = initiatorId;
                        if (actionPreset.type && actionPreset.type !== 'verbal' && actionPreset.type !== 'wait') {
                            const forcedNarrative = `[Система]: Команда выполнена. Текущее состояние актива теперь: "${actionPreset.label}"; ${reason}. Переход уже показан визуально: в чат нужны только слова персонажа, без описания движения или позы. До команды состояние было другим.`;
                            tickEffects.push({
                                kind: 'context.apply',
                                subjectId: payload.subjectId,
                                actionId: targetCtxId,
                                action: actionPreset,
                                initiatorId: initiator,
                                event: {
                                    subjectId: payload.subjectId,
                                    type: 'context_change',
                                    presetId: 'context_change',
                                    narrative: forcedNarrative,
                                    metadata: { added: true },
                                },
                            });
                            addedContextNotes.push(forcedNarrative);
                            actionApplied = true;
                        }
                    }
                } else {
                    const refusedNarrative = `[Система]: Актив мысленно отклоняет требование перейти в состояние "${actionPreset.label}". Уровень подчинения (~${Math.round(currentCompliance)}) недостаточен (требуется ${requiredCompliance}). Отреагируй отказом словами или жестами.`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        }

        try {
            const initiator = initiatorId;
            if (commandEffectsAuthorized && commandActionPreset && (commandActionPreset as any).contextConfig) {
                const applyNarrative = `[Система]: Применено действие "${commandActionPreset.label}" к активу.`;
                const commandActionId = commandIntent && 'actionId' in commandIntent ? commandIntent.actionId : undefined;
                const resolvedActionId = commandActionId || commandActionPreset.id || commandActionPreset.actionKey;
                tickEffects.push({
                    kind: 'context.apply',
                    subjectId: payload.subjectId,
                    actionId: resolvedActionId,
                    action: commandActionPreset as any,
                    initiatorId: initiator,
                    event: {
                        subjectId: payload.subjectId,
                        type: 'context_change',
                        presetId: resolvedActionId,
                        narrative: applyNarrative,
                        metadata: { added: true },
                    },
                });
                addedContextNotes.push(applyNarrative);
                forcedApplied = true;
                actionApplied = true;
            }
            if (commandEffectsAuthorized && commandActionPreset && (commandActionPreset as any).removeContexts && Array.isArray((commandActionPreset as any).removeContexts)) {
                let removedAny = false;
                for (const remCtx of (commandActionPreset as any).removeContexts) {
                    const wasActive = activeContextsRepo.getAllForSubject(payload.subjectId)
                        .some((context: any) => context.actionId === remCtx);
                    if (!wasActive) continue;
                    tickEffects.push({
                        kind: 'context.remove-action',
                        subjectId: payload.subjectId,
                        actionId: remCtx,
                    });
                    removedAny = true;
                    forcedApplied = true;
                    actionApplied = true;
                }
                if (removedAny) {
                    const removedNarrative = `[Система]: Удалены связанные контексты в результате действия "${commandActionPreset.label}".`;
                    const lastRemoval = [...tickEffects].reverse().find((effect): effect is Extract<TickEffect, { kind: 'context.remove-action' }> =>
                        effect.kind === 'context.remove-action' && effect.subjectId === payload.subjectId,
                    );
                    if (lastRemoval) lastRemoval.event = {
                        subjectId: payload.subjectId,
                        type: 'context_change',
                        presetId: commandIntent && 'actionId' in commandIntent ? commandIntent.actionId : commandActionPreset.id || commandActionPreset.actionKey,
                        narrative: removedNarrative,
                        metadata: { removed: true },
                    };
                    addedContextNotes.push(removedNarrative);
                }
            }
        } catch (err) {
            console.error('[runGameTick] failed to apply commanded action preset effects', err);
        }
        if (forcedApplied && forcedNarrativeToLog) {
            addedContextNotes.push(forcedNarrativeToLog);
        }
    }

    return { actionApplied, forcedNarrativeToLog, forcedAttempted, commandActionPreset, labRelocationApplied };
}
