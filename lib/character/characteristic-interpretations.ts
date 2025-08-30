// Система интерпретаций характеристик для персонажей

export interface CharacteristicInterpretation {
  value: number;
  interpretation: string;
  description: string;
}

export const CHARACTERISTIC_INTERPRETATIONS: { [key: string]: { [range: string]: string } } = {
  // Физические характеристики
  strength: {
    "1-3": "Очень слабая, быстро устает, не может сопротивляться",
    "4-6": "Средняя сила, может выдерживать умеренные нагрузки",
    "7-8": "Довольно сильная, хорошо переносит физические нагрузки",
    "9-10": "Очень сильная, выносливая, готова к любым испытаниям"
  },
  empathy: {
    "1-3": "Почти не чувствует эмоции других, холодная и отстраненная",
    "4-6": "Обычная эмпатия, понимает базовые эмоции",
    "7-8": "Высокая эмпатия, легко чувствует настроение других",
    "9-10": "Очень эмпатичная, глубоко чувствует эмоции окружающих"
  },
  intelligence: {
    "1-3": "Плохо понимает происходящее, наивная и доверчивая",
    "4-6": "Средний интеллект, пытается разобраться в ситуации",
    "7-8": "Умная, анализирует происходящее, ищет выходы",
    "9-10": "Очень умная, видит все возможности и последствия"
  },
  creativity: {
    "1-3": "Не творческая, не может придумать ничего нового",
    "4-6": "Обычная креативность, может адаптироваться",
    "7-8": "Творческая, находит нестандартные решения",
    "9-10": "Очень творческая, полна идей и фантазий"
  },
  temperament: {
    "1-3": "Очень эмоциональная, легко выходит из себя",
    "4-6": "Умеренно эмоциональная, может контролировать себя",
    "7-8": "Спокойная, хорошо контролирует эмоции",
    "9-10": "Очень спокойная, полностью контролирует себя"
  },
  grit: {
    "1-3": "Слабая воля, легко сдается, не может сопротивляться",
    "4-6": "Обычная сила воли, может постоять за себя",
    "7-8": "Сильная воля, упорная, не сдается легко",
    "9-10": "Очень сильная воля, не сдается никогда"
  },
  ego: {
    "1-3": "Очень низкая самооценка, считает себя ничтожеством",
    "4-6": "Обычная самооценка, иногда неуверенная",
    "7-8": "Высокая самооценка, уверена в себе",
    "9-10": "Очень высокая самооценка, гордая и самоуверенная"
  }
};

export function getCharacteristicInterpretation(characteristic: string, value: number): string {
  const interpretations = CHARACTERISTIC_INTERPRETATIONS[characteristic];
  if (!interpretations) {
    return `Характеристика ${characteristic}: ${value}`;
  }

  if (value >= 1 && value <= 3) return interpretations["1-3"];
  if (value >= 4 && value <= 6) return interpretations["4-6"];
  if (value >= 7 && value <= 8) return interpretations["7-8"];
  if (value >= 9 && value <= 10) return interpretations["9-10"];

  return interpretations["4-6"]; // fallback
}

export function formatCharacteristicsForPrompt(characteristics: { [key: string]: { value: number; interpretation: string } }): string {
  return Object.entries(characteristics)
    .map(([key, data]) => {
      const interpretation = getCharacteristicInterpretation(key, data.value);
      return `${key}: ${interpretation} (${data.value}/10)`;
    })
    .join('\n');
}











