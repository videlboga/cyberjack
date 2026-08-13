import { contractRepo } from '../infrastructure/contractRepo';
import { subjectRepo } from '../infrastructure/repositories';
import { contractConditionValue, evaluateAssetContract } from '../scenario/evaluateAssetContract';
import { db } from '../infrastructure/db';
import { getPlayerLocation, getWorldClock } from '../scenario/worldService';
import type { AssetContract, AssetContractCondition } from '../domain/types';

/**
 * Этап 8. Application service для контрактов.
 *
 * Выносит бизнес-логику приёма/сдачи контрактов из контроллера.
 * Контроллер валидирует транспортный ввод, вызывает один сервис и
 * отображает результат.
 */

export function compareOp(actual: any, operator: string, target: any): boolean {
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

export interface AcceptContractResult {
  contract: AssetContract;
}

export function acceptContract(contractId: string, playerId: string): AcceptContractResult {
  if (getPlayerLocation(playerId).id !== 'scene_liaison') {
    throw new Error('Контракты принимаются в офисе Связного');
  }
  const contract = contractRepo.get(contractId);
  if (!contract) {
    throw new Error('Контракт не найден');
  }
  if (contract.state !== 'available') {
    throw new Error('Контракт уже недоступен');
  }
  contract.state = 'accepted';
  contract.acceptedByPlayerId = playerId;
  contract.attachedSubjectId = undefined;
  contract.deadlineTick = getWorldClock().totalMinutes + 3 * 1440;
  contractRepo.save(contract);
  return { contract };
}

export interface DeliverContractResult {
  metRequirements: boolean;
  contract: AssetContract;
  deliveredSubjectId: string;
  rewards: AssetContract['rewards'];
  unmet?: string[];
}

export function deliverContract(contractId: string, subjectId: string): DeliverContractResult {
  const contract = contractRepo.get(contractId);
  if (!contract) {
    throw new Error('Контракт не найден');
  }
  if (contract.state !== 'accepted') {
    throw new Error('Контракт не принят');
  }
  const playerId = contract.acceptedByPlayerId || 'PL-1';
  if (getPlayerLocation(playerId).id !== 'scene_liaison') {
    throw new Error('Передача актива проводится через офис Связного');
  }
  if (!subjectId) {
    throw new Error('Выберите актив для передачи');
  }
  const core = subjectRepo.get(subjectId);
  if (!core) {
    throw new Error('Актив не найден');
  }

  const evaluation = evaluateAssetContract(contract, core, {});
  if (!evaluation.metRequirements) {
    const unmet: string[] = [];
    for (const cond of contract.conditions) {
      const val = contractConditionValue(cond, core, {});
      if (val !== undefined && !compareOp(val, cond.operator ?? '==', cond.value)) {
        unmet.push(`${cond.type === 'attitude' ? 'Принятие' : cond.key || cond.type}: ${typeof val === 'number' ? Math.round(val) : val} (нужно ${cond.operator} ${cond.value})`);
      }
    }
    return { metRequirements: false, contract, deliveredSubjectId: subjectId, rewards: contract.rewards, unmet };
  }

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

  return { metRequirements: true, contract, deliveredSubjectId: subjectId, rewards: contract.rewards };
}

export interface ContractProgressResult {
  contract: AssetContract;
  subjectId: string;
  conditions: Array<AssetContractCondition & { current: any; met: boolean }>;
  metAll: boolean;
}

export function getContractProgress(contractId: string, subjectId: string): ContractProgressResult {
  const contract = contractRepo.get(contractId);
  if (!contract) throw new Error('Контракт не найден');
  const core = subjectRepo.get(subjectId);
  if (!core) throw new Error('Актив не найден');
  const conditions = contract.conditions.map((condition: any) => {
    const current = contractConditionValue(condition, core, {});
    return { ...condition, current, met: current !== undefined && compareOp(current, condition.operator || '==', condition.value) };
  });
  return { contract, subjectId, conditions, metAll: conditions.length > 0 && conditions.every(c => c.met) };
}

export function getActiveContract(playerId: string, subjectId?: string) {
  const accepted = contractRepo.listForPlayer(playerId);
  const active = accepted.find(c => c.state === 'accepted');
  if (!active) return { contract: null, progress: null };
  let progress = null;
  if (subjectId) {
    const core = subjectRepo.get(subjectId);
    if (core) {
      const evaluation = evaluateAssetContract(active, core, {});
      progress = {
        metRequirements: evaluation.metRequirements,
        conditions: active.conditions.map((cond: any) => {
          const current = contractConditionValue(cond, core, {});
          return { ...cond, current, met: current !== undefined ? compareOp(current, cond.operator ?? '==', cond.value) : false };
        })
      };
    }
  }
  return { contract: active, progress };
}

/**
 * Этап 4. Просроченные контракты.
 *
 * Принятый контракт с истёкшим deadlineTick помечается `expired`, и к игроку
 * применяются штрафы (penalties). Вызывается из advanceSimulationTime после
 * продвижения времени, поэтому дедлайн считается по авторитетному worldMinute.
 */
export function expireOverdueContracts(worldMinute: number): string[] {
  const expired: string[] = [];
  const accepted = db.prepare(
    `SELECT * FROM asset_contracts WHERE state = 'accepted' AND deadline_tick IS NOT NULL AND deadline_tick <= ?`
  ).all(worldMinute) as any[];
  for (const row of accepted) {
    const contract = contractRepo._mapRow(row);
    const playerId = contract.acceptedByPlayerId || 'PL-1';
    const penalties = contract.penalties || {};
    db.transaction(() => {
      contract.state = 'expired';
      contractRepo.save(contract);
      if (penalties.credits) {
        db.prepare(`
          INSERT INTO character_resources (character_id, resource_key, amount, metadata)
          VALUES (?, 'credits', ?, '{}')
          ON CONFLICT(character_id, resource_key) DO UPDATE SET amount = amount + excluded.amount
        `).run(playerId, penalties.credits);
      }
      if (penalties.trust) {
        db.prepare(`
          INSERT INTO player_faction_states (player_id, faction_id, relation, trust, access_level, flags)
          VALUES (?, ?, 0, ?, 1, '[]')
          ON CONFLICT(player_id, faction_id) DO UPDATE SET trust = trust + excluded.trust
        `).run(playerId, contract.issuerId, penalties.trust);
      }
    })();
    expired.push(contract.id);
  }
  return expired;
}
