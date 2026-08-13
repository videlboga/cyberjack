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
});
