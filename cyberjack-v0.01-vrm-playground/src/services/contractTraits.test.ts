import { describe, expect, it, beforeEach } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { subjectRepo, subjectPreferencesRepo } from '../infrastructure/repositories';
import { addContractTrait, removeContractTrait, applyContractTraitDecay, readContractTraits } from './contractTraits';
import { deriveAcquiredTraits } from '../domain/conditioning';

function setupSubject(id: string) {
    subjectRepo.save(id, 'Тест', {
        sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50,
        tension: 0, baselineCapacity: 50, baselineSensitivity: 50,
    });
}

describe('contract traits', () => {
    beforeEach(() => {
        db.prepare('DELETE FROM subjects').run();
    });

    it('adds a temporary contract trait and boosts the derived trait level', () => {
        setupSubject('SUB-1');
        // базовый тег tickling = 2.0 → уровень 1
        subjectPreferencesRepo.adjust('SUB-1', 'tags', 'tickling', 2.0);
        addContractTrait('SUB-1', 'anomaly_foot_echo', {
            source: 'contract:C-1', kind: 'temporary', acquiredMinute: 0, decayAfterMinutes: 100, pointBoost: 1.5,
        });
        // контрактный трейт усиливает точку feet → trait_point_feet уровень > 0
        const traits = deriveAcquiredTraits(subjectPreferencesRepo.get('SUB-1'));
        const foot = traits.find(t => t.id === 'trait_point_feet');
        expect(foot).toBeDefined();
        expect(foot!.strength).toBeGreaterThan(0);
    });

    it('removes an expired temporary trait by time', () => {
        setupSubject('SUB-1');
        addContractTrait('SUB-1', 'anomaly_foot_echo', {
            source: 'contract:C-1', kind: 'temporary', acquiredMinute: 0, decayAfterMinutes: 100, pointBoost: 1.5,
        });
        expect(readContractTraits('SUB-1')['anomaly_foot_echo']).toBeDefined();
        // до истечения — трейт есть
        applyContractTraitDecay('SUB-1', 50);
        expect(readContractTraits('SUB-1')['anomaly_foot_echo']).toBeDefined();
        // после истечения — снят
        applyContractTraitDecay('SUB-1', 150);
        expect(readContractTraits('SUB-1')['anomaly_foot_echo']).toBeUndefined();
    });

    it('keeps traumatic traits (no decay)', () => {
        setupSubject('SUB-1');
        addContractTrait('SUB-1', 'trauma_foot_stimulation', {
            source: 'contract:C-1', kind: 'traumatic', acquiredMinute: 0, tagPenalty: 1.0,
        });
        applyContractTraitDecay('SUB-1', 10000);
        expect(readContractTraits('SUB-1')['trauma_foot_stimulation']).toBeDefined();
    });

    it('is idempotent: re-adding the same trait does not double the boost', () => {
        setupSubject('SUB-1');
        addContractTrait('SUB-1', 'anomaly_foot_echo', {
            source: 'contract:C-1', kind: 'temporary', acquiredMinute: 0, decayAfterMinutes: 100, pointBoost: 1.5,
        });
        addContractTrait('SUB-1', 'anomaly_foot_echo', {
            source: 'contract:C-1', kind: 'temporary', acquiredMinute: 0, decayAfterMinutes: 100, pointBoost: 1.5,
        });
        const traits = deriveAcquiredTraits(subjectPreferencesRepo.get('SUB-1'));
        const foot = traits.find(t => t.id === 'trait_point_feet');
        // boost применён один раз (не 3.0)
        expect(foot!.strength).toBeLessThan(3.0);
    });

    it('removeContractTrait deletes the entry', () => {
        setupSubject('SUB-1');
        addContractTrait('SUB-1', 'anomaly_foot_echo', {
            source: 'contract:C-1', kind: 'temporary', acquiredMinute: 0, decayAfterMinutes: 100, pointBoost: 1.5,
        });
        removeContractTrait('SUB-1', 'anomaly_foot_echo');
        expect(readContractTraits('SUB-1')['anomaly_foot_echo']).toBeUndefined();
    });
});
