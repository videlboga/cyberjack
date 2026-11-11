/**
 * Единый распорядок дня и фазы игрового времени.
 * Один конфигурационный источник для описаний комнат, симуляции и промпта.
 */

export const DAY_CYCLE = {
    /** Отбой — начало сна. */
    lightsOutMinute: 23 * 60, // 23:00
    /** Подъём — конец сна. */
    wakeMinute: 7 * 60, // 07:00
    /** Обычная рутина питания. */
    mealMinutes: [8 * 60, 13 * 60, 19 * 60], // 08:00, 13:00, 19:00
} as const;

export type DayPhase = 'night' | 'morning' | 'day' | 'evening';

/** Фаза дня по минуте суток (0..1439). */
export function dayPhaseForMinute(minuteOfDay: number): DayPhase {
    const m = ((minuteOfDay % 1440) + 1440) % 1440;
    if (m >= DAY_CYCLE.wakeMinute && m < 12 * 60) return 'morning';
    if (m >= 12 * 60 && m < 18 * 60) return 'day';
    if (m >= 18 * 60 && m < DAY_CYCLE.lightsOutMinute) return 'evening';
    return 'night';
}

/** Минута суток из мирового времени. */
export function minuteOfDay(worldMinute: number): number {
    return ((worldMinute % 1440) + 1440) % 1440;
}

/** Спит ли персонаж по распорядку в данный момент (без учёта исключений). */
export function isScheduledSleep(worldMinute: number): boolean {
    const m = minuteOfDay(worldMinute);
    return m >= DAY_CYCLE.lightsOutMinute || m < DAY_CYCLE.wakeMinute;
}

/** Следующий плановый подъём (минута суток) после текущего момента. */
export function nextScheduledWakeMinuteOfDay(worldMinute: number): number {
    const m = minuteOfDay(worldMinute);
    if (m < DAY_CYCLE.wakeMinute) return DAY_CYCLE.wakeMinute;
    // Уже после подъёма — следующий подъём на следующий день.
    return DAY_CYCLE.wakeMinute + 1440;
}

/** Следующий плановый отбой (минута суток) после текущего момента. */
export function nextScheduledLightsOutMinuteOfDay(worldMinute: number): number {
    const m = minuteOfDay(worldMinute);
    if (m < DAY_CYCLE.lightsOutMinute) return DAY_CYCLE.lightsOutMinute;
    return DAY_CYCLE.lightsOutMinute + 1440;
}

/** Русская подпись фазы для промпта. */
export function dayPhaseLabel(phase: DayPhase): string {
    switch (phase) {
        case 'night': return 'ночь';
        case 'morning': return 'утро';
        case 'day': return 'день';
        case 'evening': return 'вечер';
    }
}
