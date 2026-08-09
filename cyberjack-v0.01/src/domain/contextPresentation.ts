export function getActiveContextLabel(
    preset: { label?: string; contextConfig?: { activeLabel?: string } } | null | undefined,
    fallback: string
): string {
    return preset?.contextConfig?.activeLabel || preset?.label || fallback;
}

export function getActiveContextPromptText(
    preset: { label?: string; contextConfig?: { activeLabel?: string; promptEffect?: string } } | null | undefined,
    fallback: string
): string {
    const label = getActiveContextLabel(preset, fallback);
    const effect = contextPromptEffect(fallback, preset?.contextConfig?.promptEffect);
    return effect ? `${label}: ${effect}` : label;
}
import { contextPromptEffect } from './contextNarration';
