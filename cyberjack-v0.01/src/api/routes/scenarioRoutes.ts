import { Router } from 'express';
import { buy, changeRole, controlEquipment, getScenario, passTime, recruit, travel, useEquipment } from '../controllers/scenarioController';

const router = Router();

router.get('/scenario', getScenario as any);
router.post('/scenario/travel', travel as any);
router.post('/scenario/shop/:offerId/buy', buy as any);
router.post('/scenario/candidates/:characterId/recruit', recruit as any);
router.post('/scenario/characters/:characterId/role', changeRole as any);
router.post('/scenario/laboratory/:assetId/use', useEquipment as any);
router.post('/scenario/laboratory/:assetId/control', controlEquipment as any);
router.post('/scenario/time/pass', passTime as any);

export default router;
