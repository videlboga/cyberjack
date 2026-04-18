import { SubjectCoreState } from '../domain/types.js';
import { activeConfig } from './config.js';
import { PromptPhysicalState } from './openRouterPromptBuilder.js';
import { getBaseHumanAnatomy, AnatomyMod, Gender } from '../domain/anatomy.js';
import { activeContextsRepo, presetRepo } from '../infrastructure/repositories.js';

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

    let traitsText = cfg.noTraitsFallback;
    if (core.capacity <= 10 && core.attitude < 60) {
        traitsText = cfg.stateApathy;
    } else if (core.capacity <= 25) {
        if (core.plasticity > 80) {
            traitsText = cfg.stateSuggestibility;
        } else if (core.openness <= 20 && core.attitude >= 40) {
            traitsText = cfg.stateFreeze;
        } else if (core.attitude > 60 && core.openness > 50) {
            traitsText = cfg.stateSubspace;
        } else if (core.attitude < 40) {
            traitsText = cfg.statePanicAttack;
        } else {
            traitsText = cfg.stateSensoryOverload;
        }
    } else {
        if (core.attitude <= 20 && core.capacity > 60 && core.openness <= 30) {
            traitsText = cfg.stateActiveDefiance;
        } else if (core.sensitivity >= 85) {
            traitsText = cfg.stateHyperesthesia;
        }
    }

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
    const activeContexts = activeContextsRepo.getAllForSubject(subjectId);
    if (activeContexts && activeContexts.length > 0) {
        for (const ctx of activeContexts) {
            const preset = presetRepo.getActionPreset(ctx.actionId);
            if (preset?.contextConfig?.occupiesPoints) {
                const slots = preset.contextConfig.occupiesPoints;
                const slotLabels = slots.map((ptId: string) => {
                    const mapped = myAnatomyDef.find(a => a.id === ptId);
                    return mapped ? mapped.label : ptId;
                });
                occupiedSlots.push(`Действие [${preset.label}] занимает: ${slotLabels.join(', ')}.`);
            }
        }
    }

    let speechConstraint = "";
    if (core.capacity <= 20) {
        if (core.attitude > 60) {
            speechConstraint = "Твой разум плывет в сабспейсе. Ты физически не можешь выговаривать длинные предложения. Твоя речь сводится к тихому стону, вздохам и бессвязным обрывкам фраз из 1-2 слов.";
        } else if (core.attitude < 40) {
            speechConstraint = "Ты в панике и истерике. Твоя воля сломлена. Ты не способен на связные монологи, только на крики, мольбы, всхлипы или короткие, срывающиеся фразы.";
        } else {
            speechConstraint = "У тебя сильное истощение. Тебе тяжело строить предложения, ты говоришь медленно, с паузами, обрывками фраз.";
        }
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
