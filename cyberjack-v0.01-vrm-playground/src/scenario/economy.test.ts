import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { resourceRepo, characterItemsRepo, subjectRepo, activeContextsRepo } from '../infrastructure/repositories';
import { advanceWorldTime, ensureWorldSeed, getWorldClock, listShopOffers, buyOffer } from '../scenario/worldService';
import { resetWorldSeed } from '../scenario/worldService';

beforeEach(() => {
    resetWorldSeed();
    ensureWorldSeed();
    db.prepare('DELETE FROM character_resources WHERE character_id = ?').run('PL-1');
    db.prepare('DELETE FROM character_items WHERE character_id = ?').run('PL-1');
    db.prepare('DELETE FROM subjects WHERE id = ?').run('SUB-ECO');
    db.prepare('DELETE FROM characters WHERE id = ?').run('SUB-ECO');
    db.prepare('DELETE FROM laboratory_room_assignments WHERE player_id = ?').run('PL-1');
    db.prepare('DELETE FROM laboratory_assets WHERE player_id = ?').run('PL-1');
    db.prepare('DELETE FROM scene_characters WHERE character_id = ?').run('SUB-STAFF');
    db.prepare('DELETE FROM characters WHERE id = ?').run('SUB-STAFF');
    db.prepare(`UPDATE world_state SET total_minutes = 480, last_upkeep_day = 1 WHERE id = 'main'`).run();
});

const credits = () => {
    const row = db.prepare('SELECT amount FROM character_resources WHERE character_id = ? AND resource_key = ?').get('PL-1', 'credits') as any;
    return row ? Number(row.amount) : 0;
};

describe('Этап 4: экономика', () => {
    it('списывает ежедневное содержание при смене дня (фикс + за активов)', () => {
        resourceRepo.save({ id: 'PL-1', resources: { credits: { characterId: 'PL-1', resourceKey: 'credits', amount: 1000 } } });
        // День 1 (480 мин). Переходим на день 2 (1440 мин) — списание должно сработать.
        advanceWorldTime(1440 - 480, 'test');
        // Без активов и платного оборудования в лаборатории: 1000 - 40 (базовая ставка) = 960
        expect(credits()).toBe(960);
    });

    it('не списывает повторно в тот же день', () => {
        resourceRepo.save({ id: 'PL-1', resources: { credits: { characterId: 'PL-1', resourceKey: 'credits', amount: 1000 } } });
        advanceWorldTime(1440 - 480, 'test'); // день 2
        const afterFirst = credits();
        advanceWorldTime(60, 'test'); // ещё час в день 2
        expect(credits()).toBe(afterFirst); // не списано повторно
    });

    it('учитывает установленное платное оборудование в ежедневном содержании', () => {
        resourceRepo.save({ id: 'PL-1', resources: { credits: { characterId: 'PL-1', resourceKey: 'credits', amount: 1000 } } });
        // Устанавливаем капсулу (платное оборудование +15/день) — на старте она НЕ установлена.
        db.prepare(`INSERT INTO laboratory_assets (player_id, asset_id, name, description, state, metadata)
            VALUES ('PL-1', 'lab_recovery_capsule', 'Капсула', '', 'installed', ?)
            ON CONFLICT(player_id, asset_id) DO UPDATE SET metadata = excluded.metadata`).run('{}');
        advanceWorldTime(1440 - 480, 'test'); // день 2
        // 1000 - 40 (база) - 15 (оборудование) = 945
        expect(credits()).toBe(945);
    });

    it('капсула без ампулы восстанавливает медленнее, с ампулой — быстрее', () => {
        subjectRepo.save('SUB-ECO', 'Тест', {
            sensitivity: 50, capacity: 10, openness: 50, plasticity: 50, attitude: 50,
            tension: 80, baselineCapacity: 60,
        });
        // Помещаем в капсулу
        db.prepare(`INSERT INTO laboratory_assets (player_id, asset_id, name, description, state, metadata)
            VALUES ('PL-1', 'lab_recovery_capsule', 'Капсула', '', 'installed', ?)
            ON CONFLICT(player_id, asset_id) DO UPDATE SET metadata = excluded.metadata`).run(JSON.stringify({ subjectId: 'SUB-ECO' }));

        // Без ампулы: 1 час → +3 capacity (базовый темп)
        advanceWorldTime(60, 'test');
        let core = subjectRepo.get('SUB-ECO')!;
        const noAmpoule = core.capacity;
        expect(noAmpoule).toBe(13); // 10 + 3

        // С ампулой: контекст Regen-R активен (эффект на сутки) → +8 capacity
        activeContextsRepo.add('ctx-regen', 'SUB-ECO', 'capsule_infusion_regenerative', 1440, 'global', 'PL-1');
        advanceWorldTime(60, 'test');
        core = subjectRepo.get('SUB-ECO')!;
        expect(core.capacity).toBe(21); // 13 + 8
    });

    it('оборудование с required_trust скрыто, пока не достигнут trust фракции', () => {
        // Начальный trust=0: анальный модуль (Veil 20) и кресло (Continuum 30) скрыты.
        const offers = listShopOffers('PL-1');
        const labIds = offers.filter(o => o.category === 'laboratory').map(o => o.id);
        expect(labIds).not.toContain('lab_sex_machine_anal');
        expect(labIds).not.toContain('lab_sex_machine_tickling');
        expect(labIds).not.toContain('lab_sex_machine_circularsaw');
        expect(labIds).not.toContain('lab_mental_correction_chair');
        expect(labIds).toContain('lab_sex_machine_vaginal');
        expect(labIds).toContain('lab_recovery_capsule');

        // Покупка анального заблокирована до достижения trust.
        expect(() => buyOffer('lab_sex_machine_anal', 'PL-1')).toThrow(/довери/);

        // Начисляем trust Veil и убеждаемся, что анальный модуль открылся.
        db.prepare(`INSERT INTO player_faction_states (player_id, faction_id, relation, trust, access_level, flags)
            VALUES ('PL-1', 'fac_veil', 0, 25, 1, '[]')
            ON CONFLICT(player_id, faction_id) DO UPDATE SET trust = excluded.trust`).run();
        const after = listShopOffers('PL-1').filter(o => o.category === 'laboratory').map(o => o.id);
        expect(after).toContain('lab_sex_machine_anal');
        expect(after).not.toContain('lab_sex_machine_tickling'); // требует 30, а у нас 25
        expect(after).not.toContain('lab_sex_machine_circularsaw'); // требует 30

        // Достигаем trust 30: tickling и circularsaw открываются.
        db.prepare(`INSERT INTO player_faction_states (player_id, faction_id, relation, trust, access_level, flags)
            VALUES ('PL-1', 'fac_veil', 0, 30, 1, '[]')
            ON CONFLICT(player_id, faction_id) DO UPDATE SET trust = excluded.trust`).run();
        const after30 = listShopOffers('PL-1').filter(o => o.category === 'laboratory').map(o => o.id);
        expect(after30).toContain('lab_sex_machine_circularsaw');
    });

    it('учитывает зарплату сотрудников (staff/assistant) в ежедневном содержании', () => {
        resourceRepo.save({ id: 'PL-1', resources: { credits: { characterId: 'PL-1', resourceKey: 'credits', amount: 1000 } } });
        // Нанимаем сотрудника: роль staff в scene_lab_calibrator + resident в комнате.
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-STAFF', 'Тест-сотрудник', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO scene_characters (scene_id, character_id, role, can_act, presence_state)
            VALUES ('scene_lab_calibrator', 'SUB-STAFF', 'staff', 1, 'present')
            ON CONFLICT(scene_id, character_id) DO UPDATE SET role='staff'`).run();
        db.prepare(`INSERT INTO laboratory_room_assignments (player_id, room_id, character_id, status)
            VALUES ('PL-1', 'room_control', 'SUB-STAFF', 'resident')
            ON CONFLICT(player_id, character_id) DO UPDATE SET status='resident'`).run();
        advanceWorldTime(1440 - 480, 'test'); // день 2
        // 1000 - 40 (база) - 30 (зарплата сотрудника) = 930
        expect(credits()).toBe(930);
    });
});
