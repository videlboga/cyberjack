import { Router } from 'express';
import { getScenes, moveScene, getContexts, toggleContext, getSceneLayout } from '../controllers/sceneController';

const router = Router();
router.get('/scenes', getScenes as any);
router.get('/scene/layout', getSceneLayout as any);
router.post('/scene/move', moveScene as any);
router.get('/contexts', getContexts as any);
router.post('/contexts/toggle', toggleContext as any);
export default router;
