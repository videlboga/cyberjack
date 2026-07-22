import { clamp } from '../../engine/utils';
import { Request, Response } from 'express';
import { subjectRepo, resourceRepo, presetRepo, sceneRepo, characterRepo, characterRelationRepo, sceneCharacterRepo, activeContextsRepo, pointStateRepo, sceneObjectsRepo, chatMemoryRepo, chatSummaryRepo, memoryRepo } from '../../infrastructure/repositories';
import { activeConfig, updateConfig } from '../../prompts/config';
import { normalizePlayer } from './playerController';
import { getActiveContextLabel } from '../../domain/contextPresentation';
import { deriveTelemetry } from '../../narrative/telemetry';
import { db } from '../../infrastructure/db';

export const getState = (req: Request, res: Response) => {
    const subjectId = (req.query.subjectId as string) || 'S-01';
    let pointId = (req.query.pointId as string) || 'hands';
    pointId = pointId.toLowerCase();
    const requestedSceneId = req.query.sceneId as string | undefined;
    
    try {
        const uiState = subjectRepo.getUIState(subjectId, pointId);
        const subjectCharacter = characterRepo.ensureSubject(subjectId, uiState.subject?.name || subjectId);
        const targetSceneId = requestedSceneId || subjectCharacter.currentSceneId || 'scene_lab_calibrator';
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
                    costs: costs && Object.keys(costs).length ? costs : null,
                    occupiesPoints: preset?.contextConfig?.occupiesPoints || [],
                    categories: preset?.categories || ['physical'],
                    tags: preset?.tags || [],
                    type: preset?.type || 'physical',
                    // expose requirements so frontend can pre-filter actions
                    requiresItem: preset?.requiresItem || null,
                    requiresSceneObject: preset?.contextConfig?.requiresSceneObject || null,
                    requireContexts: (preset?.vector && preset.vector.requireContexts) || preset?.requireContexts || null,
                    removeContexts: (preset?.vector && preset.vector.removeContexts) || preset?.removeContexts || null,
                    validTargets: preset?.validTargets || (preset?.vector && preset.vector.validTargets) || null
                };
            });
            scene.characters = sceneCharacterRepo.list(scene.id);
        }

        const anatomyDict: any = {};
        const subjectPoints = pointStateRepo.getAllForSubject(subjectId) || [];
        for (const pt of subjectPoints) {
            anatomyDict[pt.pointId] = pt; // get mapped pointId
        }

        let subject = uiState.subject;
        if (subject) {
            subject.anatomy = anatomyDict;
            const rawContexts = activeContextsRepo.getAllForSubject(subjectId) || [];
            subject.contexts = rawContexts.map(c => {
                const preset = presetRepo.getActionPreset(c.actionId);
                return { ...c, label: getActiveContextLabel(preset, c.actionId), type: preset?.contextConfig?.type || preset?.type || c.actionId, occupiesPoints: preset?.contextConfig?.occupiesPoints || [], blocksPoints: preset?.contextConfig?.blocksPoints || [] };
            });
        }

        const recentInteractions = db.prepare(`SELECT result_payload FROM event_logs WHERE subject_id = ? AND action_type = 'interaction' ORDER BY id DESC LIMIT 5`).all(subjectId) as any[];
        const recentObservations = recentInteractions.flatMap(row => {
            try {
                const observation = JSON.parse(row.result_payload || '{}').observation;
                return observation ? [observation] : [];
            } catch { return []; }
        });
        const latestInteraction = recentInteractions[0];
        let latestObservation: any = null;
        try { latestObservation = JSON.parse(latestInteraction?.result_payload || '{}').observation || null; } catch { }
        const telemetry = subject ? deriveTelemetry({
            core: subject,
            point: anatomyDict[pointId],
            observation: latestObservation,
            contexts: subject.contexts
        }) : null;

        res.json({ 
            success: true, 
            subject: subject,
            telemetry,
            recentObservations,
            availablePoints: uiState.availablePoints,
            availableActions,
            scene: scene ? { id: scene.id, transitions: scene.transitions || [], characters: scene.characters || [] } : null,
            // include physical objects present in the scene (furniture, gear, suspension rigs, etc.)
            sceneObjects: scene ? sceneObjectsRepo.listForScene(scene.id) : [],
            player,
            relations,
            characters
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getChatHistory = (req: Request, res: Response) => {
    try {
        const subjectId = String(req.params.subjectId || '');
        if (!subjectId || !subjectRepo.get(subjectId)) return res.status(404).json({ success: false, error: 'Персонаж не найден' });
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
        const messages = chatMemoryRepo.getRecent(subjectId, Math.min(100, limit * 4))
            .filter(message => !message.content.startsWith('[Воздействие]'))
            .slice(-limit);
        res.json({ success: true, subjectId, messages });
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
            tension: clamp(asNumber(req.body.tension, current.tension ?? 0), 0, 150),
            baselineSensitivity: clamp(asNumber(req.body.baselineSensitivity, current.baselineSensitivity ?? current.sensitivity), 0, 100),
            baselineAttitude: clamp(asNumber(req.body.baselineAttitude, current.baselineAttitude ?? current.attitude), 0, 100),
            baselineCapacity: clamp(asNumber(req.body.baselineCapacity, current.baselineCapacity ?? current.capacity), 0, 100),
            baselineOpenness: clamp(asNumber(req.body.baselineOpenness, current.baselineOpenness ?? current.openness), 0, 100),
            baselinePlasticity: clamp(asNumber(req.body.baselinePlasticity, current.baselinePlasticity ?? current.plasticity), 0, 100)
        };

        subjectRepo.save(subjectId, current.name || subjectId, updated as any);
        const fullState = subjectRepo.getWithPoint(subjectId, req.body.pointId || 'systemic');
        res.json({ success: true, state: fullState });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updatePointState = (req: Request, res: Response) => {
    try {
        const subjectId = req.body.subjectId;
        const pointId = req.body.pointId;
        if (!subjectId || !pointId) return res.status(400).json({ success: false, error: 'subjectId and pointId required' });

        // Accept numeric fields and fallback to defaults where appropriate
        const asNum = (v: any, def: number) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : def;
        };

        const state = {
            localSensitivity: asNum(req.body.localSensitivity, 0),
            localAttitude: asNum(req.body.localAttitude, 50),
            localOpenness: asNum(req.body.localOpenness, 50),
            familiarity: asNum(req.body.familiarity, 0),
            exposureCount: asNum(req.body.exposureCount, 0),
            baselineLocalSensitivity: req.body.baselineLocalSensitivity !== undefined ? asNum(req.body.baselineLocalSensitivity, 0) : null,
            baselineLocalAttitude: req.body.baselineLocalAttitude !== undefined ? asNum(req.body.baselineLocalAttitude, 0) : null,
            baselineLocalOpenness: req.body.baselineLocalOpenness !== undefined ? asNum(req.body.baselineLocalOpenness, 0) : null
        } as any;

        // Persist using repository
        pointStateRepo.save(subjectId, pointId, state);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const resetAttemptMemory = (req: Request, res: Response) => {
    try {
        const subjectId = req.body.subjectId;
        const sceneId = req.body.sceneId || 'scene_lab_calibrator';
        if (!subjectId) return res.status(400).json({ success: false, error: 'subjectId required' });

        chatMemoryRepo.clear(subjectId);
        chatSummaryRepo.clear(subjectId);
        memoryRepo.deleteEpisodesForScene(subjectId, sceneId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
