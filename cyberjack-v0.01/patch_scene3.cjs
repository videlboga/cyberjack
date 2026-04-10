const fs = require('fs');

let content = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');

content = content.replace(/if \(sampleProbability\(effectiveProactiveProb\)\) \{[\s\S]*?actorDecisions\.push\(\{[\s\S]*?actorId,\s*kind: 'proactive',[\s\S]*?reason: proactiveReason,[\s\S]*?\}\);\s*\}/, `if (sampleProbability(effectiveProactiveProb)) {
            // Если персонаж хочет действовать проактивно, узнаем ЧТО он хочет сделать
            let proactiveReason = describeTone(relationToCalibrator?.attitude);
            let decidedAction;

            if (actorId !== playerId) {
                const possibleTargets = presentSubjectIds.filter(id => id !== actorId);
                const targetId = possibleTargets.length > 0 
                    ? possibleTargets[Math.floor(Math.random() * possibleTargets.length)] 
                    : (actorId === subjectId ? playerId : subjectId);
                
                if (targetId) {
                    // Обновляем отношение конкретно к выбранной цели
                    const targetRelation = characterRelationRepo.get(actorId, targetId);
                    proactiveReason = describeTone(targetRelation?.attitude || relationToCalibrator?.attitude);

                    const targetPointRecords = pointStateRepo.getAllForSubject(targetId);
                    const targetPoints = targetPointRecords.map(p => p.pointId);
                    if (targetPoints.length === 0) targetPoints.push('general');

                    const actions = ActionScorer.scoreAvailableActions(eventSceneId, actorId, targetId, targetPoints);

                    const scene = sceneRepo.get(eventSceneId);
                    const actorResources = resourceRepo.get(actorId);

                    const affordable = actions.filter(a => {
                        const sceneCost = scene?.actionCosts?.[a.actionId];
                        let requiredAP = 0;
                        if (sceneCost) {
                            requiredAP = Number(sceneCost.actionPoints ?? sceneCost.ap ?? sceneCost.apCost ?? sceneCost.action_points ?? 0);
                        }
                        const curAP = Number(actorResources?.resources?.actionPoints ?? 0);
                        return !(requiredAP > 0 && curAP < requiredAP);
                    });

                    const bestAction = affordable.find(a => a.score > 0);
                    if (bestAction) {
                        const targetChar = subjectRepo.get(targetId);
                        const targetName = targetChar?.name || targetId;
                        const preset = presetRepo.getActionPreset(bestAction.actionId);
                        
                        decidedAction = { ...bestAction, targetId };
                        
                        // Формируем четкую директиву для LLM с учетом цели
                        proactiveReason = \`Твое отношение к \${targetName}: \${proactiveReason}. Цель инициативы: применить действие "\${preset?.label || bestAction.actionId}" к анатомической зоне "\${bestAction.pointId}" персонажа \${targetName} (Мотивация: \${Math.round(bestAction.score)})\`;
                    }
                }
            }

            actorDecisions.push({
                actorId,
                kind: 'proactive',
                reason: proactiveReason,
                mechanicalAction: decidedAction
            });
        }`);

fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', content);
console.log("Patched sceneOrchestrator 1 (Decision generation).");

// Let's also check if we can patch the prompt text injection directly to be cleaner.
content = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');
content = content.replace(/const directive = \`\[Внутренняя директива: Ты решил проявить инициативу\. \$\{decision\.reason\}\. Опиши это действие и свои слова\]\`;/, 
    \`const directive = \\\`[Внутренняя директива: Ты проявил инициативу! \${decision.reason}. Опиши это действие, свои чувства и слова в реплай]\\\`;\`);
fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', content);
console.log("Patched sceneOrchestrator 2 (Prompt text).");
