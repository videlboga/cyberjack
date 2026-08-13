const clamp = (value: number) => Math.max(0, Math.min(100, value));

export type IntimacyReadinessInput = {
  relationAttitude: number;
  relationOpenness: number;
  fear?: number;
  resistance?: number;
  capacity: number;
  tension: number;
  points: Array<{ localAttitude?: number; localOpenness?: number }>;
};

export function deriveIntimacyReadiness(input: IntimacyReadinessInput) {
  const points = input.points.length ? input.points : [{}];
  const localAcceptance = points.reduce((sum, point) => sum + Number(point.localAttitude ?? 0), 0) / points.length;
  const localOpenness = points.reduce((sum, point) => sum + Number(point.localOpenness ?? 0), 0) / points.length;
  const trust = clamp(
    input.relationAttitude * .58 + input.relationOpenness * .42 -
    Number(input.fear || 0) * .35 - Number(input.resistance || 0) * .2,
  );
  const arousal = clamp(input.tension);
  const readiness = clamp(
    trust * .30 + localAcceptance * .24 + localOpenness * .14 + arousal * .14 + clamp(input.capacity) * .18,
  );
  return { trust, arousal, readiness, localAcceptance, localOpenness };
}
