import { describe, expect, it } from 'vitest';
import { parseVerbalInput } from '../src/parser/verbalParser';

describe('aggregate wardrobe command', () => {
    it('turns "разденься" into a deterministic multi-context removal', async () => {
        const parsed = await parseVerbalInput('Разденься');
        expect(parsed.model).toBe('deterministic-command-v1');
        expect(parsed.commandIntent).toMatchObject({
            type: 'deactivate_contexts',
            targetContextIds: expect.arrayContaining(['eq_clothe_calibration_set', 'eq_clothe_underwear']),
        });
    });
});
