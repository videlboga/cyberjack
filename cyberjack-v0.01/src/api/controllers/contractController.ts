import { Request, Response } from 'express';
import { contractRepo } from '../../infrastructure/contractRepo';
import { subjectRepo } from '../../infrastructure/repositories';
import { evaluateAssetContract } from '../../scenario/evaluateAssetContract';

// GET /api/contracts — список доступных + принятых контрактов
export const getContracts = (req: Request, res: Response) => {
    try {
        const available = contractRepo.listAvailable();
        const playerId = (req.query.playerId as string) || 'PL-1';
        const accepted = contractRepo.listForPlayer(playerId);

        res.json({
            success: true,
            available: available.map(c => ({
                id: c.id,
                title: c.title,
                description: c.description,
                issuerId: c.issuerId,
                conditions: c.conditions,
                rewards: c.rewards,
                penalties: c.penalties,
                state: c.state
            })),
            accepted: accepted.map(c => ({
                id: c.id,
                title: c.title,
                description: c.description,
                issuerId: c.issuerId,
                conditions: c.conditions,
                rewards: c.rewards,
                penalties: c.penalties,
                state: c.state,
                attachedSubjectId: c.attachedSubjectId,
                deadlineTick: c.deadlineTick
            }))
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/contracts/:id/accept — принять контракт, привязать к субъекту
export const acceptContract = (req: Request, res: Response) => {
    try {
        const contractId = req.params.id;
        const { subjectId, playerId = 'PL-1' } = req.body;

        const contract = contractRepo.get(contractId);
        if (!contract) {
            return res.status(404).json({ success: false, error: 'Контракт не найден' });
        }
        if (contract.state !== 'available') {
            return res.status(400).json({ success: false, error: 'Контракт уже недоступен' });
        }

        contract.state = 'accepted';
        contract.acceptedByPlayerId = playerId;
        contract.attachedSubjectId = subjectId;
        contractRepo.save(contract);

        res.json({ success: true, contract });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/contracts/:id/deliver — сдать актив по контракту (проверка условий)
export const deliverContract = (req: Request, res: Response) => {
    try {
        const contractId = req.params.id;
        const contract = contractRepo.get(contractId);
        if (!contract) {
            return res.status(404).json({ success: false, error: 'Контракт не найден' });
        }
        if (contract.state !== 'accepted') {
            return res.status(400).json({ success: false, error: 'Контракт не принят' });
        }

        const subjectId = contract.attachedSubjectId;
        if (!subjectId) {
            return res.status(400).json({ success: false, error: 'К контракту не привязан актив' });
        }

        const core = subjectRepo.get(subjectId);
        if (!core) {
            return res.status(400).json({ success: false, error: 'Актив не найден' });
        }

        const evaluation = evaluateAssetContract(contract, core, {});
        if (!evaluation.metRequirements) {
            // Вернём какие условия не выполнены
            const unmet: string[] = [];
            for (const cond of contract.conditions) {
                if (cond.type === 'attitude') {
                    const val = core.attitude;
                    if (!compareOp(val, cond.operator, cond.value)) {
                        unmet.push(`Покорность: ${Math.round(val)} (нужно ${cond.operator} ${cond.value})`);
                    }
                } else if (cond.type === 'custom' && cond.key) {
                    const val = (core as any)[cond.key];
                    if (val !== undefined && !compareOp(val, cond.operator, cond.value)) {
                        unmet.push(`${cond.key}: ${Math.round(val)} (нужно ${cond.operator} ${cond.value})`);
                    }
                }
            }
            return res.json({ success: false, metRequirements: false, unmet });
        }

        // Контракт выполнен
        contract.state = 'completed';
        contractRepo.save(contract);

        res.json({ success: true, metRequirements: true, contract, rewards: contract.rewards });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/contracts/active — активный контракт игрока
export const getActiveContract = (req: Request, res: Response) => {
    try {
        const playerId = (req.query.playerId as string) || 'PL-1';
        const accepted = contractRepo.listForPlayer(playerId);
        const active = accepted.find(c => c.state === 'accepted');

        if (!active) {
            return res.json({ success: true, contract: null });
        }

        // Проверим выполнение условий
        const subjectId = active.attachedSubjectId;
        let progress = null;
        if (subjectId) {
            const core = subjectRepo.get(subjectId);
            if (core) {
                const evaluation = evaluateAssetContract(active, core, {});
                progress = {
                    metRequirements: evaluation.metRequirements,
                    conditions: active.conditions.map((cond: any) => {
                        let current: any = undefined;
                        if (cond.type === 'attitude') current = core.attitude;
                        else if (cond.type === 'custom' && cond.key) current = (core as any)[cond.key];
                        else if (cond.type === 'flag' || cond.type === 'trait') {
                            current = core.flags?.includes(cond.key || '') ? true : false;
                        }
                        return {
                            ...cond,
                            current,
                            met: current !== undefined ? compareOp(current, cond.operator ?? '==', cond.value) : false
                        };
                    })
                };
            }
        }

        res.json({ success: true, contract: active, progress });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

function compareOp(actual: any, operator: string, target: any): boolean {
    switch (operator) {
        case '>': return actual > target;
        case '<': return actual < target;
        case '>=': return actual >= target;
        case '<=': return actual <= target;
        case '==': return actual == target;
        case '!=': return actual != target;
        default: return actual === target;
    }
}