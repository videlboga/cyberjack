import type { SubjectCoreState, TickOutput } from '../domain/types';
import { presetRepo, subjectEdgeStateRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { applySoftPositiveGain, clamp } from '../engine/utils';
import { STATE_RULES } from './conditionWatcher';
import { evaluateTensionDischarge, peakResolutionReady } from './triggers';
import type { TickEffect } from './tickEffectPlan';

export type NotableObservationEvent = 'positive_discharge' | 'peak_overload' | 'breakdown' | 'exhaustion' | undefined;

export interface TickConsequenceInput {
    subjectId: string;
    pointId: string;
    presetId: string;
    coreBefore: SubjectCoreState;
    output: TickOutput;
    history: unknown[];
    activeContextIds: string[];
    deviceOrgasmPolicy?: string;
}

export interface TickConsequenceResult {
    output: TickOutput;
    peakEventToLog: { presetId: string; narrative: string } | null;
    notableObservationEvent: NotableObservationEvent;
    notes: string[];
    effects: TickEffect[];
}

/**
 * Pure resolution of tick consequences (discharge, exhaustion, edge state).
 * No writes are performed here: state mutations are returned on `output`,
 * and persistence is expressed as `TickEffect`s for the caller to commit.
 * This is deliberately free of the prompt stack so it can be unit-tested.
 */
export function resolveTickConsequences(input: TickConsequenceInput): TickConsequenceResult {
    const { subjectId, pointId, presetId, coreBefore, output, history, activeContextIds, deviceOrgasmPolicy = '' } = input;
    const notes: string[] = [];
    const effects: TickEffect[] = [];
    let peakEventToLog: { presetId: string; narrative: string } | null = null;
    let notableObservationEvent: NotableObservationEvent;

    const dischargeThreshold = deviceOrgasmPolicy === 'force' ? 92 : 100;
    if (deviceOrgasmPolicy === 'deny' && output.nextCore.tension >= 100) {
        output.nextCore.tension = 99;
    }

    if (presetId !== 'wait' && deviceOrgasmPolicy !== 'deny' && output.nextCore.tension >= dischargeThreshold) {
        const ids = [...activeContextIds];
        for (const rule of STATE_RULES) {
            if (rule.check(output.nextCore, output.nextPoint)) ids.push(rule.actionPresetId);
        }
        const discharge = evaluateTensionDischarge({
            core: output.nextCore,
            result: output.result,
            recentEvents: history,
            activeContextIds: ids,
        });
        const peakReady = peakResolutionReady(
            discharge,
            output.result,
            output.nextCore.capacity || 0,
            deviceOrgasmPolicy === 'force',
        );

        if (!peakReady) {
            output.nextCore.tension = Math.min(output.nextCore.tension, 98);
            notes.push(
                discharge.outcome === 'positive'
                    ? '[Система: УДЕРЖАНИЕ НА ГРАНИ] Положительная активация высока, но текущее воздействие не даёт достаточного импульса для разрядки.'
                    : discharge.outcome === 'breakdown'
                        ? '[Система: НЕСТАБИЛЬНЫЙ КРАЙ] Дистресс высок, но срыв ещё не произошёл; характер следующих воздействий может изменить баланс.'
                        : '[Система: СМЕШАННЫЙ КРАЙ] Активация удерживается у пика без немедленной разрядки или перегрузки.',
            );
        } else {
            let dischargeNarrative = '';

            if (discharge.outcome === 'positive') {
                notableObservationEvent = 'positive_discharge';
                dischargeNarrative = '[Система: ОРГАЗМ] Накопленное возбуждение достигает пика и завершается оргазмом.';
                const trustFactor = clamp(((output.nextCore.attitude || 0) - 30) / 70, 0, 1);
                output.nextCore.openness = Math.min((output.nextCore.openness || 0) + 5 + 10 * trustFactor, 100);
                output.nextCore.attitude = Math.min((output.nextCore.attitude || 0) + 3 + 12 * trustFactor, 100);
                output.nextCore.sensitivity = Math.max((output.nextCore.sensitivity || 0) - 20, 0);
                const capacityBeforeDischarge = output.nextCore.capacity || 0;
                const postDischargeFloor = 12;
                output.nextCore.capacity = Math.max(
                    capacityBeforeDischarge - 15,
                    Math.min(capacityBeforeDischarge, postDischargeFloor),
                );
                if (!presetRepo.getActionPreset('effect_refractory')) {
                    presetRepo.saveActionPreset(
                        'effect_refractory',
                        'Рефрактерный период',
                        { intensity_mult: 0.25, contact_mult: 0.8, novelty_mult: 0.25 },
                        { type: 'condition', duration: 3, occupiesPoints: [] },
                    );
                }
                const refractoryPreset = presetRepo.getActionPreset('effect_refractory');
                if (refractoryPreset) {
                    effects.push({
                        kind: 'context.apply',
                        subjectId,
                        actionId: 'effect_refractory',
                        action: refractoryPreset,
                    });
                }
                output.nextCore.plasticity = applySoftPositiveGain(output.nextCore.plasticity || 0, 15);
                output.nextCore.tension = 10;
            } else if (discharge.outcome === 'breakdown') {
                notableObservationEvent = 'breakdown';
                dischargeNarrative = '[Система: НЕРВНЫЙ СРЫВ] Устойчиво негативная активация достигает предела и срывает контроль. Осмысленный контакт может сохраняться.';
                output.nextCore.attitude = Math.max((output.nextCore.attitude || 0) - 20, 0);
                output.nextCore.openness = Math.max((output.nextCore.openness || 0) - 15, 0);
                output.nextCore.capacity = Math.max((output.nextCore.capacity || 0) - 12, 0);
                output.nextCore.plasticity = applySoftPositiveGain(output.nextCore.plasticity || 0, 20);
                output.nextCore.tension = 45;
                const panicPreset = presetRepo.getActionPreset('effect_panic');
                if (panicPreset) {
                    effects.push({
                        kind: 'context.apply',
                        subjectId,
                        actionId: 'effect_panic',
                        action: panicPreset,
                    });
                }
            } else {
                notableObservationEvent = 'peak_overload';
                dischargeNarrative = '[Система: СМЕШАННАЯ ПЕРЕГРУЗКА] Активация достигает предела, но не имеет устойчивого положительного или негативного характера. Оргазма и нервного срыва не происходит.';
                output.nextCore.capacity = Math.max((output.nextCore.capacity || 0) - 6, 0);
                output.nextCore.plasticity = applySoftPositiveGain(output.nextCore.plasticity || 0, 8);
                output.nextCore.tension = 88;
                const overloadPreset = presetRepo.getActionPreset('effect_sensory_overload');
                if (overloadPreset) {
                    effects.push({
                        kind: 'context.apply',
                        subjectId,
                        actionId: 'effect_sensory_overload',
                        action: overloadPreset,
                    });
                }
            }

            notes.push(dischargeNarrative);
            peakEventToLog = {
                presetId: discharge.outcome === 'positive' ? 'discharge' : discharge.outcome === 'breakdown' ? 'breakdown' : 'peak_overload',
                narrative: dischargeNarrative,
            };
        }
    } else if ((output.nextCore.capacity || 0) <= 0 && (coreBefore.tension || 0) > 85 && (output.nextCore.tension || 0) < 100) {
        notableObservationEvent = 'exhaustion';
        const ruinNarrative = '[Система: ИСТОЩЕНИЕ РЕСУРСА] Выносливость упала до нуля, пока субъект находился на грани. Оргазма не произошло. Остались лишь гнетущая апатия и опустошение.';
        notes.push(ruinNarrative);
        output.nextCore.attitude = Math.max((output.nextCore.attitude || 0) - 10, 0);
        output.nextCore.tension = 20;
        peakEventToLog = { presetId: 'ruined', narrative: ruinNarrative };
    }

    output.notableEvent = notableObservationEvent;

    // Edge is a persistent subject state, not a property of the machine. The
    // hysteresis avoids treating a one-point fluctuation as a new experience.
    const worldMinute = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
    const previousEdge = subjectEdgeStateRepo.get(subjectId);
    const tensionAfter = Number(output.nextCore.tension || 0);
    const resolvedEdge = Boolean(notableObservationEvent && notableObservationEvent !== 'exhaustion') || tensionAfter < 80;
    if (resolvedEdge) {
        effects.push({ kind: 'edge.clear', subjectId });
    } else if (tensionAfter >= 85) {
        const valence: 'positive' | 'negative' | 'mixed' = output.result.finalValence > .2 ? 'positive'
            : output.result.finalValence < -.2 ? 'negative' : 'mixed';
        effects.push({
            kind: 'edge.update',
            subjectId,
            state: {
                enteredAtMinute: previousEdge?.enteredAtMinute ?? worldMinute,
                cycles: previousEdge?.cycles ?? 0,
                valence,
                sourceActionId: presetId,
                sourcePointId: pointId,
            },
            worldMinute,
        });
    }

    return { output, peakEventToLog, notableObservationEvent, notes, effects };
}
