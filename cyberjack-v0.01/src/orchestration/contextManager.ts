import { activeContextsRepo, presetRepo } from '../infrastructure/repositories';
import { CompiledAction } from '../domain/types';
import { randomUUID } from 'crypto';

export class ContextManager {
    static isPointBlocked(subjectId: string, pointId: string): { blocked: boolean; reason?: string } {
        const currentContexts = activeContextsRepo.getAllForSubject(subjectId);
        for (const ctx of currentContexts) {
            const preset = presetRepo.getActionPreset(ctx.actionId);
            if (preset?.contextConfig?.blocksPoints?.includes(pointId)) {
                return { blocked: true, reason: `Эта часть тела заблокирована (надето: ${preset.label || ctx.actionId}).` };
            }
        }
        return { blocked: false };
    }

    static applyContext(subjectId: string, actionId: string, action: CompiledAction, pointId?: string, initiatorId?: string | null) {
        if (!action.contextConfig) return;

        const config = action.contextConfig;
        const currentContexts = activeContextsRepo.getAllForSubject(subjectId);

        for (const pt of config.occupiesPoints || []) {
            for (const ctx of currentContexts) {
                const existingAction = presetRepo.getActionPreset(ctx.actionId);
                if (existingAction?.contextConfig?.occupiesPoints?.includes(pt)) {
                    if (existingAction.contextConfig.priority && config.priority && existingAction.contextConfig.priority > config.priority) {
                        return; // Blocked by higher priority
                    }
                    if (config.exclusiveWithinPoint) {
                        activeContextsRepo.removeByActionIdAndPoint(subjectId, existingAction.actionKey || existingAction.id, pt);
                    }
                }
            }
        }

        const pointsToOccupy = (config.occupiesPoints && config.occupiesPoints.length > 0)
            ? config.occupiesPoints
            : [pointId || null];

        for (const pt of pointsToOccupy) {
            activeContextsRepo.add(randomUUID(), subjectId, actionId, config.duration || -1, pt, initiatorId);
        }
    }
    
    static processTick(subjectId: string) {
        activeContextsRepo.incrementTicks(subjectId, 1);
        const currentContexts = activeContextsRepo.getAllForSubject(subjectId);
        for (const ctx of currentContexts) {
            if (ctx.duration > 0 && ctx.ticksActive >= ctx.duration) {
                activeContextsRepo.remove(ctx.id);
            }
        }
    }
}
