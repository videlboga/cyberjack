import { db } from '../infrastructure/db';
import {
    characterRelationRepo,
    memoryRepo,
    pointStateRepo,
    sceneCharacterRepo,
    subjectPreferencesRepo,
    subjectRepo,
} from '../infrastructure/repositories';
import { getLaboratoryPresence, getLaboratorySpatialContext } from '../scenario/spatialContext';
import { runGameTick } from './runGameTick';
import { ActionScorer, ActionScoreResult } from './actionScorer';
import { conditioningTags, deriveCompulsionSignals } from '../domain/conditioning';
import { createSocialTurnPlan, enqueueSocialTurn, processPendingSocialTurns, resolvePhysicalInitiativeBasis } from '../services/socialTransactions';

const AUTONOMOUS_INTERVAL_MINUTES = 5;
const MAX_ACTIONS_PER_SCENE_PULSE = 2;
let lastAutonomousMinute = -Infinity;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const NEUTRAL_CONTACT_POINTS = new Set(['head', 'hair', 'face', 'neck', 'shoulders', 'arms', 'hands', 'back', 'belly', 'legs']);
const INTIMATE_ACTION_TAGS = new Set(['sexual', 'oral', 'penetration', 'restraint', 'control', 'pain', 'humiliation', 'demeaning', 'exposure']);
const NEUTRAL_RESTRICTED_ACTION = /(?:slap|punch|whip|taser|shock|needle|pinch|bite|scratch|firm_grip|hot_wax|ice_cube|vibrator|penetration|insertion|plug|cuff|collar|blindfold|suspend|exposure|climax|friction)/;

type ObservedEvent = {
    actorId?: string;
    targetId?: string;
    actionId?: string;
    actionLabel?: string;
    pointId?: string;
    worldMinute?: number | null;
};

export function autonomousInitiativeProbability(input: {
    sensitivity: number;
    capacity: number;
    openness: number;
    relationToObservedTarget?: number;
    learnedAction?: number;
    learnedTags?: number[];
    eventAgeMinutes: number;
}): number {
    const stateReadiness = clamp01((input.sensitivity + input.openness + (100 - input.capacity)) / 300);
    const relation = clamp01((input.relationToObservedTarget ?? 50) / 100);
    const preference = clamp01(Math.max(0, input.learnedAction || 0) / 5);
    const tagPreference = clamp01(Math.max(0, ...(input.learnedTags || [0])) / 5);
    const freshness = clamp01(1 - input.eventAgeMinutes / 30);
    return clamp01(0.015 + stateReadiness * 0.035 + relation * 0.025 + preference * 0.11 + tagPreference * 0.08 + freshness * 0.035);
}

export function isAutonomousActionAllowed(action: ActionScoreResult, relationOpenness?: number): boolean {
    if ((relationOpenness ?? 0) >= 35) return true;
    const tags = conditioningTags(action.actionId);
    return NEUTRAL_CONTACT_POINTS.has(action.pointId)
        && !NEUTRAL_RESTRICTED_ACTION.test(action.actionId)
        && !tags.some(tag => INTIMATE_ACTION_TAGS.has(tag));
}

function latestObservedEvent(subjectId: string, sceneId: string): ObservedEvent | null {
    const record = memoryRepo.listRecent(subjectId, 16, 'episode_v2').find(entry =>
        entry.metadata?.observed && entry.metadata?.sceneId === sceneId,
    );
    return record?.metadata || null;
}

function isDeviceBound(subjectId: string, playerId: string): boolean {
    return String(getLaboratoryPresence(subjectId, playerId)?.status || '').startsWith('device:');
}

function chooseAction(actorId: string, preferences: unknown, observed: ObservedEvent | null, sceneId: string, visibleTargets: string[]): { targetId: string; action: ActionScoreResult } | null {
    const preferredTarget = observed.targetId && visibleTargets.includes(observed.targetId)
        ? observed.targetId
        : undefined;
    let best: { targetId: string; action: ActionScoreResult; score: number } | null = null;
    for (const targetId of visibleTargets) {
        if (targetId === actorId) continue;
        const points = pointStateRepo.getAllForSubject(targetId).map(point => point.pointId);
        const relation = characterRelationRepo.get(actorId, targetId);
        const scored = ActionScorer.scoreAvailableActions(sceneId, actorId, targetId, points.length ? points : ['systemic'])
            .map(action => {
                const compulsion = deriveCompulsionSignals(preferences, conditioningTags(action.actionId))[0];
                return compulsion?.level === 3
                    ? { ...action, score:action.score + compulsion.pressure * 18 }
                    : action;
            })
            .filter(action => isAutonomousActionAllowed(action, relation?.openness));
        const action = scored.find(item => item.score > -20);
        if (!action) continue;
        const score = action.score + (targetId === preferredTarget ? 8 : 0);
        if (!best || score > best.score) best = { targetId, action, score };
    }
    return best ? { targetId: best.targetId, action: best.action } : null;
}

/**
 * One small autonomous scene pulse. It deliberately performs no synthetic
 * wait-tick: only an actually selected action changes the simulation.
 */
export async function runAutonomousSceneMinute() {
    const worldMinute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
    if (worldMinute === lastAutonomousMinute || worldMinute % AUTONOMOUS_INTERVAL_MINUTES !== 0) return [];
    lastAutonomousMinute = worldMinute;

    const sceneId = 'scene_lab_calibrator';
    const present = sceneCharacterRepo.list(sceneId)
        .filter(entry => entry.presenceState === 'present' && entry.canAct && entry.character.subjectId)
        .map(entry => entry.character.subjectId as string);
    const acted = new Set<string>();
    const executed: Array<{ actorId: string; targetId: string; actionId: string }> = [];

    for (let step = 0; step < MAX_ACTIONS_PER_SCENE_PULSE; step++) {
        const candidates = present.flatMap(actorId => {
            // The player shares the physical scene and therefore receives
            // observations, but has no autonomous will in the simulation.
            if (actorId === 'PL-1' || acted.has(actorId) || isDeviceBound(actorId, 'PL-1')) return [];
            const actor = subjectRepo.get(actorId);
            const observed = latestObservedEvent(actorId, sceneId);
            const spatial = getLaboratorySpatialContext(actorId, 'PL-1');
            if (!actor || !spatial || spatial.isolated) return [];
            const visibleTargets = spatial.subjectIds.filter(id => id !== actorId && present.includes(id));
            if (!visibleTargets.length) return [];
            const prefs = subjectPreferencesRepo.get(actorId);
            const relation = observed?.targetId ? characterRelationRepo.get(actorId, observed.targetId) : undefined;
            const age = observed ? Math.max(0, worldMinute - Number(observed.worldMinute ?? worldMinute)) : 60;
            const probability = autonomousInitiativeProbability({
                sensitivity: Number(actor.sensitivity || 50),
                capacity: Number(actor.capacity || 50),
                openness: Number(actor.openness || 50),
                relationToObservedTarget: relation?.attitude,
                learnedAction: observed?.actionId ? prefs.actions[observed.actionId] : 0,
                learnedTags: observed ? Object.values(prefs.tags) : [],
                eventAgeMinutes: age,
            });
            return Math.random() < probability ? [{ actorId, observed, visibleTargets, probability }] : [];
        });
        if (!candidates.length) break;

        const next = candidates.sort((left, right) => right.probability - left.probability)[0];
        const socialTarget = next.observed?.targetId && next.visibleTargets.includes(next.observed.targetId)
            ? next.observed.targetId : next.visibleTargets[0];
        const social = createSocialTurnPlan(
            next.actorId,
            socialTarget,
            worldMinute,
            next.observed ? 'observed_event' : 'co_presence',
            next.observed,
        );
        if (social) {
            enqueueSocialTurn(social);
            void processPendingSocialTurns();
            acted.add(next.actorId);
            executed.push({ actorId: next.actorId, targetId: social.recipientId, actionId: `social:${social.act}` });
            continue;
        }
        const selected = chooseAction(next.actorId, subjectPreferencesRepo.get(next.actorId), next.observed, sceneId, next.visibleTargets);
        acted.add(next.actorId);
        if (!selected) continue;
        const basis = resolvePhysicalInitiativeBasis(next.actorId, selected.targetId);
        if (!basis) continue;

        try {
            await runGameTick({
                subjectId: selected.targetId,
                pointId: selected.action.pointId,
                playerId: 'PL-1',
                actingCharacterId: next.actorId,
                sceneId,
                presetId: selected.action.actionId,
                customPayload: { autonomousSceneAction: true, physicalInitiativeBasis:basis, worldMinute },
                skipContextTimeAdvance: true,
            });
            executed.push({ actorId: next.actorId, targetId: selected.targetId, actionId: selected.action.actionId });
        } catch (error) {
            console.warn(`[AutonomousScene] skipped ${next.actorId}'s action:`, error);
        }
    }
    return executed;
}
