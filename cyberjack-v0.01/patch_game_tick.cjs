const fs = require('fs');
const content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf-8');
const search = `                }
            }
        }`;
const replace = `                }
            }
        } else if (commandIntent.type === 'perform_action') {
            const actionPreset = presetRepo.getActionPreset(commandIntent.actionId);
            if (actionPreset) {
                const forcedNarrative = \`[Система]: Получен ПРЯМОЙ ПРИКАЗ на выполнение действия — "\${actionPreset.label}" (цель: \${commandIntent.targetId || 'не указана'}, точка: \${commandIntent.pointId || 'любая'}). Если твой уровень подчинения позволяет, ты ОБЯЗАН немедленно выполнить это (объявить о согласии и отыграть). Примени это действие физически. Если отказываешься, то отыграй сопротивление.\`;
                addedContextNotes.push(forcedNarrative);
                eventLogRepo.append(payload.subjectId, 'system_trigger', { presetId: 'system_trigger', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative }, { added: true });
            }
        }`;
fs.writeFileSync('src/orchestration/runGameTick.ts', content.replace(search, replace));
