const fs = require('fs');
let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf-8');

// Replace the perform_action branch
let searchAction = `        } else if (commandIntent.type === 'perform_action') {
            const actionPreset = presetRepo.getActionPreset(commandIntent.actionId);
            if (actionPreset) {
                const forcedNarrative = \`[Система]: Поступило указание на выполнение действия — "\${actionPreset.label}" (цель: \${commandIntent.targetId || 'не указана'}, точка: \${commandIntent.pointId || 'любая'}). Реши, как отреагировать (выполнить или отказаться), опираясь на текущий уровень подчинения и отношение к субъекту.\`;
                addedContextNotes.push(forcedNarrative);
                eventLogRepo.append(payload.subjectId, 'system_trigger', { presetId: 'system_trigger', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
            }
        }`;

let replaceAction = `        } else if (commandIntent.type === 'perform_action') {
            const actionPreset = presetRepo.getActionPreset(commandIntent.actionId);
            if (actionPreset) {
                const requiredCompliance = (actionPreset.priority || 1) * 20;
                const currentCompliance = 100;
                const targetName = commandIntent.targetId || 'не указана';
                
                if (currentCompliance >= requiredCompliance) {
                    const forcedNarrative = \`Выполнено действие: \${actionPreset.label} (цель: \${targetName})\`;
                    addedContextNotes.push(forcedNarrative);
                    eventLogRepo.append(payload.subjectId, 'system_trigger', { presetId: 'system_trigger', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
                } else {
                    const refusedNarrative = \`[Система]: Актив мысленно отклоняет действие "\${actionPreset.label}". Уровень подчинения (~\${Math.round(currentCompliance)}) недостаточен для выполнения (требуется \${requiredCompliance}). Отреагируй отказом словами или жестами.\`;
                    addedContextNotes.push(refusedNarrative);
                }
            }
        }`;

content = content.replace(searchAction, replaceAction);

// Fix the targetCtxId refuse narrative down below
let targetCtxSearch = `const refusedNarrative = \`[Система]: Актив мысленно ОТКАЗЫВАЕТСЯ выполнять команду ("\${actionPreset.label}"). Требуемый уровень подчинения: \${requiredCompliance}, но текущий всего ~\${Math.round(currentCompliance)}. Отреагируй отказом словами или жестами.\`;`;
let targetCtxReplace = `const refusedNarrative = \`[Система]: Актив мысленно отклоняет требование перейти в состояние "\${actionPreset.label}". Уровень подчинения (~\${Math.round(currentCompliance)}) недостаточен (требуется \${requiredCompliance}). Отреагируй отказом словами или жестами.\`;`;

content = content.replace(targetCtxSearch, targetCtxReplace);

fs.writeFileSync('src/orchestration/runGameTick.ts', content);
