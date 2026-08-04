import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import { rememberSocialExchange } from '../services/socialMemory';
import { emitSubjectMetricChanges, emitSupplyPurchased, listInbox, resolveOpportunity } from './eventDirector';
import { contractRepo } from '../infrastructure/contractRepo';

describe('Event Director promise flow', () => {
    beforeEach(() => {
        db.prepare(`PRAGMA foreign_keys = OFF`).run();
        for (const table of [
            'event_instances','event_opportunities','story_threads','world_facts',
            'director_signals','social_memories','scenario_events'
        ]) db.prepare(`DELETE FROM ${table}`).run();
        db.prepare(`DELETE FROM characters WHERE id IN ('DIRECTOR-SUBJECT','PL-DIRECTOR')`).run();
        db.prepare(`
            INSERT INTO characters (id,name,kind) VALUES
            ('DIRECTOR-SUBJECT','Тестовая Мира','npc'),
            ('PL-DIRECTOR','Калибратор','player')
        `).run();
        db.prepare(`INSERT OR REPLACE INTO world_state (id,total_minutes,day) VALUES ('main',100,1)`).run();
        db.prepare(`PRAGMA foreign_keys = ON`).run();
    });

    it('turns a spoken promise into one delayed inbox opportunity', () => {
        rememberSocialExchange({
            subjectId:'DIRECTOR-SUBJECT',
            relatedSubjectId:'PL-DIRECTOR',
            userText:'Я проверю, кто изменил твоё досье.'
        });
        rememberSocialExchange({
            subjectId:'DIRECTOR-SUBJECT',
            relatedSubjectId:'PL-DIRECTOR',
            userText:'Я проверю, кто изменил твоё досье.'
        });

        expect(listInbox()).toHaveLength(0);
        db.prepare(`UPDATE world_state SET total_minutes = 130 WHERE id = 'main'`).run();
        const inbox = listInbox();
        expect(inbox).toHaveLength(1);
        expect(inbox[0]).toMatchObject({
            templateId:'promise_follow_up_v1',
            subjectId:'DIRECTOR-SUBJECT',
            senderName:'Тестовая Мира',
        });
        expect(inbox[0].body).toContain('изменил твоё досье');
        expect((db.prepare(`SELECT COUNT(*) AS count FROM story_threads`).get() as any).count).toBe(1);
    });

    it('can defer and later return to the promised conversation', () => {
        rememberSocialExchange({
            subjectId:'DIRECTOR-SUBJECT',
            relatedSubjectId:'PL-DIRECTOR',
            userText:'Я помогу найти исходную запись.'
        });
        db.prepare(`UPDATE world_state SET total_minutes = 130 WHERE id = 'main'`).run();
        const event = listInbox()[0];

        expect(resolveOpportunity(event.id, 'defer').resolution).toBe('deferred');
        expect(listInbox()).toHaveLength(0);

        db.prepare(`UPDATE world_state SET total_minutes = 490 WHERE id = 'main'`).run();
        const returned = resolveOpportunity(listInbox()[0].id, 'return');
        expect(returned).toMatchObject({
            resolution:'return',
            focusSubjectId:'DIRECTOR-SUBJECT',
        });
        const logged = db.prepare(`
            SELECT title FROM scenario_events WHERE type = 'director_event' ORDER BY id DESC LIMIT 1
        `).get() as any;
        expect(logged.title).toBe('Возвращение к обещанию');
    });

    it('offers achievable contract terms after a notable metric threshold', () => {
        const core = {
            sensitivity:59, capacity:70, openness:50, plasticity:50, attitude:50, tension:0,
            baselineSensitivity:59, baselineCapacity:70, baselineOpenness:50,
            baselinePlasticity:50, baselineAttitude:50,
        };
        emitSubjectMetricChanges({
            tickId:'metric-tick-1',
            subjectId:'DIRECTOR-SUBJECT',
            before:core,
            after:{ ...core, sensitivity:60.5, baselineSensitivity:60.5 },
        });
        // Crossing the same band again cannot produce another offer.
        emitSubjectMetricChanges({
            tickId:'metric-tick-2',
            subjectId:'DIRECTOR-SUBJECT',
            before:{ ...core, sensitivity:58, baselineSensitivity:58 },
            after:{ ...core, sensitivity:61, baselineSensitivity:61 },
        });

        const offers = listInbox();
        expect(offers).toHaveLength(1);
        expect(offers[0]).toMatchObject({
            templateId:'metric_contract_offer_v1',
            senderName:'Veil Biotech',
        });
        expect(offers[0].body).toContain('чувствительность');

        const result = resolveOpportunity(offers[0].id, 'request_terms');
        expect(result).toMatchObject({ resolution:'request_terms', focusSection:'contracts' });
        const contract = contractRepo.get(result.contractId!);
        expect(contract).toMatchObject({
            issuerId:'fac_veil',
            state:'available',
            conditions:[{ type:'custom', key:'sensitivity', operator:'>=', value:67 }],
        });
    });

    it('opens a limited supply lot and reveals its provenance after purchase', () => {
        db.prepare(`UPDATE world_state SET total_minutes = 600 WHERE id = 'main'`).run();
        const offerEvent = listInbox().find(event => event.templateId === 'supply_lot_offer_v1');
        expect(offerEvent).toBeTruthy();

        const opened = resolveOpportunity(offerEvent!.id, 'open_supply');
        expect(opened).toMatchObject({ resolution:'open_supply', focusSection:'supply' });
        const lot = db.prepare(`SELECT * FROM shop_offers WHERE id = 'event_offer_neurospike_v17'`).get() as any;
        expect(lot).toMatchObject({ item_id:'drug_sensitizer', stock:1, source_event_id:offerEvent!.id });
        expect(JSON.parse(lot.metadata)).toMatchObject({
            eventLot:true, batch:'V-17', supplier:'Veil Biotech',
        });

        emitSupplyPurchased({
            offerId:lot.id,itemId:lot.item_id,playerId:'PL-DIRECTOR',
            metadata:JSON.parse(lot.metadata),
        });
        expect((db.prepare(`
            SELECT COUNT(*) AS count FROM world_facts WHERE predicate = 'acquired_supply_lot'
        `).get() as any).count).toBe(1);
        expect(listInbox().some(event => event.templateId === 'supply_origin_tail_v1')).toBe(false);

        db.prepare(`UPDATE world_state SET total_minutes = 720 WHERE id = 'main'`).run();
        const tail = listInbox().find(event => event.templateId === 'supply_origin_tail_v1');
        expect(tail?.body).toContain('не обычный рыночный товар');
        resolveOpportunity(tail!.id, 'inspect');
        expect((db.prepare(`
            SELECT COUNT(*) AS count FROM world_facts
            WHERE predicate = 'batch_origin' AND visibility = 'known'
        `).get() as any).count).toBe(1);
    });
});
