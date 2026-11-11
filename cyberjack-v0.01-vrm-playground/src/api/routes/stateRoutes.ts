import { Router } from 'express';
import { getState, getChatHistory, getContextChatHistory, updateSubject, updatePointState, resetAttemptMemory, forecastIntimacy } from '../controllers/stateController';

const router = Router();

router.get('/state', getState as any);
router.post('/state/intimacy-forecast', forecastIntimacy as any);
router.get('/chat/context', getContextChatHistory as any);
router.get('/characters/:subjectId/chat', getChatHistory as any);
router.post('/subject/update', updateSubject as any);
router.post('/subject/point', updatePointState as any);
router.post('/attempt/reset-memory', resetAttemptMemory as any);

export default router;
