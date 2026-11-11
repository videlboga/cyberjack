import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/api/server';
import { db } from '../../src/infrastructure/db';
import { rememberSocialExchange, __resetSocialThrottle } from '../../src/services/socialMemory';

const llmMock = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('../../src/adapters/llmAdapter', () => ({ parseVerbalInputWithLLM: llmMock.parse }));

function mockPromise(text: string) {
    llmMock.parse.mockResolvedValue({
        parsed: { memories: [{ kind: 'promise', content: text, importance: 0.9, confidence: 0.9 }], promiseOutcome: null },
    });
}

describe('Event Director API', () => {
    beforeEach(() => {
        __resetSocialThrottle();
        db.prepare(`PRAGMA foreign_keys = OFF`).run();
        for (const table of [
            'event_instances','event_opportunities','story_threads',
            'director_signals','social_memories','scenario_events'
        ]) db.prepare(`DELETE FROM ${table}`).run();
        db.prepare(`DELETE FROM characters WHERE id IN ('API-DIRECTOR-SUBJECT','API-DIRECTOR-PLAYER')`).run();
        db.prepare(`
            INSERT INTO characters (id,name,kind) VALUES
            ('API-DIRECTOR-SUBJECT','Ника API','npc'),
            ('API-DIRECTOR-PLAYER','Калибратор API','player')
        `).run();
        db.prepare(`INSERT OR REPLACE INTO world_state (id,total_minutes,day) VALUES ('main',500,1)`).run();
        db.prepare(`PRAGMA foreign_keys = ON`).run();
    });

    it('lists and resolves a due opportunity', async () => {
        __resetSocialThrottle();
        mockPromise('Я вернусь и покажу исходный журнал.');
        await rememberSocialExchange({
            subjectId:'API-DIRECTOR-SUBJECT',
            relatedSubjectId:'API-DIRECTOR-PLAYER',
            userText:'Я вернусь и покажу исходный журнал.'
        });
        db.prepare(`UPDATE world_state SET total_minutes = 530 WHERE id = 'main'`).run();

        const inbox = await request(app).get('/api/events/inbox');
        expect(inbox.status).toBe(200);
        expect(inbox.body.events).toHaveLength(1);

        const choice = await request(app)
            .post(`/api/events/${inbox.body.events[0].id}/choose`)
            .send({ choice:'return' });
        expect(choice.status).toBe(200);
        expect(choice.body.result.focusSubjectId).toBe('API-DIRECTOR-SUBJECT');

        const empty = await request(app).get('/api/events/inbox');
        expect(empty.body.events).toHaveLength(0);
    });
});
