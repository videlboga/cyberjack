import { orchestrateSceneActors } from '../src/orchestration/sceneOrchestrator';
import { buildPromptPayloadWithDB } from '../src/prompts/buildPromptPayloadWrapper';
import { characterRelationRepo, resourceRepo } from '../src/infrastructure/repositories';

// Mock the dependencies and force it to show decisions
async function run() {
    const playerId = 'PL-1';
    const npcId = 'S-TEST-NPC';
    const sceneId = 'test_room';

    characterRelationRepo.updateAttitude(npcId, playerId, 90, { openness: 90 });
    resourceRepo.save({ id: npcId, resources: { actionPoints: 50, maxActionPoints: 100 } });

    const payload = await buildPromptPayloadWithDB(playerId, playerId, undefined, sceneId, {});
    const bundle = {
        stateBefore: { core: {} },
        stateAfter: { core: {} },
        compiledAction: { intensity: 0.5, novelty: 0.8, actionPoints: 5, actionType: 'wait' },
        prompt: payload,
        history: [],
        event: { subjectId: playerId, type: 'action', playerId: playerId },
        actionContext: { intensity: 0.5 },
        lastActionIntensity: 0.8,
        lastActionNovelty: 0.8
    };

    const _rand = Math.random;
    Math.random = () => 0; // force sampleProbability to pass

    try {
        const decisions = orchestrateSceneActors(bundle);
        console.log(JSON.stringify(decisions, null, 2));
    } finally {
        Math.random = _rand;
    }
}

run().catch(console.error);
