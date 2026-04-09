const fs = require('fs');

let code = fs.readFileSync('src/api/controllers/tickController.ts', 'utf8');

const strRe = `            if (commandIntent.type === 'change_pose') {
                targetCtxId = commandIntent.targetPoseId;
            } else if (commandIntent.type === 'activate_context') {
                targetCtxId = commandIntent.targetContextId;
            }

            if (targetCtxId) {`;

const replStr = `            if (commandIntent.type === 'change_pose') {
                targetCtxId = commandIntent.targetPoseId;
            } else if (commandIntent.type === 'activate_context') {
                targetCtxId = commandIntent.targetContextId;
            } else if (commandIntent.type === 'deactivate_context') {
                const targetCtxId = commandIntent.targetContextId;
                const actionPreset = presetRepo.getActionPreset(targetCtxId);
                const currentStatus = activeContextsRepo.getAllForSubject(subjectId).find(c => c.actionId === targetCtxId);
                if (currentStatus) {
                    activeContextsRepo.remove(currentStatus.id);
                    const narrative = \`Состояние отменено: \${actionPreset?.label || targetCtxId}\`;
                    eventLogRepo.append(subjectId, 'context_change', { presetId: 'context_change', action: null, actionLabel: narrative, narrative }, { removed: true });
                    promptDirty = true;
                    immediateNotes.push(narrative);
                }
                return; // handled
            }

            if (targetCtxId) {`;

code = code.replace(strRe, replStr);
fs.writeFileSync('src/api/controllers/tickController.ts', code);
