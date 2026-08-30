import { contractRepo } from '../infrastructure/contractRepo';
import { subjectRepo } from '../infrastructure/repositories';
import { contractConditionValue, evaluateAssetContract } from '../scenario/evaluateAssetContract';
import { buildCurrentStateObservationText } from '../narrative/interactionObservation';

// ─── Нарративное описание состояния ──────────────────────────────────────────

interface ConditionProgress {
    type: string;
    key?: string;
    operator: string;
    value: number;
    current: number | boolean;
    met: boolean;
    label: string;
}

export function buildStateDescription(subjectId: string): string {
    const core = subjectRepo.get(subjectId);
    if (!core) return 'Актив не найден.';
    return buildCurrentStateObservationText(subjectId, core);
}

// ─── Прогресс контракта ───────────────────────────────────────────────────────

export function getContractProgress(subjectId: string, playerId: string, contractId?: string): {
    contractTitle: string | null;
    contractDescription: string | null;
    conditions: ConditionProgress[];
    metAll: boolean;
} | null {
    const accepted = contractRepo.listForPlayer(playerId);
    // A contract affects suggestions only when the caller explicitly selects it.
    const active = contractId ? accepted.find(c => c.state === 'accepted' && c.id === contractId) : undefined;
    if (!active) return null;

    const core = subjectRepo.get(subjectId);
    if (!core) return null;

    const evaluation = evaluateAssetContract(active, core, {});
    const conditions: ConditionProgress[] = active.conditions.map((cond: any) => {
        let current: any = undefined;
        let label = '';
        if (cond.type === 'attitude') {
            current = Math.round(core.attitude);
            label = 'Покорность';
        } else if (cond.type === 'custom' && cond.key) {
            current = Math.round((core as any)[cond.key]);
            const labels: Record<string, string> = {
                sensitivity: 'Чувствительность',
                capacity: 'Выносливость',
                openness: 'Открытость',
                plasticity: 'Пластичность'
            };
            label = labels[cond.key] || cond.key;
        } else if (cond.type === 'flag' || cond.type === 'trait') {
            current = core.flags?.includes(cond.key || '') ? true : false;
            label = `Трейт: ${cond.key}`;
        } else if (cond.type === 'preference' || cond.type === 'acquired_trait') {
            current = contractConditionValue(cond, core, {});
            label = cond.type === 'acquired_trait' ? `Приобретённая черта: ${cond.key}` : `Предпочтение: ${cond.key}`;
        }
        return {
            type: cond.type,
            key: cond.key,
            operator: cond.operator,
            value: cond.value,
            current,
            met: current !== undefined ? compareOp(current, cond.operator ?? '==', cond.value) : false,
            label
        };
    });

    return {
        contractTitle: active.title,
        contractDescription: active.description,
        conditions,
        metAll: evaluation.metRequirements
    };
}

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
