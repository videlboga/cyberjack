import { describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { resolveDirectiveCompliance } from '../scenario/directiveCompliance';

describe('resolveDirectiveCompliance', () => {
    it('сотрудник почти не отступает от протокола даже при высоком отношении', () => {
        db.prepare(`INSERT INTO characters (id, name, kind) VALUES ('EXEC-STAFF', 'Сотрудник', 'npc') ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role, can_act, presence_state, slot_id)
            VALUES ('scene_lab_calibrator', 'EXEC-STAFF', 'staff', 1, 'present', NULL)`).run();
        db.prepare(`INSERT OR REPLACE INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude)
            VALUES ('EXEC-STAFF', 'Сотрудник', 50, 50, 80, 60, 70)`).run();

        const verdict = resolveDirectiveCompliance({ executorId: 'EXEC-STAFF', requesterId: 'NPC-CAND-ELI' });
        // Сотрудник при attitude 70, openness 80, plasticity 60 и требовании НЕ игрока:
        // score = 70*.55 + 80*.15 + 60*.1 + 0 + (50-50)*.3 - 40 = 38.5+12+6-40 = 16.5 < 80 → не подчинится.
        expect(verdict.comply).toBe(false);
    });

    it('актив с высокой покорностью подчиняется оператору', () => {
        db.prepare(`INSERT INTO characters (id, name, kind) VALUES ('EXEC-ACT', 'Актив', 'subject') ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role, can_act, presence_state, slot_id)
            VALUES ('scene_lab_calibrator', 'EXEC-ACT', 'asset', 1, 'present', NULL)`).run();
        db.prepare(`INSERT OR REPLACE INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude)
            VALUES ('EXEC-ACT', 'Актив', 50, 50, 70, 60, 85)`).run();

        // Актив, покорность 85, openness 70, plasticity 60, требует оператор:
        // score = 85*.55 + 70*.15 + 60*.1 + 0 + 5 + 25 = 46.75+10.5+6+30 = 93.25 >= 55 → подчинится.
        const verdict = resolveDirectiveCompliance({ executorId: 'EXEC-ACT', requesterId: 'PL-1' });
        expect(verdict.comply).toBe(true);
    });
});
