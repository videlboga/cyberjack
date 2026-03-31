import { SubjectCoreState } from '../domain/types';
import { activeConfig } from './config';

/**
 * Преобразует числовые стейты в соматические ощущения от 2го/1го лица
 */
export function buildStateSummary(core: SubjectCoreState): string {
    const cfg = activeConfig.somaticSense;

    // Helper to get index 0-4
    const getLevelIndex = (val: number) => {
        if (val <= 20) return 0;
        if (val <= 40) return 1;
        if (val <= 60) return 2;
        if (val <= 80) return 3;
        return 4;
    };

    const sensIdx = getLevelIndex(core.sensitivity);
    const capIdx = getLevelIndex(core.capacity);
    const openIdx = getLevelIndex(core.openness);
    const attIdx = getLevelIndex(core.attitude);

    // Dynamic key access
    const sensText = (cfg as any)[`sensitivity_L${sensIdx}`];
    const capText = (cfg as any)[`capacity_L${capIdx}`];
    const openText = (cfg as any)[`openness_L${openIdx}`];
    const attText = (cfg as any)[`attitude_L${attIdx}`];

    // Build human readable block
    const lines = [
        cfg.noteTitle,
        `- ${sensText}`,
        `- ${capText}`,
        `- ${openText}`,
        `- ${attText}`,
        ``,
        `${cfg.traitsTitle} ${cfg.noTraitsFallback}` // Traits are handled implicitly by text now, but we keep placeholder
    ];

    return lines.join('\n');
}
