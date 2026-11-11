import { Router } from 'express';
import {
    assignStaffDirective,
    listStaffDirectives,
    completeStaffDirective,
    previewStaffAction,
} from '../controllers/staffDirectiveController';

const router = Router();

router.get('/staff/directives', listStaffDirectives as any);
router.post('/staff/directives', assignStaffDirective as any);
router.post('/staff/directives/:id/complete', completeStaffDirective as any);
router.get('/staff/directives/preview', previewStaffAction as any);

export default router;
