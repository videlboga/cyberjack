#!/usr/bin/env node

// ===== МИГРАЦИЯ НА УНИВЕРСАЛЬНУЮ СИСТЕМУ СКРЫТЫХ АТРИБУТОВ =====
// Скрывает ВСЕ атрибуты персонажей, включая фетиши, по умолчанию

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, '../data/characters-unified.json');
const SYSTEM_CONFIG_FILE = path.join(__dirname, '../data/system-unified.json');

// ===== КОНСТАНТЫ КАТЕГОРИЙ =====

const ATTRIBUTE_CATEGORIES = {
  physical: ['endurance', 'sensitivity', 'flexibility', 'strength', 'physical_power'],
  psychological: ['emotional_stability', 'adaptability', 'intelligence', 'creativity', 'temperament'],
  social: ['sociability', 'empathy', 'dominance', 'ego', 'social_skills'],
  personality: ['self_esteem', 'optimism', 'curiosity'],
  special: ['sexual_experience', 'resistance', 'dependency']
};

const FETISH_CATEGORIES = {
  bdsm: ['bdsm', 'humiliation', 'masochism', 'sadism', 'domination', 'submission'],
  psychological: ['voyeurism', 'exhibitionism', 'roleplay', 'fear', 'shame', 'guilt', 'forbidden', 'dependency', 'ownership'],
  sensory: ['sensory_deprivation', 'sensory_overload', 'tickling', 'vibration', 'electricity', 'temperature', 'pressure', 'water_sports'],
  body_parts: ['feet', 'hands', 'breasts', 'anal', 'neck', 'ears', 'fingers', 'toes'],
  material: ['latex', 'leather', 'silk', 'rope', 'bondage'],
  social: ['uniform', 'age_play', 'status', 'hierarchy'],
  physiological: ['pregnancy', 'lactation', 'menstruation'],
  extreme: ['edge_play', 'breath_play', 'extreme_pain', 'transformation'],
  additional: ['scent', 'taste', 'texture', 'hair', 'eyes', 'lips', 'nails', 'obedience', 'defiance', 'teasing', 'anticipation', 'authority', 'equality', 'rivalry', 'group_sex', 'public_play', 'objectification', 'dehumanization']
};

const STATE_CATEGORIES = {
  emotional: ['mood', 'fear', 'despair', 'trust', 'relationship'],
  motivational: ['devotion', 'pleasure', 'pain', 'arousal'],
  physical: ['stress', 'fatigue', 'health', 'energy'],
  cognitive: ['awareness', 'concentration', 'memory']
};

// ===== ФУНКЦИИ =====

/**
 * Создает неизвестное знание для атрибута
 */
function createUnknownKnowledge() {
  return {
    level: 'unknown'
  };
}

/**
 * Инициализирует универсальную систему скрытых атрибутов
 */
function initializeUniversalHiddenAttributes() {
  const result = {
    attributes: {},
    fetishes: {},
    states: {}
  };

  // Инициализируем характеристики
  Object.entries(ATTRIBUTE_CATEGORIES).forEach(([category, attributeIds]) => {
    result.attributes[category] = {};
    attributeIds.forEach(attributeId => {
      result.attributes[category][attributeId] = createUnknownKnowledge();
    });
  });

  // Инициализируем фетиши
  Object.entries(FETISH_CATEGORIES).forEach(([category, fetishIds]) => {
    result.fetishes[category] = {};
    fetishIds.forEach(fetishId => {
      result.fetishes[category][fetishId] = createUnknownKnowledge();
    });
  });

  // Инициализируем состояния
  Object.entries(STATE_CATEGORIES).forEach(([category, stateIds]) => {
    stateIds.forEach(stateId => {
      result.states[stateId] = createUnknownKnowledge();
    });
  });

  return result;
}

/**
 * Получает список всех фетишей из system-конфига
 */
function getAllFetishesFromSystem() {
  try {
    const systemConfig = JSON.parse(fs.readFileSync(SYSTEM_CONFIG_FILE, 'utf8'));
    return systemConfig.fetishes || [];
  } catch (error) {
    console.warn('⚠️ Не удалось загрузить system-конфиг, используем базовые фетиши');
    return [];
  }
}

/**
 * Получает список всех атрибутов из system-конфига
 */
function getAllAttributesFromSystem() {
  try {
    const systemConfig = JSON.parse(fs.readFileSync(SYSTEM_CONFIG_FILE, 'utf8'));
    return {
      attributes: systemConfig.attributes || [],
      attributes_extra: systemConfig.attributes_extra || []
    };
  } catch (error) {
    console.warn('⚠️ Не удалось загрузить system-конфиг, используем базовые атрибуты');
    return { attributes: [], attributes_extra: [] };
  }
}

/**
 * Создает универсальные знания на основе реальных данных персонажа
 */
function createUniversalKnowledgeFromCharacter(character) {
  const knowledge = initializeUniversalHiddenAttributes();

  // Добавляем атрибуты из system-конфига, если они есть у персонажа
  const systemData = getAllAttributesFromSystem();
  const allSystemAttributes = [...systemData.attributes, ...systemData.attributes_extra];

  allSystemAttributes.forEach(attr => {
    if (character.attributes && character.attributes[attr.id] !== undefined) {
      // Определяем категорию атрибута
      let category = 'additional';
      Object.entries(ATTRIBUTE_CATEGORIES).forEach(([cat, attrs]) => {
        if (attrs.includes(attr.id)) {
          category = cat;
        }
      });

      if (!knowledge.attributes[category]) {
        knowledge.attributes[category] = {};
      }
      knowledge.attributes[category][attr.id] = createUnknownKnowledge();
    }
  });

  // Добавляем фетиши из system-конфига, если они есть у персонажа
  const systemFetishes = getAllFetishesFromSystem();
  systemFetishes.forEach(fetish => {
    if (character.fetishes && character.fetishes[fetish.id] !== undefined) {
      // Определяем категорию фетиша
      let category = 'additional';
      Object.entries(FETISH_CATEGORIES).forEach(([cat, fetishes]) => {
        if (fetishes.includes(fetish.id)) {
          category = cat;
        }
      });

      if (!knowledge.fetishes[category]) {
        knowledge.fetishes[category] = {};
      }
      knowledge.fetishes[category][fetish.id] = createUnknownKnowledge();
    }
  });

  // Добавляем состояния, если они есть у персонажа
  if (character.states) {
    Object.keys(character.states).forEach(stateId => {
      knowledge.states[stateId] = createUnknownKnowledge();
    });
  }

  return knowledge;
}

/**
 * Получает информацию о доступных методах анализа
 */
function getAvailableAnalysisMethods() {
  return [
    {
      id: 'basic_scan',
      name: 'Базовое сканирование',
      cost: 50,
      time: 5,
      risk: 'low',
      baseAccuracy: 0.7,
      reveals: {
        attributes: ['physical'],
        fetishes: []
      },
      effects: {
        stressIncrease: 2,
        trustDecrease: 1,
        healthImpact: 0
      }
    },
    {
      id: 'psychological_test',
      name: 'Психологическое тестирование',
      cost: 100,
      time: 15,
      risk: 'low',
      baseAccuracy: 0.6,
      reveals: {
        attributes: ['psychological', 'personality'],
        fetishes: ['psychological']
      },
      effects: {
        stressIncrease: 5,
        trustDecrease: 3,
        healthImpact: 0
      }
    },
    {
      id: 'sensory_research',
      name: 'Сенсорное исследование',
      cost: 300,
      time: 30,
      risk: 'medium',
      baseAccuracy: 0.8,
      reveals: {
        attributes: ['physical', 'special'],
        fetishes: ['sensory', 'body_parts', 'physiological']
      },
      effects: {
        stressIncrease: 10,
        trustDecrease: 8,
        healthImpact: 2,
        arousalIncrease: 5
      }
    },
    {
      id: 'fetish_exploration',
      name: 'Исследование фетишей',
      cost: 500,
      time: 45,
      risk: 'medium',
      baseAccuracy: 0.75,
      reveals: {
        attributes: ['special'],
        fetishes: ['bdsm', 'psychological', 'material', 'social']
      },
      effects: {
        stressIncrease: 15,
        trustDecrease: 10,
        healthImpact: 1,
        arousalIncrease: 10
      }
    },
    {
      id: 'behavioral_analysis',
      name: 'Поведенческий анализ',
      cost: 200,
      time: 60,
      risk: 'low',
      baseAccuracy: 0.65,
      reveals: {
        attributes: ['social', 'personality'],
        fetishes: ['social', 'additional']
      },
      effects: {
        stressIncrease: 3,
        trustDecrease: 2,
        healthImpact: 0
      }
    },
    {
      id: 'intimate_research',
      name: 'Интимное исследование',
      cost: 800,
      time: 90,
      risk: 'high',
      baseAccuracy: 0.85,
      reveals: {
        attributes: ['special'],
        fetishes: ['bdsm', 'extreme', 'physiological', 'additional']
      },
      effects: {
        stressIncrease: 20,
        trustDecrease: 15,
        healthImpact: 3,
        arousalIncrease: 15
      }
    },
    {
      id: 'psychological_profiling',
      name: 'Психологическое профилирование',
      cost: 400,
      time: 120,
      risk: 'medium',
      baseAccuracy: 0.7,
      reveals: {
        attributes: ['psychological', 'personality', 'social'],
        fetishes: ['psychological', 'social']
      },
      effects: {
        stressIncrease: 12,
        trustDecrease: 8,
        healthImpact: 1
      }
    },
    {
      id: 'deep_immersion',
      name: 'Глубокая иммерсия',
      cost: 1500,
      time: 480,
      risk: 'high',
      baseAccuracy: 0.95,
      reveals: {
        attributes: ['physical', 'psychological', 'social', 'personality', 'special'],
        fetishes: ['bdsm', 'psychological', 'sensory', 'body_parts', 'material', 'social', 'physiological', 'extreme', 'additional'],
        states: ['emotional', 'motivational', 'physical', 'cognitive']
      },
      effects: {
        stressIncrease: 25,
        trustDecrease: 20,
        healthImpact: 5,
        arousalIncrease: 20
      }
    },
    {
      id: 'personal_work',
      name: 'Личная работа',
      cost: 0,
      time: 0,
      risk: 'medium',
      baseAccuracy: 0.4,
      reveals: {
        attributes: ['physical', 'psychological', 'social', 'personality', 'special'],
        fetishes: ['bdsm', 'psychological', 'sensory', 'body_parts', 'material', 'social', 'physiological', 'extreme', 'additional'],
        states: ['emotional', 'motivational', 'physical', 'cognitive']
      },
      effects: {
        stressIncrease: 0,
        trustDecrease: 0,
        healthImpact: 0
      }
    }
  ];
}

/**
 * Основная функция миграции
 */
function migrateToUniversalHiddenAttributes() {
  console.log('🔄 Начинаем миграцию на универсальную систему скрытых атрибутов...');
  console.log('📋 Это скроет ВСЕ атрибуты персонажей, включая фетиши');

  try {
    // Читаем файл персонажей
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
    console.log(`📁 Загружено ${charactersData.characters.length} персонажей`);

    let migratedCount = 0;
    let totalHiddenAttributes = 0;
    let totalHiddenFetishes = 0;

    // Проходим по всем персонажам
    charactersData.characters = charactersData.characters.map(character => {
      // Создаем универсальные знания для персонажа
      const universalKnowledge = createUniversalKnowledgeFromCharacter(character);

      // Подсчитываем количество скрытых атрибутов
      const hiddenAttributes = Object.values(universalKnowledge.attributes)
        .reduce((sum, category) => sum + Object.keys(category).length, 0);
      const hiddenFetishes = Object.values(universalKnowledge.fetishes)
        .reduce((sum, category) => sum + Object.keys(category).length, 0);

      totalHiddenAttributes += hiddenAttributes;
      totalHiddenFetishes += hiddenFetishes;

      // Обновляем персонажа
      const updatedCharacter = {
        ...character,
        universalKnowledge, // Новая система
        knowledge: universalKnowledge, // Совместимость со старой системой
        analysisHistory: character.analysisHistory || [],
        availableAnalysisMethods: getAvailableAnalysisMethods()
      };

      migratedCount++;
      console.log(`✅ Мигрирован: ${character.name} (${hiddenAttributes} атрибутов, ${hiddenFetishes} фетишей)`);

      return updatedCharacter;
    });

    // Сохраняем обновленные данные
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(charactersData, null, 2));

    console.log(`\n🎉 Миграция завершена!`);
    console.log(`📊 Обновлено персонажей: ${migratedCount}`);
    console.log(`🔒 Скрыто атрибутов: ${totalHiddenAttributes}`);
    console.log(`🔒 Скрыто фетишей: ${totalHiddenFetishes}`);
    console.log(`💾 Файл сохранен: ${CHARACTERS_FILE}`);

    // Создаем резервную копию
    const backupFile = CHARACTERS_FILE.replace('.json', `.backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(charactersData, null, 2));
    console.log(`💾 Резервная копия: ${backupFile}`);

  } catch (error) {
    console.error('❌ Ошибка при миграции:', error.message);
    process.exit(1);
  }
}

// ===== ЗАПУСК =====

if (require.main === module) {
  console.log('🚨 ВНИМАНИЕ: Эта миграция скроет ВСЕ атрибуты персонажей!');
  console.log('📋 Включая фетиши, состояния и дополнительные характеристики');
  console.log('⏳ Начинаем через 3 секунды...\n');

  setTimeout(() => {
    migrateToUniversalHiddenAttributes();
  }, 3000);
}

module.exports = { migrateToUniversalHiddenAttributes };
