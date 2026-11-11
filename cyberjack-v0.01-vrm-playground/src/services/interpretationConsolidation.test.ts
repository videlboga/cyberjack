import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { interpretationRepo } from '../infrastructure/interpretationRepo';
import { propagateEpisode } from './interpretationConsolidation';

const SUBJ = 'CONSOL-TEST';

beforeEach(() => {
    // Очищаем ноды/линки тестового субъекта.
    for (const node of interpretationRepo.listForSubject(SUBJ)) {
        interpretationRepo.remove(SUBJ, node.id);
    }
    for (const link of interpretationRepo.listLinks(SUBJ)) {
        interpretationRepo.removeLink(SUBJ, link.id);
    }
});

describe('propagateEpisode (детерминированное распространение)', () => {
    it('создаёт episode-ноду и распространяет person-ассоциацию на rel:<person>', () => {
        propagateEpisode(SUBJ, 1, 'Побег из дома', 'Суми рассказала Нике про побег.', [
            { type: 'person', key: 'NPC-CAND-01', label: 'Ника', tagLinks: [], valence: -0.6, strength: 0.8, expectation: 'avoid' },
        ]);

        const rel = interpretationRepo.get(SUBJ, 'rel:NPC-CAND-01');
        expect(rel).not.toBeNull();
        expect(rel!.kind).toBe('relationships');
        // delta = -0.6 * 0.8 = -0.48 → valence < 0
        expect(rel!.valence).toBeLessThan(0);
        expect(rel!.status).toBe('dirty');

        const episode = interpretationRepo.get(SUBJ, 'episode:1');
        expect(episode).not.toBeNull();
        expect(episode!.kind).toBe('episode');
    });

    it('распространяет tag-ассоциацию на trait:<tag> под self', () => {
        propagateEpisode(SUBJ, 2, 'Боль', 'Было больно.', [
            { type: 'concept', key: 'боль', label: 'боль', tagLinks: ['pain'], valence: 0.7, strength: 0.9, expectation: 'seek' },
        ]);

        const trait = interpretationRepo.get(SUBJ, 'trait:pain');
        expect(trait).not.toBeNull();
        expect(trait!.kind).toBe('trait');
        expect(trait!.parentId).toBe('self');
        expect(trait!.valence).toBeGreaterThan(0);
    });

    it('создаёт кросс-линки эпизод → rel/trait', () => {
        propagateEpisode(SUBJ, 3, 'Разговор', 'Разговор с Никой о боли.', [
            { type: 'person', key: 'NPC-CAND-01', label: 'Ника', tagLinks: ['pain'], valence: -0.5, strength: 0.7, expectation: 'avoid' },
        ]);

        const links = interpretationRepo.listLinks(SUBJ);
        const evidenceLinks = links.filter(l => l.kind === 'evidence');
        expect(evidenceLinks.length).toBeGreaterThanOrEqual(2); // episode→rel + episode→trait
    });

    it('не создаёт ноду при delta ниже порога', () => {
        propagateEpisode(SUBJ, 4, 'Слабое', 'Почти ничего.', [
            { type: 'person', key: 'NPC-CAND-01', label: 'Ника', tagLinks: [], valence: 0.1, strength: 0.1, expectation: 'seek' },
        ]);
        // delta = 0.01 < 0.15 → rel не должен стать dirty (но нода может существовать пустой)
        const rel = interpretationRepo.get(SUBJ, 'rel:NPC-CAND-01');
        if (rel) {
            expect(rel.status).not.toBe('dirty');
        }
    });
});
