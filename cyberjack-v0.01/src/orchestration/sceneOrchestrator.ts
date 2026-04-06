import {
    TickBundle,
    OrchestratedTurn,
    ActorDecision,
    NarratorDecision,
    CharacterRelation
} from '../domain/types';
import { activeConfig } from '../prompts/config';
import { activeContextsRepo, presetRepo, playerRepo, subjectRepo, characterRelationRepo } from '../infrastructure/repositories';

const normalize = (value: number, min = 0, max = 100) => {
    if (max === min) return 0;
    const clamped = Math.min(Math.max(value, min), max);
    return (clamped - min) / (max - min);
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function sampleProbability(prob: number): boolean {
    return Math.random() < prob;
}

function describeTone(attitude?: number): string {
    if (typeof attitude !== 'number') return 'neutral';
    if (attitude >= 70) return 'warm';
    if (attitude <= 30) return 'hostile';
    return 'neutral';
}

function relationTo(targetId: string, relations: CharacterRelation[]): CharacterRelation | undefined {
    return relations.find(rel => rel.target?.id === targetId || rel.toId === targetId);
}

export function orchestrateSceneActors(bundle: TickBundle): OrchestratedTurn {
    const cfg = activeConfig.orchestrator;
    const prompt = bundle.prompt;
    const relations = prompt.relations || [];
    const actorDecisions: ActorDecision[] = [];
    const subjectId = bundle.event.subjectId;

    const relationMap = new Map<string, CharacterRelation>();
    relations.forEach(rel => {
        if (rel.target?.id) relationMap.set(rel.target.id, rel);
    });

    const allActors = Array.from(new Set([
        subjectId,
        ...relations
            .filter(rel => rel.target?.subjectId && rel.present)
            .map(rel => rel.target!.subjectId!)
    ]));

    const lastActionIntensity = clamp01(bundle.compiledAction.intensity ?? 0);
    const lastActionNovelty = clamp01(bundle.compiledAction.novelty ?? 1); // If no novelty, assume 1 (new action)
    const activeContextIds = activeContextsRepo.getAllForEvent(bundle.event.sceneId || 'lab');
    const activeContextLabels = activeContextIds
        .map(ctx => presetRepo.getContextPreset(ctx.id)?.label)
        .filter(Boolean);

    const isVerbalInput = bundle.event.type === 'verbal_input';
    const playerId = bundle.event.playerId || 'PL-1';
    const playerState = playerRepo.get(playerId);

    for (const actorId of allActors) {
        let core = actorId === subjectId ? bundle.stateAfter.core : bundle.stateBefore.core;
        let relationToCalibrator = relationMap.get(bundle.event.playerId || 'PL-1');
        let peerRelations = relations.filter(rel => rel.target?.subjectId && rel.target.subjectId !== actorId);

        if (actorId !== subjectId) {
            const externalCore = subjectRepo.get(actorId);
            if (externalCore) core = externalCore;
            
            const actorRelations = characterRelationRepo.listFor(actorId);
            relationToCalibrator = actorRelations.find(r => r.target?.id === (bundle.event.playerId || 'PL-1'));
            peerRelations = actorRelations.filter(rel => rel.target?.subjectId && rel.target.subjectId !== actorId);
        }

        const relationNorm = relationToCalibrator ? normalize(relationToCalibrator.attitude ?? 50) : 0.5;
        const sensitivityNorm = normalize(core?.sensitivity ?? 50);
        const capacityNorm = normalize(core?.capacity ?? 50);
        const peerNorm = peerRelations.length
            ? peerRelations.reduce((sum, rel) => sum + normalize(rel.attitude ?? 50), 0) / peerRelations.length
            : 0.5;
        const contextBonus = activeContextLabels.length ? cfg.contextModifier : 0;
        const opennessNorm = normalize(core?.openness ?? 50);
        const resourceValue = Math.max(0, playerState?.resources?.credits ?? 0);
        const resourceScale = cfg.resourceScale || 100;
        const resourceNorm = normalize(resourceValue, 0, resourceScale);

        // Смягчаем штраф за отсутствие новизны: максимум снижение на 50%, а не до нуля.
        const noveltyFactor = isVerbalInput ? 1.0 : (0.5 + 0.5 * lastActionNovelty);

        const reactiveProb = clamp01(
            cfg.baseReactiveProbability * noveltyFactor +
                cfg.sensitivityModifier * (1 - capacityNorm) * noveltyFactor +
                cfg.attitudeModifier * (1 - relationNorm) * noveltyFactor +
                cfg.intensityModifier * lastActionIntensity * noveltyFactor +
                cfg.contextModifier * contextBonus +
                cfg.opennessModifier * opennessNorm +
                cfg.resourceModifier * resourceNorm +
                (isVerbalInput ? cfg.verbalReactiveBoost : 0)
        );

        const proactiveProb = clamp01(
            cfg.baseProactiveProbability +
                cfg.attitudeModifier * relationNorm +
                cfg.sensitivityModifier * sensitivityNorm +
                cfg.peerModifier * peerNorm +
                cfg.contextModifier * contextBonus
        );

        if (sampleProbability(reactiveProb)) {
            actorDecisions.push({
                actorId,
                kind: 'reactive',
                reason: describeTone(relationToCalibrator?.attitude)
            });
        } else if (sampleProbability(proactiveProb)) {
            actorDecisions.push({
                actorId,
                kind: 'proactive',
                reason: describeTone(relationToCalibrator?.attitude)
            });
        }
    }

    const narrator: NarratorDecision | undefined = prompt.narratorPrompt
        ? { enabled: true }
        : undefined;

    return {
        narrator,
        actorDecisions
    };
}
