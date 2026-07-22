import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/infrastructure/db';
import { controlDeviceSession } from '../src/scenario/worldService';

describe('laboratory device session', () => {
    beforeEach(() => {
        db.prepare(`INSERT OR REPLACE INTO world_state (id, total_minutes, day) VALUES ('main', 480, 1)`).run();
        db.prepare(`INSERT OR REPLACE INTO scenes (id, available_actions) VALUES ('scene_lab_calibrator', '[]')`).run();
        db.prepare(`INSERT OR REPLACE INTO scenes (id, available_actions) VALUES ('scene_broker', '[]')`).run();
        db.prepare(`INSERT OR REPLACE INTO players (id, resources) VALUES ('PL-1', '{}')`).run();
        db.prepare(`INSERT OR REPLACE INTO characters (id, name, kind, player_id, current_scene_id) VALUES ('PL-1', 'Калибратор', 'player', 'PL-1', 'scene_lab_calibrator')`).run();
        db.prepare(`INSERT OR REPLACE INTO characters (id, name, kind, subject_id, current_scene_id) VALUES ('TEST-SUBJECT', 'Test', 'subject', 'TEST-SUBJECT', 'scene_lab_calibrator')`).run();
        db.prepare(`INSERT OR REPLACE INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension) VALUES ('TEST-SUBJECT', 'Test', 50, 70, 50, 50, 50, 10)`).run();
        db.prepare(`INSERT OR REPLACE INTO laboratory_rooms (player_id, room_id, name, room_type, capacity) VALUES ('PL-1', 'room_calibration', 'Calibration', 'workroom', 2)`).run();
        db.prepare(`INSERT OR REPLACE INTO laboratory_room_assignments (player_id, room_id, character_id, status) VALUES ('PL-1', 'room_calibration', 'TEST-SUBJECT', 'device:lab_sex_machine')`).run();
        db.prepare(`INSERT OR REPLACE INTO laboratory_assets (player_id, asset_id, name, description, state, metadata) VALUES (?, ?, ?, '', 'installed', ?)`).run(
            'PL-1', 'lab_sex_machine', 'Test machine', JSON.stringify({
                roomId: 'room_calibration', subjectId: 'TEST-SUBJECT',
                deviceSession: {
                    deviceId: 'sex_machine', subjectId: 'TEST-SUBJECT', configuration: 'restrained',
                    wardrobe: 'underwear', status: 'loaded', intensity: 35, phase: 'sustain',
                    protocolId: 'standard', targetPointIds: ['systemic'], startedAtTick: null, updatedAtTick: 480,
                },
            }),
        );
    });

    it('runs the configure/start/adjust/pause/resume/stop lifecycle', () => {
        expect(controlDeviceSession('lab_sex_machine', 'configure', { configuration: 'stirrups', wardrobe: 'nude' }).session.configuration).toBe('stirrups');
        expect(controlDeviceSession('lab_sex_machine', 'start').session.status).toBe('running');
        expect(controlDeviceSession('lab_sex_machine', 'adjust', { intensity: 70 }).session).toMatchObject({ intensity: 70, phase: 'intense' });
        expect(controlDeviceSession('lab_sex_machine', 'pause').session.status).toBe('paused');
        expect(controlDeviceSession('lab_sex_machine', 'resume').session.status).toBe('running');
        expect(controlDeviceSession('lab_sex_machine', 'stop').session.status).toBe('stopped');
    });

    it('rejects clothing unsupported by the selected configuration', () => {
        expect(() => controlDeviceSession('lab_sex_machine', 'configure', { configuration: 'stirrups', wardrobe: 'underwear' })).toThrow(/Одежда несовместима/);
    });
});
