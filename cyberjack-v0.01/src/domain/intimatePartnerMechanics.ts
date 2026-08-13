type PreferenceData = {
  partnerPoints?: Record<string, Record<string, { affinity: number; familiarity: number }>>;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function intimateActorPoints(actionId: string, tags: string[] = []): string[] {
  const key = `${actionId} ${tags.join(' ')}`.toLowerCase();
  // oral/giving is applied to the recipient's lips by a partner with male anatomy.
  if (/act_start_oral_giving|act_deepen_oral/.test(key)) return ['penis'];
  if (/penetrat|проникнов/.test(key)) return ['penis'];
  if (/finger|палец|friction|трени/.test(key)) return ['hands', 'penis'];
  if (/lick|oral|kiss|язык|поцел/.test(key)) return ['lips'];
  return ['hands'];
}

export function isPartnerPointAction(actionId: string, tags: string[] = [], pointId?: string): boolean {
  if (!pointId || pointId === 'systemic') return false;
  const key = `${actionId} ${tags.join(' ')}`.toLowerCase();
  return /sexual|intimate|penetrat|oral|kiss|lick|sex|секс|интим|проник|поцел|язык/.test(key)
    || ['vulva', 'vagina', 'clitoris', 'penis', 'testicles', 'prostate', 'anus'].includes(pointId);
}

export function canPerformPartnerPointAction(actorPointIds: string[], actionId: string, tags: string[] = [], pointId?: string): boolean {
  if (!isPartnerPointAction(actionId, tags, pointId)) return true;
  return intimateActorPoints(actionId, tags).some(point => actorPointIds.includes(point));
}

export function partnerPointAffinity(preferences: unknown, partnerId: string, pointId: string): number {
  try {
    const parsed = typeof preferences === 'string' ? JSON.parse(preferences) : preferences as PreferenceData;
    return Number(parsed?.partnerPoints?.[partnerId]?.[pointId]?.affinity || 0);
  } catch { return 0; }
}

export function recordPartnerPointExperience(preferences: unknown, partnerId: string, pointId: string, valence: number, familiarity = .06): PreferenceData {
  let parsed: PreferenceData = {};
  try { parsed = typeof preferences === 'string' ? JSON.parse(preferences) : { ...(preferences as PreferenceData || {}) }; } catch { /* use empty */ }
  const partnerPoints = { ...(parsed.partnerPoints || {}) };
  const points = { ...(partnerPoints[partnerId] || {}) };
  const previous = points[pointId] || { affinity: 0, familiarity: 0 };
  points[pointId] = {
    affinity: clamp(Number(previous.affinity || 0) + clamp(valence, -1, 1) * .09, -1, 1),
    familiarity: clamp(Number(previous.familiarity || 0) + familiarity, 0, 1),
  };
  partnerPoints[partnerId] = points;
  return { ...parsed, partnerPoints };
}
