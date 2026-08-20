import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { contractRepo } from '../infrastructure/contractRepo';
import { subjectRepo, characterRepo, memoryRepo } from '../infrastructure/repositories';
import { acceptContract, completeContract, refuseContract, returnAssetsFromTransfer, applyReturnProfile } from './contractService';
import { ensureWorldSeed, resetWorldSeed, advanceWorldTime, getWorldClock } from '../scenario/worldService';
import type { AssetContract } from '../domain/types';

const contract = (id: string, overrides: Partial<AssetContract> = {}): AssetContract => ({
    id, issuerId: 'fac_veil', title: 'Тест', description: '',
    state: 'available', acceptedByPlayerId: 'PL-1', deadlineTick: 1000,
    format: 'external_transfer', durationMinutes: 1440,
    conditions: [{ type: 'attitude', operator: '>=', value: 0 }], rewards: { credits: 100 }, penalties: { credits: -50, trust: -5 },
    return_profile: {
        memory: { theme: 'тест', fragments: ['фрагмент'], tags: ['tickling', 'feet'] },
        acute_state: { capacity: 5, tension: 85, sensitivity: 10, attitude: -15 },
        recovery: { baselineCapacityLimit: 0.25, method: 'капсула', durationDays: 3 },
        traits: { kept: [], traumatic: [], temporary: [] },
        associations: { traumatic: [], new: [] },
        relations: { attitude: -10, openness: 5, plasticity: 5 },
        world_effects: { facts: ['факт'], threads: ['нить'] },
    },
    ...overrides,
});

const setupSubject = (id: string, capacity = 60) => {
    subjectRepo.save(id, 'Тест', {
        sensitivity: 70, capacity, openness: 65, plasticity: 60, attitude: 60,
        tension: 0, baselineCapacity: capacity, baselineSensitivity: 70,
    });
    db.prepare(`INSERT INTO scene_characters (scene_id, character_id, role, presence_state) VALUES ('scene_lab_calibrator', ?, 'asset', 'present')`).run(id);
};

beforeEach(() => {
    resetWorldSeed();
    ensureWorldSeed();
    db.prepare('DELETE FROM asset_contracts').run();
    db.prepare('DELETE FROM character_resources WHERE character_id = ?').run('PL-1');
    db.prepare('DELETE FROM player_faction_states WHERE player_id = ?').run('PL-1');
    db.prepare('DELETE FROM subjects WHERE id IN (?, ?)').run('SUB-1', 'SUB-2');
    db.prepare('DELETE FROM characters WHERE id IN (?, ?)').run('SUB-1', 'SUB-2');
    db.prepare('DELETE FROM memory_embeddings WHERE subject_id IN (?, ?)').run('SUB-1', 'SUB-2');
    db.prepare('DELETE FROM scene_characters WHERE character_id IN (?, ?)').run('SUB-1', 'SUB-2');
    db.prepare('DELETE FROM world_facts WHERE source_id IN (?, ?)').run('C-1', 'C-2');
    db.prepare('DELETE FROM story_threads WHERE source_id IN (?, ?)').run('C-1', 'C-2');
    db.prepare(`UPDATE world_state SET total_minutes = 480, last_upkeep_day = 1 WHERE id = 'main'`).run();
    // PL-1 at liaison office
    db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('PL-1', 'Калибратор', 'player', 'scene_liaison')
        ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_liaison'`).run();
});

describe('Этап 6: проверка сценариев', () => {
    it('1. принятие стандартной передачи и возврат с последствиями', () => {
        contractRepo.save(contract('C-1'));
        setupSubject('SUB-1');
        acceptContract('C-1', 'PL-1');
        expect(contractRepo.get('C-1')!.state).toBe('accepted');

        const result = completeContract('C-1', 'SUB-1');
        expect(result.metRequirements).toBe(true);
        expect(contractRepo.get('C-1')!.state).toBe('in_transfer');
        // внешняя передача: актив отсутствует
        const presence = db.prepare('SELECT presence_state FROM scene_characters WHERE character_id = ?').get('SUB-1') as any;
        expect(presence.presence_state).toBe('absent');
        // последствия НЕ применены при отправке
        let core = subjectRepo.get('SUB-1')!;
        expect(core.capacity).toBe(60);
        // возврат по истечении срока применяет последствия
        const c = contractRepo.get('C-1')!;
        c.unavailableUntil = 1;
        contractRepo.save(c);
        returnAssetsFromTransfer(1000);
        expect(contractRepo.get('C-1')!.state).toBe('completed');
        core = subjectRepo.get('SUB-1')!;
        expect(core.capacity).toBe(5);
        expect(core.baselineCapacity).toBe(15); // 25% от 60
    });

    it('3. отказ применяет штрафы', () => {
        contractRepo.save(contract('C-1'));
        acceptContract('C-1', 'PL-1');
        refuseContract('C-1');
        expect(contractRepo.get('C-1')!.state).toBe('refused');
        const credits = db.prepare('SELECT amount FROM character_resources WHERE character_id = ? AND resource_key = ?').get('PL-1', 'credits') as any;
        expect(credits.amount).toBe(-50);
    });

    it('4. просрочка помечает expired и применяет штрафы', () => {
        contractRepo.save(contract('C-1'));
        acceptContract('C-1', 'PL-1');
        // acceptContract ставит дедлайн = now + 3 дня. Сдвигаем его в прошлое.
        const now = getWorldClock().totalMinutes;
        const c = contractRepo.get('C-1')!;
        c.deadlineTick = now - 1;
        contractRepo.save(c);
        // переводим время за дедлайн
        advanceWorldTime(60, 'test');
        expect(contractRepo.get('C-1')!.state).toBe('expired');
    });

    it('5. возврат из внешней передачи после истечения срока', () => {
        contractRepo.save(contract('C-1', { durationMinutes: 60 }));
        setupSubject('SUB-1');
        acceptContract('C-1', 'PL-1');
        completeContract('C-1', 'SUB-1');
        // актив отсутствует
        let presence = db.prepare('SELECT presence_state FROM scene_characters WHERE character_id = ?').get('SUB-1') as any;
        expect(presence.presence_state).toBe('absent');
        // через 60 минут возвращается
        advanceWorldTime(60, 'test');
        presence = db.prepare('SELECT presence_state FROM scene_characters WHERE character_id = ?').get('SUB-1') as any;
        expect(presence.presence_state).toBe('present');
    });

    it('6. персональный контракт требует именно своего актива', () => {
        contractRepo.save(contract('C-1', { personal: true, subjectId: 'SUB-1' }));
        setupSubject('SUB-1');
        setupSubject('SUB-2');
        acceptContract('C-1', 'PL-1');
        // чужой актив отклоняется
        expect(() => completeContract('C-1', 'SUB-2')).toThrow('привязан к конкретному активу');
        // свой актив проходит
        const result = completeContract('C-1', 'SUB-1');
        expect(result.metRequirements).toBe(true);
    });

    it('7. нет окончательной потери актива в обычном цикле', () => {
        contractRepo.save(contract('C-1'));
        setupSubject('SUB-1');
        acceptContract('C-1', 'PL-1');
        completeContract('C-1', 'SUB-1');
        // актив не удалён из characters/subjects
        expect(characterRepo.get('SUB-1')).not.toBeNull();
        expect(subjectRepo.get('SUB-1')).not.toBeNull();
        // и возвращается после срока
        advanceWorldTime(1440, 'test');
        const presence = db.prepare('SELECT presence_state FROM scene_characters WHERE character_id = ?').get('SUB-1') as any;
        expect(presence.presence_state).toBe('present');
    });

    it('8. повторное давление на невосстановившегося актива', () => {
        contractRepo.save(contract('C-1'));
        setupSubject('SUB-1', 60);
        acceptContract('C-1', 'PL-1');
        completeContract('C-1', 'SUB-1');
        // возврат применяет последствия: актив истощён (capacity 5, baseline 15)
        const c1 = contractRepo.get('C-1')!;
        c1.unavailableUntil = 1;
        contractRepo.save(c1);
        returnAssetsFromTransfer(1000);
        const core = subjectRepo.get('SUB-1')!;
        expect(core.capacity).toBe(5);
        // повторный контракт на истощённого — условия не выполняются (capacity низкая)
        contractRepo.save(contract('C-2', { conditions: [{ type: 'custom', key: 'capacity', operator: '>=', value: 50 }] }));
        acceptContract('C-2', 'PL-1');
        const result = completeContract('C-2', 'SUB-1');
        expect(result.metRequirements).toBe(false); // не может сдать истощённого
    });

    it('9. редкая награда создаёт нового кандидата при возврате', () => {
        contractRepo.save(contract('C-1', { rewards: { newAsset: true } }));
        setupSubject('SUB-1');
        acceptContract('C-1', 'PL-1');
        completeContract('C-1', 'SUB-1');
        // возврат применяет награду newAsset
        const c = contractRepo.get('C-1')!;
        c.unavailableUntil = 1;
        contractRepo.save(c);
        returnAssetsFromTransfer(1000);
        // новый кандидат создан
        const newCandidates = db.prepare(`SELECT id FROM characters WHERE id LIKE 'NPC-CAND-C%'`).all() as any[];
        expect(newCandidates.length).toBeGreaterThan(0);
    });
});
