import { AssetContract, SubjectCoreState, AssetContractCondition } from '../domain/types';
import { acquiredTraitValue, parsePreferences } from '../domain/conditioning';

export interface EvaluationResult {
    contract: AssetContract;
    core: SubjectCoreState;
    metRequirements: boolean;
}

export function evaluateAllContracts(
    contracts: AssetContract[],
    core: SubjectCoreState,
    context: Record<string, any>
): SubjectCoreState {
    let currentCore = core;
    for (const contract of contracts) {
        const res = evaluateAssetContract(contract, currentCore, context);
        currentCore = res.core;
    }
    return currentCore;
}

/**
 * Проверяет текущее состояние актива и решает, соответствует ли он контракту.
 * Если да, вешает на актив флаг готовности к сдаче.
 */
export function evaluateAssetContract(
    contract: AssetContract, 
    core: SubjectCoreState, 
    context: Record<string, any>
): EvaluationResult {
    if (contract.state !== 'accepted') {
        return { contract, core, metRequirements: false };
    }

    let allCondsMet = true;

    if (contract.conditions && contract.conditions.length > 0) {
        for (const cond of contract.conditions) {
            allCondsMet = allCondsMet && checkCondition(cond, core, context);
            if (!allCondsMet) break; // Оптимизация
        }
    } else {
        // Если условий нет — контракт невозможно автоматически засчитать собранным (или он просто пустой)
        allCondsMet = false; 
    }

    const readyFlag = `contract_ready:${contract.id}`;
    let updatedCore = { ...core, flags: core.flags || [] };
    let changed = false;

    if (allCondsMet) {
        // Актив готов. Вешаем флаг, чтобы в UI показать отметку.
        if (!updatedCore.flags.includes(readyFlag)) {
            updatedCore.flags = [...updatedCore.flags, readyFlag];
            changed = true;
        }
    } else {
        // Если параметры упали (актив "испортился"), снимаем флаг
        if (updatedCore.flags.includes(readyFlag)) {
            updatedCore.flags = updatedCore.flags.filter(f => f !== readyFlag);
            changed = true;
        }
    }

    return { 
        contract, 
        core: changed ? updatedCore : core, 
        metRequirements: allCondsMet 
    };
}

export function contractConditionValue(cond: AssetContractCondition, core: SubjectCoreState, context: Record<string, any>): any {
    if (cond.type === 'attitude') {
        return core.baselineAttitude ?? core.attitude;
    }
    if (cond.type === 'flag' || cond.type === 'trait') {
        const hasFlag = core.flags?.includes(cond.key || '');
        return !!hasFlag;
    }
    if (cond.type === 'custom' && cond.key) {
        // Trainable qualities are evaluated by their adapted baseline. Session
        // state (resource/tension) intentionally remains momentary.
        const baselineKeys: Record<string, keyof SubjectCoreState> = {
            sensitivity: 'baselineSensitivity',
            openness: 'baselineOpenness',
            plasticity: 'baselinePlasticity',
            attitude: 'baselineAttitude',
        };
        const baselineKey = baselineKeys[cond.key];
        if (baselineKey) return core[baselineKey] ?? (core as any)[cond.key];
        return (core as any)[cond.key];
    }
    if (cond.type === 'preference' && cond.key) {
        return parsePreferences(core.preferences).tags[cond.key] || 0;
    }
    if (cond.type === 'acquired_trait' && cond.key) {
        return acquiredTraitValue(core.preferences, cond.key);
    }
    return context[cond.key || cond.type];
}

function checkCondition(cond: AssetContractCondition, core: SubjectCoreState, context: Record<string, any>): boolean {
    const value = contractConditionValue(cond, core, context);
    return value !== undefined && compareValues(value, cond.operator, cond.value);
}

function compareValues(actual: any, operator: string = '==', target: any): boolean {
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
