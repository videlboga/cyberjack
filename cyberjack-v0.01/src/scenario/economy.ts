import { db } from '../infrastructure/db';
import { resourceRepo } from '../infrastructure/repositories';

/**
 * Экономика лаборатории.
 *
 * Единственный источник дохода — контракты (выплата при передаче актива).
 * Ежедневное содержание списывается за каждые пересечённые сутки и зависит
 * от числа активов, физически находящихся в лаборатории (не на контрактах):
 * фиксированная ставка + ставка за каждого актива.
 */
export const UPKEEP_BASE = 40;        // фикс. содержание лаборатории за сутки
export const UPKEEP_PER_ASSET = 25;   // за каждого актива в лаборатории
export const UPKEEP_PER_EQUIPMENT = 15; // за каждое установленное оборудование
export const UPKEEP_PER_STAFF = 30;   // зарплата за каждого сотрудника (staff/assistant)

/** Число активов, физически присутствующих в лаборатории (не в in_transfer). */
export function countLabAssets(playerId = 'PL-1'): number {
    const row = db.prepare(`
        SELECT COUNT(*) AS n
        FROM laboratory_room_assignments a
        JOIN characters c ON c.id = a.character_id
        JOIN scene_characters sc ON sc.character_id = a.character_id AND sc.scene_id = 'scene_lab_calibrator'
        WHERE a.player_id = ? AND a.status = 'resident' AND sc.role = 'asset'
    `).get(playerId) as { n: number } | undefined;
    return Number(row?.n || 0);
}

/** Число сотрудников (staff/assistant), нанятых в лаборатории. */
export function countLabStaff(playerId = 'PL-1'): number {
    const row = db.prepare(`
        SELECT COUNT(*) AS n
        FROM laboratory_room_assignments a
        JOIN characters c ON c.id = a.character_id
        JOIN scene_characters sc ON sc.character_id = a.character_id AND sc.scene_id = 'scene_lab_calibrator'
        WHERE a.player_id = ? AND a.status = 'resident' AND sc.role IN ('staff', 'assistant')
    `).get(playerId) as { n: number } | undefined;
    return Number(row?.n || 0);
}

/** Покупаемые модули оборудования (не декор, не стартовый стол). */
const PAID_EQUIPMENT_IDS = new Set([
    'lab_recovery_capsule',
    'lab_sex_machine_vaginal',
    'lab_sex_machine_anal',
    'lab_sex_machine_tickling',
    'lab_mental_correction_chair',
]);

/** Число установленного платного оборудования (без декора и стартового стола). */
export function countLabEquipment(playerId = 'PL-1'): number {
    const ids = [...PAID_EQUIPMENT_IDS];
    const placeholders = ids.map(() => '?').join(',');
    const row = db.prepare(`
        SELECT COUNT(*) AS n
        FROM laboratory_assets
        WHERE player_id = ? AND state = 'installed' AND asset_id IN (${placeholders})
    `).get(playerId, ...ids) as { n: number } | undefined;
    return Number(row?.n || 0);
}

/** Стоимость содержания за сутки при текущем составе. */
export function dailyUpkeepCost(playerId = 'PL-1'): number {
    return UPKEEP_BASE
        + UPKEEP_PER_ASSET * countLabAssets(playerId)
        + UPKEEP_PER_EQUIPMENT * countLabEquipment(playerId)
        + UPKEEP_PER_STAFF * countLabStaff(playerId);
}

/**
 * Списывает содержание за все сутки, пересечённые с последнего списания.
 * Идемпотентно по `world_state.last_upkeep_day`: каждый день списывается ровно
 * один раз, независимо от того, одной перемоткой или несколькими он пройден.
 */
export function applyDailyUpkeep(worldMinute: number, playerId = 'PL-1'): number {
    const state = db.prepare(`SELECT total_minutes, last_upkeep_day FROM world_state WHERE id = 'main'`).get() as any;
    if (!state) return 0;
    const currentDay = Math.floor(worldMinute / 1440) + 1;
    const lastDay = Number(state.last_upkeep_day || 1);
    if (currentDay <= lastDay) return 0;

    const cost = dailyUpkeepCost(playerId);
    const days = currentDay - lastDay;
    const total = cost * days;

    const credits = resourceRepo.get(playerId)?.resources.credits?.amount || 0;
    const remaining = Math.max(0, credits - total);
    resourceRepo.save({
        id: playerId,
        resources: {
            credits: { characterId: playerId, resourceKey: 'credits', amount: remaining, maxAmount: 1000000, regenRate: 0 },
        },
    });
    db.prepare(`UPDATE world_state SET last_upkeep_day = ? WHERE id = 'main'`).run(currentDay);
    return total;
}
