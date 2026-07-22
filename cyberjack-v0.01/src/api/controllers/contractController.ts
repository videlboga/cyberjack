import { Request, Response } from 'express';
import { contractRepo } from '../../infrastructure/contractRepo';
import { subjectRepo } from '../../infrastructure/repositories';
import { contractConditionValue, evaluateAssetContract } from '../../scenario/evaluateAssetContract';
import { db } from '../../infrastructure/db';
import { advanceWorldTime, getPlayerLocation, getWorldClock } from '../../scenario/worldService';

// GET /api/contracts — список доступных + принятых контрактов
export const getContracts = (req: Request, res: Response) => {
    try {
        const available = contractRepo.listAvailable();
        const playerId = (req.query.playerId as string) || 'PL-1';
        const accepted = contractRepo.listForPlayer(playerId).filter(c => c.state === 'accepted');

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

// POST /api/contracts/:id/accept — принять заказ игроком без резервирования актива
export const acceptContract = (req: Request, res: Response) => {
    try {
        const contractId = req.params.id;
        const { playerId = 'PL-1' } = req.body;

        if (getPlayerLocation(playerId).id !== 'scene_liaison') {
            return res.status(400).json({ success: false, error: 'Контракты принимаются в офисе Связного' });
        }

        const contract = contractRepo.get(contractId);
        if (!contract) {
            return res.status(404).json({ success: false, error: 'Контракт не найден' });
        }
        if (contract.state !== 'available') {
            return res.status(400).json({ success: false, error: 'Контракт уже недоступен' });
        }

        contract.state = 'accepted';
        contract.acceptedByPlayerId = playerId;
        contract.attachedSubjectId = undefined;
        contract.deadlineTick = getWorldClock().totalMinutes + 3 * 1440;
        contractRepo.save(contract);

        advanceWorldTime(15);

        res.json({ success: true, contract });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/contracts/:id/deliver — выбрать и сдать подходящий актив в момент передачи
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

        const playerId = contract.acceptedByPlayerId || 'PL-1';
        if (getPlayerLocation(playerId).id !== 'scene_liaison') {
            return res.status(400).json({ success: false, error: 'Передача актива проводится через офис Связного' });
        }

        const subjectId = req.body.subjectId;
        if (!subjectId) {
            return res.status(400).json({ success: false, error: 'Выберите актив для передачи' });
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
                const val = contractConditionValue(cond, core, {});
                if (val !== undefined && !compareOp(val, cond.operator, cond.value)) {
                    unmet.push(`${cond.type === 'attitude' ? 'Принятие' : cond.key || cond.type}: ${typeof val === 'number' ? Math.round(val) : val} (нужно ${cond.operator} ${cond.value})`);
                }
            }
            return res.json({ success: false, metRequirements: false, unmet });
        }

        // Контракт и награда фиксируются одной транзакцией. Выбор актива при
        // этом не превращается в постоянную связь contract↔subject.
        db.transaction(() => {
            contract.state = 'completed';
            contractRepo.save(contract);
            if (contract.rewards.credits) {
                db.prepare(`
                    INSERT INTO character_resources (character_id, resource_key, amount, metadata)
                    VALUES (?, 'credits', ?, '{}')
                    ON CONFLICT(character_id, resource_key) DO UPDATE SET amount = amount + excluded.amount
                `).run(playerId, contract.rewards.credits);
            }
            if (contract.rewards.trust) {
                db.prepare(`
                    INSERT INTO player_faction_states (player_id, faction_id, relation, trust, access_level, flags)
                    VALUES (?, ?, 0, ?, 1, '[]')
                    ON CONFLICT(player_id, faction_id) DO UPDATE SET trust = trust + excluded.trust
                `).run(playerId, contract.issuerId, contract.rewards.trust);
            }
            for (const itemId of contract.rewards.items || []) {
                db.prepare(`
                    INSERT INTO character_items (character_id, item_id, state, charges, metadata)
                    VALUES (?, ?, 'active', -1, '{}')
                    ON CONFLICT(character_id, item_id) DO UPDATE SET state = 'active'
                `).run(playerId, itemId);
            }
        })();

        advanceWorldTime(30);

        res.json({ success: true, metRequirements: true, contract, deliveredSubjectId: subjectId, rewards: contract.rewards });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/contracts/:id/progress?subjectId=... — чистое сравнение, без привязки
export const getContractProgress = (req: Request, res: Response) => {
    try {
        const contract = contractRepo.get(req.params.id);
        if (!contract) return res.status(404).json({ success: false, error: 'Контракт не найден' });
        const subjectId = String(req.query.subjectId || '');
        const core = subjectRepo.get(subjectId);
        if (!core) return res.status(404).json({ success: false, error: 'Актив не найден' });

        const conditions = contract.conditions.map((condition: any) => {
            const current = contractConditionValue(condition, core, {});
            return { ...condition, current, met: current !== undefined && compareOp(current, condition.operator || '==', condition.value) };
        });
        res.json({ success: true, contract, subjectId, conditions, metAll: conditions.length > 0 && conditions.every(c => c.met) });
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
        const subjectId = req.query.subjectId as string | undefined;
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
