import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/infrastructure/db';
import { resolveLaboratoryMove } from '../../src/scenario/resolveLaboratoryMove';
import { getLaboratoryPresence } from '../../src/scenario/spatialContext';

const LAB = 'scene_lab_calibrator';

function seedBase() {
    db.prepare(`INSERT INTO characters (id, name, kind) VALUES (?, ?, ?)`).run('S-01', 'Актив', 'npc');
    db.prepare(`INSERT INTO characters (id, name, kind) VALUES (?, ?, ?)`).run('S-02', 'Пациент', 'npc');
    db.prepare(`INSERT INTO characters (id, name, kind, player_id) VALUES (?, ?, ?, ?)`).run('PL-1', 'Калибратор', 'npc', 'PL-1');
    db.prepare(`INSERT INTO scenes (id, available_actions) VALUES (?, ?)`).run(LAB, '[]');
    db.prepare(`INSERT INTO laboratory_rooms (player_id, room_id, name, room_type, capacity) VALUES (?, ?, ?, ?, ?)`)
        .run('PL-1', 'r_cell', 'Изоляционная камера', 'cell', 1);
    db.prepare(`INSERT INTO laboratory_rooms (player_id, room_id, name, room_type, capacity) VALUES (?, ?, ?, ?, ?)`)
        .run('PL-1', 'r_main', 'Основной зал', 'lab', 3);
    db.prepare(`INSERT INTO laboratory_assets (player_id, asset_id, name, metadata) VALUES (?, ?, ?, ?)`)
        .run('PL-1', 'lab_diagnostic_table', 'Диагностический стол', JSON.stringify({ roomId: 'r_main' }));
    db.prepare(`INSERT INTO laboratory_room_assignments (player_id, room_id, character_id, status) VALUES (?, ?, ?, ?)`)
        .run('PL-1', 'r_main', 'S-01', 'resident');
    db.prepare(`INSERT INTO laboratory_room_assignments (player_id, room_id, character_id, status) VALUES (?, ?, ?, ?)`)
        .run('PL-1', 'r_cell', 'S-02', 'resident');
    db.prepare(`INSERT INTO laboratory_room_assignments (player_id, room_id, character_id, status) VALUES (?, ?, ?, ?)`)
        .run('PL-1', 'r_main', 'PL-1', 'operator');
    db.prepare(`INSERT INTO scene_characters (scene_id, character_id, slot_id, presence_state) VALUES (?, ?, ?, ?)`)
        .run(LAB, 'S-01', 'room:r_main', 'present');
    db.prepare(`INSERT INTO scene_characters (scene_id, character_id, slot_id, presence_state) VALUES (?, ?, ?, ?)`)
        .run(LAB, 'S-02', 'room:r_cell', 'present');
    db.prepare(`INSERT INTO scene_characters (scene_id, character_id, slot_id, presence_state) VALUES (?, ?, ?, ?)`)
        .run(LAB, 'PL-1', 'room:r_main', 'present');
}

describe('resolveLaboratoryMove', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        for (const table of ['scene_characters', 'laboratory_room_assignments', 'laboratory_assets', 'laboratory_rooms', 'scenes', 'characters', 'interaction_stances']) {
            db.prepare(`DELETE FROM ${table}`).run();
        }
        db.prepare('PRAGMA foreign_keys = ON').run();
        seedBase();
    });

    it('is read-only: it never writes to the database directly', () => {
        resolveLaboratoryMove('S-01', 'Изоляционная камера', 'PL-1');
        // Assignment and slot must be untouched by the resolver itself.
        expect(getLaboratoryPresence('S-01', 'PL-1')?.roomId).toBe('r_main');
        expect(getLaboratoryPresence('S-01', 'PL-1')?.slotId).toBe('room:r_main');
    });

    it('blocks a move into a full room with zero mutations', () => {
        // r_cell capacity 2 already holds subject + operator.
        const result = resolveLaboratoryMove('S-01', 'Изоляционная камера', 'PL-1');
        expect(result.outcome).toBe('blocked');
        expect(result.handled).toBe(true);
        expect(result.moved).toBe(false);
        expect(result.reason).toMatch(/нет свободного места/);
        expect(result.effects).toEqual([]);
    });

    it('represents a successful relocation as a set of atomic TickEffects', () => {
        // Move subject to the diagnostic table asset in r_main.
        const result = resolveLaboratoryMove('S-01', 'Диагностический стол', 'PL-1');
        expect(result.outcome).toBe('allowed');
        expect(result.handled).toBe(true);
        expect(result.moved).toBe(true);
        expect(result.slotId).toBe('near:lab_diagnostic_table');
        // Clear setup contexts + set presence + soften stance.
        expect(result.effects.map(e => e.kind)).toEqual([
            'lab.clear-setup-contexts',
            'lab.set-presence',
            'stance.soften-all',
        ]);
    });

    it('reports unchanged as handled but not moved', () => {
        const result = resolveLaboratoryMove('S-01', 'Основной зал', 'PL-1');
        expect(result.outcome).toBe('unchanged');
        expect(result.handled).toBe(true);
        expect(result.moved).toBe(false);
        expect(result.effects).toEqual([]);
    });

    it('reports an unknown destination as unresolved', () => {
        const result = resolveLaboratoryMove('S-01', 'Несуществующее место', 'PL-1');
        expect(result.outcome).toBe('unresolved');
        expect(result.handled).toBe(false);
        expect(result.moved).toBe(false);
        expect(result.effects).toEqual([]);
    });

    it('resolves «своя камера» to the character home cell', () => {
        db.prepare(`UPDATE laboratory_room_assignments SET home_room_id = 'r_cell' WHERE player_id = 'PL-1' AND character_id = 'S-01'`).run();
        db.prepare(`UPDATE laboratory_rooms SET capacity = 3 WHERE player_id = 'PL-1' AND room_id = 'r_cell'`).run();
        const result = resolveLaboratoryMove('S-01', 'своя камера', 'PL-1');
        expect(result.outcome).toBe('allowed');
        expect(result.slotId).toBe('room:r_cell');
        expect(result.label).toBe('в Изоляционная камера');
    });

    it('allows a free move off the diagnostic table (non-enclosed device)', () => {
        // Put S-01 onto the diagnostic table (device:), then free the cell capacity.
        db.prepare(`UPDATE laboratory_room_assignments SET status = 'device:lab_diagnostic_table' WHERE player_id = 'PL-1' AND character_id = 'S-01'`).run();
        db.prepare(`UPDATE scene_characters SET slot_id = 'device:lab_diagnostic_table' WHERE scene_id = ? AND character_id = 'S-01'`).run(LAB);
        db.prepare(`UPDATE laboratory_rooms SET capacity = 3 WHERE player_id = 'PL-1' AND room_id = 'r_cell'`).run();
        const result = resolveLaboratoryMove('S-01', 'Изоляционная камера', 'PL-1');
        expect(result.outcome).toBe('allowed');
        expect(result.slotId).toBe('room:r_cell');
        // Walking off the table frees its slot (release-device) as part of the move.
        expect(result.effects.map(e => e.kind)).toContain('lab.release-device');
    });

    it('blocks a move while fixed in an enclosed device (capsule)', () => {
        db.prepare(`INSERT OR IGNORE INTO laboratory_assets (player_id, asset_id, name, metadata) VALUES (?, ?, ?, ?)`)
            .run('PL-1', 'lab_recovery_capsule', 'Капсула восстановления', JSON.stringify({ roomId: 'r_main' }));
        db.prepare(`UPDATE laboratory_room_assignments SET status = 'device:lab_recovery_capsule' WHERE player_id = 'PL-1' AND character_id = 'S-01'`).run();
        const result = resolveLaboratoryMove('S-01', 'Изоляционная камера', 'PL-1');
        expect(result.outcome).toBe('blocked');
        expect(result.reason).toMatch(/зафиксирована в оборудовании/);
    });
});
