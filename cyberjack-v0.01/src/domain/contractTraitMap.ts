/**
 * Маппинг контрактных трейтов (из return_profile) на тег/точку в preferences.
 * Без зависимостей — импортируется и conditioning.ts, и contractTraits.ts.
 */

export interface ContractTraitTarget {
    bucket: 'tags' | 'points';
    key: string;
}

export const CONTRACT_TRAIT_TARGET_MAP: Record<string, ContractTraitTarget> = {
    // Точки (trait_point_*)
    anomaly_foot_echo: { bucket: 'points', key: 'feet' },
    trauma_foot_stimulation: { bucket: 'points', key: 'feet' },
    // Теги (существующие трейты)
    anomaly_pain_echo: { bucket: 'tags', key: 'pain' },
    trauma_pain_resonance: { bucket: 'tags', key: 'pain' },
    anomaly_exposure_echo: { bucket: 'tags', key: 'exposure' },
    trauma_public_exposure: { bucket: 'tags', key: 'exposure' },
    anomaly_clinical_echo: { bucket: 'tags', key: 'clinical' },
    trauma_clinical_invasive: { bucket: 'tags', key: 'clinical' },
    anomaly_void_echo: { bucket: 'tags', key: 'deprivation' },
    trauma_isolation: { bucket: 'tags', key: 'deprivation' },
    anomaly_electro_echo: { bucket: 'tags', key: 'electronic' },
    trauma_electro: { bucket: 'tags', key: 'electronic' },
    anomaly_restraint_echo: { bucket: 'tags', key: 'restraint' },
    trauma_restraint: { bucket: 'tags', key: 'restraint' },
    anomaly_submission_echo: { bucket: 'tags', key: 'submission' },
    trauma_conditioning: { bucket: 'tags', key: 'submission' },
    anomaly_command_echo: { bucket: 'tags', key: 'command' },
    anomaly_chemical_echo: { bucket: 'tags', key: 'chemical' },
    trauma_chemical_peak: { bucket: 'tags', key: 'chemical' },
    anomaly_vibration_echo: { bucket: 'tags', key: 'vibration' },
    trauma_vibration_overload: { bucket: 'tags', key: 'vibration' },
    anomaly_voice_echo: { bucket: 'tags', key: 'voice' },
    trauma_voice: { bucket: 'tags', key: 'voice' },
    anomaly_pose_echo: { bucket: 'tags', key: 'pose' },
    anomaly_interface_echo: { bucket: 'tags', key: 'interface' },
    anomaly_predictable_echo: { bucket: 'tags', key: 'predictable' },
    anomaly_endurance_echo: { bucket: 'tags', key: 'endurance' },
    trauma_endurance: { bucket: 'tags', key: 'endurance' },
    anomaly_threshold_echo: { bucket: 'tags', key: 'threshold' },
    trauma_threshold: { bucket: 'tags', key: 'threshold' },
    anomaly_loyalty_echo: { bucket: 'tags', key: 'loyalty' },
    trauma_loyalty: { bucket: 'tags', key: 'loyalty' },
    anomaly_drift_echo: { bucket: 'tags', key: 'drift' },
    anomaly_crossindex_echo: { bucket: 'tags', key: 'crossindex' },
    anomaly_mapping_echo: { bucket: 'tags', key: 'mapping' },
    anomaly_plasticity_echo: { bucket: 'tags', key: 'plasticity' },
    anomaly_comparative_echo: { bucket: 'tags', key: 'comparative' },
    anomaly_biography_echo: { bucket: 'tags', key: 'biography' },
    anomaly_trace_echo: { bucket: 'tags', key: 'trace' },
    anomaly_rebuild_echo: { bucket: 'tags', key: 'rebuild' },
    anomaly_resonance_echo: { bucket: 'tags', key: 'resonance' },
    trauma_anomaly_overload: { bucket: 'tags', key: 'overload' },
    trauma_breakdown: { bucket: 'tags', key: 'breakdown' },
    // Сексуальные травмы/аномалии (переработка контрактов v2).
    trauma_forced_orgasm: { bucket: 'tags', key: 'sexual' },
    trauma_penetration: { bucket: 'tags', key: 'penetration' },
    trauma_oral_use: { bucket: 'tags', key: 'oral' },
    trauma_gang_use: { bucket: 'tags', key: 'humiliation' },
    trauma_breeding: { bucket: 'tags', key: 'penetration' },
    trauma_machine_use: { bucket: 'tags', key: 'machine' },
    anomaly_orgasm_echo: { bucket: 'tags', key: 'sexual' },
    anomaly_penetration_echo: { bucket: 'tags', key: 'penetration' },
    anomaly_oral_echo: { bucket: 'tags', key: 'oral' },
    anomaly_breeding_echo: { bucket: 'tags', key: 'penetration' },
    anomaly_gang_echo: { bucket: 'tags', key: 'sexual' },
    anomaly_machine_echo: { bucket: 'tags', key: 'machine' },
    // Манипуляция воспоминаниями (Continuum Archive v2).
    trauma_memory_rewrite: { bucket: 'tags', key: 'deprivation' },
    trauma_implanted_memory: { bucket: 'tags', key: 'control' },
    anomaly_memory_echo: { bucket: 'tags', key: 'deprivation' },
    // Аверсии/фобии (Центр адаптивной психофизиологии).
    trauma_aversion_amplified: { bucket: 'tags', key: 'pain' },
    anomaly_aversion_echo: { bucket: 'tags', key: 'pain' },
};

/** Резолвит контрактный трейт на тег/точку. */
export function resolveContractTraitTarget(traitId: string): ContractTraitTarget | null {
    return CONTRACT_TRAIT_TARGET_MAP[traitId] || null;
}
