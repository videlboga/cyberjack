import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { contractRepo } from '../infrastructure/contractRepo';
import { expireOverdueContracts } from './contractService';
import type { AssetContract } from '../domain/types';

const contract = (id: string, state: AssetContract['state'], deadlineTick?: number): AssetContract => ({
    id, issuerId: 'faction_syndicate', title: 'Тест', description: '',
    state, deadlineTick, conditions: [], rewards: { credits: 100 }, penalties: { credits: -50, trust: -5 },
});

beforeEach(() => {
    db.prepare('DELETE FROM asset_contracts').run();
    db.prepare('DELETE FROM character_resources WHERE character_id = ?').run('PL-1');
    db.prepare('DELETE FROM player_faction_states WHERE player_id = ?').run('PL-1');
});

describe('expireOverdueContracts (Этап 4)', () => {
    it('expires an accepted contract past its deadline and applies penalties', () => {
        contractRepo.save(contract('C-1', 'accepted', 100));
        contractRepo.save(contract('C-2', 'accepted', 500));

        const expired = expireOverdueContracts(200);

        expect(expired).toEqual(['C-1']);
        expect(contractRepo.get('C-1')!.state).toBe('expired');
        expect(contractRepo.get('C-2')!.state).toBe('accepted');

        const credits = db.prepare('SELECT amount FROM character_resources WHERE character_id = ? AND resource_key = ?').get('PL-1', 'credits') as any;
        expect(credits.amount).toBe(-50);
    });

    it('does not touch contracts without a deadline', () => {
        contractRepo.save(contract('C-3', 'accepted', undefined));
        const expired = expireOverdueContracts(1000);
        expect(expired).toEqual([]);
        expect(contractRepo.get('C-3')!.state).toBe('accepted');
    });
});
