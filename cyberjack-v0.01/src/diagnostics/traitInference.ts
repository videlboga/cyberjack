import { SubjectCoreState } from '../domain/types';

/**
 * Maps raw core stats back to string descriptors for ST or UI.
 * E.g., translates "attitude: 80" into "Very cooperative".
 */
export function inferTraits(core: SubjectCoreState): Record<string, string> {
    const getLevel = (val: number, labels: [string, string, string, string, string]) => {
        if (val < 20) return labels[0];
        if (val < 40) return labels[1];
        if (val < 60) return labels[2];
        if (val < 80) return labels[3];
        return labels[4];
    };

    return {
        attitude: getLevel(core.attitude, ['Враждебный', 'Оборонительный', 'Нейтральный', 'Благосклонный', 'Преданный']),
        openness: getLevel(core.openness, ['Отстраненный', 'Закрытый', 'Осторожный', 'Открытый', 'Абсолютно открытый']),
        sensitivity: getLevel(core.sensitivity, ['Онемевший', 'Притупленный', 'Нормальный', 'Чувствительный', 'Сверхчувствительный']),
        capacity: getLevel(core.capacity, ['Хрупкий', 'Уязвимый', 'Средний', 'Стойкий', 'Несокрушимый']),
        plasticity: getLevel(core.plasticity, ['Ригидный', 'Упрямый', 'Адаптивный', 'Податливый', 'Легко внушаемый'])
    };
}
