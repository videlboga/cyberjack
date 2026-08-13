import { clamp } from '../../engine/utils';
import { Request, Response } from 'express';
import { subjectRepo, resourceRepo, presetRepo, sceneRepo, characterRepo, characterRelationRepo, sceneCharacterRepo, activeContextsRepo, pointStateRepo, sceneObjectsRepo, chatMemoryRepo, chatSummaryRepo, memoryRepo } from '../../infrastructure/repositories';
import { activeConfig, updateConfig } from '../../prompts/config';
import { normalizePlayer } from './playerController';
import { getActiveContextLabel } from '../../domain/contextPresentation';
import { deriveTelemetry } from '../../narrative/telemetry';
import { resolvePortraitEmotion } from '../../domain/portraitEmotion';
import { db } from '../../infrastructure/db';
import { relationshipDynamicsRepo } from '../../infrastructure/relationshipDynamicsRepo';
import { compileAction } from '../../compiler/compileAction';
import { runTick } from '../../engine/runTick';
import { conditioningTags, preferenceValenceModifier } from '../../domain/conditioning';
import { deriveIntimacyReadiness } from '../../domain/intimacyReadiness';
import * as checkActionAccess from '../../scenario/checkActionAccess';
import { ContextManager } from '../../orchestration/contextManager';
import { getStateSnapshot } from '../../services/stateService';

export const getState = (req: Request, res: Response) => {
    const subjectId = (req.query.subjectId as string) || 'S-01';
    let pointId = (req.query.pointId as string) || 'hands';
    pointId = pointId.toLowerCase();
    const requestedSceneId = req.query.sceneId as string | undefined;
    // Scene cards only need the current character state.  Returning the full
    // action catalogue and a 160-event recommendation history for every
    // visible neighbour made a single calibration refresh several megabytes.
    const sceneSnapshot = req.query.view === 'scene';
    
    try {
        const snapshot = getStateSnapshot({
            subjectId,
            pointId,
            sceneId: requestedSceneId,
            sceneSnapshot,
        });
        res.json({ success: true, ...snapshot });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// A dry run of the same engine used by a real tick. The console uses this to
// rank its recommendations by the displayed metric, rather than by unrelated
// historical deltas.
export const forecastIntimacy = (req: Request, res: Response) => {
  try {
    const subjectId = String(req.body.subjectId || '');
    const actorId = String(req.body.actorId || 'PL-1');
    const sceneId = String(req.body.sceneId || 'scene_lab_calibrator');
    const candidates = Array.isArray(req.body.candidates) ? req.body.candidates.slice(0, 80) : [];
    const subject = subjectRepo.get(subjectId);
    const character = characterRepo.ensureSubject(subjectId, subject?.name || subjectId);
    const relation = characterRelationRepo.ensure(character.id, actorId, { attitude: subject?.attitude ?? 50, openness: subject?.openness ?? 50, plasticity: subject?.plasticity ?? 50 });
    const dynamics = relationshipDynamicsRepo.get(subjectId, actorId);
    const points = pointStateRepo.getAllForSubject(subjectId);
    const scene = sceneRepo.get(sceneId);
    const resources = resourceRepo.get(actorId);
    const forecasts = candidates.flatMap((candidate: any) => {
      const pointId = String(candidate.pointId || '');
      const presetId = String(candidate.actionId || '');
      const point = points.find(entry => entry.pointId === pointId);
      if (!subject || !point || !scene || !resources || !presetRepo.getActionPreset(presetId)) return [];
      if (!checkActionAccess.validateAction(presetId, scene, resources, subjectId, actorId, pointId).allowed) return [];
      if (ContextManager.isPointBlocked(subjectId, pointId).blocked) return [];
      let action = compileAction({ presetId, eventId: sceneId, activeContexts: activeContextsRepo.getAllForSubject(subjectId).filter(context => !context.pointId || context.pointId === pointId), familiarity: point.familiarity ?? 0 });
      action.tags = conditioningTags(action.actionKey, action.tags || []);
      action.valence += preferenceValenceModifier(action.tags, subject.preferences);
      const output = runTick({ subjectId, pointId, action, core: subject, point, relationship: relation });
      const relationalScale = Math.max(.15, Math.min(1.5, Number(output.result.experiencedIntensity || 0) / 10));
      const relationalSignal = Math.max(-1, Math.min(.5, output.result.finalValence * relationalScale * .25));
      const after = deriveIntimacyReadiness({
        relationAttitude: Math.max(0, Math.min(100, Number(relation.attitude) + relationalSignal)),
        relationOpenness: Math.max(0, Math.min(100, Number(relation.openness || 0) + relationalSignal * .35)),
        fear: Math.max(0, Number(dynamics.fear || 0) + (output.result.finalValence > .3 ? -.15 : 0)),
        resistance: dynamics.resistance,
        capacity: output.nextCore.capacity,
        tension: output.nextCore.tension,
        points: points.map(entry => entry.pointId === pointId ? output.nextPoint : entry),
      });
      const before = deriveIntimacyReadiness({ relationAttitude: relation.attitude, relationOpenness: relation.openness ?? subject.openness, fear: dynamics.fear, resistance: dynamics.resistance, capacity: subject.capacity, tension: subject.tension, points });
      return [{ actionId: presetId, pointId, readiness: after.readiness - before.readiness, arousal: after.arousal - before.arousal, trust: after.trust - before.trust }];
    });
    res.json({ success: true, forecasts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getChatHistory = (req: Request, res: Response) => {
    try {
        const subjectId = String(req.params.subjectId || '');
        if (!subjectId || !subjectRepo.get(subjectId)) return res.status(404).json({ success: false, error: 'Персонаж не найден' });
        const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
        const currentSubject = subjectRepo.get(subjectId);
        const historicalObservations = db.prepare(`
            SELECT timestamp, result_payload
            FROM event_logs
            WHERE subject_id = ? AND action_type = 'interaction'
            ORDER BY timestamp ASC, id ASC
        `).all(subjectId) as Array<{ timestamp: string; result_payload: string }>;
        const messages = chatMemoryRepo.getRecent(subjectId, Math.min(100, limit * 4))
            .filter(message => !message.content.startsWith('[Воздействие]'))
            .slice(-limit)
            .map(message => {
                if (message.role !== 'assistant' || message.portraitEmotion) return message;
                const messageTime = String(message.createdAt || '');
                const historical = [...historicalObservations].reverse().find(event => event.timestamp <= messageTime);
                let observation:any = null;
                try {
                    if (historical) observation = JSON.parse(historical.result_payload || '{}').observation;
                } catch { }
                return {
                    ...message,
                    portraitEmotion: resolvePortraitEmotion({
                        speech: message.content,
                        behavioralState: observation?.behavioralState,
                        reaction: observation?.reaction,
                        transitions: observation?.transitions,
                        state: {
                            tension: currentSubject?.tension,
                            capacity: currentSubject?.capacity,
                            attitude: currentSubject?.attitude,
                            openness: currentSubject?.openness,
                            plasticity: currentSubject?.plasticity,
                            contexts: (observation?.contexts || []).map((context: any) => ({ actionId: context.id }))
                        }
                    })
                };
            });
        res.json({ success: true, subjectId, messages });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/** Return a durable room/device journal, including former occupants. */
export const getContextChatHistory = (req: Request, res: Response) => {
    try {
        const labels = String(req.query.contexts || '')
            .split('|')
            .map(label => label.trim())
            .filter(Boolean);
        if (!labels.length) return res.status(400).json({ success: false, error: 'contexts required' });
        const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
        const messages = chatMemoryRepo.getRecentForContexts(labels, limit);
        res.json({ success: true, contexts: labels, messages });
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
            sensitivity: Math.max(0, asNumber(req.body.sensitivity, current.sensitivity)),
            attitude: clamp(asNumber(req.body.attitude, current.attitude), 0, 100),
            capacity: clamp(asNumber(req.body.capacity, current.capacity), 0, 100),
            openness: clamp(asNumber(req.body.openness, current.openness), 0, 100),
            plasticity: Math.max(0, asNumber(req.body.plasticity, current.plasticity)),
            tension: clamp(asNumber(req.body.tension, current.tension ?? 0), 0, 150),
            baselineSensitivity: Math.max(0, asNumber(req.body.baselineSensitivity, current.baselineSensitivity ?? current.sensitivity)),
            baselineAttitude: clamp(asNumber(req.body.baselineAttitude, current.baselineAttitude ?? current.attitude), 0, 100),
            baselineCapacity: clamp(asNumber(req.body.baselineCapacity, current.baselineCapacity ?? current.capacity), 0, 100),
            baselineOpenness: clamp(asNumber(req.body.baselineOpenness, current.baselineOpenness ?? current.openness), 0, 100),
            baselinePlasticity: Math.max(0, asNumber(req.body.baselinePlasticity, current.baselinePlasticity ?? current.plasticity))
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
