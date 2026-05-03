import { Request, Response } from 'express';
import { sceneRepo, presetRepo, activeContextsRepo, eventLogRepo, sceneCharacterRepo, sceneLayoutsRepo } from '../../infrastructure/repositories';
import { ContextManager } from '../../orchestration/contextManager';


export const getScenes = (req: Request, res: Response) => {
    try {
        const scenes = sceneRepo.list().map((scene) => ({
            ...scene,
            characters: sceneCharacterRepo.list(scene.id)
        }));
        res.json({ success: true, scenes });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const moveScene = (req: Request, res: Response) => {
    try {
        const { characterId, sceneId, role, canAct, presenceState, slotId } = req.body || {};
        if (!characterId || !sceneId) {
            return res.status(400).json({ success: false, error: 'characterId и sceneId обязательны' });
        }
        
        const opts: any = {};
        if (role !== undefined) opts.role = role;
        if (canAct !== undefined) opts.canAct = canAct;
        if (presenceState !== undefined) opts.presenceState = presenceState;
        if (slotId !== undefined) opts.slotId = slotId;

        // Assuming sceneCharacterRepo has moveCharacter, we need to pass slotId too.
        sceneCharacterRepo.moveCharacter(characterId, sceneId, opts);
        const sceneCharacters = sceneCharacterRepo.list(sceneId);
        res.json({ success: true, sceneCharacters });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

    export const getContexts = (req: Request, res: Response) => {
        try {
            const subjectId = req.query.subjectId as string || 'CL-01';
            const allPresets = presetRepo.getAllActionPresets().filter((a: any) => a.contextConfig);
            const activeIds = activeContextsRepo.getAllForSubject(subjectId);

            res.json({ success: true, allPresets, activeIds });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    export const toggleContext = (req: Request, res: Response) => {
        try {
            const { subjectId = 'CL-01', contextId, isActive, pointId } = req.body;
            const targetContext = presetRepo.getActionPreset(contextId);
            const actorName = 'Брокер';
            
            if (!targetContext) throw new Error("Context preset not found.");

            const narratives: string[] = [];

            if (isActive) {
                // If a pointId is provided, apply the context specifically to that point
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
            res.json({ success: true, narratives });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
};

export const getSceneLayout = (req: Request, res: Response) => {
    try {
        const sceneId = (req.query.sceneId as string) || 'scene_lab_calibrator';
        const layout = sceneLayoutsRepo.get(sceneId);
        res.json({ success: true, layout });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};