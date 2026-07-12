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
        if (!action.contextConfig) return { applied: false, blocked: false };

        const config = action.contextConfig;
        const currentContexts = activeContextsRepo.getAllForSubject(subjectId);
        const pointsToOccupy: Array<string | null> = config.occupiesPoints?.length
            ? config.occupiesPoints
            : [pointId ?? null];
        const contextKind = (preset: any): string | undefined => {
            const presetConfig = preset?.contextConfig;
            if (presetConfig?.type) return presetConfig.type;
            return presetConfig?.occupiesPoints?.includes('global_pose') ? 'pose' : undefined;
        };
        const newKind = contextKind(action);
        const newPriority = config.priority ?? 0;
        const conflicts: typeof currentContexts = [];

        // Validation is deliberately read-only. A blocked replacement must not
        // delete anything before its priority has been checked on every slot.
        for (const ctx of currentContexts) {
            if (ctx.actionId === actionId && pointsToOccupy.includes(ctx.pointId)) continue;
            const existingAction = presetRepo.getActionPreset(ctx.actionId);
            const existingConfig = existingAction?.contextConfig;
            if (!existingConfig) continue;

            const replacesPose = newKind === 'pose' && contextKind(existingAction) === 'pose';
            const overlapsInstance = pointsToOccupy.includes(ctx.pointId);
            const exclusiveConflict = overlapsInstance &&
                (config.exclusiveWithinPoint === true || existingConfig.exclusiveWithinPoint === true);
            if (!replacesPose && !exclusiveConflict) continue;

            const existingPriority = existingConfig.priority ?? 0;
            if (existingPriority > newPriority) {
                return { applied: false, blocked: true, blockedBy: ctx.actionId };
            }
            conflicts.push(ctx);
        }

        for (const ctx of conflicts) activeContextsRepo.remove(ctx.id);

        let added = 0;
        for (const pt of pointsToOccupy) {
            const alreadyActive = currentContexts.some(c =>
                c.actionId === actionId && c.pointId === pt && !conflicts.some(conflict => conflict.id === c.id)
            );
            if (!alreadyActive) {
                activeContextsRepo.add(randomUUID(), subjectId, actionId, config.duration ?? -1, pt, initiatorId);
                added += 1;
            }
        }
        return { applied: added > 0 || conflicts.length > 0, blocked: false };
    }
    
    static processTick(subjectId: string, deltaTime: number = 1) {
        activeContextsRepo.incrementTicks(subjectId, Math.max(0, deltaTime));
        const currentContexts = activeContextsRepo.getAllForSubject(subjectId);
        for (const ctx of currentContexts) {
            if (ctx.duration >= 0 && ctx.ticksActive >= ctx.duration) {
                activeContextsRepo.remove(ctx.id);
            }
        }
    }
}
