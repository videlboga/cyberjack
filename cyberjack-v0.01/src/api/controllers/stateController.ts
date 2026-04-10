import { clamp } from '../../engine/utils';
import { Request, Response } from 'express';
import { subjectRepo, resourceRepo, presetRepo, sceneRepo, characterRepo, characterRelationRepo, sceneCharacterRepo } from '../../infrastructure/repositories';
import { activeConfig, updateConfig } from '../../prompts/config';
import { normalizePlayer } from './playerController';

export const getState = (req: Request, res: Response) => {
    const subjectId = (req.query.subjectId as string) || 'S-01';
    const pointId = (req.query.pointId as string) || 'hands';
    const requestedSceneId = req.query.sceneId as string | undefined;
    
    try {
        const uiState = subjectRepo.getUIState(subjectId, pointId);
        const subjectCharacter = characterRepo.ensureSubject(subjectId, uiState.subject?.name || subjectId);
        const targetSceneId = requestedSceneId || subjectCharacter.currentSceneId || 'lab';
        const scene = sceneRepo.get(targetSceneId);
        const player = normalizePlayer(resourceRepo.get('PL-1'));
        const relations = characterRelationRepo.listFor(subjectCharacter.id);
        const characters = characterRepo.listAll().map((ch) => ({
            id: ch.id,
            name: ch.name,
            kind: ch.kind,
            currentSceneId: ch.currentSceneId
        }));

        let availableActions = uiState.availableActions || [];
        if (scene) {
            availableActions = (scene.availableActions || []).map(actionId => {
                const preset = presetRepo.getActionPreset(actionId);
                const costs = scene.actionCosts?.[actionId];
                return {
                    id: actionId,
                    label: preset?.label || actionId,
                    costs: costs && Object.keys(costs).length ? costs : null, occupiesPoints: preset?.contextConfig?.occupiesPoints || []
                };
            });
            scene.characters = sceneCharacterRepo.list(scene.id);
        }

        res.json({ 
            success: true, 
            subject: uiState.subject,
            availablePoints: uiState.availablePoints,
            availableActions,
            scene: scene ? { id: scene.id, transitions: scene.transitions || [], characters: scene.characters || [] } : null,
            player,
            relations,
            characters
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateSubject = (req: Request, res: Response) => {
    try {
        const subjectId = req.body.subjectId || 'S-01';
        const current = subjectRepo.get(subjectId);

        if (!current) {
            return res.status(404).json({ success: false, error: 'Subject not found' });
        }

        const asNumber = (value: any, fallback: number) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const updated = {
            sensitivity: clamp(asNumber(req.body.sensitivity, current.sensitivity), 0, 100),
            attitude: clamp(asNumber(req.body.attitude, current.attitude), 0, 100),
            capacity: clamp(asNumber(req.body.capacity, current.capacity), 0, 100),
            openness: clamp(asNumber(req.body.openness, current.openness), 0, 100),
            plasticity: clamp(asNumber(req.body.plasticity, current.plasticity), 0, 100),
            baselineSensitivity: clamp(asNumber(req.body.baselineSensitivity, current.baselineSensitivity ?? current.sensitivity), 0, 100),
            baselineAttitude: clamp(asNumber(req.body.baselineAttitude, current.baselineAttitude ?? current.attitude), 0, 100),
            baselineCapacity: clamp(asNumber(req.body.baselineCapacity, current.baselineCapacity ?? current.capacity), 0, 100),
            baselineOpenness: clamp(asNumber(req.body.baselineOpenness, current.baselineOpenness ?? current.openness), 0, 100),
            baselinePlasticity: clamp(asNumber(req.body.baselinePlasticity, current.baselinePlasticity ?? current.plasticity), 0, 100)
        };

        subjectRepo.save(subjectId, current.name || subjectId, updated as any);
        const fullState = subjectRepo.getWithPoint(subjectId, req.body.pointId || 'general');
        res.json({ success: true, state: fullState });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
