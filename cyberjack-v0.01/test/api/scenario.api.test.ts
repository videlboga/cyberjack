import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/api/server';
import { db } from '../../src/infrastructure/db';
import { contractRepo } from '../../src/infrastructure/contractRepo';
import { subjectRepo } from '../../src/infrastructure/repositories';
import { VISUALLY_SUPPORTED_PORTABLE_ITEMS } from '../../src/scenario/worldService';

describe('scenario campaign API', () => {
  beforeEach(() => {
    db.prepare('PRAGMA foreign_keys = OFF').run();
    for (const table of ['scenario_events', 'story_threads', 'laboratory_room_assignments', 'laboratory_rooms', 'laboratory_assets', 'shop_offers', 'world_state', 'character_items', 'character_resources', 'scene_characters', 'characters', 'scenes', 'asset_contracts', 'factions']) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare('PRAGMA foreign_keys = ON').run();
    for (const sceneId of ['scene_lab_calibrator', 'scene_broker', 'scene_liaison']) {
      db.prepare('INSERT INTO scenes (id, available_actions) VALUES (?, ?)').run(sceneId, '[]');
    }
  });

  it('creates a persistent campaign clock and moves the player between locations', async () => {
    const initial = await request(app).get('/api/scenario');
    expect(initial.status).toBe(200);
    expect(initial.body.location.id).toBe('scene_lab_calibrator');
    expect(initial.body.clock.label).toBe('01 января 17349 · 08:00');
    expect(initial.body.credits).toBe(1000);
    expect(initial.body.residents.some((resident: any) => resident.role === 'assistant' && resident.kind === 'npc')).toBe(true);
    const portableOffers = initial.body.shop.filter((offer:any) =>
      offer.category === 'item' && !offer.itemId.startsWith('drug_')
    );
    expect(portableOffers.length).toBeGreaterThan(0);
    expect(portableOffers.every((offer:any) => VISUALLY_SUPPORTED_PORTABLE_ITEMS.has(offer.itemId))).toBe(true);
    expect(initial.body.shop.some((offer:any) => offer.itemId === 'eq_speculum')).toBe(false);

    const travel = await request(app).post('/api/scenario/travel').send({ locationId: 'scene_broker' });
    expect(travel.status).toBe(200);
    expect(travel.body.scenario.location.id).toBe('scene_broker');
    expect(travel.body.scenario.clock.totalMinutes).toBe(initial.body.clock.totalMinutes);
  });

  it('orders portable items and laboratory modules through station supply', async () => {
    await request(app).get('/api/scenario');
    const item = await request(app).post('/api/scenario/shop/offer_handcuffs/buy').send({});
    expect(item.status).toBe(200);
    expect(item.body.scenario.inventory.some((entry: any) => entry.itemId === 'eq_handcuffs')).toBe(true);

    const module = await request(app).post('/api/scenario/shop/lab_recovery_capsule/buy').send({});
    expect(module.status).toBe(200);
    expect(module.body.scenario.laboratory.some((entry: any) => entry.id === 'lab_recovery_capsule')).toBe(true);
    expect(module.body.scenario.credits).toBe(190);
  });

  it('requires a visit to the liaison and gives accepted contracts a world-time deadline', async () => {
    db.prepare("INSERT INTO factions (id, name, type) VALUES ('issuer', 'Issuer', 'research')").run();
    contractRepo.save({
      id: 'scenario_contract',
      issuerId: 'issuer',
      title: 'Scenario contract',
      description: 'Test',
      state: 'available',
      conditions: [{ type: 'attitude', operator: '>', value: 50 }],
      rewards: { credits: 100 }
    });

    await request(app).get('/api/scenario');
    const rejected = await request(app).post('/api/contracts/scenario_contract/accept').send({ playerId: 'PL-1' });
    expect(rejected.status).toBe(400);

    await request(app).post('/api/scenario/travel').send({ locationId: 'scene_liaison' });
    const accepted = await request(app).post('/api/contracts/scenario_contract/accept').send({ playerId: 'PL-1' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.contract.deadlineTick).toBeGreaterThan(0);
  });

  it('does not permit a route to fast-forward the background game clock', async () => {
    subjectRepo.save('S-AV-01', 'Мира', {
      sensitivity: 80, capacity: 10, openness: 50, plasticity: 50, attitude: 50, tension: 90,
      baselineSensitivity: 50, baselineCapacity: 70, baselineOpenness: 50, baselinePlasticity: 50, baselineAttitude: 50
    });
    await request(app).get('/api/scenario');
    const result = await request(app).post('/api/scenario/time/pass').send({ minutes: 480 });
    expect(result.status).toBe(409);
    expect(subjectRepo.get('S-AV-01')!.capacity).toBe(10);
  });
});
