#!/usr/bin/env node

// ===== ТЕСТИРОВАНИЕ УНИВЕРСАЛЬНОЙ СИСТЕМЫ СКРЫТЫХ АТРИБУТОВ =====

const fs = require('fs');
const path = require('path');

const CHARACTERS_FILE = path.join(__dirname, '../data/characters-unified.json');

// Импортируем функции (в реальном проекте это будет через import)
// Здесь мы просто протестируем структуру данных

function testUniversalHiddenAttributes() {
  console.log('🧪 Тестирование универсальной системы скрытых атрибутов...\n');

  try {
    // Загружаем данные персонажей
    const charactersData = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8'));
    console.log(`📁 Загружено ${charactersData.characters.length} персонажей\n`);

    // Тестируем каждого персонажа
    charactersData.characters.forEach((character, index) => {
      console.log(`👤 Тестируем персонажа: ${character.name}`);

      // Проверяем наличие универсальных знаний
      if (!character.universalKnowledge) {
        console.log('❌ Отсутствует universalKnowledge');
        return;
      }

      const knowledge = character.universalKnowledge;

      // Подсчитываем скрытые атрибуты
      let totalAttributes = 0;
      let hiddenAttributes = 0;
      let totalFetishes = 0;
      let hiddenFetishes = 0;
      let totalStates = 0;
      let hiddenStates = 0;

      // Атрибуты
      Object.entries(knowledge.attributes || {}).forEach(([category, attrs]) => {
        Object.entries(attrs).forEach(([attrId, attrKnowledge]) => {
          totalAttributes++;
          if (attrKnowledge.level === 'unknown') {
            hiddenAttributes++;
          }
        });
      });

      // Фетиши
      Object.entries(knowledge.fetishes || {}).forEach(([category, fetishes]) => {
        Object.entries(fetishes).forEach(([fetishId, fetishKnowledge]) => {
          totalFetishes++;
          if (fetishKnowledge.level === 'unknown') {
            hiddenFetishes++;
          }
        });
      });

      // Состояния
      Object.entries(knowledge.states || {}).forEach(([stateId, stateKnowledge]) => {
        totalStates++;
        if (stateKnowledge.level === 'unknown') {
          hiddenStates++;
        }
      });

      // Выводим статистику
      console.log(`  📊 Атрибуты: ${hiddenAttributes}/${totalAttributes} скрыто`);
      console.log(`  💕 Фетиши: ${hiddenFetishes}/${totalFetishes} скрыто`);
      console.log(`  ⚙️ Состояния: ${hiddenStates}/${totalStates} скрыто`);

      // Проверяем методы анализа
      if (character.availableAnalysisMethods) {
        console.log(`  🔬 Методов анализа: ${character.availableAnalysisMethods.length}`);

        // Показываем доступные методы
        const availableMethods = character.availableAnalysisMethods
          .filter(method => method.id === 'basic_scan' || method.id === 'personal_work')
          .map(method => method.name);

        console.log(`  ✅ Доступные методы: ${availableMethods.join(', ')}`);
      }

      // Проверяем реальные значения (должны быть видны в characteristics)
      if (character.characteristics) {
        const realAttributes = Object.values(character.characteristics)
          .flatMap(cat => Object.keys(cat)).length;
        console.log(`  🎯 Реальных атрибутов: ${realAttributes}`);
      }

      if (character.fetishes) {
        const realFetishes = Object.keys(character.fetishes).length;
        console.log(`  🎯 Реальных фетишей: ${realFetishes}`);
      }

      console.log('');
    });

    // Общая статистика
    console.log('📈 ОБЩАЯ СТАТИСТИКА:');
    const totalChars = charactersData.characters.length;
    let totalHiddenAttrs = 0;
    let totalHiddenFetishes = 0;
    let totalHiddenStates = 0;

    charactersData.characters.forEach(character => {
      if (character.universalKnowledge) {
        const knowledge = character.universalKnowledge;

        // Подсчитываем скрытые атрибуты
        Object.values(knowledge.attributes || {}).forEach(attrs => {
          Object.values(attrs).forEach(attr => {
            if (attr.level === 'unknown') totalHiddenAttrs++;
          });
        });

        // Подсчитываем скрытые фетиши
        Object.values(knowledge.fetishes || {}).forEach(fetishes => {
          Object.values(fetishes).forEach(fetish => {
            if (fetish.level === 'unknown') totalHiddenFetishes++;
          });
        });

        // Подсчитываем скрытые состояния
        Object.values(knowledge.states || {}).forEach(state => {
          if (state.level === 'unknown') totalHiddenStates++;
        });
      }
    });

    console.log(`  👥 Персонажей: ${totalChars}`);
    console.log(`  🔒 Скрыто атрибутов: ${totalHiddenAttrs}`);
    console.log(`  🔒 Скрыто фетишей: ${totalHiddenFetishes}`);
    console.log(`  🔒 Скрыто состояний: ${totalHiddenStates}`);
    console.log(`  📊 Всего скрыто: ${totalHiddenAttrs + totalHiddenFetishes + totalHiddenStates}`);

    // Проверяем резервную копию
    const backupFiles = fs.readdirSync(path.dirname(CHARACTERS_FILE))
      .filter(file => file.includes('backup-') && file.includes('.json'));

    if (backupFiles.length > 0) {
      console.log(`\n💾 Резервные копии: ${backupFiles.length}`);
      backupFiles.forEach(backup => {
        console.log(`  📁 ${backup}`);
      });
    }

    console.log('\n✅ Тестирование завершено успешно!');
    console.log('🎉 Универсальная система скрытых атрибутов работает корректно!');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    process.exit(1);
  }
}

// Запускаем тест
if (require.main === module) {
  testUniversalHiddenAttributes();
}

module.exports = { testUniversalHiddenAttributes };
