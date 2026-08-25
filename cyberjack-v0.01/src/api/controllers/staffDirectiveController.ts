import { Request, Response } from 'express';
import { staffDirectiveRepo } from '../../infrastructure/staffDirectiveRepo';
import { nextExecutorAction } from '../../scenario/staffDirectiveService';

export function assignStaffDirective(req: Request, res: Response) {
    try {
        const { executorId, subjectId, contractId, goal, spec } = req.body || {};
        if (!executorId || !subjectId || !goal) {
            return res.status(400).json({ success: false, error: 'Требуются executorId, subjectId, goal' });
        }
        const directive = staffDirectiveRepo.assign({
            executorId,
            subjectId,
            contractId: contractId || undefined,
            goal,
            spec: spec || undefined,
        });
        res.json({ success: true, directive });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
}

export function listStaffDirectives(req: Request, res: Response) {
    try {
        const executorId = String(req.query.executorId || '');
        const directives = executorId
            ? staffDirectiveRepo.listActiveForExecutor(executorId)
            : staffDirectiveRepo.listAllActive();
        res.json({ success: true, directives });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
}

export function completeStaffDirective(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        staffDirectiveRepo.complete(id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
}

export function previewStaffAction(req: Request, res: Response) {
    try {
        const executorId = String(req.query.executorId || '');
        const action = nextExecutorAction(executorId);
        res.json({ success: true, action });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
}
