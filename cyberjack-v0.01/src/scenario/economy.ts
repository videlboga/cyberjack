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
export const UPKEEP_BASE = 30;        // фикс. содержание за сутки
export const UPKEEP_PER_ASSET = 10;   // за каждого актива в лаборатории

/** Число активов, физически присутствующих в лаборатории (не в in_transfer). */
export function countLabAssets(playerId = 'PL-1'): number {
    const row = db.prepare(`
        SELECT COUNT(*) AS n
        FROM laboratory_room_assignments a
        JOIN characters c ON c.id = a.character_id
        WHERE a.player_id = ? AND a.status = 'resident'
    `).get(playerId) as { n: number } | undefined;
    return Number(row?.n || 0);
}

/** Стоимость содержания за сутки при текущем составе. */
export function dailyUpkeepCost(playerId = 'PL-1'): number {
    return UPKEEP_BASE + UPKEEP_PER_ASSET * countLabAssets(playerId);
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
