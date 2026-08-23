import { db } from '../infrastructure/db';
import { contractRepo } from '../infrastructure/contractRepo';
import { CONTRACT_DATA } from '../infrastructure/contractData';
import { PERSONAL_CONTRACT_DATA } from '../infrastructure/personalContracts';
import { evaluateAssetContract } from '../scenario/evaluateAssetContract';
import { subjectRepo } from '../infrastructure/repositories';
import type { AssetContract } from '../domain/types';

/**
 * Ограниченный случайный пул стандартных контрактов.
 *
 * Стандартные контракты хранятся как шаблоны (CONTRACT_DATA), но НЕ все
 * доступны сразу. Периодически (из advanceWorldTime) формируется ограниченный
 * пул предложений: только несколько одновременно, только внешние передачи,
 * только с подходящим активом в лаборатории, с cooldown.
 *
 * Параметры вариативные — балансируются позже.
 */

export const CONTRACT_POOL_CONFIG = {
    /** Сколько стандартных контрактов одновременно в пуле. */
    poolSize: 5,
    /** Cooldown после появления/выполнения/отказа (в минутах). */
    cooldownMinutes: 2 * 1440,
    /** Минимальное игровое время для начала выдачи. */
    startMinute: 540,
};

/** Проверяет, есть ли в лаборатории хотя бы один подходящий актив. */
function hasSuitableAsset(contract: AssetContract): boolean {
    const subjects = db.prepare('SELECT id FROM subjects').all() as Array<{ id: string }>;
    for (const subject of subjects) {
        if (subject.id === 'PL-1') continue;
        // Исключаем отсутствующих (в in_transfer) и уже переданных активов.
        const inTransfer = db.prepare(
            `SELECT 1 FROM asset_contracts WHERE attached_subject_id = ? AND state = 'in_transfer'`
        ).get(subject.id) as any;
        if (inTransfer) continue;
        const presence = db.prepare(
            `SELECT presence_state FROM scene_characters WHERE character_id = ?`
        ).get(subject.id) as any;
        if (!presence || presence.presence_state !== 'present') continue;
        try {
            const core = subjectRepo.get(subject.id);
            if (!core) { continue; }
            const evaluation = evaluateAssetContract({ ...contract, state: 'accepted' }, core, {});
            if (evaluation.metRequirements) return true;
        } catch (e: any) { }
    }
    return false;
}

/** Считает, сколько стандартных контрактов сейчас в пуле (available). */
function countAvailableStandard(): number {
    const row = db.prepare(
        `SELECT COUNT(*) AS count FROM asset_contracts WHERE state = 'available' AND (personal IS NULL OR personal = 0)`
    ).get() as { count: number };
    return Number(row.count) || 0;
}

/** Проверяет cooldown для шаблона (по последнему событию). */
function isOnCooldown(templateId: string, now: number): boolean {
    // Cooldown по последнему появлению в пуле.
    const row = db.prepare(
        `SELECT world_minute FROM scenario_events WHERE type = 'contract_pool' AND title = ? ORDER BY id DESC LIMIT 1`
    ).get(templateId) as { world_minute?: number } | undefined;
    if (row && row.world_minute != null && now - Number(row.world_minute) < CONTRACT_POOL_CONFIG.cooldownMinutes) {
        return true;
    }
    // Cooldown по терминальному состоянию (выполнен/отказан/просрочен) —
    // контракт не должен мгновенно вернуться в пул после завершения.
    const terminal = db.prepare(
        `SELECT state FROM asset_contracts WHERE id = ? AND state IN ('completed', 'refused', 'expired')`
    ).get(templateId) as { state?: string } | undefined;
    if (terminal && terminal.state) {
        const done = db.prepare(
            `SELECT world_minute FROM scenario_events WHERE title = ? AND type IN ('contract_completed', 'contract_refused', 'contract_expired') ORDER BY id DESC LIMIT 1`
        ).get(templateId) as { world_minute?: number } | undefined;
        if (done && done.world_minute != null && now - Number(done.world_minute) < CONTRACT_POOL_CONFIG.cooldownMinutes) {
            return true;
        }
    }
    return false;
}

/**
 * Формирует ограниченный пул стандартных контрактов.
 * Вызывается из advanceWorldTime.
 */
export function ensureContractPool(now: number): void {
    if (now < CONTRACT_POOL_CONFIG.startMinute) { return; }
    const current = countAvailableStandard();
    if (current >= CONTRACT_POOL_CONFIG.poolSize) return;

    // Кандидаты: внешние передачи, не на cooldown, с подходящим активом.
    const candidates = CONTRACT_DATA.filter(c => {
        if (c.format !== 'external_transfer') { return false; }
        if (isOnCooldown(c.id, now)) { return false; }
        return hasSuitableAsset(c as AssetContract);
    });

    // Случайный выбор из допустимого пула.
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const need = CONTRACT_POOL_CONFIG.poolSize - current;
    for (const c of shuffled.slice(0, need)) {
        const existing = contractRepo.get(c.id);
        // Активный контракт (принят/в передаче) не перевыдаётся.
        // Терминальные (completed/refused/expired) перевыдаются после cooldown.
        if (existing && (existing.state === 'accepted' || existing.state === 'in_transfer')) continue;
        contractRepo.save({
            id: c.id,
            issuerId: c.issuerId,
            title: c.title,
            description: c.description,
            state: 'available',
            acceptedByPlayerId: undefined,
            attachedSubjectId: undefined,
            deadlineTick: undefined,
            format: c.format,
            durationMinutes: c.durationMinutes,
            offerDeadlineMinutes: c.offerDeadlineMinutes,
            return_profile: c.return_profile,
            conditions: c.conditions as any,
            rewards: c.rewards as any,
            penalties: c.penalties as any,
            difficulty: c.difficulty,
            cruelty: c.cruelty,
        });
        // Отмечаем появление (cooldown).
        db.prepare(
            `INSERT INTO scenario_events (type, title, description, world_minute) VALUES ('contract_pool', ?, ?, ?)`
        ).run(c.id, `Появился контракт ${c.title}`, now);
    }
}

/**
 * Выдаёт следующий этап персональной линии, когда предыдущий разрешён.
 * Линия определяется по префиксу id (contract_personal_<name>_NN).
 * Следующий этап появляется только после completed предыдущего.
 */
export function ensurePersonalContractLine(now: number): void {
    // Группируем персональные контракты по линиям (префикс до _NN).
    const lines = new Map<string, typeof PERSONAL_CONTRACT_DATA>();
    for (const c of PERSONAL_CONTRACT_DATA) {
        const m = /^(.*)_\d+$/.exec(c.id);
        if (!m) continue;
        const prefix = m[1];
        if (!lines.has(prefix)) lines.set(prefix, []);
        lines.get(prefix)!.push(c);
    }

    for (const [prefix, stages] of lines) {
        // Сортируем этапы по номеру.
        const sorted = [...stages].sort((a, b) => {
            const na = Number(/_(\d+)$/.exec(a.id)?.[1] || 0);
            const nb = Number(/_(\d+)$/.exec(b.id)?.[1] || 0);
            return na - nb;
        });
        // Находим последний разрешённый (completed) этап.
        let lastCompleted = -1;
        for (let i = 0; i < sorted.length; i++) {
            const existing = contractRepo.get(sorted[i].id);
            if (existing && existing.state === 'completed') lastCompleted = i;
        }
        // Следующий этап после последнего completed.
        const nextIndex = lastCompleted + 1;
        if (nextIndex >= sorted.length) continue;
        const next = sorted[nextIndex];
        const existing = contractRepo.get(next.id);
        // Уже доступен — не дублируем.
        if (existing && existing.state === 'available') continue;
        // Терминальное состояние (refused/expired/completed) блокирует перевыдачу:
        // этап не возвращается в пул после отказа или просрочки.
        if (existing && (existing.state === 'refused' || existing.state === 'expired' || existing.state === 'completed')) continue;
        // Выдаём следующий этап.
        contractRepo.save({
            id: next.id,
            issuerId: next.issuerId,
            title: next.title,
            description: next.description,
            state: 'available',
            acceptedByPlayerId: undefined,
            attachedSubjectId: undefined,
            subjectId: next.subjectId,
            personal: true,
            deadlineTick: undefined,
            format: next.format,
            durationMinutes: next.durationMinutes,
            offerDeadlineMinutes: next.offerDeadlineMinutes,
            return_profile: next.return_profile,
            conditions: next.conditions as any,
            rewards: next.rewards as any,
            penalties: next.penalties as any,
            difficulty: next.difficulty,
            cruelty: next.cruelty,
        });
    }
}
