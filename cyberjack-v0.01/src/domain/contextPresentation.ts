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
    return preset?.contextConfig?.promptEffect ? `${label}: ${preset.contextConfig.promptEffect}` : label;
}
