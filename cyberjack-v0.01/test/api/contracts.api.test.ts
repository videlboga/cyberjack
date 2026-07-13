import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/api/server';
import { db } from '../../src/infrastructure/db';
import { contractRepo } from '../../src/infrastructure/contractRepo';
import { subjectRepo } from '../../src/infrastructure/repositories';

describe('contract and asset matching', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        db.prepare('DELETE FROM asset_contracts').run();
        db.prepare('DELETE FROM subjects').run();
        db.prepare('DELETE FROM characters').run();
        db.prepare('DELETE FROM factions').run();
        db.prepare('DELETE FROM character_resources').run();
        db.prepare('PRAGMA foreign_keys = ON').run();
        db.prepare("INSERT INTO factions (id, name, type) VALUES ('test_issuer', 'Test issuer', 'research')").run();
        contractRepo.save({
            id: 'test_contract',
            issuerId: 'test_issuer',
            title: 'Independent order',
            description: 'Any matching asset can be delivered.',
            state: 'available',
            conditions: [{ type: 'attitude', operator: '>', value: 70 }],
            rewards: { credits: 100 }
        });
        subjectRepo.save('asset_ready', 'Ready', { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 80, tension: 0 });
        subjectRepo.save('asset_unready', 'Unready', { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 40, tension: 0 });
        db.prepare("INSERT OR IGNORE INTO characters (id, name, kind, player_id) VALUES ('PL-1', 'Player', 'player', 'PL-1')").run();
    });

    it('accepts an order without attaching an asset and compares either asset', async () => {
        const accepted = await request(app).post('/api/contracts/test_contract/accept').send({ playerId: 'PL-1', subjectId: 'asset_ready' });
        expect(accepted.status).toBe(200);
        expect(accepted.body.contract.attachedSubjectId).toBeUndefined();

        const ready = await request(app).get('/api/contracts/test_contract/progress').query({ subjectId: 'asset_ready' });
        const unready = await request(app).get('/api/contracts/test_contract/progress').query({ subjectId: 'asset_unready' });
        expect(ready.body.metAll).toBe(true);
        expect(unready.body.metAll).toBe(false);
    });

    it('selects the asset only when it is delivered', async () => {
        await request(app).post('/api/contracts/test_contract/accept').send({ playerId: 'PL-1' });
        const rejected = await request(app).post('/api/contracts/test_contract/deliver').send({ subjectId: 'asset_unready' });
        expect(rejected.body.metRequirements).toBe(false);
        expect(contractRepo.get('test_contract')?.state).toBe('accepted');

        const delivered = await request(app).post('/api/contracts/test_contract/deliver').send({ subjectId: 'asset_ready' });
        expect(delivered.body.success).toBe(true);
        expect(contractRepo.get('test_contract')?.state).toBe('completed');
        const credits = db.prepare("SELECT amount FROM character_resources WHERE character_id = 'PL-1' AND resource_key = 'credits'").get() as any;
        expect(credits.amount).toBe(100);
    });
});
