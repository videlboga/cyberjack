import { activeContextsRepo, presetRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { CompiledAction } from '../domain/types';
import { randomUUID } from 'crypto';
import { getActiveContextLabel } from '../domain/contextPresentation';

export class ContextManager {
    static applyAutonomousCollapse(subjectId: string): { applied: boolean; blocked: boolean; narrative: string; blockedBy?: string } {
        const lyingPose = presetRepo.getActionPreset('pose_lying_down');
        if (!lyingPose) return { applied: false, blocked: false, narrative: '' };
        const result = this.applyContext(subjectId, 'pose_lying_down', lyingPose, undefined, subjectId);
        if (result.blocked) {
            const blocker = presetRepo.getActionPreset((result as any).blockedBy);
            return {
                ...result,
                narrative: `Актив обмякает, но фиксация «${getActiveContextLabel(blocker, (result as any).blockedBy)}» удерживает тело в прежнем положении.`
            };
        }
        return {
            ...result,
            narrative: result.applied ? 'Актив обмякает и оседает, оказываясь в положении лёжа.' : ''
        };
    }

    static isPointBlocked(subjectId: string, pointId: string): { blocked: boolean; reason?: string } {
        const currentContexts = activeContextsRepo.getAllForSubject(subjectId);
        for (const ctx of currentContexts) {
            const preset = presetRepo.getActionPreset(ctx.actionId);
            if (preset?.contextConfig?.blocksPoints?.includes(pointId)) {
                return { blocked: true, reason: `Эта часть тела заблокирована (надето: ${getActiveContextLabel(preset, ctx.actionId)}).` };
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
        // A pose is one scene-level state. Its occupied anatomy slots describe
        // conflicts, not separate active-context instances. Older builds stored
        // one row per slot, which made one pose appear several times and leaked
        // duplicate context lines into prompts.
        const pointsToStore: Array<string | null> = newKind === 'pose'
            ? [pointsToOccupy.includes('global_pose') ? 'global_pose' : (pointId ?? pointsToOccupy[0] ?? null)]
            : pointsToOccupy;
        const autonomousPoseChange = newKind === 'pose' && initiatorId === subjectId;
        const newPriority = config.priority ?? 0;
        const conflicts: typeof currentContexts = [];

        // Validation is deliberately read-only. A blocked replacement must not
        // delete anything before its priority has been checked on every slot.
        for (const ctx of currentContexts) {
            if (ctx.actionId === actionId && pointsToOccupy.includes(ctx.pointId)) continue;
            const existingAction = presetRepo.getActionPreset(ctx.actionId);
            const existingConfig = existingAction?.contextConfig;
            if (!existingConfig) continue;

            // A subject that has lost control cannot autonomously replace a
            // whole-body restraint with a new pose. External repositioning is
            // still governed by the ordinary priority/exclusivity rules.
            const holdsGlobalPose = ctx.pointId === 'global_pose' || existingConfig.occupiesPoints?.includes('global_pose');
            if (autonomousPoseChange && holdsGlobalPose && existingAction?.tags?.includes('restraint')) {
                return { applied: false, blocked: true, blockedBy: ctx.actionId };
            }

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
        for (const pt of pointsToStore) {
            const alreadyActive = currentContexts.some(c =>
                c.actionId === actionId && c.pointId === pt && !conflicts.some(conflict => conflict.id === c.id)
            );
            if (!alreadyActive) {
                activeContextsRepo.add(randomUUID(), subjectId, actionId, config.duration ?? -1, pt, initiatorId);
                added += 1;
            }
        }

        // Reapplying a legacy multi-row pose also repairs it in place.
        if (newKind === 'pose') {
            const canonicalPoint = pointsToStore[0];
            const poseRows = activeContextsRepo.getAllForSubject(subjectId)
                .filter(context => context.actionId === actionId);
            const canonical = poseRows.find(context => context.pointId === canonicalPoint) ?? poseRows[0];
            for (const context of poseRows) {
                if (context.id !== canonical?.id) activeContextsRepo.remove(context.id);
            }
        }
        return { applied: added > 0 || conflicts.length > 0, blocked: false };
    }
    
    static processTick(subjectId: string, deltaTime: number = 1, elapsedMinutes: number = deltaTime) {
        const tickAmount = Math.max(0, deltaTime);
        const minuteAmount = Math.max(0, elapsedMinutes);
        db.transaction(() => {
            db.prepare(`
                UPDATE active_contexts
                SET ticks_active = COALESCE(ticks_active, 0) + CASE
                    WHEN COALESCE((SELECT json_extract(ap.context_config_json, '$.durationUnit')
                                   FROM action_presets ap WHERE ap.id = active_contexts.action_id), '') = 'minutes'
                    THEN ? ELSE ? END
                WHERE subject_id = ?
            `).run(minuteAmount, tickAmount, subjectId);
            db.prepare(`
                DELETE FROM active_contexts
                WHERE subject_id = ? AND duration >= 0 AND COALESCE(ticks_active, 0) >= duration
            `).run(subjectId);
        })();
    }
}
