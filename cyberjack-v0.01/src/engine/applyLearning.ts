// src/engine/applyLearning.ts

import { CompiledAction, SubjectCoreState, SubjectPointState, EngineConfig } from '../domain/types';
import { validateConfig } from './validate';
import { normalizeAction, normalizeCore, normalizePoint } from './normalize';
import { applySoftPositiveGain, clamp, softMechanicalScale } from './utils';
import { DEFAULT_CONFIG } from './config';
import { advanceBaseline, dampTowardsBaseline } from './baselineUtils';
import { OVERLOAD_NOTICEABLE } from '../domain/overloadScale';
import { arousalDirection } from '../domain/arousalDynamics';

export function applyLearning(
    core: Partial<SubjectCoreState>,
    point: Partial<SubjectPointState>,
    action: Partial<CompiledAction>,
    result: any,
    config: EngineConfig = DEFAULT_CONFIG,
    deltaTime: number = 1.0
): { nextCore: SubjectCoreState; nextPoint: SubjectPointState } {
    validateConfig(config);
    const safeCore = normalizeCore(core, config);
    const safePoint = normalizePoint(point, config);
    const safeAction = normalizeAction(action, config);
    const f = config.formulas.applyLearning;

    const tension = safeCore.tension ?? 0;
    const isEdging = tension > 85;
    
    // Calculate new tension
    // Grows based on action intensity (pleasure/discomfort), scaled by sensitivity.
    // It decays only when time actually passes without stimulation. Result
    // metrics already include sensitivity, so the extra reactivity multiplier
    // is deliberately soft rather than another full sensitivity scaling.
    const isRestAction = safeAction.actionKey === 'wait';
    const arousal = arousalDirection(safeAction, safePoint.pointId, Number(result.finalValence || 0), tension);
    const mechanicalSensitivity = softMechanicalScale(result.effectiveSensitivity ?? safeCore.sensitivity);
    const reactivityMultiplier = 0.5 + clamp(mechanicalSensitivity / 100, 0, 2);
    const rawTensionGrowth = (result.pleasure + result.discomfort + (result.overload || 0) * 0.5) * reactivityMultiplier * (f.tensionGrowthMultiplier ?? 0.3) * (isRestAction ? deltaTime : 1.0) * arousal.excitation;
    // The edge is a playable band rather than one ordinary action away from an
    // automatic outcome. Growth compresses as activation approaches the peak;
    // emotionally meaningful results still enter learning at full strength.
    const edgeGrowthWindow = tension <= 85 ? 1 : clamp((100 - tension) / 15, 0.08, 1);
    const tensionGrowth = rawTensionGrowth * edgeGrowthWindow;
    // A pause relaxes accumulated activation, but must not resemble an instant
    // discharge. A normal 20-unit pause should preserve most of an edge state;
    // openness only modestly accelerates settling.
    const tensionRecoveryRate = Math.max(
        f.tensionRecoveryBase ?? 0.75,
        safeCore.openness / (f.tensionRecoveryOpennessDivisor ?? 25)
    );
    // Recovery grows sub-linearly with elapsed time: a one-tick pause remains
    // mechanically meaningful, while a long 20-unit wait cannot erase an
    // entire high-tension state in one click.
    const passiveTensionDrop = isRestAction
        ? Math.min(
            f.tensionRecoveryMaxPerAction ?? 18,
            tensionRecoveryRate * Math.sqrt(Math.max(deltaTime, 0))
        )
        : 0;
    const regulatedTensionDrop = isRestAction ? 0 : arousal.regulation * (4 + tension * .1);
    const tensionDrop = passiveTensionDrop + regulatedTensionDrop;
    const nextTension = clamp(
        tension + tensionGrowth - tensionDrop,
        0,
        150 // Allow exceeding 100 temporarily to trigger Discharge
    );

    // Sensitivity has three continuous bands:
    // rest restores current state towards baseline; manageable novel load can
    // sensitize current state; excessive load temporarily desensitizes it.
    // Baseline itself is never changed directly here: advanceBaseline below
    // slowly follows whatever current state is sustained over time.
    const coreRecoveryCeiling = f.sensitivityRecoveryCeiling ?? f.adaptationIntensitySetpoint ?? f.sensitivityTarget ?? 5;
    const localRecoveryCeiling = f.localSensitivityRecoveryCeiling ?? f.localAdaptationIntensitySetpoint ?? f.localSensitivityTarget ?? 3;
    const coreDesensitizationStart = f.sensitivityDesensitizationStart ?? 25;
    const localDesensitizationStart = f.localSensitivityDesensitizationStart ?? 20;
    const overloadAllowsRecovery = (result.overload || 0) < (f.sensitivityRegenThreshold ?? 8);
    const coreBaselineSensitivity = safeCore.baselineSensitivity ?? safeCore.sensitivity;
    const localBaselineSensitivity = safePoint.baselineLocalSensitivity ?? safePoint.localSensitivity;
    const coreRecoveryFactor = overloadAllowsRecovery
        ? clamp(1 - result.experiencedIntensity / Math.max(coreRecoveryCeiling, 0.001), 0, 1)
        : 0;
    const localRecoveryFactor = overloadAllowsRecovery
        ? clamp(1 - result.experiencedIntensity / Math.max(localRecoveryCeiling, 0.001), 0, 1)
        : 0;
    const coreRecovery = Math.min(
        Math.max(0, coreBaselineSensitivity - safeCore.sensitivity),
        (f.sensitivityRegenRate ?? 0) * deltaTime * coreRecoveryFactor
    );
    const localRecovery = Math.min(
        Math.max(0, localBaselineSensitivity - safePoint.localSensitivity),
        (f.localSensitivityRegenRate ?? 0) * deltaTime * localRecoveryFactor
    );
    const manageableBand = (low: number, high: number) => {
        const rise = clamp((result.experiencedIntensity - low) / Math.max(high - low, 0.001), 0, 1);
        const fade = clamp((high * 1.6 - result.experiencedIntensity) / Math.max(high * 0.6, 0.001), 0, 1);
        return rise * fade;
    };
    // These scales describe a fully useful calibration experience. Multiplying
    // two raw percentages made the practical sensitisation window nearly inert.
    const learningQuality = clamp(
        (result.learningEffect || 0) / (f.sensitivityLearningEffectScale ?? 45), 0, 1
    ) * clamp(
        (result.engagement || 0) / (f.sensitivityEngagementScale ?? 65), 0, 1
    ) *
        clamp(1 - (result.overload || 0) / 100, 0, 1);
    const coreSensitization = learningQuality * manageableBand(coreRecoveryCeiling, coreDesensitizationStart) *
        (f.sensitivityFromLearning ?? 8);
    const localSensitization = learningQuality * manageableBand(localRecoveryCeiling, localDesensitizationStart) *
        (f.localSensitivityFromLearning ?? 14);
    const coreDesensitization = Math.max(0, result.experiencedIntensity - coreDesensitizationStart) *
        f.sensitivityFromIntensity + (result.overload || 0) * (f.sensitivityFromOverload ?? 0.02);
    const localDesensitization = Math.max(0, result.experiencedIntensity - localDesensitizationStart) *
        f.localSensitivityFromIntensity + (result.overload || 0) * (f.localSensitivityFromOverload ?? 0.03);

    const isRest = safeAction.actionKey === 'wait';
    let baseCapacityDrop = isRest ? 0 :
        result.experiencedIntensity * (f.capacityLoadFromIntensity ?? 0.015) +
        result.discomfort * (f.capacityLoadFromDiscomfort ?? 0.02) +
        result.overload * (f.capacityDropMultiplier ?? 0.25);
    // A well-received pleasant action is still tiring, but much less so than
    // distress or overload at the same raw intensity.
    const pleasantShare = (result.pleasure || 0) / Math.max(1, (result.pleasure || 0) + (result.discomfort || 0) + (result.overload || 0));
    baseCapacityDrop *= 1 - clamp(pleasantShare, 0, 1) * 0.45;
    if (isEdging) {
        const edgeDistressFactor = result.pleasure > (result.discomfort || 0) * 1.35 ? 0.25
            : result.discomfort > (result.pleasure || 0) * 1.35 ? 1 : 0.65;
        baseCapacityDrop += (tension - 85) * (f.edgingCapacityDropRate ?? 0.08) * edgeDistressFactor * deltaTime;
    }
    const capacityBaseline = safeCore.baselineCapacity ?? safeCore.capacity;
    const capacityRecovery = isRest ? Math.min(
        Math.max(0, capacityBaseline - safeCore.capacity),
        (f.capacityRecoveryRate ?? 1.0) * deltaTime
    ) * (isEdging ? 0.35 : 1) : 0;

    const tensionModifier = 1 + (tension / 100) * 0.5; // Up to 1.5x effect on changes when tension is high
    const routineCapacityLossLimit = (result.overload || 0) >= OVERLOAD_NOTICEABLE ? 15 : 6;
    const capacityLoss = Math.min(baseCapacityDrop * tensionModifier, routineCapacityLossLimit);

    const timeScale = safeAction.actionKey === 'wait' ? deltaTime : 1.0;
    const bodilyBalance = (result.pleasure || 0) - (result.discomfort || 0);
    const sensoryMagnitude = (result.pleasure || 0) + (result.discomfort || 0) + (result.overload || 0) * 0.25;
    // finalValence is the character's psychological appraisal after
    // preferences, relationship and context have been applied. This allows a
    // physically uncomfortable experience to be accepted without pretending
    // that it was pleasant.
    const affect = Number.isFinite(result.finalValence)
        ? clamp(result.finalValence, -1, 1) * sensoryMagnitude
        : bodilyBalance;
    // Acceptance follows the experienced balance directly. Novelty and
    // learning amplify a positive experience instead of gating it entirely;
    // familiar pleasure therefore gives a small gain rather than an opaque
    // zero or reversal. A subject at zero functional resource still cannot
    // consolidate a positive experience.
    const responsiveness = clamp((safeCore.capacity - 10) / 30, 0, 1);
    // Arousal strengthens emotional encoding in either direction. The old
    // positive-only consolidation window reached zero near the edge, making
    // edging useful for teaching aversion but useless for positive rewiring.
    const emotionalEncoding = clamp(0.8 + 1.2 * tension / 100, 0.8, 2);
    const learnedQuality = clamp((result.learningEffect || 0) / 12, 0, 1) *
        clamp((result.engagement || 0) / 30, 0, 1);
    // Familiar pleasure can reinforce acceptance a little, but cannot train it
    // almost as efficiently as a novel, engaging experience. The old 25% floor
    // let identical pleasant actions drive acceptance to ~100 in a few ticks.
    // High activation strengthens the *meaningful* (novel/engaging) part of
    // learning. It must not amplify the tiny familiarity floor, otherwise one
    // repeated pleasant action becomes an acceptance exploit near the edge.
    const positiveLearningFactor = 0.03 + learnedQuality * 0.555 * emotionalEncoding;
    const negativeResponsiveness = 0.5 + responsiveness * 0.5;
    const opennessAffect = affect > 0
        ? affect * positiveLearningFactor * responsiveness
        : affect * negativeResponsiveness;
    // Positive conditioning asymptotically loses room near the ceiling. It can
    // reach exceptional values, but no finite repetition receives a hidden
    // minimum gain all the way to 100.
    const positiveCoreRoom = Math.pow(clamp((100 - safeCore.attitude) / 50, 0, 1), 1.5);
    const positiveLocalRoom = Math.pow(clamp((100 - safePoint.localAttitude) / 50, 0, 1), 1.5);
    const coreAffectForAcceptance = affect > 0
        ? affect * positiveLearningFactor * responsiveness * positiveCoreRoom
        : affect * negativeResponsiveness * emotionalEncoding;
    const localAffectForAcceptance = affect > 0
        ? affect * positiveLearningFactor * responsiveness * positiveLocalRoom
        : affect * negativeResponsiveness * emotionalEncoding;

    const nextCore: SubjectCoreState = {
        tension: nextTension,
        sensitivity: applySoftPositiveGain(
            safeCore.sensitivity,
            (coreSensitization - coreDesensitization + coreRecovery) * tensionModifier
        ),
        capacity: clamp(
            safeCore.capacity - capacityLoss + capacityRecovery,
            config.core.min,
            config.core.max
        ),
        openness: clamp(
            safeCore.openness + (opennessAffect * f.opennessFromPleasureDiscomfort * timeScale),
            config.core.min,
            config.core.max
        ),
        plasticity: applySoftPositiveGain(
            safeCore.plasticity,
            ((result.learningEffect * f.plasticityFromLearning * clamp(1 - result.overload / 100, 0, 1) -
            result.overload * f.plasticityFromOverload) * (isRest ? 0 : 1)) * tensionModifier
        ),
        attitude: clamp(
            safeCore.attitude +
            (coreAffectForAcceptance * f.attitudeFromPleasureDiscomfort -
            result.overload * f.attitudeFromOverload) * timeScale,
            config.core.min,
            config.core.max
        ),
    };

    const nextPoint: SubjectPointState = {
        pointId: safePoint.pointId,
        localSensitivity: applySoftPositiveGain(
            safePoint.localSensitivity,
            localSensitization - localDesensitization + localRecovery
        ),
        localAttitude: clamp(
            safePoint.localAttitude +
            localAffectForAcceptance * f.localAttitudeFromPleasureDiscomfort -
            safeAction.sharpness * result.overload * f.localAttitudeFromSharpOverload,
            config.point.min,
            config.point.max
        ),
        localOpenness: clamp(
            (safePoint.localOpenness ?? config.point.defaults.localOpenness ?? 50) +
            opennessAffect * (f.localOpennessFromPleasureDiscomfort ?? f.opennessFromPleasureDiscomfort),
            config.point.min,
            config.point.max
        ),
        familiarity: clamp(
            (safePoint.familiarity ?? config.point.defaults.familiarity ?? 0) + result.learningEffect * 0.01,
            config.point.min,
            config.point.max
        ),
        exposureCount: clamp(
            (safePoint.exposureCount ?? config.point.defaults.exposureCount ?? 0) + 1,
            config.point.min,
            config.point.max
        )
    };

    // Only learned changes leak between local and global acceptance. Comparing
    // their absolute levels made a pleasant action lower global acceptance
    // merely because the selected zone started below it.
    const localAttitudeDelta = nextPoint.localAttitude - safePoint.localAttitude;
    nextCore.attitude = clamp(
        nextCore.attitude + localAttitudeDelta * f.localToGlobalLeak,
        config.core.min,
        config.core.max
    );

    const coreAttitudeDelta = nextCore.attitude - safeCore.attitude;
    nextPoint.localAttitude = clamp(
        nextPoint.localAttitude + coreAttitudeDelta * f.globalToLocalLeak,
        config.point.min,
        config.point.max
    );

    const baselineCfg = config.formulas.baseline || {};
    const coreBaselineState = {
        sensitivity: safeCore.baselineSensitivity ?? safeCore.sensitivity,
        capacity: safeCore.baselineCapacity ?? safeCore.capacity,
        openness: safeCore.baselineOpenness ?? safeCore.openness,
        plasticity: safeCore.baselinePlasticity ?? safeCore.plasticity,
        attitude: safeCore.baselineAttitude ?? safeCore.attitude
    };
    const pointBaselineState = {
        localSensitivity: safePoint.baselineLocalSensitivity ?? safePoint.localSensitivity,
        localAttitude: safePoint.baselineLocalAttitude ?? safePoint.localAttitude,
        localOpenness: safePoint.baselineLocalOpenness ?? safePoint.localOpenness ?? 50
    };
    const novelty = safeAction.novelty ?? 0.5;

    const coreDriver = {
        plasticity: safeCore.plasticity,
        openness: safeCore.openness,
        novelty
    };

    const coreConfig = baselineCfg.core || {};
    const pointConfig = baselineCfg.point || {};

    nextCore.sensitivity = dampTowardsBaseline(nextCore.sensitivity, coreBaselineState.sensitivity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineSensitivity = advanceBaseline(
        coreBaselineState.sensitivity,
        nextCore.sensitivity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    nextCore.capacity = dampTowardsBaseline(nextCore.capacity, coreBaselineState.capacity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineCapacity = advanceBaseline(
        coreBaselineState.capacity,
        nextCore.capacity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    if (isRest) nextCore.openness = dampTowardsBaseline(nextCore.openness, coreBaselineState.openness, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineOpenness = advanceBaseline(
        coreBaselineState.openness,
        nextCore.openness,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    nextCore.plasticity = dampTowardsBaseline(nextCore.plasticity, coreBaselineState.plasticity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselinePlasticity = advanceBaseline(
        coreBaselineState.plasticity,
        nextCore.plasticity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    if (isRest) nextCore.attitude = dampTowardsBaseline(nextCore.attitude, coreBaselineState.attitude, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineAttitude = advanceBaseline(
        coreBaselineState.attitude,
        nextCore.attitude,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );
    
    // Tension actively drops towards its baseline when resting, but doesn't adapt its baseline easily.

    const pointDriver = {
        plasticity: safeCore.plasticity,
        openness: safeCore.openness,
        novelty,
        extraFactor: 1 + (result.learningEffect / 100)
    };

    nextPoint.localSensitivity = dampTowardsBaseline(nextPoint.localSensitivity, pointBaselineState.localSensitivity, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping,
        timeScale: deltaTime
    });
    nextPoint.baselineLocalSensitivity = advanceBaseline(
        pointBaselineState.localSensitivity,
        nextPoint.localSensitivity,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig, timeScale: deltaTime }
    );

    if (isRest) nextPoint.localAttitude = dampTowardsBaseline(nextPoint.localAttitude, pointBaselineState.localAttitude, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping,
        timeScale: deltaTime
    });
    nextPoint.baselineLocalAttitude = advanceBaseline(
        pointBaselineState.localAttitude,
        nextPoint.localAttitude,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig, timeScale: deltaTime }
    );

    if (isRest) nextPoint.localOpenness = dampTowardsBaseline(nextPoint.localOpenness ?? pointBaselineState.localOpenness, pointBaselineState.localOpenness, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping,
        timeScale: deltaTime
    });
    nextPoint.baselineLocalOpenness = advanceBaseline(
        pointBaselineState.localOpenness,
        nextPoint.localOpenness,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig, timeScale: deltaTime }
    );

    // Preserve a small explicit whitelist of metadata fields that callers may
    // attach to the core (preferences JSON string, flags, name, profileJson).
    // Using a whitelist avoids accidentally copying unknown fields and is
    // safer than copying every non-numeric key.
    try {
        const whitelist = ['preferences', 'flags', 'name', 'profileJson'];
        for (const k of whitelist) {
            if ((core as any)[k] !== undefined) {
                (nextCore as any)[k] = (core as any)[k];
            }
        }
    } catch (e) {
        // non-critical: ignore
    }

    return { nextCore, nextPoint };
}
