import { activeContextsRepo, presetRepo } from '../infrastructure/repositories';
import { CompiledAction } from '../domain/types';
import { randomUUID } from 'crypto';

export class ContextManager {
    static applyContext(subjectId: string, actionId: string, action: CompiledAction) {
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
                        activeContextsRepo.removeByActionId(subjectId, existingAction.actionKey);
                    }
                }
            }
        }
        
        activeContextsRepo.add(randomUUID(), subjectId, actionId, config.duration || -1);
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
