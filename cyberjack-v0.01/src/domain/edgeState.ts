import { InteractionObservation, SubjectCoreState } from './types';

export type EdgeKind = 'none' | 'positive' | 'negative' | 'mixed' | 'exhausted';

export interface EdgeProfile {
    active: boolean;
    kind: EdgeKind;
    label: string;
    description: string;
    pleasurePressure: number;
    distressPressure: number;
    /** Signed character of accumulated activation: -100 distress, +100 pleasure. */
    activationBalance: number;
    expectedOutcome: 'stable' | 'positive_discharge' | 'overload' | 'breakdown';
}

const observationFrom = (entry: any): InteractionObservation | null | undefined =>
    entry?.resultPayload?.observation || entry?.observation || entry;

export function deriveActivationPressure(sources: any[] = []) {
    let pleasurePressure = 0, distressPressure = 0, weightTotal = 0;
    const weights = [1, .65, .4, .25, .15];
    sources.slice(0, weights.length).forEach((source, index) => {
        const reaction = observationFrom(source)?.reaction;
        if (!reaction) return;
        const weight = weights[index];
        const pleasure = Math.max(0, Number(reaction.pleasure) || 0);
        const discomfort = Math.max(0, Number(reaction.discomfort) || 0);
        const overload = Math.max(0, Number(reaction.overload) || 0);
        const appraisal = Number(reaction.appraisal);
        if (Number.isFinite(appraisal)) {
            // Activation balance is emotional, while pleasure/discomfort are
            // physical telemetry. Positively accepted pain must remain visible
            // as discomfort without automatically making the emotional balance
            // negative. The appraisal supplies the sign; the sensory response
            // supplies its magnitude. Overload remains distress regardless.
            const appraisedPressure = Math.max(-1, Math.min(1, appraisal)) * (pleasure + discomfort);
            pleasurePressure += Math.max(0, appraisedPressure) * weight;
            distressPressure += (Math.max(0, -appraisedPressure) + overload * .5) * weight;
        } else {
            // Backward compatibility for old observations without appraisal.
            pleasurePressure += pleasure * weight;
            distressPressure += (discomfort + overload * .5) * weight;
        }
        weightTotal += weight;
    });
    if (weightTotal) {
        pleasurePressure /= weightTotal;
        distressPressure /= weightTotal;
    }
    // This is a pressure balance, not merely the purity of the sign. Dividing
    // by the total made any weak but clean reaction jump straight to ±100
    // (for example 7.7 pleasure vs .2 discomfort became +95). A soft signed
    // scale keeps small reactions modest and reserves the extremes for strong,
    // sustained dominance.
    const signedPressure = pleasurePressure - distressPressure;
    const activationBalance = Math.tanh(signedPressure / 20) * 100;
    return { pleasurePressure, distressPressure, activationBalance };
}

export function deriveReactionCharacter(sources: any[] = []): Exclude<EdgeKind, 'none' | 'exhausted'> | 'neutral' {
    const { pleasurePressure: pleasure, distressPressure: distress, activationBalance } = deriveActivationPressure(sources);
    if (activationBalance >= 20) return 'positive';
    if (activationBalance <= -20) return 'negative';
    if (pleasure > 1 || distress > 1) return 'mixed';
    return 'neutral';
}

export function deriveEdgeProfile(core: Pick<SubjectCoreState, 'tension' | 'capacity'>, sources: any[] = []): EdgeProfile {
    const { pleasurePressure, distressPressure, activationBalance } = deriveActivationPressure(sources);
    if ((core.tension || 0) < 85) return {
        active: false, kind: 'none', label: 'Стабильная', description: 'До предельного состояния остаётся запас.',
        pleasurePressure, distressPressure, activationBalance, expectedOutcome: 'stable',
    };
    const base = { active: true, pleasurePressure, distressPressure, activationBalance };
    if ((core.capacity || 0) <= 10) return { ...base, kind: 'exhausted', label: 'На грани · истощение', description: 'Ресурс почти исчерпан: пик разрешится перегрузкой, но потеря контакта не предрешена.', expectedOutcome: 'overload' };
    if (activationBalance >= 20) return { ...base, kind: 'positive', label: 'На грани · возбуждение', description: 'Положительное возбуждение доминирует; напряжение почти достигло пика, вероятен оргазм.', expectedOutcome: 'positive_discharge' };
    if (activationBalance <= -20) return { ...base, kind: 'negative', label: 'На грани · срыв', description: 'Дистресс устойчиво доминирует; возможен нервный срыв без автоматической потери сознания.', expectedOutcome: 'breakdown' };
    return { ...base, kind: 'mixed', label: 'На грани · смешанное', description: 'Телесное возбуждение и защитная реакция конкурируют; вероятна перегрузка без оргазма.', expectedOutcome: 'overload' };
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
