import { describe, expect, it } from 'vitest';
import { describeSocialObservation } from './socialTransactions';

describe('social observation grounding', () => {
    it('makes the observed recipient a direct addressee', () => {
        expect(describeSocialObservation({ targetId: 'NPC-CAND-GEN-02', actionLabel: 'Мягкое поглаживание' }, 'NPC-CAND-GEN-02'))
            .toContain('Обращайся к собеседнику на «ты»');
    });

    it('requires a named third person when the observed target is not the recipient', () => {
        expect(describeSocialObservation({ targetId: 'NPC-CAND-SUMI', actionLabel: 'Массаж' }, 'NPC-CAND-GEN-02'))
            .toContain('сначала назови его по имени');
    });
});
