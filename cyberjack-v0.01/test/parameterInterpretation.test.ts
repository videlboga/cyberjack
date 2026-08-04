import { describe, expect, it } from 'vitest';
import {
    exceptionalCoreStateLines,
    formatRelativeValue,
    interpretCoreMetric,
    interpretPointAttitude,
    interpretPointSensitivity,
    isAcquiredHyperSensitivity
} from '../src/domain/parameterInterpretation';
import { buildStateSummary } from '../src/prompts/buildStateSummary';

describe('parameter interpretation', () => {
    it('separates population and personal references', () => {
        const value = interpretCoreMetric('plasticity', 100, 70);
        expect(value.humanPercent).toBe(400);
        expect(value.personalPercent).toBe(143);
        expect(formatRelativeValue(value)).toBe('400% нормы · индекс 100 · сверхчеловеческое значение');
    });

    it('keeps an absolute index comparable while using point-specific norms', () => {
        const feet = interpretPointSensitivity('feet', 75, 75);
        const clitoris = interpretPointSensitivity('clitoris', 100, 100);
        expect(feet.humanPercent).toBe(100);
        expect(clitoris.humanPercent).toBe(100);
        expect(interpretPointSensitivity('feet', 150, 75).humanPercent).toBe(400);
    });

    it('interprets local acceptance against neutral and personal references', () => {
        const value = interpretPointAttitude(75, 60);
        expect(value.humanPercent).toBe(225);
        expect(value.personalPercent).toBe(125);
        expect(value.value).toBe(75);
    });

    it('does not call naturally sensitive anatomy acquired hyperesthesia', () => {
        expect(isAcquiredHyperSensitivity(interpretPointSensitivity('nipples', 95, 95))).toBe(false);
        expect(isAcquiredHyperSensitivity(interpretPointSensitivity('nipples', 110, 95))).toBe(true);
    });

    it('keeps natural sensitivity and acquired hyper-sensitivity distinct in prompts', () => {
        const core = {
            sensitivity: 50, capacity: 60, openness: 50, plasticity: 50, attitude: 50, tension: 0
        };
        const natural = buildStateSummary(core, [{
            pointId: 'nipples', label: 'Соски', localSensitivity: 95, baselineLocalSensitivity: 95, localAttitude: 50
        }]);
        expect(natural).not.toContain('[Фокусная гиперсенситизация]');

        const acquired = buildStateSummary(core, [{
            pointId: 'nipples', label: 'Соски', localSensitivity: 110, baselineLocalSensitivity: 95, localAttitude: 50
        }]);
        expect(acquired).toContain('[Фокусная гиперсенситизация]');
    });

    it('marks values beyond the old core range as exceptional prompt facts', () => {
        const lines = exceptionalCoreStateLines({
            sensitivity: 160, capacity: 60, openness: 50, plasticity: 150, attitude: 50, tension: 0
        });
        expect(lines.join(' ')).toContain('ЗАПРЕДЕЛЬНОЕ ЗНАЧЕНИЕ: Общая чувствительность');
        expect(lines.join(' ')).toContain('ЗАПРЕДЕЛЬНОЕ ЗНАЧЕНИЕ: Пластичность');
    });
});
