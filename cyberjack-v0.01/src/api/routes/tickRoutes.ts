import { Router } from 'express';
import { processTick, processWait } from '../controllers/tickController';

const router = Router();

router.post('/tick', processTick as any);
router.post('/wait', processWait as any);

export default router;
