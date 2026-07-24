import { Router } from 'express';
import { getContracts, acceptContract, deliverContract, getActiveContract, getContractProgress } from '../controllers/contractController';

const router = Router();

router.get('/contracts', getContracts as any);
router.post('/contracts/:id/accept', acceptContract as any);
router.post('/contracts/:id/deliver', deliverContract as any);
router.get('/contracts/active', getActiveContract as any);
router.get('/contracts/:id/progress', getContractProgress as any);

export default router;
