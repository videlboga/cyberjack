import actionPresets from '../infrastructure/data/presets/actions.json';
import { expandActionTargets } from './actionTargets';

export const BODY_POINT_ORDER = [
    'head',
    'hair',
    'face',
    'lips',
    'neck',
    'shoulders',
    'chest',
    'nipples',
    'belly',
    'back',
    'waist',
    'arms',
    'hands',
    'inner_thighs',
    'legs',
    'feet',
    'buttocks',
    'vulva',
    'clitoris',
    'vagina',
    'anus',
    'penis',
    'testicles',
    'prostate',
] as const;

export type BodyPointId = typeof BODY_POINT_ORDER[number];

export type ActionPointMatrixEntry = {
    id: string;
    label: string;
    description: string;
    categories: string[];
    tags: string[];
    points: BodyPointId[];
};

const bodyPoints = new Set<string>(BODY_POINT_ORDER);

/**
 * Mechanical compatibility matrix used by body-map and action-card UIs.
 * Broad authored targets such as `head`, `torso` and `limbs` are expanded
 * into the exact points visible on the body map. Non-body targets
 * (`systemic`, `mind_state`) and presets without targets are excluded.
 */
export const ACTION_POINT_MATRIX: ActionPointMatrixEntry[] = actionPresets
    .map((preset) => ({
        id: preset.id,
        label: preset.name,
        description: preset.description || '',
        categories: preset.categories || [],
        tags: preset.tags || [],
        points: expandActionTargets(preset.validTargets)
            .filter((point): point is BodyPointId => bodyPoints.has(point)),
    }))
    .filter((entry) => entry.points.length > 0);

export const ACTION_POINTS = Object.fromEntries(
    ACTION_POINT_MATRIX.map((entry) => [entry.id, entry.points]),
) as Record<string, BodyPointId[]>;

export const POINT_ACTIONS = Object.fromEntries(
    BODY_POINT_ORDER.map((point) => [
        point,
        ACTION_POINT_MATRIX.filter((entry) => entry.points.includes(point)),
    ]),
) as Record<BodyPointId, ActionPointMatrixEntry[]>;

export const actionsForBodyPoint = (point: BodyPointId) => POINT_ACTIONS[point] || [];

export const pointsForAction = (actionId: string) => ACTION_POINTS[actionId] || [];

export const isActionAllowedAtBodyPoint = (actionId: string, point: BodyPointId) =>
    pointsForAction(actionId).includes(point);
