import { contractRepo } from '../infrastructure/contractRepo';
import { subjectRepo, characterRepo, sceneCharacterRepo, memoryRepo, characterRelationRepo, subjectiveAssociationRepo } from '../infrastructure/repositories';
import { contractConditionValue, evaluateAssetContract } from '../scenario/evaluateAssetContract';
import { db } from '../infrastructure/db';
import { getPlayerLocation, getWorldClock } from '../scenario/worldService';
import { enqueueBackgroundJob } from '../orchestration/backgroundJobs';
import { buildEmbedding } from './embeddingService';
import { addContractTrait } from './contractTraits';
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
    // Внешняя передача: актив уходит из лаборатории на срок durationMinutes.
    // Награда выплачивается при передаче; return_profile применяется при возврате.
    contract.state = 'in_transfer';
    contract.subject_id = subjectId;
    contract.attachedSubjectId = subjectId;
    contract.unavailableUntil = getWorldClock().totalMinutes + (contract.durationMinutes || 1440);
    contractRepo.save(contract);
    sceneCharacterRepo.set('scene_lab_calibrator', subjectId, { presenceState: 'absent' });

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

export interface CompleteContractResult {
  metRequirements: boolean;
  contract: AssetContract;
  subjectId: string;
  unmet?: string[];
}

/**
 * Сдаёт актив по контракту. Для внешней передачи (external_transfer) актив
 * помечается как in_transfer (отсутствует в лаборатории) и вернётся после
 * срока; последствия return_profile применяются при возврате.
 */
export function completeContract(contractId: string, subjectId: string): CompleteContractResult {
  const contract = contractRepo.get(contractId);
  if (!contract) throw new Error('Контракт не найден');
  if (contract.state !== 'accepted') throw new Error('Контракт не принят');

  // Персональный контракт требует именно своего актива.
  const boundSubjectId = contract.subject_id || (contract as any).subjectId;
  if (contract.personal && boundSubjectId && boundSubjectId !== subjectId) {
    throw new Error('Контракт привязан к конкретному активу');
  }

  const core = subjectRepo.get(subjectId);
  if (!core) throw new Error('Актив не найден');

  const evaluation = evaluateAssetContract(contract, core, {});
  if (!evaluation.metRequirements) {
    const unmet: string[] = [];
    for (const cond of contract.conditions) {
      const val = contractConditionValue(cond, core, {});
      if (val !== undefined && !compareOp(val, cond.operator ?? '==', cond.value)) {
        unmet.push(`${cond.key || cond.type}: ${typeof val === 'number' ? Math.round(val) : val} (нужно ${cond.operator} ${cond.value})`);
      }
    }
    return { metRequirements: false, contract, subjectId, unmet };
  }

  db.transaction(() => {
    if (contract.format === 'external_transfer' || contract.return_profile) {
      // Внешняя передача: актив уходит, вернётся после срока. Награда
      // выплачивается при передаче; return_profile применяется при возврате.
      contract.state = 'in_transfer';
      contract.subject_id = subjectId;
      contract.attachedSubjectId = subjectId;
      contract.unavailableUntil = getWorldClock().totalMinutes + (contract.durationMinutes || 1440);
      sceneCharacterRepo.set('scene_lab_calibrator', subjectId, { presenceState: 'absent' });
      const playerId = contract.acceptedByPlayerId || 'PL-1';
      if (contract.rewards.credits) {
        db.prepare(`INSERT INTO character_resources (character_id, resource_key, amount, metadata)
          VALUES (?, 'credits', ?, '{}')
          ON CONFLICT(character_id, resource_key) DO UPDATE SET amount = amount + excluded.amount`)
          .run(playerId, contract.rewards.credits);
      }
      if (contract.rewards.trust) {
        db.prepare(`INSERT INTO player_faction_states (player_id, faction_id, relation, trust, access_level, flags)
          VALUES (?, ?, 0, ?, 1, '[]')
          ON CONFLICT(player_id, faction_id) DO UPDATE SET trust = trust + excluded.trust`)
          .run(playerId, contract.issuerId, contract.rewards.trust);
      }
      for (const itemId of contract.rewards.items || []) {
        db.prepare(`INSERT INTO character_items (character_id, item_id, state, charges, metadata)
          VALUES (?, ?, 'active', -1, '{}')
          ON CONFLICT(character_id, item_id) DO UPDATE SET state = 'active'`)
          .run(playerId, itemId);
      }
    } else {
      // Локальный контракт: применяем последствия сразу.
      contract.state = 'completed';
      if (contract.rewards.credits) {
        db.prepare(`INSERT INTO character_resources (character_id, resource_key, amount, metadata)
          VALUES (?, 'credits', ?, '{}')
          ON CONFLICT(character_id, resource_key) DO UPDATE SET amount = amount + excluded.amount`)
          .run(contract.acceptedByPlayerId || 'PL-1', contract.rewards.credits);
      }
    }
    contractRepo.save(contract);
  })();

  return { metRequirements: true, contract, subjectId };
}

/** Отказ от контракта — применяет штрафы и помечает refused. */
export function refuseContract(contractId: string): AssetContract {
  const contract = contractRepo.get(contractId);
  if (!contract) throw new Error('Контракт не найден');
  const playerId = contract.acceptedByPlayerId || 'PL-1';
  db.transaction(() => {
    contract.state = 'refused';
    contractRepo.save(contract);
    const penalties = contract.penalties || {};
    if (penalties.credits) {
      db.prepare(`INSERT INTO character_resources (character_id, resource_key, amount, metadata)
        VALUES (?, 'credits', ?, '{}')
        ON CONFLICT(character_id, resource_key) DO UPDATE SET amount = amount + excluded.amount`)
        .run(playerId, penalties.credits);
    }
    if (penalties.trust) {
      db.prepare(`INSERT INTO player_faction_states (player_id, faction_id, relation, trust, access_level, flags)
        VALUES (?, ?, 0, ?, 1, '[]')
        ON CONFLICT(player_id, faction_id) DO UPDATE SET trust = trust + excluded.trust`)
        .run(playerId, contract.issuerId, penalties.trust);
    }
  })();
  return contract;
}

/**
 * Возврат актива из внешней передачи: применяет return_profile (острые
 * последствия, восстановление, трейты, память, ассоциации, отношения,
 * world_effects) и возвращает актив в лабораторию.
 */
export function returnAssetsFromTransfer(worldMinute: number): string[] {
  const returned: string[] = [];
  const transfers = db.prepare(
    `SELECT * FROM asset_contracts WHERE state = 'in_transfer' AND (unavailable_until IS NULL OR unavailable_until <= ?)`
  ).all(worldMinute) as any[];
  for (const row of transfers) {
    const contract = contractRepo._mapRow(row);
    const subjectId = contract.subject_id || contract.attachedSubjectId || (contract as any).subjectId;
    if (!subjectId) continue;
    db.transaction(() => {
      contract.state = 'completed';
      contractRepo.save(contract);
      if (contract.return_profile) {
        applyReturnProfile(subjectId, contract, contract.acceptedByPlayerId || 'PL-1');
      }
      if (contract.rewards?.newAsset) {
        createNewCandidateAsset(subjectId);
      }
      // Актив возвращается в лабораторию.
      sceneCharacterRepo.set('scene_lab_calibrator', subjectId, { presenceState: 'present', role: 'asset' });
    })();
    returned.push(subjectId);
  }
  return returned;
}

/**
 * Применяет return_profile контракта к активу: acute_state (параметры),
 * recovery (лимит baseline), травматические/временные трейты, ассоциации,
 * отношения, world_effects (facts/threads) и очередь памяти.
 */
export function applyReturnProfile(subjectId: string, contract: AssetContract, playerId: string): void {
  const profile = contract.return_profile;
  if (!profile) return;
  const core = subjectRepo.get(subjectId);
  if (!core) return;

  // acute_state — острые последствия.
  const acute = profile.acute_state || {};
  if (typeof acute.capacity === 'number') core.capacity = Math.max(0, acute.capacity);
  if (typeof acute.tension === 'number') core.tension = acute.tension;
  if (typeof acute.sensitivity === 'number') core.sensitivity = Math.max(0, core.sensitivity + acute.sensitivity);
  if (typeof acute.attitude === 'number') core.attitude = Math.max(0, core.attitude + acute.attitude);

  // recovery — ограничиваем baseline (необратимая деградация reserve).
  const recovery = profile.recovery || {};
  if (recovery.baselineCapacityLimit != null && core.baselineCapacity != null) {
    core.baselineCapacity = Math.round(core.baselineCapacity * recovery.baselineCapacityLimit);
  }
  subjectRepo.save(subjectId, core.name, core);

  // traits — травматические (постоянные) и временные (срок действия).
  const traits = profile.traits || {};
  for (const trait of traits.traumatic || []) {
    if (trait && trait.id) {
      addContractTrait(subjectId, trait.id, {
        source: `contract:${contract.id}`,
        kind: 'traumatic',
        acquiredMinute: getWorldClock().totalMinutes,
        tagPenalty: 0.6,
        response: trait.response,
        trigger: trait.trigger,
      });
    }
  }
  for (const trait of traits.temporary || []) {
    if (trait && trait.id) {
      addContractTrait(subjectId, trait.id, {
        source: `contract:${contract.id}`,
        kind: 'temporary',
        acquiredMinute: getWorldClock().totalMinutes,
        decayAfterMinutes: contract.durationMinutes || 1440,
        pointBoost: 1.5,
        tagBoost: 0.6,
        impulse: trait.impulse,
        decayCondition: trait.decayCondition,
      });
    }
  }

  // associations — травматические и новые.
  const assoc = profile.associations || {};
  const associations: Array<{ type: string; key: string; label: string; tagLinks: string[]; valence: number; strength: number; expectation: string }> = [];
  for (const a of assoc.traumatic || []) {
    if (typeof a === 'string') {
      associations.push({ type: 'context', key: a.split('→')[0] || a, label: a, tagLinks: [], valence: -0.7, strength: 0.7, expectation: 'avoid' });
    }
  }
  for (const a of assoc.new || []) {
    if (typeof a === 'string') {
      associations.push({ type: 'context', key: a.split('→')[0] || a, label: a, tagLinks: [], valence: 0.5, strength: 0.5, expectation: 'seek' });
    }
  }
  if (associations.length) {
    subjectiveAssociationRepo.replaceSource(subjectId, `contract:${contract.id}`, associations);
  }

  // relations — сдвиг к игроку.
  const rel = profile.relations || {};
  if (typeof rel.attitude === 'number') {
    const current = characterRelationRepo.get(subjectId, playerId);
    const base = current?.attitude ?? 50;
    characterRelationRepo.updateAttitude(subjectId, playerId, base + rel.attitude);
  }

  // world_effects — факты и нити.
  const worldEffects = profile.world_effects || {};
  for (const fact of worldEffects.facts || []) {
    db.prepare(`INSERT INTO world_facts (id, scope, scope_id, predicate, value, confidence, visibility, status, source_type, source_id, valid_from, tags, metadata)
      VALUES (?, 'world', NULL, 'contract_effect', ?, 1, 'known', 'active', 'contract', ?, ?, '[]', '{}')
      ON CONFLICT(id) DO NOTHING`)
      .run(`fact_${contract.id}_${Math.random().toString(36).slice(2, 8)}`, fact, contract.id, worldMinuteNow());
  }
  for (const thread of worldEffects.threads || []) {
    db.prepare(`INSERT INTO story_threads (id, type, title, status, stage, related_character_ids, facts, tags, tension, importance, visibility, source_type, source_id, created_minute, updated_minute, metadata)
      VALUES (?, 'contract', ?, 'open', 'new', ?, '[]', '[]', 0.3, 0.5, 'known', 'contract', ?, ?, ?, '{}')
      ON CONFLICT(id) DO NOTHING`)
      .run(`thread_${contract.id}_${Math.random().toString(36).slice(2, 8)}`, thread, JSON.stringify([subjectId]), contract.id, worldMinuteNow(), worldMinuteNow());
  }

  // memory — очередь консолидации памяти (идемпотентна).
  const memory = profile.memory || {};
  enqueueBackgroundJob({
    type: 'contract.memory',
    key: `contract:${contract.id}:${subjectId}`,
    subjectId,
    dueMinute: worldMinuteNow(),
    payload: {
      theme: memory.theme,
      fragments: memory.fragments || [],
      tags: memory.tags || [],
      source: `contract:${contract.id}`,
    },
  });
}

/** Текущее мировое время (минуты) — вспомогательный хелпер. */
function worldMinuteNow(): number {
  return getWorldClock().totalMinutes;
}

/** Редкая награда: создаёт нового кандидата в витрине/пуле. */
function createNewCandidateAsset(_sourceId: string): void {
  const id = `NPC-CAND-C${Math.floor(Date.now() / 1000) % 100000}`;
  db.prepare(
    `INSERT OR IGNORE INTO characters (id, name, kind, current_scene_id) VALUES (?, ?, 'npc', 'scene_broker')`
  ).run(id, 'Кандидат');
  sceneCharacterRepo.set('scene_broker', id, { role: 'candidate', presenceState: 'present' });
}
