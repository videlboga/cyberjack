import { Mission, SubjectCoreState } from '../domain/types';

/**
 * Проверяет текущее состояние ядра субъекта и решает, увеличился ли прогресс по миссии.
 * Это болванка (stub), которую предстоит заменить на реальные условия.
 */
export function applyMissionProgress(
    mission: Mission, 
    core: SubjectCoreState, 
    conditions: Record<string, any>
): Mission {
    // В будущем тут будет валидация state против conditions (например, openness > 60).
    // Пока просто повышаем прогресс, если миссия активна.
    return {
        ...mission,
        progress: typeof mission.progress === 'number' ? mission.progress + 1 : 1
    };
}
