const fs = require('fs');
const path = require('path');

// Функция для парсинга характеристик из текста
function parseCharacteristics(text) {
  const characteristics = {
    physical: {},
    psychological: {},
    social: {},
    personality: {},
    special: {}
  };

  // Физические характеристики
  const physicalMatch = text.match(/### Физические характеристики\s*([\s\S]*?)(?=###|$)/);
  if (physicalMatch) {
    const physicalText = physicalMatch[1];
    const enduranceMatch = physicalText.match(/Выносливость.*?(\d+)\/10/);
    const sensitivityMatch = physicalText.match(/Чувствительность.*?(\d+)\/10/);
    const flexibilityMatch = physicalText.match(/Гибкость.*?(\d+)\/10/);

    if (enduranceMatch) characteristics.physical['Выносливость'] = parseInt(enduranceMatch[1]);
    if (sensitivityMatch) characteristics.physical['Чувствительность'] = parseInt(sensitivityMatch[1]);
    if (flexibilityMatch) characteristics.physical['Гибкость'] = parseInt(flexibilityMatch[1]);
  }

  // Психологические характеристики
  const psychologicalMatch = text.match(/### Психологические характеристики\s*([\s\S]*?)(?=###|$)/);
  if (psychologicalMatch) {
    const psychologicalText = psychologicalMatch[1];
    const emotionalStabilityMatch = psychologicalText.match(/Эмоциональная стабильность.*?(\d+)\/10/);
    const adaptabilityMatch = psychologicalText.match(/Адаптивность.*?(\d+)\/10/);
    const intelligenceMatch = psychologicalText.match(/Интеллект.*?(\d+)\/10/);

    if (emotionalStabilityMatch) characteristics.psychological['Эмоциональная стабильность'] = parseInt(emotionalStabilityMatch[1]);
    if (adaptabilityMatch) characteristics.psychological['Адаптивность'] = parseInt(adaptabilityMatch[1]);
    if (intelligenceMatch) characteristics.psychological['Интеллект'] = parseInt(intelligenceMatch[1]);
  }

  // Социальные характеристики
  const socialMatch = text.match(/### Социальные характеристики\s*([\s\S]*?)(?=###|$)/);
  if (socialMatch) {
    const socialText = socialMatch[1];
    const sociabilityMatch = socialText.match(/Общительность.*?(\d+)\/10/);
    const empathyMatch = socialText.match(/Эмпатия.*?(\d+)\/10/);
    const dominanceMatch = socialText.match(/Доминантность.*?(\d+)\/10/);

    if (sociabilityMatch) characteristics.social['Общительность'] = parseInt(sociabilityMatch[1]);
    if (empathyMatch) characteristics.social['Эмпатия'] = parseInt(empathyMatch[1]);
    if (dominanceMatch) characteristics.social['Доминантность'] = parseInt(dominanceMatch[1]);
  }

  // Личностные характеристики
  const personalityMatch = text.match(/### Личностные характеристики\s*([\s\S]*?)(?=###|$)/);
  if (personalityMatch) {
    const personalityText = personalityMatch[1];
    const selfEsteemMatch = personalityText.match(/Самооценка.*?(\d+)\/10/);
    const optimismMatch = personalityText.match(/Оптимизм.*?(\d+)\/10/);
    const curiosityMatch = personalityText.match(/Любопытство.*?(\d+)\/10/);

    if (selfEsteemMatch) characteristics.personality['Самооценка'] = parseInt(selfEsteemMatch[1]);
    if (optimismMatch) characteristics.personality['Оптимизм'] = parseInt(optimismMatch[1]);
    if (curiosityMatch) characteristics.personality['Любопытство'] = parseInt(curiosityMatch[1]);
  }

  // Специальные характеристики
  const specialMatch = text.match(/### Специальные характеристики\s*([\s\S]*?)(?=###|$)/);
  if (specialMatch) {
    const specialText = specialMatch[1];
    const sexualExperienceMatch = specialText.match(/Сексуальная опытность.*?(\d+)\/10/);
    const resistanceMatch = specialText.match(/Сопротивляемость.*?(\d+)\/10/);
    const dependencyMatch = specialText.match(/Зависимость.*?(\d+)\/10/);

    if (sexualExperienceMatch) characteristics.special['Сексуальная опытность'] = parseInt(sexualExperienceMatch[1]);
    if (resistanceMatch) characteristics.special['Сопротивляемость'] = parseInt(resistanceMatch[1]);
    if (dependencyMatch) characteristics.special['Зависимость'] = parseInt(dependencyMatch[1]);
  }

  return characteristics;
}

// Функция для парсинга фетишей
function parseFetishes(text) {
  const fetishes = {};
  
  // Основные фетиши
  const mainFetishesMatch = text.match(/### Основные фетиши\s*([\s\S]*?)(?=###|##|$)/);
  if (mainFetishesMatch) {
    const mainFetishesText = mainFetishesMatch[1];
    
    // Парсим каждый фетиш
    const fetishLines = mainFetishesText.split('\n').filter(line => line.trim());
    fetishLines.forEach(line => {
      const match = line.match(/-\s*\*\*([^*]+)\*\*:\s*(\d+)\/10/);
      if (match) {
        const fetishName = match[1].trim();
        const fetishValue = parseInt(match[2]);
        
        // Преобразуем название фетиша в ключ
        const fetishKey = fetishName.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-zа-яё0-9_]/g, '');
        
        fetishes[fetishKey] = fetishValue;
      }
    });
  }
  
  // Дополнительные фетиши
  const additionalFetishesMatch = text.match(/### Дополнительные фетиши\s*([\s\S]*?)(?=###|##|$)/);
  if (additionalFetishesMatch) {
    const additionalFetishesText = additionalFetishesMatch[1];
    
    const fetishLines = additionalFetishesText.split('\n').filter(line => line.trim());
    fetishLines.forEach(line => {
      const match = line.match(/-\s*\*\*([^*]+)\*\*:\s*(\d+)\/10/);
      if (match) {
        const fetishName = match[1].trim();
        const fetishValue = parseInt(match[2]);
        
        const fetishKey = fetishName.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-zа-яё0-9_]/g, '');
        
        fetishes[fetishKey] = fetishValue;
      }
    });
  }
  
  return fetishes;
}

// Функция для парсинга базового промта
function parseBasePrompt(text) {
  // Пробуем разные варианты поиска секции промта
  let promptMatch = text.match(/## 🧠 Базовый промт\s*\n([\s\S]*?)(?=\n## |$)/);
  
  if (!promptMatch) {
    // Если не нашли с эмодзи, пробуем без него
    promptMatch = text.match(/## Базовый промт\s*\n([\s\S]*?)(?=\n## |$)/);
  }
  
  if (!promptMatch) {
    // Если все еще не нашли, пробуем более широкий поиск
    promptMatch = text.match(/Базовый промт\s*\n([\s\S]*?)(?=\n## 🎯|\n## |$)/);
  }
  
  if (promptMatch) {
    let promptText = promptMatch[1].trim();
    
    // Удаляем лишние символы и форматирование
    promptText = promptText
      .replace(/###\s+/g, '')
      .replace(/\*\*/g, '')
      .replace(/-\s+/g, '• ')
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/g, ''); // Удаляем лишние пробелы в начале и конце
    
    return promptText;
  }
  
  return '';
}

// Функция для парсинга имени и возраста
function parseBasicInfo(text) {
  const nameMatch = text.match(/\*\*Имя\*\*:\s*([^\n]+)/);
  const ageMatch = text.match(/\*\*Возраст\*\*:\s*(\d+)/);
  const archetypeMatch = text.match(/\*\*Архетип\*\*:\s*([^\n]+)/);
  
  let name = nameMatch ? nameMatch[1].trim() : '';
  let archetype = archetypeMatch ? archetypeMatch[1].trim() : '';
  
  // Удаляем лишние кавычки
  name = name.replace(/^["']|["']$/g, '');
  archetype = archetype.replace(/^["']|["']$/g, '');
  
  return {
    name: name,
    age: ageMatch ? parseInt(ageMatch[1]) : 0,
    archetype: archetype
  };
}

// Функция для создания персонажа
function createCharacter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.md');
  
  const basicInfo = parseBasicInfo(content);
  const characteristics = parseCharacteristics(content);
  const fetishes = parseFetishes(content);
  const basePrompt = parseBasePrompt(content);
  
  // Создаем ID на основе имени
  const id = `asset_${basicInfo.name.toLowerCase().replace(/\s+/g, '_')}`;
  
  // Базовые состояния (можно настроить под каждого персонажа)
  const states = {
    "Настроение": 75,
    "Тревожность": 25,
    "Выгорание": 20,
    "Вовлеченность": 80,
    "Чувство права": 30,
    "Проницательность": 70,
    "Рутина": 50,
    "Послушание": 60,
    "Нейропластичность": 80,
    "Когнитивная нагрузка": 40
  };
  
  // Корректируем состояния на основе характеристик
  if (characteristics.personality['Оптимизм']) {
    states['Настроение'] = Math.min(100, 75 + (characteristics.personality['Оптимизм'] - 5) * 5);
  }
  
  if (characteristics.psychological['Эмоциональная стабильность']) {
    states['Тревожность'] = Math.max(0, 25 - (characteristics.psychological['Эмоциональная стабильность'] - 5) * 5);
  }
  
  if (characteristics.physical['Выносливость']) {
    states['Выгорание'] = Math.max(0, 20 - (characteristics.physical['Выносливость'] - 5) * 3);
  }
  
  if (characteristics.personality['Любопытство']) {
    states['Вовлеченность'] = Math.min(100, 80 + (characteristics.personality['Любопытство'] - 5) * 4);
  }
  
  if (characteristics.personality['Самооценка']) {
    states['Чувство права'] = Math.min(100, 30 + (characteristics.personality['Самооценка'] - 5) * 8);
  }
  
  if (characteristics.psychological['Интеллект']) {
    states['Проницательность'] = Math.min(100, 70 + (characteristics.psychological['Интеллект'] - 5) * 6);
  }
  
  if (characteristics.social['Доминантность']) {
    states['Послушание'] = Math.max(0, 60 - (characteristics.social['Доминантность'] - 5) * 8);
  }
  
  return {
    id,
    name: basicInfo.name,
    age: basicInfo.age,
    archetype: basicInfo.archetype,
    description: `${basicInfo.name} - ${basicInfo.archetype}`,
    dateTransformation: "2024-01-01",
    category: "Выходцы из трущоб",
    characteristics,
    states,
    fetishes,
    basePrompt,
    traits: [],
    preferences: {
      work_type: ["service"],
      environment: ["clean"],
      avoid: ["violence"]
    },
    skills: {
      maid: 2,
      cooking: 2,
      neural_hacking: 1,
      orgasm_control: 1,
      field: 1,
      etiquette: 2,
      logistics: 2,
      medical: 1,
      maintenance: 1,
      data: 1,
      dance: 1,
      seduction: 1,
      interrogation: 1,
      surveillance: 1
    },
    rank: "Junior",
    price: 100,
    specialization: "Базовое подчинение",
    status: "available",
    owner: null,
    location: "talent_exchange",
    avatar: "👤",
    deleted: false,
    deletedAt: null
  };
}

// Основная функция
function updateCharactersFromObsidian() {
  const obsidianPath = path.join(__dirname, '../obsidiabvault/Калибратор активов/02_Персонажи/Персонажи');
  const outputPath = path.join(__dirname, '../data/characters-unified.json');
  
  // Читаем существующие данные
  let existingData = { characters: [] };
  if (fs.existsSync(outputPath)) {
    existingData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  }
  
  // Получаем список файлов персонажей
  const characterFiles = fs.readdirSync(obsidianPath)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(obsidianPath, file));
  
  console.log(`Найдено ${characterFiles.length} файлов персонажей`);
  
  // Обрабатываем каждый файл
  characterFiles.forEach(filePath => {
    try {
      const character = createCharacter(filePath);
      console.log(`Обработан персонаж: ${character.name}`);
      
      // Ищем существующего персонажа с таким же именем
      const existingIndex = existingData.characters.findIndex(c => c.name === character.name);
      
      if (existingIndex !== -1) {
        // Обновляем существующего персонажа
        console.log(`Обновляем существующего персонажа: ${character.name}`);
        existingData.characters[existingIndex] = {
          ...existingData.characters[existingIndex],
          characteristics: character.characteristics,
          states: character.states,
          fetishes: character.fetishes,
          basePrompt: character.basePrompt,
          archetype: character.archetype,
          age: character.age
        };
      } else {
        // Добавляем нового персонажа
        console.log(`Добавляем нового персонажа: ${character.name}`);
        existingData.characters.push(character);
      }
    } catch (error) {
      console.error(`Ошибка при обработке файла ${filePath}:`, error.message);
    }
  });
  
  // Сохраняем обновленные данные
  fs.writeFileSync(outputPath, JSON.stringify(existingData, null, 2), 'utf8');
  console.log(`\nОбновлено ${existingData.characters.length} персонажей в ${outputPath}`);
}

// Запускаем скрипт
updateCharactersFromObsidian();
