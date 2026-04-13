import { Router } from 'express';
import { getConfig, postConfig, getCharacterProfile, getCharacterPrompt, getAllCharacters, deleteCharacter, generateCharacterEndpoint } from '../controllers/metaController';

const router = Router();

router.get('/config', getConfig);
router.post('/config', postConfig);
router.get('/characters/profile', getCharacterProfile);
router.post('/characters/prompt', getCharacterPrompt);
router.get('/characters/prompt', getCharacterPrompt);


router.get('/characters', getAllCharacters as any);
router.delete('/characters/:id', deleteCharacter as any);
router.post('/characters/generate', generateCharacterEndpoint as any);

export default router;

