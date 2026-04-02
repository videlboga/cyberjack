import { CompiledAction, SubjectCoreState, SubjectPointState } from '../domain/types';
import { clamp } from '../engine/utils';
import { DEFAULT_CONFIG } from '../engine/config';

/**
 * Applies dynamic multipliers and overrides to the action vector based on the
 * subject's current mental and physical overloads (Virtual Contexts).
 */
export function applyDynamicContexts(
    action: CompiledAction, 
    core: SubjectCoreState, 
    point: SubjectPointState
): CompiledAction {
    const finalAction = { ...action };
    
    // Evaluate Body Point Overloads
    if (point.localSensitivity >= 85) {
        // [Фокусная гиперсенситизация] Any touch to this point feels extremely intense and sharp
        finalAction.intensity *= 1.3;
        finalAction.sharpness *= 1.2;
    }
    
    if (point.localAttitude >= 85 && core.attitude < 40) {
        // [Сенсорный диссонанс] Body loves it, mind hates it - causes sharpness and extreme confusion
        finalAction.sharpness += 0.2; 
        finalAction.novelty += 0.2;
    }

    // Evaluate Mental Overloads
    if (core.capacity <= 10 && core.attitude < 60) {
        // [Апатия / Отключение] Numbness
        finalAction.intensity *= 0.5;
        finalAction.sharpness *= 0.5;
    } else if (core.capacity <= 25) {
        if (core.plasticity > 80) {
            // [Смещение контроля / Suggestibility] Perceived softer, more pleasant
            finalAction.valence += 0.15;
            finalAction.sharpness *= 0.8;
        } else if (core.openness <= 20 && core.attitude >= 40) {
            // [Тоническое оцепенение / Freeze] Blocked perception
            finalAction.valence = Math.min(0, finalAction.valence);
            finalAction.contact *= 0.8;
        } else if (core.attitude > 60 && core.openness > 50) {
            // [Сабспейс / Subspace] High pleasure, less sharpness
            finalAction.valence += 0.2;
            finalAction.sharpness *= 0.6;
        } else if (core.attitude < 40) {
            // [Паническая Атака / Panic Attack] Everything is perceived sharp and extremely negative
            finalAction.sharpness *= 1.4;
            finalAction.valence -= 0.3;
        } else {
            // [Сенсорная Перегрузка / Sensory Overload] Disorienting and sharp
            finalAction.sharpness += 0.15;
            finalAction.intensity *= 1.2;
        }
    } else {
        // High capacity checks
        if (core.attitude <= 20 && core.capacity > 60 && core.openness <= 30) {
            // [Активное Отторжение / Active Defiance] Resistant to impacts
            finalAction.intensity *= 0.8;
            finalAction.valence -= 0.1;
        } else if (core.sensitivity >= 85) {
            // [Гиперестезия / Hyperesthesia] General over-stimulation
            finalAction.intensity *= 1.3;
            finalAction.sharpness *= 1.1;
        }
    }

    // Ensure we don't break bounds after arithmetic
    finalAction.intensity = clamp(finalAction.intensity, 0, 5.0);
    finalAction.valence = clamp(finalAction.valence, -1.0, 1.0);
    finalAction.contact = clamp(finalAction.contact, 0, 1.0);
    finalAction.sharpness = clamp(finalAction.sharpness, 0, 1.0);
    finalAction.novelty = clamp(finalAction.novelty, 0, 1.0);

    return finalAction;
}
