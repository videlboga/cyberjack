import { CompiledAction, SubjectCoreState, SubjectPointState } from '../domain/types';
import { clamp } from '../engine/utils';
import { DEFAULT_CONFIG } from '../engine/config';

/**
 * Applies dynamic multipliers and overrides to the action vector based on the
 * subject's current mental and physical overloads (Virtual Contexts).
 * 
 * NOTE: Most mental overloads (Apathy, Freeze, Subspace, Panic) have now been
 * migrated to Contexts in DB + conditionWatcher.ts. Only localized / immediate
 * physiological reactions remain here.
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

    // Ensure we don't break bounds after arithmetic
    finalAction.intensity = clamp(finalAction.intensity, 0, 5.0);
    finalAction.valence = clamp(finalAction.valence, -1.0, 1.0);
    finalAction.contact = clamp(finalAction.contact, 0, 1.0);
    finalAction.sharpness = clamp(finalAction.sharpness, 0, 1.0);
    finalAction.novelty = clamp(finalAction.novelty, 0, 1.0);
    
    return finalAction;
}