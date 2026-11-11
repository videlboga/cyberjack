import { test, expect } from 'vitest';
import { parseVerbalInput } from '../src/parser/verbalParser';

test('verbalParser exports parseVerbalInput (smoke)', async () => {
    expect(typeof parseVerbalInput).toBe('function');
    // call with empty input which should return a default structure
    const res = await parseVerbalInput('');
    expect(res).toHaveProperty('intensity');
    expect(res).toHaveProperty('commandIntent');
});
