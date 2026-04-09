import * as fs from 'fs';

const content = fs.readFileSync('src/api/controllers/tickController.ts', 'utf8');

// Remove the inline hook processing from tickController completely since runGameTick now handles it!
const blockToRemove = `
        const commandIntent = dynamicModifiers?.commandIntent;
        if (commandIntent && commandIntent.type !== 'none') {
            let targetCtxId: string | undefined;
            if (commandIntent.type === 'change_pose') targetCtxId = commandIntent.targetPoseId;
            else if (commandIntent.type === 'activate_context') targetCtxId = commandIntent.targetContextId;
            else if (commandIntent.type === 'deactivate_context') {
                const deactivateId = commandIntent.targetContextId;
                const actionPreset = presetRepo.getActionPreset(deactivateId);
                const currentStatus = activeContextsRepo.getAllForSubject(subjectId).find(c => c.actionId === deactivateId);
                if (currentStatus) {
                    activeContextsRepo.remove(currentStatus.id);
                    const removalNarrative = \`Состояние отменено: \${actionPreset?.label || deactivateId}\`;
                    eventLogRepo.append(subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                    promptDirty = true;
                    immediateNotes.push(removalNarrative);
                    suppressActionNarrative = !hasUserText;
                }
            }

            if (targetCtxId) {
                const actionPreset = presetRepo.getActionPreset(targetCtxId);
                if (actionPreset && actionPreset.contextConfig) {
                    const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                    const currentCompliance = (fullState.core.plasticity || 0) + (fullState.core.openness || 0) * 0.5 + (fullState.core.attitude || 0) * 0.5;
                    
                    if (currentCompliance >= requiredCompliance) {
                        ContextManager.applyContext(subjectId, targetCtxId, actionPreset);
                        const forcedNarrative = \`Выполнено действие: \${actionPreset.label}. Примени это состояние.\`;
                        eventLogRepo.append(subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                        promptDirty = true;
                        immediateNotes.push(forcedNarrative);
                        suppressActionNarrative = !hasUserText;
                    } else {
                        const refusedNarrative = \`[Система]: Актив мысленно ОТКАЗЫВАЕТСЯ выполнять команду ("\${actionPreset.label}"). Требуемый уровень подчинения: \${requiredCompliance}, но текущий всего ~\${Math.round(currentCompliance)}. Отреагируй отказом словами или жестами.\`;
                        promptDirty = true;
                        immediateNotes.push(refusedNarrative);
                        suppressActionNarrative = !hasUserText;
                    }
                }
            }
        }

        if (wantsNeutralPose) {
            const currentContexts = activeContextsRepo.getAllForSubject(subjectId);
            const poseContexts = currentContexts
                .map(obj => ({ ctx: obj, preset: presetRepo.getActionPreset(obj.actionId) }))
                .filter(item => item.preset?.contextConfig?.occupiesPoints?.includes('global_pose'));

            if (poseContexts.length) {
                for (const { ctx, preset } of poseContexts) {
                    if (!preset?.id) continue;
                    const removalNarrative = \`Состояние отменено: \${preset.label}\`;
                    activeContextsRepo.remove(ctx.id);
                    eventLogRepo.append(subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: removalNarrative, narrative: removalNarrative }, { removed: true });
                    immediateNotes.push(removalNarrative);
                }
                promptDirty = true;
            } else {
                immediateNotes.push('Ты уже стоишь, поэтому дополнительных изменений нет.');
            }
        }
        
        if (!req.body.skipTimeTick) ContextManager.processTick(subjectId);
`;

const newContent = content.replace(blockToRemove, '');
fs.writeFileSync('src/api/controllers/tickController.ts', newContent);
