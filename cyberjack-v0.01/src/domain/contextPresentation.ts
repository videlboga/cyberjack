export function getActiveContextLabel(
    preset: { label?: string; contextConfig?: { activeLabel?: string } } | null | undefined,
    fallback: string
): string {
    return preset?.contextConfig?.activeLabel || preset?.label || fallback;
}
