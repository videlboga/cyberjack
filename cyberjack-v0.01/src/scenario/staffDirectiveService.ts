import { db } from '../infrastructure/db';
import { presetRepo } from '../infrastructure/repositories';
import { staffDirectiveRepo, StaffDirective } from '../infrastructure/staffDirectiveRepo';
import { subjectRepo } from '../infrastructure/repositories';
import { acquiredTraitValue, parsePreferences } from '../domain/conditioning';
import { AssetContract } from '../domain/types';

/**
 * Маппинг контрактного трейта на теги/точки, которые нужно тренировать,
 * чтобы поднять этот трейт. Совпадает с deriveAcquiredTraits в conditioning.ts.
 */
const TRAIT_TRAIN_TAGS: Record<string, string[]> = {
    trait_masochist: ['pain'],
    trait_knismolagnia: ['tickling'],
    trait_restraint_fetish: ['restraint'],
    trait_conditioned_submission: ['control', 'command', 'submission'],
    trait_exhibitionist: ['exposure', 'humiliation'],
    trait_clinical_fetish: ['clinical'],
    trait_electrophile: ['electronic'],
    trait_technophile: ['machine'],
    trait_sexual_dependency: ['sexual'],
    trait_chem_addict: ['chemical', 'drug'],
    trait_sensory_deprivation: ['deprivation'],
    trait_penetration: ['penetration', 'vagina', 'prostate', 'anus'],
    trait_point_clitoris: ['clitoris'],
    trait_point_feet: ['feet'],
    trait_point_lips: ['lips'],
};

/** Точка тела для трейта trait_point_* (если есть). */
const TRAIT_POINT: Record<string, string> = {
    trait_point_clitoris: 'clitoris',
    trait_point_feet: 'feet',
    trait_point_lips: 'lips',
};

/** Действия, которые тренируют конкретный тег (по тегам пресета). */
function actionsForTag(tag: string): { actionId: string; pointId: string }[] {
    const presets = presetRepo.getAllActionPresets();
    const out: { actionId: string; pointId: string }[] = [];
    for (const p of presets) {
        const tags = Array.isArray(p.tags) ? p.tags : [];
        if (!tags.includes(tag)) continue;
        // Точка по умолчанию — systemic, если у пресета нет явной.
        const pointId = (p as any).pointId || 'systemic';
        out.push({ actionId: p.id, pointId });
    }
    return out;
}

/** Текущее значение трейта у актива. */
function currentTraitValue(subjectId: string, traitId: string): number {
    const core = subjectRepo.get(subjectId);
    if (!core) return 0;
    return acquiredTraitValue(core.preferences, traitId);
}

/**
 * Определяет, какие теги нужно тренировать для выполнения контракта.
 * Возвращает список { tag, pointId, needed } — теги, где трейт ещё не достиг порога.
 */
export function trainingTargetsForContract(
    subjectId: string,
    contract: AssetContract,
): { tag: string; pointId: string; needed: number; current: number }[] {
    const targets: { tag: string; pointId: string; needed: number; current: number }[] = [];
    const conditions = contract.conditions || [];
    for (const cond of conditions) {
        if (cond.type !== 'acquired_trait' || !cond.key) continue;
        const traitId = cond.key;
        const trainTags = TRAIT_TRAIN_TAGS[traitId];
        if (!trainTags) continue;
        const current = currentTraitValue(subjectId, traitId);
        const needed = Number(cond.value ?? 0);
        if (current >= needed) continue; // уже достигнут
        const pointId = TRAIT_POINT[traitId] || 'systemic';
        for (const tag of trainTags) {
            targets.push({ tag, pointId, needed, current });
        }
    }
    return targets;
}

/**
 * Выбирает действие для сотрудника, чтобы продвинуть подготовку к контракту.
 * Возвращает null, если тренировать нечего (все трейты достигнуты).
 */
export function pickTrainingAction(
    subjectId: string,
    contract: AssetContract,
): { actionId: string; pointId: string; tag: string } | null {
    const targets = trainingTargetsForContract(subjectId, contract);
    if (!targets.length) return null;
    // Берём первый недостигнутый тег и первое подходящее действие.
    const target = targets[0];
    const actions = actionsForTag(target.tag);
    if (!actions.length) return null;
    const action = actions[0];
    return { actionId: action.actionId, pointId: target.pointId, tag: target.tag };
}

/**
 * Проверяет, достиг ли актив всех условий контракта (готов к сдаче).
 */
export function isContractReady(subjectId: string, contract: AssetContract): boolean {
    return trainingTargetsForContract(subjectId, contract).length === 0;
}

/** Текущее значение метрики актива (для condition-алгоритма). */
function metricValue(subjectId: string, metric: string): number {
    const core = subjectRepo.get(subjectId);
    if (!core) return 0;
    switch (metric) {
        case 'sensitivity': return core.sensitivity ?? 0;
        case 'capacity': return core.capacity ?? 0;
        case 'tension': return core.tension ?? 0;
        case 'attitude': return core.attitude ?? 0;
        case 'openness': return core.openness ?? 0;
        case 'plasticity': return core.plasticity ?? 0;
        default: return 0;
    }
}

/** Проверяет условие (metric op value). */
function checkCondition(subjectId: string, metric: string, operator: string, value: number): boolean {
    const current = metricValue(subjectId, metric);
    switch (operator) {
        case '>=': return current >= value;
        case '<=': return current <= value;
        case '>': return current > value;
        default: return false;
    }
}

/** Выбирает действие по спецификации алгоритма. */
function pickActionForSpec(
    subjectId: string,
    spec: NonNullable<StaffDirective['spec']>,
): { actionId: string; pointId: string } | null {
    switch (spec.kind) {
        case 'contract': {
            const contract = db.prepare(`SELECT * FROM asset_contracts WHERE id = ?`).get(spec.contractId) as any;
            if (!contract) return null;
            const typed: AssetContract = { ...contract, conditions: JSON.parse(contract.conditions || '[]') };
            const action = pickTrainingAction(subjectId, typed);
            return action ? { actionId: action.actionId, pointId: action.pointId } : null;
        }
        case 'sequence': {
            // Берём первое действие из серии.
            const first = spec.actions[0];
            if (!first) return null;
            return { actionId: first.actionId, pointId: first.pointId || 'systemic' };
        }
        case 'category': {
            // Выбираем действие, тренирующее любой из тегов категории.
            for (const tag of spec.tags) {
                const actions = actionsForTag(tag);
                if (actions.length) return { actionId: actions[0].actionId, pointId: actions[0].pointId };
            }
            return null;
        }
        case 'condition': {
            // Если условие истинно — выполняем основное действие, иначе else.
            const met = checkCondition(subjectId, spec.metric, spec.operator, spec.value);
            const actionId = met ? spec.actionId : spec.elseActionId;
            if (!actionId) return null;
            return { actionId, pointId: spec.pointId || 'systemic' };
        }
        default:
            return null;
    }
}

/**
 * Выполняет один шаг подготовки исполнителем (сотрудник или актив): выбирает
 * действие по активному поручению и возвращает его (для runGameTick).
 * Если поручений нет или всё достигнуто — возвращает null.
 */
export function nextExecutorAction(
    executorId: string,
    playerId = 'PL-1',
): { subjectId: string; actionId: string; pointId: string; directive: StaffDirective } | null {
    const directives = staffDirectiveRepo.listActiveForExecutor(executorId, playerId);
    for (const directive of directives) {
        // Если есть спецификация алгоритма — используем её.
        if (directive.spec) {
            const action = pickActionForSpec(directive.subjectId, directive.spec);
            if (action) {
                return { subjectId: directive.subjectId, actionId: action.actionId, pointId: action.pointId, directive };
            }
            // Алгоритм не дал действия (например, контракт достигнут) — завершаем.
            staffDirectiveRepo.complete(directive.id);
            continue;
        }
        // Обратная совместимость: указание с contractId без spec.
        if (directive.contractId) {
            const contract = db.prepare(`SELECT * FROM asset_contracts WHERE id = ?`).get(directive.contractId) as any;
            if (contract) {
                const typed: AssetContract = { ...contract, conditions: JSON.parse(contract.conditions || '[]') };
                const action = pickTrainingAction(directive.subjectId, typed);
                if (action) {
                    return { subjectId: directive.subjectId, actionId: action.actionId, pointId: action.pointId, directive };
                }
                staffDirectiveRepo.complete(directive.id);
                continue;
            }
        }
        continue;
    }
    return null;
}
