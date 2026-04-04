import {
    TickBundle,
    OrchestratedTurn,
    ActorDecision,
    NarratorDecision,
    CharacterRelation
} from '../domain/types';
import { activeConfig } from '../prompts/config';
import { activeContextsRepo, presetRepo, playerRepo } from '../infrastructure/repositories';

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

    const allActors = relations
        .filter(rel => rel.target?.subjectId && rel.present)
        .map(rel => rel.target!.subjectId!);

    const lastActionIntensity = clamp01(bundle.compiledAction.intensity ?? 0);
    const activeContextIds = activeContextsRepo.getAllForEvent(bundle.event.sceneId || 'lab');
    const activeContextLabels = activeContextIds
        .map(ctx => presetRepo.getContextPreset(ctx.id)?.label)
        .filter(Boolean);

    const isVerbalInput = bundle.event.type === 'verbal_input';
    const playerId = bundle.event.playerId || 'PL-1';
    const playerState = playerRepo.get(playerId);

    for (const actorId of allActors) {
        const core = actorId === subjectId ? bundle.stateAfter.core : bundle.stateBefore.core;
        const relationToCalibrator = relationMap.get(bundle.event.playerId || 'PL-1');
        const relationNorm = relationToCalibrator ? normalize(relationToCalibrator.attitude ?? 50) : 0.5;
        const sensitivityNorm = normalize(core?.sensitivity ?? 50);
        const capacityNorm = normalize(core?.capacity ?? 50);
        const peerRelations = relations.filter(rel => rel.target?.subjectId && rel.target.subjectId !== actorId);
        const peerNorm = peerRelations.length
            ? peerRelations.reduce((sum, rel) => sum + normalize(rel.attitude ?? 50), 0) / peerRelations.length
            : 0.5;
        const contextBonus = activeContextLabels.length ? cfg.contextModifier : 0;
        const opennessNorm = normalize(core?.openness ?? 50);
        const resourceValue = Math.max(0, playerState?.resources?.credits ?? 0);
        const resourceScale = cfg.resourceScale || 100;
        const resourceNorm = normalize(resourceValue, 0, resourceScale);

        const reactiveProb = clamp01(
            cfg.baseReactiveProbability +
                cfg.sensitivityModifier * (1 - capacityNorm) +
                cfg.attitudeModifier * (1 - relationNorm) +
                cfg.intensityModifier * lastActionIntensity +
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
        }

        if (sampleProbability(proactiveProb)) {
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
