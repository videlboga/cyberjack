const fs = require('fs');
let code = fs.readFileSync('src/orchestration/sceneOrchestrator.ts', 'utf8');

// Find the start of proactive block
const startIdx = code.indexOf(`            if (sampleProbability(effectiveProactiveProb)) {`);
const endIdx = code.indexOf(`            actorDecisions.push({`, startIdx);
const finalEndIdx = code.indexOf(`            });`, endIdx) + 16;

if (startIdx !== -1 && finalEndIdx !== -1) {
    const replacement = `            if (sampleProbability(effectiveProactiveProb)) {
                // Если персонаж хочет действовать проактивно, узнаем ЧТО он хочет сделать
                let proactiveReason = describeTone(relationToCalibrator?.attitude);
                let decidedAction = undefined;

                if (actorId !== playerId) {
                    // Пытаемся найти лучшую цель из присутствующих
                    const possibleTargets = presentSubjectIds.filter(id => id !== actorId);
                    const targetId = possibleTargets.length > 0 
                        ? possibleTargets[Math.floor(Math.random() * possibleTargets.length)] 
                        : (actorId === subjectId ? playerId : subjectId);
                    
                    if (targetId) {
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
                            proactiveReason = \`Отношение к \${targetName}: \${proactiveReason}. Цель инициативы: применить действие "\${preset?.label || bestAction.actionId}" к анатомической зоне "\${bestAction.pointId}" персонажа \${targetName} (Мотивация: \${Math.round(bestAction.score)})\`;
                        }
                    }
                }

                actorDecisions.push({
                    actorId,
                    kind: 'proactive',
                    reason: proactiveReason,
                    mechanicalAction: decidedAction
                });
            }`;
    code = code.substring(0, startIdx) + replacement + code.substring(finalEndIdx);
} else {
    console.error("Could not find proactive block indices");
}

code = code.replace(
    /\const directive = \`\[Внутренняя директива: Ты решил проявить инициативу\. \$\{decision\.reason\}\. Опиши это действие и свои слова\]\`;/g, 
    "const directive = `[Внутренняя директива: Ты проявил инициативу! ${decision.reason}. Опиши совершаемое действие от своего лица, свои чувства и слова в реплай]`;"
);

fs.writeFileSync('src/orchestration/sceneOrchestrator.ts', code);
console.log("Patched!!");
