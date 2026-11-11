import { executeTurnConversations } from '../src/orchestration/sceneOrchestrator';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';
import { characterRelationRepo, resourceRepo } from '../src/infrastructure/repositories';

async function run() {
    const playerId = 'PL-1';
    const npcId = 'S-TEST-NPC';
    const sceneId = 'test_room';

    // Максимально стимулируем NPC на проактивность
    characterRelationRepo.updateAttitude(npcId, playerId, 90, { openness: 90 });
    resourceRepo.save({ id: npcId, resources: { actionPoints: 50, maxActionPoints: 100 } });

    console.log("Building prompt payload...");
    const payload = await buildPromptPayloadWithDB(playerId, playerId, undefined, sceneId, {});

    // Фейковый бандл
    sceneCharacterRepo.set(sceneId, npcId, { role: 'npc' }); sceneCharacterRepo.set(sceneId, playerId, { role: 'player' });
    const bundle = {
        prompt: payload,
        history: [], 
        event: { subjectId: npcId }, compiledAction: { intensity: 0.5, novelty: 0.8, actionPoints: 5, actionType: 'wait' }, stateBefore: { core: {} }, stateAfter: { core: {} }, actionContext: { intensity: 0.5 },
        lastActionIntensity: 0.8,
        lastActionNovelty: 0.8
    };

    const params = {
        subjectId: playerId,
        eventId: sceneId,
        actionId: 'wait',
        actionLabel: 'Стоит и смотрит',
        pointLabel: 'systemic',
        pointIdUsed: 'systemic',
        autoUserMessage: 'Ты просто смотришь на него.',
        actionLabelMessage: null,
        fullStateName: 'Player',
        promptPayload: payload
    };

    console.log("Executing turn... (Waiting for LLM generation)");
    // Подменяем Math.random чтобы форсировать проактивность, если она завязана на рандом
    const _rand = Math.random;
    Math.random = () => 0; // chance 100% for anything using Math.random < prob

    try {
        const result = await executeTurnConversations(bundle, params);
        console.log("\n=== EXECUTION RESULTS ===");
        console.log(JSON.stringify(result, null, 2));
    } finally {
        Math.random = _rand;
    }
}

run().catch(console.error);
