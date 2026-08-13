import { subjectRepo, resourceRepo, presetRepo, characterRepo, characterRelationRepo, pointStateRepo, sceneRepo, activeContextsRepo } from '../infrastructure/repositories';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';
import { compileAction } from '../compiler/compileAction';
import { runTick } from '../engine/runTick';
import { conditioningTags, preferenceValenceModifier } from '../domain/conditioning';
import { deriveIntimacyReadiness } from '../domain/intimacyReadiness';
import * as checkActionAccess from '../scenario/checkActionAccess';
import { ContextManager } from '../orchestration/contextManager';

/**
 * Этап 8. Application service для прогноза интимной готовности.
 *
 * Выносит бизнес-логику forecastIntimacy из контроллера: для каждого
 * кандидата (actionId × pointId) прогоняет сухой тик движка и считает
 * дельту готовности/возбуждения/доверия.
 */

export interface IntimacyForecastCandidate {
  pointId?: string;
  actionId?: string;
}

export interface IntimacyForecastResult {
  actionId: string;
  pointId: string;
  readiness: number;
  arousal: number;
  trust: number;
}

export interface ForecastIntimacyInput {
  subjectId: string;
  actorId: string;
  sceneId: string;
  candidates: IntimacyForecastCandidate[];
}

export function forecastIntimacy(input: ForecastIntimacyInput): IntimacyForecastResult[] {
  const { subjectId, actorId, sceneId, candidates } = input;
  const subject = subjectRepo.get(subjectId);
  const character = characterRepo.ensureSubject(subjectId, subject?.name || subjectId);
  const relation = characterRelationRepo.ensure(character.id, actorId, { attitude: subject?.attitude ?? 50, openness: subject?.openness ?? 50, plasticity: subject?.plasticity ?? 50 });
  const dynamics = relationshipDynamicsRepo.get(subjectId, actorId);
  const points = pointStateRepo.getAllForSubject(subjectId);
  const scene = sceneRepo.get(sceneId);
  const resources = resourceRepo.get(actorId);

  return candidates.flatMap((candidate) => {
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
}
