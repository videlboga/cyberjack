const fs = require('fs');
const path = require('path');

// Пути к файлам
const UNIFIED_FILE = path.join(__dirname, '../data/characters-unified.json');

// Функция для добавления недостающих полей персонажу
function addMissingFields(character) {
  const characteristics = character.characteristics || {};
  
  // Добавляем атрибуты, если их нет
  if (!character.attributes) {
    character.attributes = {
      strength: characteristics.physical?.endurance || 5,
      empathy: characteristics.social?.empathy || 5,
      intelligence: characteristics.psychological?.intelligence || 5,
      creativity: characteristics.personality?.curiosity || 5,
      temperament: characteristics.psychological?.emotionalStability || 5,
      grit: characteristics.special?.resistance || 5,
      ego: characteristics.personality?.selfEsteem || 5
    };
  }
  
  // Обновляем states, если их нет или они неполные
  if (!character.states) {
    character.states = {
      mood: 50,
      anxiety: 30,
      burnout: 20,
      engagement: 70,
      entitlement: 40,
      insight: 60,
      routine: 50,
      compliance: 60,
      neuroplasticity: 70,
      endurance: characteristics.physical?.endurance || 5,
      cognitiveLoad: 40
    };
  }
  
  // Добавляем skills, если их нет
  if (!character.skills) {
    character.skills = {
      maid: 30,
      cooking: 30,
      neural_hacking: 20,
      orgasm_control: 10,
      field: 40,
      etiquette: 50,
      logistics: 30,
      medical: 20,
      maintenance: 30,
      data: 40,
      dance: 40
    };
  }
  
  // Добавляем affinities, если их нет
  if (!character.affinities) {
    character.affinities = {};
  }
  
  // Добавляем stressors, если их нет
  if (!character.stressors) {
    character.stressors = {};
  }
  
  return character;
}

// Основная функция обновления
function updateCharacters() {
  try {
    console.log('🔄 Начинаем обновление персонажей...');
    
    // Загружаем unified конфигурацию
    const unifiedConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    console.log(`📊 Загружено ${unifiedConfig.characters.length} персонажей`);
    
    // Обновляем каждого персонажа
    let updatedCount = 0;
    unifiedConfig.characters = unifiedConfig.characters.map(character => {
      const hasAttributes = character.attributes && Object.keys(character.attributes).length > 0;
      const hasStates = character.states && Object.keys(character.states).length > 0;
      
      if (!hasAttributes || !hasStates) {
        console.log(`🔄 Обновляем ${character.name}...`);
        updatedCount++;
        return addMissingFields(character);
      }
      
      return character;
    });
    
    // Сохраняем результат
    fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedConfig, null, 2));
    
    console.log(`✅ Обновление завершено!`);
    console.log(`📊 Обновлено ${updatedCount} персонажей`);
    console.log(`📁 Всего персонажей: ${unifiedConfig.characters.length}`);
    
    // Проверяем результат
    console.log('\n🔍 Проверка результата:');
    unifiedConfig.characters.forEach(char => {
      const hasAttributes = char.attributes && Object.keys(char.attributes).length > 0;
      const hasStates = char.states && Object.keys(char.states).length > 0;
      const hasSkills = char.skills && Object.keys(char.skills).length > 0;
      
      console.log(`${char.name}:`);
      console.log(`  - Атрибуты: ${hasAttributes ? '✅' : '❌'}`);
      console.log(`  - Состояния: ${hasStates ? '✅' : '❌'}`);
      console.log(`  - Навыки: ${hasSkills ? '✅' : '❌'}`);
    });
    
    // Создаем отчет об обновлении
    const updateReport = {
      timestamp: new Date().toISOString(),
      totalCharacters: unifiedConfig.characters.length,
      updatedCharacters: updatedCount,
      charactersWithAttributes: unifiedConfig.characters.filter(c => 
        c.attributes && Object.keys(c.attributes).length > 0
      ).length,
      charactersWithStates: unifiedConfig.characters.filter(c => 
        c.states && Object.keys(c.states).length > 0
      ).length,
      charactersWithSkills: unifiedConfig.characters.filter(c => 
        c.skills && Object.keys(c.skills).length > 0
      ).length
    };
    
    const reportPath = path.join(__dirname, '../migration-results/update-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(updateReport, null, 2));
    
    console.log(`📄 Отчет сохранен в: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении:', error);
  }
}

// Запускаем обновление
updateCharacters();












