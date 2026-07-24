import { describe, expect, it } from 'vitest';
import { getActiveContextLabel } from '../src/domain/contextPresentation';

describe('active context labels', () => {
    it('uses the state label instead of the action command', () => {
        expect(getActiveContextLabel({
            label: 'Застегнуть шоковый ошейник',
            contextConfig: { activeLabel: 'Шоковый ошейник' },
        }, 'act_apply_collar')).toBe('Шоковый ошейник');
    });

    it('falls back to the action label for legacy contexts', () => {
        expect(getActiveContextLabel({ label: 'Гиперестезия' }, 'effect_hyperesthesia')).toBe('Гиперестезия');
    });
});
