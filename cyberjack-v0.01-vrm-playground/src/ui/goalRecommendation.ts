export type GoalCondition = {
  type: string;
  key?: string;
  operator?: string;
  value: unknown;
};

export type GoalObservation = {
  changes?: Record<string, number | undefined>;
  learning?: {
    sensitivityDelta?: number;
    baselineSensitivityDelta?: number;
  };
  reaction?: {
    overload?: number;
  };
};

export type GoalCandidate = {
  tags: string[];
  preferenceScore: number;
  intensity: number;
  observations: GoalObservation[];
};

const metricKey = (condition: GoalCondition) =>
  condition.key || (condition.type === "attitude" ? "attitude" : condition.type);

const observedDelta = (condition: GoalCondition, observation: GoalObservation) => {
  const key = metricKey(condition);
  if (key === "sensitivity")
    return observation.learning?.baselineSensitivityDelta ?? observation.changes?.sensitivity;
  if (key === "localSensitivity")
    return observation.learning?.sensitivityDelta ?? observation.changes?.sensitivity;
  return observation.changes?.[key];
};

const desiredDirection = (condition: GoalCondition, current: unknown) => {
  const operator = condition.operator || "==";
  if (operator.startsWith(">")) return 1;
  if (operator.startsWith("<")) return -1;
  if (typeof current === "number" && typeof condition.value === "number")
    return Math.sign(condition.value - current);
  return 0;
};

const fallbackDelta = (condition: GoalCondition, candidate: GoalCandidate) => {
  const key = metricKey(condition);
  if (condition.type === "preference" || condition.type === "acquired_trait")
    return candidate.tags.includes(key) ? Math.max(.1, candidate.intensity) : 0;
  if (key === "capacity") return -Math.max(.1, candidate.intensity);
  if (["sensitivity", "localSensitivity"].includes(key))
    return Math.max(.05, candidate.intensity);
  if (["attitude", "localAttitude", "openness", "localOpenness"].includes(key))
    return candidate.preferenceScore > 0 ? Math.min(1, candidate.preferenceScore) : 0;
  return 0;
};

export function scoreGoalCandidate(
  condition: GoalCondition,
  current: unknown,
  candidate: GoalCandidate,
) {
  const direction = desiredDirection(condition, current);
  if (!direction) return Number.NEGATIVE_INFINITY;
  const observed = candidate.observations
    .map(observation => observedDelta(condition, observation))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const predictedDelta = observed.length
    ? observed.reduce((sum, value) => sum + value, 0) / observed.length
    : fallbackDelta(condition, candidate);
  const progress = predictedDelta * direction;
  if (progress <= .001) return Number.NEGATIVE_INFINITY;

  const overload = candidate.observations.length
    ? candidate.observations.reduce((sum, observation) => sum + Number(observation.reaction?.overload || 0), 0)
      / candidate.observations.length
    : 0;
  const confidence = observed.length ? 2 + Math.min(3, observed.length) : 1;
  return progress * confidence + Math.max(0, candidate.preferenceScore) * .15 - overload * .12;
}

