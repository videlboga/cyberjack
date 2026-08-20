import { Request, Response } from 'express';
import { contractRepo } from '../../infrastructure/contractRepo';
import { acceptContract as acceptContractService, deliverContract as deliverContractService, getContractProgress as getContractProgressService, getActiveContract as getActiveContractService, refuseContract as refuseContractService } from '../../services/contractService';
import { AssetContract } from '../../domain/types';

/** Maps known business errors from the contract service to HTTP statuses. */
function contractBusinessStatus(message?: string): number {
    if (!message) return 500;
    if (message.includes('не найден')) return 404;
    return 400;
}

/** Общий проектор контракта в клиентский вид: отдаёт формат, длительность,
 *  дедлайн, риски возврата (return_profile) и срок возврата для передачи. */
function mapContract(c: AssetContract) {
    return {
        id: c.id,
        title: c.title,
        description: c.description,
        issuerId: c.issuerId,
        conditions: c.conditions,
        rewards: c.rewards,
        penalties: c.penalties,
        state: c.state,
        format: c.format || 'external_transfer',
        durationMinutes: c.durationMinutes ?? undefined,
        offerDeadlineMinutes: c.offerDeadlineMinutes ?? undefined,
        returnProfile: c.return_profile && Object.keys(c.return_profile).length
            ? c.return_profile
            : undefined,
        deadlineTick: c.deadlineTick,
        attachedSubjectId: c.attachedSubjectId,
        unavailableUntil: c.unavailable_until ?? c.unavailableUntil ?? undefined,
        subjectId: c.subject_id || undefined,
    };
}

// GET /api/contracts — список доступных + принятых + в передаче контрактов
export const getContracts = (req: Request, res: Response) => {
    try {
        const available = contractRepo.listAvailable();
        const playerId = (req.query.playerId as string) || 'PL-1';
        const playerContracts = contractRepo.listForPlayer(playerId);
        const accepted = playerContracts.filter(c => c.state === 'accepted');
        const inTransfer = playerContracts.filter(c => c.state === 'in_transfer');

        res.json({
            success: true,
            available: available.map(mapContract),
            accepted: accepted.map(mapContract),
            inTransfer: inTransfer.map(mapContract),
        });
    } catch (error: any) {
        console.error('[getContracts]', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/contracts/:id/accept — принять заказ игроком без резервирования актива
export const acceptContract = (req: Request, res: Response) => {
    try {
        const contractId = String(req.params.id);
        const { playerId = 'PL-1' } = req.body;
        const { contract } = acceptContractService(contractId, playerId);
        res.json({ success: true, contract });
    } catch (error: any) {
        console.error('[acceptContract]', error);
        const status = contractBusinessStatus(error?.message);
        res.status(status).json({ success: false, error: error.message });
    }
};

// POST /api/contracts/:id/refuse — отказаться от принятого контракта (штрафы)
export const refuseContract = (req: Request, res: Response) => {
    try {
        const contractId = String(req.params.id);
        const contract = refuseContractService(contractId);
        res.json({ success: true, contract });
    } catch (error: any) {
        console.error('[refuseContract]', error);
        const status = contractBusinessStatus(error?.message);
        res.status(status).json({ success: false, error: error.message });
    }
};

// POST /api/contracts/:id/deliver — выбрать и сдать подходящий актив в момент передачи
export const deliverContract = (req: Request, res: Response) => {
    try {
        const contractId = String(req.params.id);
        const subjectId = req.body.subjectId;
        const result = deliverContractService(contractId, subjectId);
        res.json({ success: true, ...result });
    } catch (error: any) {
        console.error('[deliverContract]', error);
        const status = contractBusinessStatus(error?.message);
        res.status(status).json({ success: false, error: error.message });
    }
};

// GET /api/contracts/:id/progress?subjectId=... — чистое сравнение, без привязки
export const getContractProgress = (req: Request, res: Response) => {
    try {
        const contractId = String(req.params.id);
        const subjectId = String(req.query.subjectId || '');
        const result = getContractProgressService(contractId, subjectId);
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/contracts/active — активный контракт игрока
export const getActiveContract = (req: Request, res: Response) => {
    try {
        const playerId = (req.query.playerId as string) || 'PL-1';
        const subjectId = req.query.subjectId as string | undefined;
        const { contract, progress } = getActiveContractService(playerId, subjectId);
        res.json({ success: true, contract, progress });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
