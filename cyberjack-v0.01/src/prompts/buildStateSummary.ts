import { SubjectCoreState } from '../domain/types';
import {
    exceptionalCoreStateLines,
    interpretPointSensitivity,
    isAcquiredHyperSensitivity,
    sensitivityBand
} from '../domain/parameterInterpretation';
import { activeConfig } from './config';

/**
 * Преобразует числовые стейты в соматические ощущения от 2го/1го лица
 */
export function buildStateSummary(core: SubjectCoreState, points?: any[]): string {
    const cfg = activeConfig.somaticSense;

    // Helper to get index 0-4
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

    // Dynamic key access
    const sensText = (cfg as any)[`sensitivity_L${sensIdx}`];
    const capText = (cfg as any)[`capacity_L${capIdx}`];
    const openText = (cfg as any)[`openness_L${openIdx}`];
    const attText = (cfg as any)[`attitude_L${attIdx}`];

    // Edging and Tension mechanics
    let tensionAddon = "";
    if (core.tension !== undefined) {
        if (core.tension >= 95) {
            tensionAddon = "\n- [АБСОЛЮТНЫЙ ПРЕДЕЛ] Ты находишься на грани оргазма или нервного срыва. В глазах темнеет, дыхание срывается. Мысли путаются в кашу из-за невыносимого напряжения. Тебе физически тяжело строить сложные фразы, тело требует конца.";
        } else if (core.tension >= 85) {
            tensionAddon = "\n- [НА ГРАНИ] Напряжение почти достигло пика. Твоё тело дрожит, приближаясь к оргазму или срыву. Ты теряешь контроль над собой.";
        } else if (core.tension >= 60) {
            tensionAddon = "\n- [СИЛЬНОЕ НАПРЯЖЕНИЕ] Внутри тебя скопилось интенсивное напряжение. Дыхание сбито, ощущения обострены.";
        } else if (core.tension <= 15) {
            tensionAddon = "\n- [ОПУСТОШЕНИЕ/ПОКОЙ] Напряжение минимально. Тело расслаблено или опустошено.";
        }
    }

    // Динамический расчет Особых состояний (Overload mechanics)
    let traitsText = cfg.noTraitsFallback;
    
    if (core.capacity <= 10) {
        // Total exhaustion and apathy
        traitsText = cfg.stateApathy;
    } else if (core.capacity <= 25) {
        if (core.plasticity > 80) {
            // High plasticity + low capacity = Suggestibility (Malleable)
            traitsText = cfg.stateSuggestibility;
        } else if (core.openness <= 20 && core.attitude >= 40) {
            // Physically closed but mentally not fully hostile = Freeze response
            traitsText = cfg.stateFreeze;
        } else if (core.attitude > 60 && core.openness > 50) {
            // High submissiveness + openness + low capacity = Subspace
            traitsText = cfg.stateSubspace;
        } else if (core.attitude < 40) {
            // Hostile/fearful + low capacity = Panic Attack
            traitsText = cfg.statePanicAttack;
        } else {
            // General loss of control
            traitsText = cfg.stateSensoryOverload;
        }
    } else {
        // Check for high-resource or specific high-stat states if capacity is intact
        if (core.attitude <= 20 && core.capacity > 60 && core.openness <= 30) {
            // Full defense
            traitsText = cfg.stateActiveDefiance;
        } else if (core.sensitivity >= 85) {
            // Over-stimulated normally
            traitsText = cfg.stateHyperesthesia;
        }
    }

    const exceptionalCore = exceptionalCoreStateLines(core);
    let pointOverloads = exceptionalCore.length
        ? `\n* ${exceptionalCore.join('\n* ')}`
        : "";
    if (points && points.length > 0) {
        const interpretedPoints = points.map(p => ({
            point: p,
            interpreted: interpretPointSensitivity(
                p.pointId || p.id || p.label,
                p.localSensitivity,
                p.baselineLocalSensitivity
            )
        }));
        const sensitivePoints = interpretedPoints.filter(entry => isAcquiredHyperSensitivity(entry.interpreted));
        if (sensitivePoints.length > 0) {
            const descriptions = sensitivePoints.map(entry =>
                `${entry.point.label} — ${sensitivityBand(entry.interpreted)}`
            ).join('; ');
            const extreme = sensitivePoints.some(entry =>
                entry.interpreted.humanRatio >= 1.5 || entry.interpreted.personalRatio >= 2
            );
            pointOverloads += extreme
                ? `\n* [ЭКСТРЕМАЛЬНАЯ ФОКУСНАЯ ГИПЕРСЕНСИТИЗАЦИЯ] ${descriptions}. Обычное касание вызывает непропорционально сильный, трудно контролируемый отклик и не может описываться как рядовое ощущение.`
                : `\n* [Фокусная гиперсенситизация] ${descriptions}. Прикосновение ощущается заметно сильнее привычного.`;
        }
        const unusualPoints = interpretedPoints
            .filter(entry => !isAcquiredHyperSensitivity(entry.interpreted) && entry.interpreted.humanRatio >= 1.5)
            .slice(0, 5);
        if (unusualPoints.length > 0) {
            const descriptions = unusualPoints.map(entry =>
                `${entry.point.label} — ${sensitivityBand(entry.interpreted)}`
            ).join('; ');
            pointOverloads += `\n* [Анатомический профиль чувствительности] ${descriptions}. Это высокая абсолютная чувствительность, но не обязательно приобретённая гиперсенситизация.`;
        }

        const dissonantPoints = points.filter(p => p.localAttitude >= 85 && core.attitude < 40);
        if (dissonantPoints.length > 0) {
            const labels = dissonantPoints.map(p => p.label).join(', ');
            pointOverloads += `\n* [Сенсорный диссонанс] Твой разум ненавидит происходящее, но тело предает тебя — зоны: ${labels} плавятся от удовольствия.`;
        }
    }

    // Build human readable block
    const lines = [
        cfg.noteTitle,
        `- ${sensText}`,
        `- ${capText}`,
        `- ${openText}`,
        `- ${attText}`,
        tensionAddon,
        ``,
        `${cfg.traitsTitle} ${traitsText}${pointOverloads}`
    ];

    return lines.join('\n');
}
