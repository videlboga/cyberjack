import { presetRepo, activeContextsRepo, eventLogRepo } from '../infrastructure/repositories';
import { ContextManager } from '../orchestration/contextManager';

/**
 * Этап 8. Application service для контекстов сцены.
 *
 * Выносит бизнес-логику включения/выключения контекстов из контроллера.
 * Контроллер валидирует транспортный ввод, вызывает один сервис и
 * отображает результат.
 */

export interface ToggleContextInput {
  subjectId: string;
  contextId: string;
  isActive: boolean;
  pointId?: string | null;
  actorName?: string;
}

export function toggleContext(input: ToggleContextInput): string[] {
  const { subjectId, contextId, isActive, pointId, actorName = 'Брокер' } = input;
  const targetContext = presetRepo.getActionPreset(contextId);
  if (!targetContext) throw new Error('Context preset not found.');

  const narratives: string[] = [];

  if (isActive) {
    ContextManager.applyContext(subjectId, contextId, targetContext, pointId || undefined);
    const forcedNarrative = `Активирован контекст: ${targetContext.label}`;
    eventLogRepo.append(subjectId, 'context_change',
      { presetId: 'context_change', action: null, actionLabel: forcedNarrative, narrative: forcedNarrative },
      { added: true }
    );
    narratives.push(forcedNarrative);
  } else {
    if (pointId !== undefined && pointId !== null) {
      activeContextsRepo.removeByActionIdAndPoint(subjectId, contextId, pointId);
    } else {
      activeContextsRepo.removeByActionId(subjectId, contextId);
    }
    const removalText = `Контекст удален: ${targetContext.label}`;
    eventLogRepo.append(subjectId, 'context_change',
      { presetId: 'context_change', action: null, actionLabel: removalText, narrative: removalText },
      { removed: true }
    );
    narratives.push(removalText);
  }
  return narratives;
}
