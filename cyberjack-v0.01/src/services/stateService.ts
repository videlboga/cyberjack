import { subjectRepo, resourceRepo, presetRepo, sceneRepo, characterRepo, characterRelationRepo, sceneCharacterRepo, activeContextsRepo, pointStateRepo, sceneObjectsRepo } from '../infrastructure/repositories';
import { normalizePlayer } from '../api/controllers/playerController';
import { getActiveContextLabel } from '../domain/contextPresentation';
import { deriveTelemetry } from '../narrative/telemetry';
import { db } from '../infrastructure/db';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';

/**
 * Этап 8. Application service для состояния сцены.
 *
 * Выносит бизнес-логику построения state-снимка из контроллера.
 * Контроллер валидирует транспортный ввод, вызывает один сервис и
 * отображает результат.
 */

export interface GetStateInput {
  subjectId: string;
  pointId: string;
  sceneId?: string;
  sceneSnapshot?: boolean;
}

export function getStateSnapshot(input: GetStateInput) {
  const { subjectId, pointId, sceneId: requestedSceneId, sceneSnapshot = false } = input;

  const uiState = subjectRepo.getUIState(subjectId, pointId);
  const subjectCharacter = characterRepo.ensureSubject(subjectId, uiState.subject?.name || subjectId);
  const targetSceneId = requestedSceneId || subjectCharacter.currentSceneId || 'scene_lab_calibrator';
  const scene = sceneRepo.get(targetSceneId);
  const player = normalizePlayer(resourceRepo.get('PL-1'));
  const relations = characterRelationRepo.listFor(subjectCharacter.id);
  const relationshipDynamics = relationshipDynamicsRepo.get(subjectCharacter.id, 'PL-1');
  const characters = characterRepo.listAll().map((ch) => ({
    id: ch.id,
    name: ch.name,
    kind: ch.kind,
    currentSceneId: ch.currentSceneId
  }));

  let availableActions = uiState.availableActions || [];
  if (scene && !sceneSnapshot) {
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
        requiresItem: preset?.requiresItem || null,
        requiresSceneObject: preset?.contextConfig?.requiresSceneObject || null,
        requireContexts: (preset?.vector && preset.vector.requireContexts) || preset?.requireContexts || null,
        removeContexts: (preset?.vector && preset.vector.removeContexts) || preset?.removeContexts || null,
        validTargets: preset?.validTargets || (preset?.vector && preset.vector.validTargets) || null,
        intensity: Number(preset?.vector?.intensity ?? 0),
        sharpness: Number(preset?.vector?.sharpness ?? 0)
      };
    });
    scene.characters = sceneCharacterRepo.list(scene.id);
  }

  const anatomyDict: any = {};
  const subjectPoints = pointStateRepo.getAllForSubject(subjectId) || [];
  for (const pt of subjectPoints) {
    anatomyDict[pt.pointId] = pt;
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

  const recentInteractions = db.prepare(`SELECT id, result_payload FROM event_logs WHERE subject_id = ? AND action_type = 'interaction' ORDER BY id DESC LIMIT 5`).all(subjectId) as any[];
  const recentObservations = recentInteractions.flatMap(row => {
    try {
      const observation = JSON.parse(row.result_payload || '{}').observation;
      return observation ? [{ ...observation, eventLogId: Number(row.id) }] : [];
    } catch { return []; }
  });
  const recommendationObservations = sceneSnapshot ? [] : db.prepare(`
    SELECT result_payload
    FROM event_logs
    WHERE subject_id = ? AND action_type = 'interaction'
    ORDER BY id DESC
    LIMIT 160
  `).all(subjectId).flatMap((row: any) => {
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

  return {
    subject,
    telemetry,
    recentObservations,
    recommendationObservations,
    availablePoints: sceneSnapshot ? [] : uiState.availablePoints,
    availableActions,
    scene: scene && !sceneSnapshot ? { id: scene.id, transitions: scene.transitions || [], characters: scene.characters || [] } : null,
    sceneObjects: scene && !sceneSnapshot ? sceneObjectsRepo.listForScene(scene.id) : [],
    player: sceneSnapshot ? null : player,
    relations: sceneSnapshot ? [] : relations,
    relationshipDynamics: sceneSnapshot ? null : relationshipDynamics,
    characters: sceneSnapshot ? [] : characters
  };
}
