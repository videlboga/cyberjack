import { SubjectCoreState } from '../domain/types';
import { inferTraits } from '../diagnostics/traitInference';

/**
 * Генерирует текстовое резюме текущего состояния субъекта
 * для инъекции в промпт (например, в системный промпт или как память).
 */
export function buildStateSummary(core: SubjectCoreState): string {
    const traits = inferTraits(core);
    
    // Формируем человекочитаемый блок о состоянии
    const lines = [
        `[System Note: Subject Internal State]`,
        `- Emotional Sensitivity: ${Math.round(core.sensitivity)}%`,
        `- Stress Capacity: ${Math.round(core.capacity)}%`,
        `- Receptiveness (Openness): ${Math.round(core.openness)}%`,
        `- Attitude towards Player: ${Math.round(core.attitude)}%`,
        ``,
        `Current Behavioral Traits:`,
        traits.length > 0 ? traits.map(t => `* ${t}`).join('\n') : '* None noticeable.'
    ];

    return lines.join('\n');
}
