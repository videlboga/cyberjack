import { describe, expect, it, beforeEach } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { contractRepo } from '../infrastructure/contractRepo';
import { subjectRepo } from '../infrastructure/repositories';
import { ensureContractPool, CONTRACT_POOL_CONFIG } from './contractPool';

function setupSubject(id: string, overrides: Partial<any> = {}, prefs: any = {}) {
    subjectRepo.save(id, 'Тест', {
        sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50,
        tension: 0, baselineCapacity: 50, baselineSensitivity: 50, ...overrides,
        preferences: prefs,
    });
    // Актив должен присутствовать в лаборатории, чтобы пул считал его подходящим.
    db.prepare(`INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role, can_act, presence_state) VALUES ('scene_lab_calibrator', ?, 'participant', 1, 'present')`).run(id);
}

// Субъект с трейтами, подходящими под многие контракты.
function setupTraitSubject(id: string) {
    setupSubject(id, { sensitivity: 90, openness: 90, capacity: 90, baselineSensitivity: 90, baselineOpenness: 90, baselineCapacity: 90 }, {
        tags: { pain: 3.5, tickling: 3.5, exposure: 3.5, clinical: 3.5, electronic: 3.5, restraint: 3.5, submission: 3.5, chemical: 3.5, vibration: 3.5, sexual: 3.5 },
        points: { feet: 3.5, hands: 3.5, lips: 3.5, vulva: 3.5, vagina: 3.5, clitoris: 3.5 },
    });
}

function countAvailable(): number {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM asset_contracts WHERE state = 'available' AND (personal IS NULL OR personal = 0)`).get() as { count: number };
    return Number(row.count) || 0;
}

describe('contract pool', () => {
    beforeEach(() => {
        db.prepare('DELETE FROM asset_contracts').run();
        db.prepare('DELETE FROM scenario_events').run();
        db.prepare('DELETE FROM subjects').run();
    });

    it('does not issue before startMinute', () => {
        setupTraitSubject('SUB-1');
        ensureContractPool(100);
        expect(countAvailable()).toBe(0);
    });

    it('issues a limited pool (not all templates at once)', () => {
        setupTraitSubject('SUB-1');
        ensureContractPool(2000);
        const count = countAvailable();
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(CONTRACT_POOL_CONFIG.poolSize);
    });

    it('does not exceed poolSize across repeated calls', () => {
        setupTraitSubject('SUB-1');
        ensureContractPool(2000);
        ensureContractPool(3000);
        ensureContractPool(4000);
        expect(countAvailable()).toBeLessThanOrEqual(CONTRACT_POOL_CONFIG.poolSize);
    });

    it('only issues external_transfer contracts', () => {
        setupTraitSubject('SUB-1');
        ensureContractPool(2000);
        const rows = db.prepare(`SELECT format FROM asset_contracts WHERE state = 'available' AND (personal IS NULL OR personal = 0)`).all() as any[];
        for (const row of rows) {
            expect(row.format).toBe('external_transfer');
        }
    });
});
