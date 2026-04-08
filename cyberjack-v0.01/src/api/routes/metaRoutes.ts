import { Router } from 'express';
import { getConfig, postConfig, getCharacterProfile, getCharacterPrompt } from '../controllers/metaController';

const router = Router();

router.get('/config', getConfig);
router.post('/config', postConfig);
router.get('/characters/profile', getCharacterProfile);
router.post('/characters/prompt', getCharacterPrompt);
router.get('/characters/prompt', getCharacterPrompt);

export default router;
