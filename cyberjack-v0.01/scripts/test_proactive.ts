import { subjectRepo, pointStateRepo, characterRelationRepo, sceneRepo, presetRepo, sceneCharacterRepo } from '../src/infrastructure/repositories';
import { ActionScorer } from '../src/orchestration/actionScorer';
import { db } from '../src/infrastructure/db';
import { resourceRepo } from '../src/infrastructure/repositories';

async function testProactive() {
    console.log("=== SETUP TEST SCENE ===");
    // 1. Убедимся что персонажи существуют и зададим им нужные профайлы
    const npcId = 'S-TEST-NPC';
    const playerId = 'PL-1';

    // NPC - любит ласку, не любит боль
    subjectRepo.save(npcId, "Test NPC", {
        sensitivity: 50, capacity: 50, openness: 60, plasticity: 50, attitude: 60,
        baselineAttitude: 60,
        preferences: JSON.stringify({
            actions: {
                "light_kiss": 2.0,      // Обожает поцелуи
                "passionate_kiss": 3.0,
                "tackle_to_ground": 2.5,
                "soft_stroke": 1.5,     // Любит прикосновения
                "hard_slap": -2.0,      // Ненавидит пощечины
            },
            points: {
                "face": 1.5,            // Тянется к лицу
                "lips": 2.0             // И губам
            }
        })
    });

    // Player
    subjectRepo.save(playerId, "Player", {
        sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50,
        // preferences omitted to avoid accidental overwrites of existing generated preferences
    });

    console.log("Characters configured.");

    // 2. Настраиваем точки Игрока (барьеры интимности)
    const points = ['general', 'face', 'lips', 'chest', 'left_arm'];
    for (const pt of points) {
        pointStateRepo.save(playerId, pt, {
            pointId: pt,
            localSensitivity: 50,
            localAttitude: 50,
            // Интимность: губы=10 (очень интимно), лицо=30 (интимно), руки=80 (доступно)
            localOpenness: pt === 'lips' ? 10 : pt === 'face' ? 30 : pt === 'left_arm' ? 80 : 50
        });
    }

    resourceRepo.save({
        id: npcId,
        resources: { actionPoints: { amount: 30, maxAmount: 100 } }
    });

    // 3. Создаем базовую сцену с доступными действиями
    const sceneId = 'test_room';
    sceneRepo.save({
        id: sceneId,
        availableActions: ['light_kiss', 'passionate_kiss', 'tackle_to_ground', 'soft_stroke', 'hard_slap', 'talk'],
        actionCosts: {
            'soft_stroke': { actionPoints: 2 },
            'light_kiss': { actionPoints: 5 },
            'passionate_kiss': { actionPoints: 25 },
            'tackle_to_ground': { actionPoints: 60 },
            'hard_slap': { actionPoints: 15 },
            'talk': { actionPoints: 0 }
        },
        title: "Test Room",
        slots: []
    });

    // Добавляем пресеты если их нет
    const mockPresets = [
        { id: 'passionate_kiss', label: 'Страстный поцелуй', type: 'physical' },
        { id: 'tackle_to_ground', label: 'Повалить на землю', type: 'physical' },
        { id: 'light_kiss', label: 'Поцелуй', type: 'physical' },
        { id: 'soft_stroke', label: 'Поглаживание', type: 'physical' },
        { id: 'hard_slap', label: 'Пощечина', type: 'physical' },
        { id: 'talk', label: 'Разговор', type: 'verbal' },
    ];
    for (const pre of mockPresets) {
        presetRepo.saveActionPreset(pre.id, pre.label, { type: pre.type }, {});
    }

    // Помещаем персонажей в сцену
    sceneCharacterRepo.set(sceneId, npcId, { role: 'npc' });
    sceneCharacterRepo.set(sceneId, playerId, { role: 'player' });

    console.log("Scene and Points configured.\n");

    const scene = sceneRepo.get(sceneId);

    console.log("=== SCENARIO 1: Чужие: Низкий Openness ===");
    // NPC к Игроку в холодных/незнакомых отношениях
    characterRelationRepo.updateAttitude(npcId, playerId, 50, { openness: 20 });
    
    let actorResources = resourceRepo.get(npcId);
    let curAP = Number(actorResources?.resources?.actionPoints ?? 0);
    console.log(`Текущие AP NPC: ${curAP}`);

    let results = ActionScorer.scoreAvailableActions(sceneId, npcId, playerId, points).map(a => {
        const sceneCost = scene?.actionCosts?.[a.actionId];
        let requiredAP = Number(sceneCost?.actionPoints ?? sceneCost?.ap ?? 0);
        return { ...a, requiredAP, affordable: curAP >= requiredAP };
    });

    console.log("Отношение NPC -> Player: Attitude 50, Openness 20");
    console.log("Топ 3 желания NPC:");
    results.slice(0, 3).forEach(r => {
        console.log(`- Action: ${r.actionId} (AP: ${r.requiredAP} - ${r.affordable ? 'Доступно' : 'Недостаточно AP'}), Point: ${r.pointId} | Score: ${r.score.toFixed(2)}`);
    });

    console.log("\n=== SCENARIO 2: Близкие: Высокий Attitude и Openness ===");
    // NPC к Игроку в близких отношениях (открытость 90 - "пробивает" интимность губ)
    characterRelationRepo.updateAttitude(npcId, playerId, 80, { openness: 90 });
    
    actorResources = resourceRepo.get(npcId);
    curAP = Number(actorResources?.resources?.actionPoints ?? 0);
    console.log(`Текущие AP NPC: ${curAP}`);

    results = ActionScorer.scoreAvailableActions(sceneId, npcId, playerId, points).map(a => {
        const sceneCost = scene?.actionCosts?.[a.actionId];
        let requiredAP = Number(sceneCost?.actionPoints ?? sceneCost?.ap ?? 0);
        return { ...a, requiredAP, affordable: curAP >= requiredAP };
    });

    console.log("Отношение NPC -> Player: Attitude 80, Openness 90");
    console.log("Топ 3 желания NPC:");
    results.slice(0, 3).forEach(r => {
        console.log(`- Action: ${r.actionId} (AP: ${r.requiredAP} - ${r.affordable ? 'Доступно' : 'Недостаточно AP'}), Point: ${r.pointId} | Score: ${r.score.toFixed(2)}`);
    });

    console.log("\n=== SCENARIO 3: Очень мало AP (5 AP), Страстный поцелуй недоступен ===");
    resourceRepo.save({
        id: npcId,
        resources: { actionPoints: { amount: 5, maxAmount: 100 } }
    });
    
    actorResources = resourceRepo.get(npcId);
    curAP = Number(actorResources?.resources?.actionPoints ?? 0);
    console.log(`Текущие AP NPC: ${curAP}`);

    results = ActionScorer.scoreAvailableActions(sceneId, npcId, playerId, points).map(a => {
        const sceneCost = scene?.actionCosts?.[a.actionId];
        let requiredAP = Number(sceneCost?.actionPoints ?? sceneCost?.ap ?? 0);
        return { ...a, requiredAP, affordable: curAP >= requiredAP };
    });

    console.log("Отношение NPC -> Player: Attitude 80, Openness 90, AP: 5");
    console.log("Все желания NPC:");
    results.slice(0, 5).forEach(r => {
        console.log(`- Action: ${r.actionId} (AP: ${r.requiredAP} - ${r.affordable ? 'Доступно' : 'Недостаточно AP'}), Point: ${r.pointId} | Score: ${r.score.toFixed(2)}`);
    });

}

testProactive().catch(console.error);
