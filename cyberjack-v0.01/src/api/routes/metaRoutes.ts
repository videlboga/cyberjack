import { Router } from 'express';
import { getConfig, getActions, getDiagnostics, postConfig, getCharacterProfile, getCharacterPrompt, getAllCharacters, deleteCharacter, generateCharacterEndpoint, getVisualAssetReviews, saveVisualAssetReview } from '../controllers/metaController';
import { getPrompts, getEngineLog, getOrchestratorLog } from '../controllers/logsController';

const router = Router();

router.get('/actions', getActions);
router.get('/config', getConfig);
router.get('/diagnostics', getDiagnostics);
router.get('/logs/prompts', getPrompts);
router.get('/logs/engine', getEngineLog);
router.get('/logs/orchestrator', getOrchestratorLog);
router.post('/config', postConfig);
router.get('/characters/profile', getCharacterProfile);
router.post('/characters/prompt', getCharacterPrompt);
router.get('/characters/prompt', getCharacterPrompt);


router.get('/characters', getAllCharacters as any);
router.delete('/characters/:id', deleteCharacter as any);
router.post('/characters/generate', generateCharacterEndpoint as any);
router.get('/visual-reviews', getVisualAssetReviews as any);
router.post('/visual-reviews', saveVisualAssetReview as any);

export default router;
