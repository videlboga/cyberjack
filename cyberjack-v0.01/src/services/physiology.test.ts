import { describe, expect, it, beforeEach } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { subjectRepo } from '../infrastructure/repositories';
import { advancePhysiology, getPhysiology, isSleeping, formatPhysiologyContext, wakeUp } from './physiology';
import { advanceWorldTime } from '../scenario/worldService';

describe('physiology', () => {
    beforeEach(() => {
        db.prepare(`DELETE FROM subject_physiology`).run();
        db.prepare(`DELETE FROM subjects`).run();
        db.prepare(`DELETE FROM laboratory_assets`).run();
        db.prepare(`DELETE FROM asset_contracts`).run();
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude) VALUES ('SUB-P', 'Тест', 50, 50, 50, 50, 50)`).run();
    });

    it('накапливает голод и туалет со временем', () => {
        advancePhysiology(120, 1000); // 2 часа
        const phys = getPhysiology('SUB-P');
        expect(phys.hunger).toBeGreaterThan(0);
        expect(phys.bladder).toBeGreaterThan(0);
    });

    it('переходит в сон ночью и снимает недосып', () => {
        // Ночь: 23:00 = 1380 мин суток. worldMinute 1380.
        advancePhysiology(60, 1380);
        expect(isSleeping('SUB-P')).toBe(true);
        const phys = getPhysiology('SUB-P');
        expect(phys.sleep_state).toBe('sleeping');
        expect(phys.planned_wake_minute).not.toBeNull();
    });

    it('не спит днём', () => {
        advancePhysiology(60, 600); // 10:00
        expect(isSleeping('SUB-P')).toBe(false);
    });

    it('форматирует контекст физиологии для промпта', () => {
        // Голод 80, туалет 80.
        const phys = getPhysiology('SUB-P');
        phys.hunger = 80;
        phys.bladder = 80;
        db.prepare(`UPDATE subject_physiology SET hunger=?, bladder=? WHERE subject_id=?`).run(80, 80, 'SUB-P');
        const ctx = formatPhysiologyContext('SUB-P', 600);
        expect(ctx).toContain('голодна');
        expect(ctx).toContain('туалет');
    });

    it('ночной сегмент 23:00→07:00 считается сном, а не бодрствованием', () => {
        // Устанавливаем время на 23:00 (1380 мин суток).
        db.prepare(`INSERT OR IGNORE INTO world_state (id, total_minutes, day) VALUES ('main', 0, 1)`).run();
        db.prepare(`UPDATE world_state SET total_minutes = 1380 WHERE id='main'`).run();
        // Перемотка 8 часов: 23:00 → 07:00. Сегментация разбивает по рубежам.
        advanceWorldTime(480, 'test');
        const phys = getPhysiology('SUB-P');
        expect(phys.sleep_state).toBe('sleeping');
        expect(phys.sleep_debt).toBe(0); // сон снимает недосып, а не накапливает
    });

    it('принудительно разбуженный ночью не засыпает снова до планового подъёма', () => {
        // Устанавливаем время на 23:00 (1380 мин суток).
        db.prepare(`INSERT OR IGNORE INTO world_state (id, total_minutes, day) VALUES ('main', 0, 1)`).run();
        db.prepare(`UPDATE world_state SET total_minutes = 1380 WHERE id='main'`).run();
        // Укладываем спать.
        advancePhysiology(1, 1380);
        expect(isSleeping('SUB-P')).toBe(true);
        // Принудительно будим.
        wakeUp('SUB-P', 'внешнее воздействие');
        expect(isSleeping('SUB-P')).toBe(false);
        // Следующий ночной проход не должен снова уложить спать.
        advancePhysiology(60, 1400);
        expect(isSleeping('SUB-P')).toBe(false);
        expect(getPhysiology('SUB-P').wake_reason).toBe('внешнее воздействие');
    });

    it('не обрабатывает актив в in_transfer', () => {
        // Помечаем актив в передаче.
        db.prepare(`INSERT INTO asset_contracts (id, issuer_id, title, description, state, attached_subject_id, unavailable_until) VALUES ('C-T', 'f1', 't', 'd', 'in_transfer', 'SUB-P', 99999)`).run();
        advancePhysiology(120, 1000);
        const phys = getPhysiology('SUB-P');
        // Актив в передаче не получает физиологию лаборатории.
        expect(phys.hunger).toBe(0);
        expect(phys.bladder).toBe(0);
    });

    it('описывается при bladder=100, если зафиксирован в оборудовании', () => {
        // Зафиксировать SUB-P в секс-машине.
        db.prepare(`INSERT INTO laboratory_assets (player_id, asset_id, name, state, metadata) VALUES ('PL-1', 'lab_sex_machine', 'Секс-машина', 'installed', ?)`)
            .run(JSON.stringify({ subjectId: 'SUB-P' }));
        const phys = getPhysiology('SUB-P');
        phys.bladder = 100;
        db.prepare(`UPDATE subject_physiology SET bladder=100 WHERE subject_id='SUB-P'`).run();
        advancePhysiology(1, 600);
        const after = getPhysiology('SUB-P');
        expect(after.bladder).toBe(0);
        // Событие записано в память.
        const mem = db.prepare(`SELECT COUNT(*) AS n FROM memory_embeddings WHERE subject_id='SUB-P' AND metadata LIKE '%incontinence%'`).get() as any;
        expect(mem.n).toBeGreaterThan(0);
        db.prepare(`DELETE FROM laboratory_assets WHERE asset_id='lab_sex_machine'`).run();
    });

    it('свободный персонаж сходит в туалет при bladder>=45', () => {
        const phys = getPhysiology('SUB-P');
        phys.bladder = 50;
        db.prepare(`UPDATE subject_physiology SET bladder=50 WHERE subject_id='SUB-P'`).run();
        advancePhysiology(1, 600);
        const after = getPhysiology('SUB-P');
        expect(after.bladder).toBe(0);
    });
});
