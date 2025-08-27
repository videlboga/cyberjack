#!/usr/bin/env node

// ===== МИГРАЦИЯ ПЕРСОНАЖЕЙ НА СИСТЕМУ СКРЫТЫХ ХАРАКТЕРИСТИК =====
// Добавляет поле knowledge для каждого персонажа с системой скрытых характеристик

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, '../data/characters-unified.json');

/**
 * Инициализирует систему скрытых характеристик для персонажа
 */
function initializeHiddenCharacteristics() {
  const createUnknownKnowledge = () => ({
    level: 'unknown'
  });

  return {
    physical: {
      Выносливость: createUnknownKnowledge(),
      Чувствительность: createUnknownKnowledge(),
      Гибкость: createUnknownKnowledge()
    },
    psychological: {
      "Эмоциональная стабильность": createUnknownKnowledge(),
      Адаптивность: createUnknownKnowledge(),
      Интеллект: createUnknownKnowledge()
    },
    social: {
      Общительность: createUnknownKnowledge(),
      Эмпатия: createUnknownKnowledge(),
      Доминантность: createUnknownKnowledge()
    },
    personality: {
      Самооценка: createUnknownKnowledge(),
      Оптимизм: createUnknownKnowledge(),
      Любопытство: createUnknownKnowledge()
    },
    special: {
      "Сексуальная опытность": createUnknownKnowledge(),
      Сопротивляемость: createUnknownKnowledge(),
      Зависимость: createUnknownKnowledge()
    }
  };
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
      accuracy: 0.7,
      reveals: ['physical'],
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
      accuracy: 0.6,
      reveals: ['psychological', 'social'],
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
      accuracy: 0.8,
      reveals: ['physical', 'special'],
      effects: {
        stressIncrease: 10,
        trustDecrease: 8,
        healthImpact: 2
      }
    },
    {
      id: 'deep_immersion',
      name: 'Глубокая иммерсия',
      cost: 1000,
      time: 480,
      risk: 'high',
      accuracy: 0.95,
      reveals: ['all'],
      effects: {
        stressIncrease: 20,
        trustDecrease: 15,
        healthImpact: 5
      }
    },
    {
      id: 'personal_work',
      name: 'Личная работа',
      cost: 0,
      time: 0,
      risk: 'medium',
      accuracy: 0.4,
      reveals: ['all'],
      effects: {
        stressIncrease: 0,
        trustDecrease: 0,
        healthImpact: 0
      }
    }
  ];
}

function migrateCharacters() {
  console.log('🔄 Начинаем миграцию персонажей на систему скрытых характеристик...');

  try {
    // Читаем файл персонажей
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
    console.log(`📁 Загружено ${charactersData.characters.length} персонажей`);

    let migratedCount = 0;

    // Проходим по всем персонажам и добавляем систему анализа
    charactersData.characters = charactersData.characters.map(character => {
      if (!character.knowledge) {
        character.knowledge = initializeHiddenCharacteristics();
        migratedCount++;
        console.log(`✅ Добавлена система анализа для: ${character.name}`);
      }

      if (!character.analysisHistory) {
        character.analysisHistory = [];
      }

      if (!character.availableAnalysisMethods) {
        character.availableAnalysisMethods = getAvailableAnalysisMethods();
      }

      return character;
    });

    // Сохраняем обновленные данные
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(charactersData, null, 2));
    console.log(`\n🎉 Миграция завершена!`);
    console.log(`📊 Обновлено персонажей: ${migratedCount}`);
    console.log(`💾 Файл сохранен: ${CHARACTERS_FILE}`);

  } catch (error) {
    console.error('❌ Ошибка при миграции:', error.message);
    process.exit(1);
  }
}

// Запускаем миграцию
if (require.main === module) {
  migrateCharacters();
}

module.exports = { migrateCharacters };

