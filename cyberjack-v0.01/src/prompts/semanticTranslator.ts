import { SubjectCoreState } from '../domain/types.js';
import { activeConfig } from './config.js';
import { PromptPhysicalState } from './openRouterPromptBuilder.js';
import { getBaseHumanAnatomy, AnatomyMod, Gender } from '../domain/anatomy.js';
import { activeContextsRepo, presetRepo } from '../infrastructure/repositories.js';
import { getActiveContextLabel } from '../domain/contextPresentation.js';

export function translateStateToPrompt(
    subjectId: string,
    core: SubjectCoreState,
    points: any[], 
    gender: Gender, 
    anatomyMod: AnatomyMod
): PromptPhysicalState {
    const cfg = activeConfig.somaticSense;

    const getLevelIndex = (val: number) => {
        if (val <= 20) return 0;
        if (val <= 40) return 1;
        if (val <= 60) return 2;
        if (val <= 80) return 3;
        return 4;
    };

    const sensIdx = getLevelIndex(core.sensitivity);
    const capIdx = getLevelIndex(core.capacity);
    const openIdx = getLevelIndex(core.openness);
    const attIdx = getLevelIndex(core.attitude);

    const sensText = (cfg as any)[`sensitivity_L${sensIdx}`];
    const capText = (cfg as any)[`capacity_L${capIdx}`];
    const openText = (cfg as any)[`openness_L${openIdx}`];
    const attText = (cfg as any)[`attitude_L${attIdx}`];

    // ConditionWatcher is the source of truth. Do not infer a competing state
    // tree here: delayed/chronic contexts and mutually exclusive presentation
    // would otherwise be lost in the prompt.
    const activeContexts = activeContextsRepo.getAllForSubject(subjectId);
    const activeIds = new Set(activeContexts.map(context => context.actionId));
    const behaviorTexts: Array<[string[], string]> = [
        [['effect_apathy', 'effect_chronic_apathy'], cfg.stateApathy],
        [['effect_panic'], cfg.statePanicAttack],
        [['effect_active_defiance'], cfg.stateActiveDefiance],
        [['effect_freeze'], cfg.stateFreeze],
        [['effect_sensory_overload'], cfg.stateSensoryOverload],
        [['effect_subspace'], cfg.stateSubspace],
    ];
    const traits: string[] = [];
    const behavior = behaviorTexts.find(([ids]) => ids.some(id => activeIds.has(id)));
    if (behavior) traits.push(behavior[1]);
    if (activeIds.has('effect_suggestibility')) traits.push(cfg.stateSuggestibility);
    if (activeIds.has('effect_hyperesthesia')) traits.push(cfg.stateHyperesthesia);
    const traitsText = traits.length ? traits.join(' ') : cfg.noTraitsFallback;

    const globalSummary = `${sensText} ${capText} ${openText} ${attText} [СОСТОЯНИЕ РАЗУМА: ${traitsText}]`;

    // Универсальная сборка анатомии без хардкода: 
    // Движок сам отдает актуальный список частей тела.
    const myAnatomyDef = getBaseHumanAnatomy(gender, anatomyMod);
    const visibleParts = myAnatomyDef
        .filter(p => !p.id.startsWith('slot_') && p.id !== 'global_pose' && p.id !== 'mind_state' && p.id !== 'systemic')
        .map(p => p.label);
    
    const bodyAnatomy = `Мое доступное тело содержит следующие зоны: ${visibleParts.join(', ')}.`;

    const sensations: string[] = [];
    if (points && points.length > 0) {
        const sensitivePoints = points.filter(p => p.localSensitivity >= 85);
        if (sensitivePoints.length > 0) {
            const labels = sensitivePoints.map(p => p.label).join(', ');
            sensations.push(`Фокусная гиперсенситизация: зоны [${labels}] перестимулированы от крайнего напряжения.`);
        }

        const dissonantPoints = points.filter(p => p.localAttitude >= 85 && core.attitude < 40);
        if (dissonantPoints.length > 0) {
            const labels = dissonantPoints.map(p => p.label).join(', ');
            sensations.push(`Сенсорный диссонанс: разум сопротивляется, но участки тела [${labels}] плавятся от извращенного удовольствия.`);
        }
    }

    const occupiedSlots: string[] = [];
    if (activeContexts && activeContexts.length > 0) {
        for (const ctx of activeContexts) {
            const preset = presetRepo.getActionPreset(ctx.actionId);
            if (preset?.contextConfig?.occupiesPoints) {
                const slots = preset.contextConfig.occupiesPoints;
                const slotLabels = slots.map((ptId: string) => {
                    const mapped = myAnatomyDef.find(a => a.id === ptId);
                    return mapped ? mapped.label : ptId;
                });
                occupiedSlots.push(`[${getActiveContextLabel(preset, ctx.actionId)}] занимает: ${slotLabels.join(', ')}.`);
            }
        }
    }

    let speechConstraint = "";
    if (activeIds.has('effect_subspace')) {
            speechConstraint = "Твой разум плывет в сабспейсе. Ты физически не можешь выговаривать длинные предложения. Твоя речь сводится к тихому стону, вздохам и бессвязным обрывкам фраз из 1-2 слов.";
    } else if (activeIds.has('effect_panic')) {
            speechConstraint = "Ты в панике и истерике. Твоя воля сломлена. Ты не способен на связные монологи, только на крики, мольбы, всхлипы или короткие, срывающиеся фразы.";
    } else if (activeIds.has('effect_apathy') || activeIds.has('effect_chronic_apathy') || activeIds.has('effect_sensory_overload')) {
            speechConstraint = "У тебя сильное истощение. Тебе тяжело строить предложения, ты говоришь медленно, с паузами, обрывками фраз.";
    } else if (core.capacity >= 70 && core.openness > 60) {
        speechConstraint = "У тебя много сил, и ты чувствуешь себя раскованно. Описывай свои развернутые мысли, можешь быть как язвительным, так и весьма откровенным в своих высказываниях.";
    }

    return {
        globalSummary,
        bodyAnatomy,
        sensations,
        occupiedSlots,
        speechConstraint: speechConstraint === "" ? undefined : speechConstraint
    };
}
