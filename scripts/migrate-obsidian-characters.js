const fs = require('fs');
const path = require('path');

// Пути к файлам
const ANALYSIS_FILE = path.join(__dirname, '../migration-results/characters-analysis.json');
const UNIFIED_FILE = path.join(__dirname, '../data/characters-unified.json');

// Функция для преобразования характеристик в unified формат
function convertCharacteristics(characteristics) {
  const converted = {};
  
  // Физические характеристики
  if (characteristics.physical) {
    converted.physical = {
      endurance: characteristics.physical.выносливость || 5,
      sensitivity: characteristics.physical.чувствительность || 5,
      flexibility: characteristics.physical.гибкость || 5
    };
  }
  
  // Психологические характеристики
  if (characteristics.psychological) {
    converted.psychological = {
      emotionalStability: characteristics.psychological.эмоциональнаястабильность || 5,
      adaptability: characteristics.psychological.адаптивность || 5,
      intelligence: characteristics.psychological.интеллект || 5
    };
  }
  
  // Социальные характеристики
  if (characteristics.social) {
    converted.social = {
      sociability: characteristics.social.общительность || 5,
      empathy: characteristics.social.эмпатия || 5,
      dominance: characteristics.social.доминантность || 5
    };
  }
  
  // Личностные характеристики
  if (characteristics.personality) {
    converted.personality = {
      selfEsteem: characteristics.personality.самооценка || 5,
      optimism: characteristics.personality.оптимизм || 5,
      curiosity: characteristics.personality.любопытство || 5
    };
  }
  
  // Специальные характеристики
  if (characteristics.special) {
    converted.special = {
      sexualExperience: characteristics.special.сексуальнаяопытность || 1,
      resistance: characteristics.special.сопротивляемость || 5,
      dependency: characteristics.special.зависимость || 5
    };
  }
  
  return converted;
}

// Функция для преобразования фетишей в unified формат
function convertFetishes(fetishes) {
  const converted = {
    primary: fetishes.primary || [],
    secondary: fetishes.secondary || [],
    intensities: fetishes.intensities || {}
  };
  
  return converted;
}

// Функция для создания промта
function createPrompt(character) {
  const prompt = {
    character: character.prompt?.character || '',
    communication: character.prompt?.communication || '',
    behavior: character.prompt?.behavior || ''
  };
  
  return prompt;
}

// Функция для создания интерпретаций характеристик
function createCharacteristicInterpretations(character) {
  const interpretations = {};
  
  // Добавляем интерпретации для основных характеристик
  interpretations.endurance = {
    '1-3': 'Я очень устал... можно отдохнуть немножко?',
    '4-6': 'Я устаю, но это так интересно... можно ещё немножко?',
    '7-8': 'Я ещё не очень устал... давайте продолжим!',
    '9-10': 'Я полон сил! Готов продолжать!'
  };
  
  interpretations.sensitivity = {
    '1-3': 'Я почти ничего не чувствую... это нормально?',
    '4-6': 'Обычные ощущения... но мне нравится!',
    '7-8': 'Каждое прикосновение такое особенное... мне нравится!',
    '9-10': 'Я взрываюсь от каждого прикосновения! Это так волшебно!'
  };
  
  interpretations.emotionalStability = {
    '1-3': 'Я не могу контролировать себя... эмоции захлёстывают...',
    '4-6': 'Иногда мне грустно, но потом становится лучше...',
    '7-8': 'Я относительно спокоен... могу контролировать себя!',
    '9-10': 'Я полностью контролирую свои эмоции... всё хорошо!'
  };
  
  return interpretations;
}

// Функция для создания unified персонажа
function createUnifiedCharacter(character) {
  const characteristics = convertCharacteristics(character.characteristics);
  
  const unified = {
    id: character.id,
    name: character.name,
    age: character.age,
    dateTransformation: character.dateTransformation,
    description: `${character.name} - ${character.archetype || 'персонаж'}`,
    
    characteristics: characteristics,
    fetishes: convertFetishes(character.fetishes),
    
    communicationStyle: {
      voice: character.age < 18 ? 'детский голос' : 'взрослый голос',
      language: character.prompt?.communication ? 'специальный стиль' : 'обычный стиль',
      expressions: [],
      behavior: character.prompt?.behavior || '',
      speechPatterns: []
    },
    
    basePrompt: character.prompt?.character || `Ты - ${character.name}`,
    
    characteristicInterpretations: createCharacteristicInterpretations(character),
    
    combinedPrompts: {
      default: `Реакция основана на характеристиках персонажа ${character.name}.`
    },
    
    memories: {
      childhood: [],
      recent: [],
      traumatic: [],
      pleasant: []
    },
    
    attributes: {
      strength: characteristics.physical?.endurance || 5,
      empathy: characteristics.social?.empathy || 5,
      intelligence: characteristics.psychological?.intelligence || 5,
      creativity: characteristics.personality?.curiosity || 5,
      temperament: characteristics.psychological?.emotionalStability || 5,
      grit: characteristics.special?.resistance || 5,
      ego: characteristics.personality?.selfEsteem || 5
    },
    
    states: {
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
    },
    
    skills: {
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
    },
    
    affinities: {},
    stressors: {}
  };
  
  return unified;
}

// Основная функция миграции
function migrateCharacters() {
  try {
    console.log('🔄 Начинаем миграцию персонажей...');
    
    // Загружаем анализ персонажей
    const analysisData = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf8'));
    console.log(`📊 Загружено ${analysisData.length} персонажей для миграции`);
    
    // Загружаем текущую unified конфигурацию
    let unifiedConfig = { characters: [] };
    if (fs.existsSync(UNIFIED_FILE)) {
      unifiedConfig = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
      console.log(`📁 Текущая конфигурация содержит ${unifiedConfig.characters.length} персонажей`);
    }
    
    // Конвертируем персонажей
    const migratedCharacters = analysisData.map(character => {
      console.log(`🔄 Конвертируем ${character.name}...`);
      return createUnifiedCharacter(character);
    });
    
    // Объединяем с существующими персонажами
    const existingIds = new Set(unifiedConfig.characters.map(c => c.id));
    const newCharacters = migratedCharacters.filter(c => !existingIds.has(c.id));
    
    unifiedConfig.characters = [...unifiedConfig.characters, ...newCharacters];
    
    // Сохраняем результат
    fs.writeFileSync(UNIFIED_FILE, JSON.stringify(unifiedConfig, null, 2));
    
    console.log(`✅ Миграция завершена!`);
    console.log(`📊 Добавлено ${newCharacters.length} новых персонажей`);
    console.log(`📁 Всего персонажей: ${unifiedConfig.characters.length}`);
    
    // Выводим статистику
    console.log('\n📋 Новые персонажи:');
    newCharacters.forEach(char => {
      console.log(`- ${char.name} (${char.age || 'неизвестный возраст'} лет)`);
    });
    
    // Создаем отчет о миграции
    const migrationReport = {
      timestamp: new Date().toISOString(),
      totalCharacters: unifiedConfig.characters.length,
      newCharacters: newCharacters.length,
      migratedCharacters: newCharacters.map(c => ({
        id: c.id,
        name: c.name,
        age: c.age
      }))
    };
    
    const reportPath = path.join(__dirname, '../migration-results/migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
    
    console.log(`📄 Отчет сохранен в: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
  }
}

// Запускаем миграцию
migrateCharacters();
