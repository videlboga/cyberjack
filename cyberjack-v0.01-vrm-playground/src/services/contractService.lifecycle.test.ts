import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { contractRepo } from '../infrastructure/contractRepo';
import { subjectRepo, memoryRepo, subjectiveAssociationRepo, characterRelationRepo } from '../infrastructure/repositories';
import { completeContract, applyReturnProfile, refuseContract, returnAssetsFromTransfer } from './contractService';
import { ensureWorldSeed } from '../scenario/worldService';
import type { AssetContract } from '../domain/types';

const contract = (id: string, overrides: Partial<AssetContract> = {}): AssetContract => ({
    id, issuerId: 'fac_veil', title: 'Тест', description: '',
    state: 'accepted', acceptedByPlayerId: 'PL-1', deadlineTick: 1000,
    format: 'external_transfer', durationMinutes: 1440,
    conditions: [{ type: 'attitude', operator: '>=', value: 0 }], rewards: { credits: 100 }, penalties: { credits: -50, trust: -5 },
    return_profile: {
        memory: { theme: 'тест', fragments: ['фрагмент'], tags: ['tickling', 'feet'] },
        acute_state: { capacity: 5, tension: 85, sensitivity: 10, attitude: -15 },
        recovery: { baselineCapacityLimit: 0.25, method: 'капсула', durationDays: 3 },
        traits: {
            kept: ['trait_point_feet'],
            traumatic: [{ id: 'trauma_foot_stimulation', trigger: 'tickling/feet', response: 'страх' }],
            temporary: [{ id: 'anomaly_foot_echo', impulse: 'искать щекотку', decayCondition: 'время' }],
        },
        associations: { traumatic: ['ступни→негатив'], new: ['Аномалия→притягательная'] },
        relations: { attitude: -10, openness: 5, plasticity: 5 },
        world_effects: { facts: ['Veil провёл протокол'], threads: ['повторный запрос'] },
    },
    ...overrides,
});

beforeEach(() => {
    db.prepare('DELETE FROM asset_contracts').run();
    db.prepare('DELETE FROM character_resources WHERE character_id = ?').run('PL-1');
    db.prepare('DELETE FROM player_faction_states WHERE player_id = ?').run('PL-1');
    db.prepare('DELETE FROM subjects WHERE id = ?').run('SUB-1');
    db.prepare('DELETE FROM characters WHERE id = ?').run('SUB-1');
    db.prepare('DELETE FROM memory_embeddings WHERE subject_id = ?').run('SUB-1');
    db.prepare('DELETE FROM subjective_associations WHERE subject_id = ?').run('SUB-1');
    db.prepare('DELETE FROM character_relations WHERE from_id = ? OR to_id = ?').run('SUB-1', 'SUB-1');
    db.prepare('DELETE FROM world_facts WHERE source_id = ?').run('C-1');
    db.prepare('DELETE FROM story_threads WHERE source_id = ?').run('C-1');
    // Seed the world first so ensureWorldSeed's guard is set; otherwise the
    // first getPlayerLocation() call re-seeds and resets PL-1 to the lab.
    ensureWorldSeed();
    // PL-1 must be at the liaison office to complete/refuse contracts
    db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('PL-1', 'Калибратор', 'player', 'scene_liaison')
        ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_liaison'`).run();
});

describe('contract lifecycle (пересборка)', () => {
    it('completeContract dispatches to in_transfer; returnAssetsFromTransfer applies return_profile', () => {
        contractRepo.save(contract('C-1'));
        subjectRepo.save('SUB-1', 'Тест', {
            sensitivity: 70, capacity: 60, openness: 65, plasticity: 60, attitude: 60,
            tension: 0, baselineCapacity: 60, baselineSensitivity: 70,
        });
        // Актив должен присутствовать в лаборатории для отправки.
        db.prepare(`INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role, can_act, presence_state) VALUES ('scene_lab_calibrator', 'SUB-1', 'participant', 1, 'present')`).run();

        const result = completeContract('C-1', 'SUB-1');

        expect(result.metRequirements).toBe(true);
        // Отправка переводит в in_transfer, последствия НЕ применяются.
        expect(contractRepo.get('C-1')!.state).toBe('in_transfer');
        const coreAfterDispatch = subjectRepo.get('SUB-1')!;
        expect(coreAfterDispatch.capacity).toBe(60); // не тронут

        // Возврат по истечении срока применяет последствия.
        const c = contractRepo.get('C-1')!;
        c.unavailableUntil = 1; // срок истёк
        contractRepo.save(c);
        const returned = returnAssetsFromTransfer(1000);
        expect(returned).toContain('SUB-1');
        expect(contractRepo.get('C-1')!.state).toBe('completed');

        // acute_state applied
        const core = subjectRepo.get('SUB-1')!;
        expect(core.capacity).toBe(5);
        expect(core.tension).toBe(85);
        expect(core.sensitivity).toBe(80); // 70 + 10
        expect(core.attitude).toBe(45);   // 60 - 15
        // recovery: baseline limited to 25% of pre-contract (60) = 15
        expect(core.baselineCapacity).toBe(15);

        // memory episode queued (идемпотентная очередь contract.memory)
        const queued = db.prepare(`SELECT * FROM background_jobs WHERE type = 'contract.memory' AND key = 'contract:C-1:SUB-1'`).get() as any;
        expect(queued).toBeDefined();
        expect(JSON.parse(queued.payload).tags).toContain('tickling');

        // associations created
        const assoc = db.prepare('SELECT * FROM subjective_associations WHERE subject_id = ?').all('SUB-1') as any[];
        expect(assoc.length).toBeGreaterThan(0);

        // relations updated
        const rel = characterRelationRepo.get('SUB-1', 'PL-1');
        expect(rel).not.toBeNull();
        expect(rel!.attitude).toBe(40); // 50 + (-10)

        // world facts + threads
        const facts = db.prepare('SELECT * FROM world_facts WHERE source_id = ?').all('C-1') as any[];
        expect(facts.length).toBe(1);
        const threads = db.prepare('SELECT * FROM story_threads WHERE source_id = ?').all('C-1') as any[];
        expect(threads.length).toBe(1);
    });

    it('refuseContract applies penalties and marks failed', () => {
        contractRepo.save(contract('C-2'));
        const result = refuseContract('C-2');
        expect(contractRepo.get('C-2')!.state).toBe('refused');
        expect(result.penalties?.credits).toBe(-50);
        const credits = db.prepare('SELECT amount FROM character_resources WHERE character_id = ? AND resource_key = ?').get('PL-1', 'credits') as any;
        expect(credits.amount).toBe(-50);
    });

    it('applyReturnProfile is idempotent-safe (no crash on missing profile)', () => {
        contractRepo.save(contract('C-3', { return_profile: undefined }));
        subjectRepo.save('SUB-1', 'Тест', { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 0 });
        expect(() => applyReturnProfile('SUB-1', contractRepo.get('C-3')!, 'PL-1')).not.toThrow();
    });
});
