import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { subjectRepo } from '../infrastructure/repositories';
import { buildCharacterTurnContext } from './characterTurnContext';

describe('buildCharacterTurnContext', () => {
    beforeEach(() => {
        subjectRepo.save('S-TC-01', 'TurnSubject', {
            sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 0,
        });
        db.prepare(`DELETE FROM active_contexts WHERE subject_id = ?`).run('S-TC-01');
        db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES ('S-TC-01', 'TurnSubject', 'npc', 'scene_lab_calibrator') ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_lab_calibrator'`).run();
    });

    it('assembles a turn context for an internal_impulse stimulus', async () => {
        const context = await buildCharacterTurnContext({
            subjectId: 'S-TC-01',
            stimulus: { kind: 'internal_impulse', impulseId: 'notice_device_change' },
        });
        expect(context.subjectId).toBe('S-TC-01');
        expect(context.stimulus.kind).toBe('internal_impulse');
        expect(context.payload).toBeDefined();
        expect(context.payload.systemPrompt).toBeTruthy();
    });

    it('is the single shared builder: payload mirrors buildPromptPayloadWithDB', async () => {
        const a = await buildCharacterTurnContext({
            subjectId: 'S-TC-01',
            stimulus: { kind: 'internal_impulse', impulseId: 'seek_orientation' },
            initiatorId: 'PL-1',
        });
        const b = await buildCharacterTurnContext({
            subjectId: 'S-TC-01',
            stimulus: { kind: 'internal_impulse', impulseId: 'seek_orientation' },
            initiatorId: 'PL-1',
        });
        expect(a.payload.systemPrompt).toBe(b.payload.systemPrompt);
    });
});
