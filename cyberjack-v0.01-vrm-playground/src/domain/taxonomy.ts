// src/domain/taxonomy.ts

export const ACTION_TAGS = {
    // 1. VERBAL (Слова и Эмоции)
    COMFORT: 'comfort',       // Утешение, похвала, поддержка
    COMMAND: 'command',       // Приказ, доминирование (coerce)
    DEGRADATION: 'degradation', // Унижение, оскорбление
    MOCKERY: 'mockery',       // Насмешка, дразнение, психологическое давление

    // 2. PHYSICAL_SOFT (Приятные и Нейтральные касания)
    CARESS: 'caress',         // Ласка, поверхностный контакт
    STIMULATION: 'stimulation', // Глубокая/направленная стимуляция
    INTIMATE: 'intimate',     // Сексуализированный/интимный контакт
    CLINICAL: 'clinical',     // Холодный медицинский осмотр, препараты

    // 3. PHYSICAL_HARD (Агрессия и Боль)
    PAIN: 'pain',             // Общий тег для любой боли
    BLUNT: 'blunt',           // Тупые удары: шлепки, кулаки
    PIERCING: 'piercing',     // Острое/проникающее: иглы, укусы
    SHOCK: 'shock',           // Ток, резкий испуг
    TORTURE: 'torture',       // Экстремальный урон, травма

    // 4. ENVIRONMENT (Среда и Инвентарь)
    RESTRAINT: 'restraint',   // Ограничение движения, фиксация
    TEMPERATURE: 'temperature'// Температурное воздействие (воск, лед)
};

export const ANATOMY_TAGS = {
    VULNERABLE: 'vulnerable', // Шея, Живот, Горло. Удары обычно дают штраф к capacity.
    EROGENOUS: 'erogenous',   // Губы, грудь, бедра. Зоны с бонусом к pleasure при позитивном контакте.
    SOCIAL: 'social',         // Лицо, голова. Удары или плевки сюда генерируют humiliation.
    NEUTRAL: 'neutral'        // Спина, руки. Стандартный расчет.
};

export const ANATOMY_REGIONS = {
    head: ['face', 'lips', 'neck'],
    torso: ['chest', 'back', 'belly'],
    limbs: ['left_arm', 'right_arm', 'legs', 'feet'],
    intimate: ['groin', 'inner_thighs']
};
