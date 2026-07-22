import { InteractionObservation, SubjectCoreState } from './types';

export type EdgeKind = 'none' | 'positive' | 'negative' | 'mixed' | 'exhausted';

export interface EdgeProfile {
    active: boolean;
    kind: EdgeKind;
    label: string;
    description: string;
    pleasurePressure: number;
    distressPressure: number;
}

const observationFrom = (entry: any): InteractionObservation | null | undefined =>
    entry?.resultPayload?.observation || entry?.observation || entry;

export function deriveReactionCharacter(sources: any[] = []): Exclude<EdgeKind, 'none' | 'exhausted'> | 'neutral' {
    let pleasure = 0, distress = 0, weightTotal = 0;
    const weights = [1, .65, .4, .25, .15];
    sources.slice(0, weights.length).forEach((source, index) => {
        const reaction = observationFrom(source)?.reaction;
        if (!reaction) return;
        const weight = weights[index];
        pleasure += Math.max(0, Number(reaction.pleasure) || 0) * weight;
        distress += (Math.max(0, Number(reaction.discomfort) || 0) + Math.max(0, Number(reaction.overload) || 0) * 1.25) * weight;
        weightTotal += weight;
    });
    if (weightTotal) { pleasure /= weightTotal; distress /= weightTotal; }
    if (pleasure > Math.max(1, distress * 1.35)) return 'positive';
    if (distress > Math.max(1, pleasure * 1.35)) return 'negative';
    if (pleasure > 1 || distress > 1) return 'mixed';
    return 'neutral';
}

export function deriveEdgeProfile(core: Pick<SubjectCoreState, 'tension' | 'capacity'>, sources: any[] = []): EdgeProfile {
    if ((core.tension || 0) < 85) return {
        active: false, kind: 'none', label: 'Стабильная', description: 'До предельного состояния остаётся запас.',
        pleasurePressure: 0, distressPressure: 0,
    };
    let pleasurePressure = 0, distressPressure = 0, weightTotal = 0;
    const weights = [1, .65, .4, .25, .15];
    sources.slice(0, weights.length).forEach((source, index) => {
        const reaction = observationFrom(source)?.reaction;
        if (!reaction) return;
        const weight = weights[index];
        pleasurePressure += Math.max(0, Number(reaction.pleasure) || 0) * weight;
        distressPressure += (Math.max(0, Number(reaction.discomfort) || 0) + Math.max(0, Number(reaction.overload) || 0) * 1.25) * weight;
        weightTotal += weight;
    });
    if (weightTotal) { pleasurePressure /= weightTotal; distressPressure /= weightTotal; }
    if ((core.capacity || 0) <= 12) return { active: true, kind: 'exhausted', label: 'На грани · истощение', description: 'Контроль ослаблен из-за исчерпанного ресурса; возможны ступор и срыв.', pleasurePressure, distressPressure };
    if (pleasurePressure > Math.max(1, distressPressure * 1.35)) return { active: true, kind: 'positive', label: 'На грани · возбуждение', description: 'Положительное возбуждение доминирует; ситуативная податливость повышена.', pleasurePressure, distressPressure };
    if (distressPressure > Math.max(1, pleasurePressure * 1.35)) return { active: true, kind: 'negative', label: 'На грани · срыв', description: 'Дистресс доминирует; вероятны резкий протест, паника или агрессия.', pleasurePressure, distressPressure };
    return { active: true, kind: 'mixed', label: 'На грани · смешанное', description: 'Телесное возбуждение и защитная реакция конкурируют.', pleasurePressure, distressPressure };
}

export function edgeComplianceModifier(profile: EdgeProfile, action: { id?: string; label?: string; type?: string; pointId?: string } = {}) {
    if (!profile.active) return 0;
    const text = `${action.id || ''} ${action.label || ''} ${action.type || ''} ${action.pointId || ''}`.toLowerCase();
    const intimate = /(cloth|underwear|бель|обнаж|exposure|vulva|vagina|clitoris|groin|buttocks|chest|nipples|sex|oral|penetr)/.test(text);
    const supportive = /(stop|pause|wait|останов|освобод|отдых|remove_(restraint|cuffs|gag|blindfold)|снять (фиксац|наруч|кляп|повяз))/.test(text) && !intimate;
    if (profile.kind === 'positive') return supportive || intimate ? 20 : 8;
    if (profile.kind === 'negative') return supportive ? 10 : intimate ? -18 : -8;
    if (profile.kind === 'mixed') return supportive ? 10 : intimate ? 4 : 0;
    if (profile.kind === 'exhausted') return supportive ? 12 : -15;
    return 0;
}

export function calculateSituationalCompliance(input: { attitude: number; plasticity: number; profile: EdgeProfile; action?: { id?: string; label?: string; type?: string; pointId?: string } }) {
    const base = input.attitude + input.plasticity * .5;
    const edgeModifier = edgeComplianceModifier(input.profile, input.action);
    return { base, edgeModifier, total: Math.max(0, Math.min(150, base + edgeModifier)) };
}
