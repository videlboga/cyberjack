import { clamp } from '../engine/utils';
import type { CompiledAction } from '../domain/types';

const scalar = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Convert old 0..10 authored vectors to the engine's canonical ranges. */
export function normalizeAuthoredActionVector(vector: Record<string, any> = {}) {
    const legacyScale = 'powerBase' in vector ||
        scalar(vector.intensity) > 1 || Math.abs(scalar(vector.valence)) > 1 ||
        scalar(vector.contact) > 1 || Math.abs(scalar(vector.sharpness)) > 1 || scalar(vector.novelty) > 1;
    const divisor = legacyScale ? 10 : 1;
    const result = { ...vector };
    if ('intensity' in vector) result.intensity = clamp(scalar(vector.intensity) / divisor, 0, 1);
    if ('valence' in vector) result.valence = clamp(scalar(vector.valence) / divisor, -1, 1);
    if ('contact' in vector) result.contact = clamp(scalar(vector.contact) / divisor, 0, 1);
    if ('sharpness' in vector) result.sharpness = clamp(scalar(vector.sharpness) / divisor, 0, 1);
    if ('novelty' in vector) result.novelty = clamp(scalar(vector.novelty) / divisor, 0, 1);
    return result;
}

/** Setup/state changes are not themselves sustained physical stimulation. */
export function shapeImmediateContextAction(
  vector: Record<string, any>,
  contextType?: string,
  removesContexts = false,
): Pick<CompiledAction, 'intensity' | 'valence' | 'contact' | 'sharpness' | 'novelty'> {
  const result: Pick<CompiledAction, 'intensity' | 'valence' | 'contact' | 'sharpness' | 'novelty'> = {
    intensity: Number(vector.intensity) || 0,
    valence: Number(vector.valence) || 0,
    contact: Number(vector.contact) || 0,
    sharpness: Number(vector.sharpness) || 0,
    novelty: Number(vector.novelty) || 0,
  };
  if (contextType === 'pose') {
    result.intensity = Math.min(result.intensity, .15);
    result.contact = 0;
    result.sharpness = 0;
  } else if (['equipment', 'restraint', 'clothing'].includes(contextType || '')) {
    result.intensity *= .35;
    result.contact *= .25;
    result.sharpness *= .25;
  } else if (removesContexts) {
    result.intensity *= .2;
    result.contact *= .2;
    result.sharpness *= .2;
  }
  return result;
}
