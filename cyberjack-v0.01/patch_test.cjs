const fs = require('fs');
const path = 'scripts/test_proactive.ts';
let code = fs.readFileSync(path, 'utf8');

const importTarget = `import { db } from '../src/infrastructure/db';`;
const addImport = `import { resourceRepo } from '../src/infrastructure/repositories';\n`;
code = code.replace(importTarget, importTarget + '\n' + addImport);

const setupTarget = `    // 3. Создаем базовую сцену с доступными действиями`;
const newSetup = `
    resourceRepo.save({
        id: npcId,
        resources: { actionPoints: 30, maxActionPoints: 100 }
    });

    // 3. Создаем базовую сцену с доступными действиями`;
code = code.replace(setupTarget, newSetup);

const sceneTarget = `availableActions: ['light_kiss', 'soft_stroke', 'hard_slap', 'talk'],`;
const newScene = `availableActions: ['light_kiss', 'passionate_kiss', 'tackle_to_ground', 'soft_stroke', 'hard_slap', 'talk'],
        actionCosts: {
            'soft_stroke': { actionPoints: 2 },
            'light_kiss': { actionPoints: 5 },
            'passionate_kiss': { actionPoints: 25 },
            'tackle_to_ground': { actionPoints: 60 },
            'hard_slap': { actionPoints: 15 },
            'talk': { actionPoints: 0 }
        },`;
code = code.replace(sceneTarget, newScene);

const mockPresetsTarget = `const mockPresets = [`;
const addPresets = `        { id: 'passionate_kiss', label: 'Страстный поцелуй', type: 'physical' },
        { id: 'tackle_to_ground', label: 'Повалить на землю', type: 'physical' },
`;
code = code.replace(mockPresetsTarget, mockPresetsTarget + '\n' + addPresets);

const prefTarget = `"light_kiss": 2.0,      // Обожает поцелуи`;
const addPref = `"passionate_kiss": 3.0, "tackle_to_ground": 2.5,\n`;
code = code.replace(prefTarget, prefTarget + '\n' + addPref);

const filterTarget1 = `results = ActionScorer.scoreAvailableActions(sceneId, npcId, playerId, points);`;
const filterStr = `
    const scene = sceneRepo.get(sceneId);
    const actorResources = resourceRepo.get(npcId);
    const curAP = Number(actorResources?.resources?.actionPoints ?? 0);
    
    console.log(\`Текущие AP NPC: \${curAP}\`);

    results = ActionScorer.scoreAvailableActions(sceneId, npcId, playerId, points).map(a => {
        const sceneCost = scene?.actionCosts?.[a.actionId];
        let requiredAP = Number(sceneCost?.actionPoints ?? sceneCost?.ap ?? 0);
        return { ...a, requiredAP, affordable: curAP >= requiredAP };
    });
`;
// Need to replace all occurrences.
code = code.split('results = ActionScorer.scoreAvailableActions(sceneId, npcId, playerId, points);').join(filterStr);

const printTarget1 = `console.log(\`- Action: \${r.actionId}, Point: \${r.pointId} | Score: \${r.score} | База: \${r.details.baseScore}, Бонус: \${r.details.preferenceBonus}, Штраф барьера: \${r.details.barrierPenalty}\`);`;
const newPrint1 = `console.log(\`- Action: \${r.actionId} (AP: \${r.requiredAP} - \${r.affordable ? 'Доступно' : 'Недостаточно AP'}), Point: \${r.pointId} | Score: \${r.score}\`);`;
code = code.replace(printTarget1, newPrint1);
code = code.replace(printTarget1, newPrint1); // replace both scenarios

// Wait, the first one is actually: `let results = ActionScorer.scoreAvailableActions...`
code = code.replace('let results = ActionScorer.scoreAvailableActions(sceneId, npcId, playerId, points);', `let ` + filterStr.trim());

// Scenario 3: low AP
const sc3 = `
    console.log("\\n=== SCENARIO 3: Очень мало AP (5 AP), Страстный поцелуй недоступен ===");
    resourceRepo.save({
        id: npcId,
        resources: { actionPoints: 5, maxActionPoints: 100 }
    });
    
    results = \n${filterStr}
    
    console.log("Отношение NPC -> Player: Attitude 80, Openness 90, AP: 5");
    console.log("Все желания NPC:");
    results.slice(0, 5).forEach(r => {
        console.log(\`- Action: \${r.actionId} (AP: \${r.requiredAP} - \${r.affordable ? 'Доступно' : 'Недостаточно AP'}), Point: \${r.pointId} | Score: \${r.score}\`);
    });
`;

code = code.replace('}test', sc3 + '\n}\ntest');
code = code.replace('testProactive().catch(console.error);', sc3 + '\n}testProactive().catch(console.error);');

fs.writeFileSync(path, code);
