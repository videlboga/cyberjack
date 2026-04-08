import { Router } from 'express';
import { updatePlayer, updateRelations, getRelations } from '../controllers/playerController';

const router = Router();

router.post('/player/update', updatePlayer as any);
router.post('/relations/update', updateRelations as any);
router.get('/relations', getRelations as any);

export default router;
