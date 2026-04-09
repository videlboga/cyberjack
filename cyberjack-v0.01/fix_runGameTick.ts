import * as fs from 'fs';

const content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');

const updated = content.replace(
`    // 6. Save new state
    const tickId = randomUUID();

    // 6.0 Apply Context Overrides
    if (compiledAction.contextConfig) {
        ContextManager.applyContext(payload.subjectId, payload.presetId, compiledAction);
    }
    if (compiledAction.removeContexts) {
        for (const remCtx of compiledAction.removeContexts) {
            activeContextsRepo.removeByActionId(payload.subjectId, remCtx);
        }
    }`, 
`    // 6. Save new state
    const tickId = randomUUID();

    // 6.0 Apply Context Overrides (Parser Intention Hook)
    // Here we perform dynamic context modification dictated directly by the LLM classification,
    // intercepting and modifying the subject's conditions immediately.
    let addedContextNotes: string[] = [];
    if (commandIntent && commandIntent.type !== 'none') {
        const presetRepo = require('../infrastructure/repositories').presetRepo;
        const activeContextsRepo2 = require('../infrastructure/repositories').activeContextsRepo;
        const eventLogRepo = require('../infrastructure/repositories').eventLogRepo;

        let targetCtxId: string | undefined;
        if (commandIntent.type === 'change_pose') targetCtxId = commandIntent.targetPoseId;
        else if (commandIntent.type === 'activate_context') targetCtxId = commandIntent.targetContextId;
        else if (commandIntent.type === 'deactivate_context') {
            const deactivateId = commandIntent.targetContextId;
            const actionPreset = presetRepo.getActionPreset(deactivateId);
            const currentStatus = activeContextsRepo2.getAllForSubject(payload.subjectId).find((c: any) => c.actionId === deactivateId);
            if (currentStatus) {
                activeContextsRepo2.remove(currentStatus.id);
                const removalNarrative = \`Состояние отменено: \${actionPreset?.label || deactivateId}\`;
                eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                addedContextNotes.push(removalNarrative);
            }
        }

        if (targetCtxId) {
            const actionPreset = presetRepo.getActionPreset(targetCtxId);
            if (actionPreset && actionPreset.contextConfig) {
                const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = (engineOutput.nextCore.plasticity || 0) + (engineOutput.nextCore.openness || 0) * 0.5 + (engineOutput.nextCore.attitude || 0) * 0.5;
                
                if (currentCompliance >= requiredCompliance) {
                    ContextManager.applyContext(payload.subjectId, targetCtxId, actionPreset);
                    const forcedNarrative = \`Выполнено действие: \${actionPreset.label}. Примени это состояние.\`;
                    eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                    addedContextNotes.push(forcedNarrative);
                } else {
                    const refusedNarrative = \`[Система]: Актив мысленно ОТКАЗЫВАЕТСЯ выполнять команду ("\${actionPreset.label}"). Требуемый уровень подчинения: \${requiredCompliance}, но текущий всего ~\${Math.round(currentCompliance)}. Отреагируй отказом словами или жестами.\`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        }
    }

    // "Neutral pose" heuristic: If saying "встань", stand up.
    if (payload.textMessage) {
        const wantsNeutralPose = /\\b(встань|вставай|поднимись|поднимайся|на\\s+ноги|встаньте)\\b/.test(payload.textMessage.toLowerCase());
        if (wantsNeutralPose) {
            const presetRepo = require('../infrastructure/repositories').presetRepo;
            const activeContextsRepo2 = require('../infrastructure/repositories').activeContextsRepo;
            const eventLogRepo = require('../infrastructure/repositories').eventLogRepo;

            const currentContexts = activeContextsRepo2.getAllForSubject(payload.subjectId);
            const poseContexts = currentContexts
                .map((obj: any) => ({ ctx: obj, preset: presetRepo.getActionPreset(obj.actionId) }))
                .filter((item: any) => item.preset?.contextConfig?.occupiesPoints?.includes('global_pose'));

            if (poseContexts.length) {
                for (const { ctx, preset } of poseContexts) {
                    if (!preset?.id) continue;
                    const removalNarrative = \`Состояние отменено: \${preset.label}\`;
                    activeContextsRepo2.remove(ctx.id);
                    eventLogRepo.append(payload.subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                    addedContextNotes.push(removalNarrative);
                }
            } else {
                addedContextNotes.push('Ты уже стоишь, поэтому дополнительных изменений нет.');
            }
        }
    }

    if (compiledAction.contextConfig) {
        ContextManager.applyContext(payload.subjectId, payload.presetId, compiledAction);
    }
    if (compiledAction.removeContexts) {
        for (const remCtx of compiledAction.removeContexts) {
            activeContextsRepo.removeByActionId(payload.subjectId, remCtx);
        }
    }

    ContextManager.processTick(payload.subjectId); // Time passes
`);

fs.writeFileSync('src/orchestration/runGameTick.ts', updated);
