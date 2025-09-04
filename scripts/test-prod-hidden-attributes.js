#!/usr/bin/env node

// ===== ТЕСТИРОВАНИЕ ПРОДОВОЙ ВЕРСИИ С СКРЫТЫМИ АТРИБУТАМИ =====

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, '../data/characters-unified.json');

// Импортируем функции (в реальном проекте это будет через import)
// Здесь мы просто проверим структуру данных

function testProdHiddenAttributes() {
  console.log('🧪 Тестирование продовой версии с универсальной системой скрытых атрибутов...\n');

  try {
    // Загружаем данные персонажей
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
    console.log(`📁 Загружено ${charactersData.characters.length} персонажей\n`);

    // Проверим структуру данных для первого персонажа
    const firstCharacter = charactersData.characters[0];

    console.log(`👤 Анализ персонажа: ${firstCharacter.name}`);
    console.log(`🔍 Наличие universalKnowledge: ${!!firstCharacter.universalKnowledge}`);
    console.log(`🔍 Наличие реальных характеристик: ${!!firstCharacter.characteristics}`);
    console.log(`🔍 Наличие реальных фетишей: ${!!firstCharacter.fetishes}`);

    // Подсчитаем скрытые атрибуты
    if (firstCharacter.universalKnowledge) {
      const knowledge = firstCharacter.universalKnowledge;

      // Подсчитываем скрытые атрибуты
      let hiddenAttributes = 0;
      let totalAttributes = 0;
      let hiddenFetishes = 0;
      let totalFetishes = 0;

      Object.values(knowledge.attributes || {}).forEach(attrs => {
        Object.values(attrs).forEach(attr => {
          totalAttributes++;
          if (attr.level === 'unknown') {
            hiddenAttributes++;
          }
        });
      });

      Object.values(knowledge.fetishes || {}).forEach(fetishes => {
        Object.values(fetishes).forEach(fetish => {
          totalFetishes++;
          if (fetish.level === 'unknown') {
            hiddenFetishes++;
          }
        });
      });

      console.log(`📊 Скрытые атрибуты: ${hiddenAttributes}/${totalAttributes}`);
      console.log(`💕 Скрытые фетиши: ${hiddenFetishes}/${totalFetishes}`);

      // Проверим несколько конкретных примеров
      console.log('\n🔍 Примеры скрытых атрибутов:');

      // Физические атрибуты
      if (knowledge.attributes?.physical?.endurance) {
        const attr = knowledge.attributes.physical.endurance;
        const realValue = firstCharacter.characteristics?.physical?.['Выносливость'] || 0;
        console.log(`  - Выносливость: уровень знаний "${attr.level}", реальное значение ${realValue}`);
      }

      // Психологические атрибуты
      if (knowledge.attributes?.psychological?.emotional_stability) {
        const attr = knowledge.attributes.psychological.emotional_stability;
        const realValue = firstCharacter.characteristics?.psychological?.['Эмоциональная стабильность'] || 0;
        console.log(`  - Эмоциональная стабильность: уровень знаний "${attr.level}", реальное значение ${realValue}`);
      }

      // Фетиши
      if (knowledge.fetishes?.bdsm?.domination) {
        const fetish = knowledge.fetishes.bdsm.domination;
        const realValue = firstCharacter.fetishes?.domination || 0;
        console.log(`  - Доминирование: уровень знаний "${fetish.level}", реальное значение ${realValue}`);
      }

      if (knowledge.fetishes?.bdsm?.submission) {
        const fetish = knowledge.fetishes.bdsm.submission;
        const realValue = firstCharacter.fetishes?.submission || 0;
        console.log(`  - Подчинение: уровень знаний "${fetish.level}", реальное значение ${realValue}`);
      }
    } else {
      console.log('❌ universalKnowledge отсутствует!');
    }

    console.log('\n✅ Тестирование завершено!');
    console.log('🎯 Теперь характеристики должны отображаться как скрытые в продовой версии!');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    process.exit(1);
  }
}

// Запускаем тест
if (require.main === module) {
  testProdHiddenAttributes();
}

module.exports = { testProdHiddenAttributes };
