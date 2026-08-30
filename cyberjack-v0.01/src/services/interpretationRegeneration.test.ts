import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../infrastructure/seed';
import { interpretationRepo } from '../infrastructure/interpretationRepo';
import { propagateEpisode } from './interpretationConsolidation';
import { consolidateNextInterpretation } from './interpretationRegeneration';

const mocks = vi.hoisted(() => ({ parseVerbalInputWithLLM: vi.fn() }));
vi.mock('../adapters/llmAdapter', () => ({ parseVerbalInputWithLLM: mocks.parseVerbalInputWithLLM }));

const SUBJ = 'REGEN-TEST';

beforeEach(() => {
    for (const node of interpretationRepo.listForSubject(SUBJ)) interpretationRepo.remove(SUBJ, node.id);
    for (const link of interpretationRepo.listLinks(SUBJ)) interpretationRepo.removeLink(SUBJ, link.id);
    mocks.parseVerbalInputWithLLM.mockReset();
});

describe('consolidateNextInterpretation (регенерация content)', () => {
    it('регенерирует content dirty-ноды батчем и снимает dirty', async () => {
        // Создаём dirty-ноду через propagateEpisode.
        propagateEpisode(SUBJ, 1, 'Побег', 'Суми рассказала Нике про побег.', [
            { type: 'person', key: 'NPC-CAND-01', label: 'Ника', tagLinks: [], valence: -0.6, strength: 0.8, expectation: 'avoid' },
        ]);
        const rel = interpretationRepo.get(SUBJ, 'rel:NPC-CAND-01');
        expect(rel!.status).toBe('dirty');

        // Батч-формат: parsed — объект { id ноды: content }.
        mocks.parseVerbalInputWithLLM.mockResolvedValue({ parsed: { 'rel:NPC-CAND-01': 'Я не доверяю Нике после того разговора.' } });

        const didWork = await consolidateNextInterpretation();
        expect(didWork).toBe(true);

        const after = interpretationRepo.get(SUBJ, 'rel:NPC-CAND-01');
        expect(after!.status).toBe('ready');
        expect(after!.content).toContain('не доверяю');
    });

    it('не перегенерирует ноду, если fingerprint не изменился и content есть', async () => {
        propagateEpisode(SUBJ, 2, 'Боль', 'Было больно.', [
            { type: 'concept', key: 'боль', label: 'боль', tagLinks: ['pain'], valence: 0.7, strength: 0.9, expectation: 'seek' },
        ]);
        // Первый проход генерит content (батч-формат).
        mocks.parseVerbalInputWithLLM.mockResolvedValue({ parsed: { 'trait:pain': 'Боль стала для меня притягательной.' } });
        await consolidateNextInterpretation();

        const trait = interpretationRepo.get(SUBJ, 'trait:pain');
        expect(trait!.status).toBe('ready');
        expect(trait!.content).toContain('притягательной');

        // Повторный проход: fingerprint не изменился → нода не перегенерируется.
        // (Сид создаёт dirty-каркас для всех субъектов, поэтому глобальный
        // didWork может быть true за счёт других субъектов — проверяем именно
        // нашу ноду: content не должен измениться, LLM не должен вызываться
        // для неё повторно.)
        mocks.parseVerbalInputWithLLM.mockClear();
        await consolidateNextInterpretation();
        const after = interpretationRepo.get(SUBJ, 'trait:pain');
        expect(after!.content).toContain('притягательной');
        expect(after!.status).toBe('ready');
    });
});
