import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { staffDirectiveRepo } from '../infrastructure/staffDirectiveRepo';
import { trainingTargetsForContract, pickTrainingAction, isContractReady, nextStaffAction } from '../scenario/staffDirectiveService';
import { resetWorldSeed } from '../scenario/worldService';
import { ensureWorldSeed } from '../scenario/worldService';

beforeEach(() => {
    resetWorldSeed();
    ensureWorldSeed();
    db.prepare(`DELETE FROM staff_directives`).run();
});

// Контракт, требующий trait_masochist >= 2 (тег pain).
const masochistContract: any = {
    id: 'test-masochist',
    state: 'accepted',
    conditions: [
        { type: 'acquired_trait', key: 'trait_masochist', operator: '>=', value: 2 },
    ],
};

describe('staffDirectiveService', () => {
    it('определяет целевые теги для недостигнутого трейта', () => {
        // Создаём актива с нулевым pain.
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-DIR', 'Тест', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences)
            VALUES ('SUB-DIR', 'Тест', 50, 50, 50, 50, 50, 0, '{}')
            ON CONFLICT(id) DO NOTHING`).run();
        const targets = trainingTargetsForContract('SUB-DIR', masochistContract);
        expect(targets.length).toBeGreaterThan(0);
        expect(targets[0].tag).toBe('pain');
        expect(targets[0].needed).toBe(2);
    });

    it('выбирает действие, тренирующее целевой тег', () => {
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-DIR2', 'Тест2', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences)
            VALUES ('SUB-DIR2', 'Тест2', 50, 50, 50, 50, 50, 0, '{}')
            ON CONFLICT(id) DO NOTHING`).run();
        const action = pickTrainingAction('SUB-DIR2', masochistContract);
        expect(action).not.toBeNull();
        expect(action!.tag).toBe('pain');
        expect(action!.actionId).toBeTruthy();
    });

    it('возвращает null, когда трейт достигнут', () => {
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-DIR3', 'Тест3', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        // pain = 4.5 → trait_masochist level 3 ≥ 2.
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences)
            VALUES ('SUB-DIR3', 'Тест3', 50, 50, 50, 50, 50, 0, '{"tags":{"pain":4.5}}')
            ON CONFLICT(id) DO NOTHING`).run();
        expect(isContractReady('SUB-DIR3', masochistContract)).toBe(true);
        expect(pickTrainingAction('SUB-DIR3', masochistContract)).toBeNull();
    });

    it('nextStaffAction возвращает действие по активному указанию', () => {
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-DIR4', 'Тест4', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences)
            VALUES ('SUB-DIR4', 'Тест4', 50, 50, 50, 50, 50, 0, '{}')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('STAFF-DIR', 'Сотрудник', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        // Контракт должен существовать в БД, чтобы nextStaffAction его прочитал.
        db.prepare(`INSERT INTO asset_contracts (id, issuer_id, title, description, state, conditions, rewards)
            VALUES ('test-masochist', 'fac_veil', 'Тест', '', 'accepted', '[]', '{}')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`UPDATE asset_contracts SET conditions = ? WHERE id = 'test-masochist'`)
            .run(JSON.stringify([{ type: 'acquired_trait', key: 'trait_masochist', operator: '>=', value: 2 }]));
        staffDirectiveRepo.assign({
            staffId: 'STAFF-DIR',
            subjectId: 'SUB-DIR4',
            contractId: 'test-masochist',
            goal: 'Подготовить к контракту',
        });
        const action = nextStaffAction('STAFF-DIR');
        expect(action).not.toBeNull();
        expect(action!.subjectId).toBe('SUB-DIR4');
        expect(action!.actionId).toBeTruthy();
    });

    it('sequence-алгоритм выполняет первое действие серии', () => {
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-SEQ', 'Тест', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences)
            VALUES ('SUB-SEQ', 'Тест', 50, 50, 50, 50, 50, 0, '{}')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('STAFF-SEQ', 'Сотрудник', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        staffDirectiveRepo.assign({
            staffId: 'STAFF-SEQ',
            subjectId: 'SUB-SEQ',
            goal: 'Серия действий',
            spec: { kind: 'sequence', actions: [{ actionId: 'act_slap', pointId: 'face' }, { actionId: 'act_punch', pointId: 'face' }] },
        });
        const action = nextStaffAction('STAFF-SEQ');
        expect(action).not.toBeNull();
        expect(action!.actionId).toBe('act_slap');
        expect(action!.pointId).toBe('face');
    });

    it('category-алгоритм выбирает действие по тегу категории', () => {
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-CAT', 'Тест', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences)
            VALUES ('SUB-CAT', 'Тест', 50, 50, 50, 50, 50, 0, '{}')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('STAFF-CAT', 'Сотрудник', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        staffDirectiveRepo.assign({
            staffId: 'STAFF-CAT',
            subjectId: 'SUB-CAT',
            goal: 'Категория pain',
            spec: { kind: 'category', tags: ['pain'] },
        });
        const action = nextStaffAction('STAFF-CAT');
        expect(action).not.toBeNull();
        expect(action!.actionId).toBeTruthy();
    });

    it('condition-алгоритм выбирает else-действие, когда условие ложно', () => {
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('SUB-COND', 'Тест', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        // capacity = 10 < 50 → условие «capacity >= 50» ложно → else-действие.
        db.prepare(`INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences)
            VALUES ('SUB-COND', 'Тест', 50, 10, 50, 50, 50, 0, '{}')
            ON CONFLICT(id) DO NOTHING`).run();
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('STAFF-COND', 'Сотрудник', 'npc', 'scene_lab_calibrator')
            ON CONFLICT(id) DO NOTHING`).run();
        staffDirectiveRepo.assign({
            staffId: 'STAFF-COND',
            subjectId: 'SUB-COND',
            goal: 'Условие',
            spec: { kind: 'condition', actionId: 'act_slap', metric: 'capacity', operator: '>=', value: 50, elseActionId: 'act_punch' },
        });
        const action = nextStaffAction('STAFF-COND');
        expect(action).not.toBeNull();
        expect(action!.actionId).toBe('act_punch');
    });
});
