import { Router } from 'express';
import { getDeferredReply, waitForDeferredReply, streamDeferredReply, processTick, processWait } from '../controllers/tickController';

const router = Router();

router.post('/tick', processTick as any);
router.post('/wait', processWait as any);
router.get('/tick/replies/:jobId', getDeferredReply as any);
router.get('/tick/replies/:jobId/wait', waitForDeferredReply as any);
router.get('/tick/replies/:jobId/stream', streamDeferredReply as any);

export default router;
