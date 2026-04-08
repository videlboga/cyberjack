import { Router } from 'express';
import { getState, updateSubject } from '../controllers/stateController';

const router = Router();

router.get('/state', getState as any);
router.post('/subject/update', updateSubject as any);

export default router;
