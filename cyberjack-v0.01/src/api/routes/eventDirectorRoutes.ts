import { Router } from 'express';
import { chooseEventOpportunity, getEventInbox } from '../controllers/eventDirectorController';

const router = Router();

router.get('/events/inbox', getEventInbox as any);
router.post('/events/:id/choose', chooseEventOpportunity as any);

export default router;
