import { subjectPreferencesRepo } from '../infrastructure/repositories';
import { resolveContractTraitTarget } from '../domain/contractTraitMap';
import { db } from '../infrastructure/db';
import { getWorldClock } from '../scenario/worldService';

/**
 * Контрактные трейты (временные/травматические) из return_profile.
 *
 * Хранятся в `preferences.contractTraits` — структурированном поле рядом с
 * tags/points. Каждый трейт имеет источник (contract:<id>), время появления и
 * срок действия. Временные трейты добавляются и снимаются по игровому времени.
 *
 * Взаимодействие с существующей механикой:
 * - `deriveAcquiredTraits` учитывает contractTraits как модификаторы тегов/точек
 *   (см. conditioning.ts), поэтому контрактные трейты автоматически влияют на
 *   промпт, компульсии и автономные инициативы.
 * - `applyContractTraitDecay` вызывается из advanceWorldTime и снимает истёкшие
 *   временные трейты.
 */

export type ContractTraitKind = 'temporary' | 'traumatic';

export interface ContractTraitEntry {
    source: string;              // contract:<id>
    kind: ContractTraitKind;
    acquiredMinute: number;
    decayAfterMinutes?: number;  // для temporary: срок действия
    tagBoost?: number;           // прибавка к тегу (temporary)
    tagPenalty?: number;         // штраф к тегу (traumatic)
    pointBoost?: number;         // прибавка к точке (temporary)
    pointPenalty?: number;       // штраф к точке (traumatic)
    /** Текстовый импульс (temporary): навязчивое влечение, подаётся в промпт. */
    impulse?: string;
    /** Текстовая реакция (traumatic): страх/избегание, подаётся в промпт. */
    response?: string;
    /** Условие ослабления (temporary): восстановление, время, работа с памятью. */
    decayCondition?: string;
    /** Триггер (traumatic): что запускает реакцию. */
    trigger?: string;
}

export type ContractTraitsMap = Record<string, ContractTraitEntry>;

/** Читает contractTraits из preferences. */
export function readContractTraits(subjectId: string): ContractTraitsMap {
    const prefs = subjectPreferencesRepo.get(subjectId) as any;
    return (prefs.contractTraits || {}) as ContractTraitsMap;
}

/** Добавляет контрактный трейт (идемпотентно по trait_id). */
export function addContractTrait(subjectId: string, traitId: string, entry: ContractTraitEntry): void {
    const prefs = subjectPreferencesRepo.get(subjectId) as any;
    const traits = (prefs.contractTraits || {}) as ContractTraitsMap;
    // Идемпотентность: повторный возврат не дублирует boost.
    traits[traitId] = entry;
    prefs.contractTraits = traits;
    subjectPreferencesRepo.set(subjectId, prefs);
}

/** Снимает контрактный трейт. */
export function removeContractTrait(subjectId: string, traitId: string): void {
    const prefs = subjectPreferencesRepo.get(subjectId) as any;
    const traits = (prefs.contractTraits || {}) as ContractTraitsMap;
    if (!traits[traitId]) return;
    delete traits[traitId];
    prefs.contractTraits = traits;
    subjectPreferencesRepo.set(subjectId, prefs);
}

/**
 * Снимает истёкшие временные трейты по игровому времени.
 * Вызывается из advanceWorldTime.
 */
export function applyContractTraitDecay(subjectId: string, worldMinute: number): void {
    const prefs = subjectPreferencesRepo.get(subjectId) as any;
    const traits = (prefs.contractTraits || {}) as ContractTraitsMap;
    let changed = false;
    for (const [traitId, entry] of Object.entries(traits)) {
        if (entry.kind !== 'temporary') continue;
        if (entry.decayAfterMinutes == null) continue;
        if (worldMinute - entry.acquiredMinute >= entry.decayAfterMinutes) {
            delete traits[traitId];
            changed = true;
        }
    }
    if (changed) {
        prefs.contractTraits = traits;
        subjectPreferencesRepo.set(subjectId, prefs);
    }
}

/** Применяет все истёкшие временные трейты для всех субъектов. */
export function applyAllContractTraitDecay(worldMinute: number): void {
    const rows = db.prepare('SELECT id FROM subjects').all() as Array<{ id: string }>;
    for (const row of rows) applyContractTraitDecay(row.id, worldMinute);
}


/** Хелпер: текущее игровое время. */
export function nowMinute(): number {
    return getWorldClock().totalMinutes;
}
