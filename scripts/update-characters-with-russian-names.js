const fs = require('fs');
const path = require('path');

function updateCharactersWithRussianNames() {
  try {
    // Загружаем текущий characters-unified.json
    const charactersPath = path.join(__dirname, '../data/characters-unified.json');
    const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));
    
    // Словарь переводов атрибутов
    const attributeTranslations = {
      // Физические характеристики
      endurance: 'Выносливость',
      sensitivity: 'Чувствительность',
      flexibility: 'Гибкость',
      
      // Психологические характеристики
      emotionalStability: 'Эмоциональная стабильность',
      adaptability: 'Адаптивность',
      intelligence: 'Интеллект',
      
      // Социальные характеристики
      sociability: 'Общительность',
      empathy: 'Эмпатия',
      dominance: 'Доминантность',
      
      // Личностные характеристики
      selfEsteem: 'Самооценка',
      optimism: 'Оптимизм',
      curiosity: 'Любопытство',
      
      // Специальные характеристики
      sexualExperience: 'Сексуальная опытность',
      resistance: 'Сопротивляемость',
      dependency: 'Зависимость'
    };
    
    // Словарь переводов состояний
    const stateTranslations = {
      mood: 'Настроение',
      anxiety: 'Тревожность',
      burnout: 'Выгорание',
      engagement: 'Вовлеченность',
      entitlement: 'Чувство права',
      insight: 'Проницательность',
      routine: 'Рутина',
      compliance: 'Послушание',
      neuroplasticity: 'Нейропластичность',
      cognitiveLoad: 'Когнитивная нагрузка'
    };
    
    // Функция для упрощения имени
    function simplifyName(fullName) {
      // Убираем полные имена, оставляем только первое имя или прозвище
      const nameParts = fullName.split(' ');
      
      // Если это "Анечка" или похожее прозвище, оставляем как есть
      if (nameParts[0].toLowerCase().includes('анечка') || 
          nameParts[0].toLowerCase().includes('анна') ||
          nameParts[0].toLowerCase().includes('аня')) {
        return 'Анечка';
      }
      
      // Если это "Миша" или похожее
      if (nameParts[0].toLowerCase().includes('миша') ||
          nameParts[0].toLowerCase().includes('михаил')) {
        return 'Миша';
      }
      
      // Если это "Алексей" или похожее
      if (nameParts[0].toLowerCase().includes('алексей') ||
          nameParts[0].toLowerCase().includes('алекс')) {
        return 'Алексей';
      }
      
      // Если это "Виктор" или похожее
      if (nameParts[0].toLowerCase().includes('виктор')) {
        return 'Виктор';
      }
      
      // Если это "Елена" или похожее
      if (nameParts[0].toLowerCase().includes('елена') ||
          nameParts[0].toLowerCase().includes('лена')) {
        return 'Елена';
      }
      
      // Если это "Мария" или похожее
      if (nameParts[0].toLowerCase().includes('мария') ||
          nameParts[0].toLowerCase().includes('маша')) {
        return 'Мария';
      }
      
      // Если это "Дмитрий" или похожее
      if (nameParts[0].toLowerCase().includes('дмитрий') ||
          nameParts[0].toLowerCase().includes('дима')) {
        return 'Дмитрий';
      }
      
      // Если это "Ольга" или похожее
      if (nameParts[0].toLowerCase().includes('ольга')) {
        return 'Ольга';
      }
      
      // Если это "Сергей" или похожее
      if (nameParts[0].toLowerCase().includes('сергей')) {
        return 'Сергей';
      }
      
      // Если это "Наталья" или похожее
      if (nameParts[0].toLowerCase().includes('наталья') ||
          nameParts[0].toLowerCase().includes('наташа')) {
        return 'Наталья';
      }
      
      // Если это "Игорь" или похожее
      if (nameParts[0].toLowerCase().includes('игорь')) {
        return 'Игорь';
      }
      
      // Если это "Татьяна" или похожее
      if (nameParts[0].toLowerCase().includes('татьяна') ||
          nameParts[0].toLowerCase().includes('таня')) {
        return 'Татьяна';
      }
      
      // Если это "Андрей" или похожее
      if (nameParts[0].toLowerCase().includes('андрей')) {
        return 'Андрей';
      }
      
      // Если это "Екатерина" или похожее
      if (nameParts[0].toLowerCase().includes('екатерина') ||
          nameParts[0].toLowerCase().includes('катя')) {
        return 'Екатерина';
      }
      
      // Если это "Павел" или похожее
      if (nameParts[0].toLowerCase().includes('павел')) {
        return 'Павел';
      }
      
      // Если это "Анна" или похожее
      if (nameParts[0].toLowerCase().includes('анна')) {
        return 'Анна';
      }
      
      // По умолчанию возвращаем первое имя
      return nameParts[0];
    }
    
    // Обновляем персонажей
    const updatedCharacters = charactersData.characters.map(char => {
      // Упрощаем имя
      const simplifiedName = simplifyName(char.name);
      
      // Обновляем характеристики с русскими названиями
      const updatedCharacteristics = {};
      
      if (char.characteristics) {
        Object.keys(char.characteristics).forEach(category => {
          updatedCharacteristics[category] = {};
          Object.keys(char.characteristics[category]).forEach(attr => {
            const russianName = attributeTranslations[attr] || attr;
            updatedCharacteristics[category][russianName] = char.characteristics[category][attr];
          });
        });
      }
      
      // Обновляем состояния с русскими названиями
      const updatedStates = {};
      if (char.states) {
        Object.keys(char.states).forEach(state => {
          const russianName = stateTranslations[state] || state;
          updatedStates[russianName] = char.states[state];
        });
      }
      
      return {
        ...char,
        name: simplifiedName,
        characteristics: updatedCharacteristics,
        states: updatedStates
      };
    });
    
    // Создаем обновленную структуру
    const updatedCharactersData = {
      ...charactersData,
      characters: updatedCharacters
    };
    
    // Сохраняем обновленный файл
    fs.writeFileSync(charactersPath, JSON.stringify(updatedCharactersData, null, 2), 'utf8');
    
    console.log(`✅ Успешно обновлено ${updatedCharacters.length} персонажей`);
    console.log(`📁 Файл сохранен: ${charactersPath}`);
    
    // Показываем примеры изменений
    console.log('\n📊 Примеры изменений:');
    updatedCharacters.slice(0, 3).forEach(char => {
      console.log(`- ${char.name} (было: ${charactersData.characters.find(c => c.id === char.id)?.name})`);
      console.log(`  Характеристики: ${Object.keys(char.characteristics.physical || {}).join(', ')}`);
      console.log(`  Состояния: ${Object.keys(char.states || {}).slice(0, 3).join(', ')}...`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении:', error);
  }
}

// Запуск обновления
if (require.main === module) {
  updateCharactersWithRussianNames();
}

module.exports = { updateCharactersWithRussianNames };












