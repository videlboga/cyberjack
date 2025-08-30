const fs = require('fs');
const path = require('path');

// Путь к папке с персонажами
const CHARACTERS_DIR = path.join(__dirname, '../obsidiabvault/Калибратор активов/02_Персонажи/Персонажи');

// Функция для парсинга характеристик из markdown
function parseCharacteristics(content) {
  const characteristics = {};
  
  // Физические характеристики
  const physicalMatch = content.match(/### Физические характеристики\s*([\s\S]*?)(?=###|$)/);
  if (physicalMatch) {
    characteristics.physical = {};
    const lines = physicalMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/- \*\*(.*?)\*\*: (\d+)\/10/);
      if (match) {
        characteristics.physical[match[1].toLowerCase().replace(/\s+/g, '')] = parseInt(match[2]);
      }
    });
  }
  
  // Психологические характеристики
  const psychologicalMatch = content.match(/### Психологические характеристики\s*([\s\S]*?)(?=###|$)/);
  if (psychologicalMatch) {
    characteristics.psychological = {};
    const lines = psychologicalMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/- \*\*(.*?)\*\*: (\d+)\/10/);
      if (match) {
        characteristics.psychological[match[1].toLowerCase().replace(/\s+/g, '')] = parseInt(match[2]);
      }
    });
  }
  
  // Социальные характеристики
  const socialMatch = content.match(/### Социальные характеристики\s*([\s\S]*?)(?=###|$)/);
  if (socialMatch) {
    characteristics.social = {};
    const lines = socialMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/- \*\*(.*?)\*\*: (\d+)\/10/);
      if (match) {
        characteristics.social[match[1].toLowerCase().replace(/\s+/g, '')] = parseInt(match[2]);
      }
    });
  }
  
  // Личностные характеристики
  const personalityMatch = content.match(/### Личностные характеристики\s*([\s\S]*?)(?=###|$)/);
  if (personalityMatch) {
    characteristics.personality = {};
    const lines = personalityMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/- \*\*(.*?)\*\*: (\d+)\/10/);
      if (match) {
        characteristics.personality[match[1].toLowerCase().replace(/\s+/g, '')] = parseInt(match[2]);
      }
    });
  }
  
  // Специальные характеристики
  const specialMatch = content.match(/### Специальные характеристики\s*([\s\S]*?)(?=###|$)/);
  if (specialMatch) {
    characteristics.special = {};
    const lines = specialMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/- \*\*(.*?)\*\*: (\d+)\/10/);
      if (match) {
        characteristics.special[match[1].toLowerCase().replace(/\s+/g, '')] = parseInt(match[2]);
      }
    });
  }
  
  return characteristics;
}

// Функция для парсинга фетишей
function parseFetishes(content) {
  const fetishes = {
    primary: [],
    secondary: [],
    intensities: {}
  };
  
  // Основные фетиши
  const primaryMatch = content.match(/### Основные фетиши\s*([\s\S]*?)(?=###|$)/);
  if (primaryMatch) {
    const lines = primaryMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/- \*\*(.*?)\*\*: (\d+)\/10/);
      if (match) {
        const fetishName = match[1].toLowerCase().replace(/\s+/g, '_');
        fetishes.primary.push(fetishName);
        fetishes.intensities[fetishName] = parseInt(match[2]);
      }
    });
  }
  
  // Дополнительные фетиши
  const secondaryMatch = content.match(/### Дополнительные фетиши\s*([\s\S]*?)(?=###|$)/);
  if (secondaryMatch) {
    const lines = secondaryMatch[1].split('\n');
    lines.forEach(line => {
      const match = line.match(/- \*\*(.*?)\*\*: (\d+)\/10/);
      if (match) {
        const fetishName = match[1].toLowerCase().replace(/\s+/g, '_');
        fetishes.secondary.push(fetishName);
        fetishes.intensities[fetishName] = parseInt(match[2]);
      }
    });
  }
  
  return fetishes;
}

// Функция для парсинга базовой информации
function parseBasicInfo(content) {
  const info = {};
  
  // Имя
  const nameMatch = content.match(/\*\*Имя\*\*: (.*?)(?:\n|$)/);
  if (nameMatch) info.name = nameMatch[1].trim();
  
  // Возраст
  const ageMatch = content.match(/\*\*Возраст\*\*: (\d+) лет/);
  if (ageMatch) info.age = parseInt(ageMatch[1]);
  
  // Категория
  const categoryMatch = content.match(/\*\*Категория\*\*: (.*?)(?:\n|$)/);
  if (categoryMatch) info.category = categoryMatch[1].trim();
  
  // Дата превращения
  const dateMatch = content.match(/\*\*Дата превращения в актив\*\*: (.*?)(?:\n|$)/);
  if (dateMatch) info.dateTransformation = dateMatch[1].trim();
  
  // Архетип
  const archetypeMatch = content.match(/\*\*Архетип\*\*: "(.*?)"/);
  if (archetypeMatch) info.archetype = archetypeMatch[1].trim();
  
  return info;
}

// Функция для парсинга базового промта
function parseBasePrompt(content) {
  const prompt = {};
  
  // Общий характер
  const characterMatch = content.match(/### Общий характер\s*([\s\S]*?)(?=###|$)/);
  if (characterMatch) {
    prompt.character = characterMatch[1].trim();
  }
  
  // Стиль общения
  const communicationMatch = content.match(/### Стиль общения\s*([\s\S]*?)(?=###|$)/);
  if (communicationMatch) {
    prompt.communication = communicationMatch[1].trim();
  }
  
  // Особенности поведения
  const behaviorMatch = content.match(/### Особенности поведения\s*([\s\S]*?)(?=###|$)/);
  if (behaviorMatch) {
    prompt.behavior = behaviorMatch[1].trim();
  }
  
  return prompt;
}

// Основная функция анализа
function analyzeCharacters() {
  const characters = [];
  
  try {
    const files = fs.readdirSync(CHARACTERS_DIR);
    
    files.forEach(file => {
      if (file.endsWith('.md')) {
        const filePath = path.join(CHARACTERS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const basicInfo = parseBasicInfo(content);
        const characteristics = parseCharacteristics(content);
        const fetishes = parseFetishes(content);
        const prompt = parseBasePrompt(content);
        
        const character = {
          filename: file,
          id: file.replace('.md', '').toLowerCase().replace(/\s+/g, '_'),
          ...basicInfo,
          characteristics,
          fetishes,
          prompt
        };
        
        characters.push(character);
      }
    });
    
    // Сохраняем результат
    const outputPath = path.join(__dirname, '../migration-results/characters-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(characters, null, 2));
    
    console.log(`✅ Проанализировано ${characters.length} персонажей`);
    console.log(`📁 Результат сохранен в: ${outputPath}`);
    
    // Выводим краткую статистику
    console.log('\n📊 Статистика:');
    characters.forEach(char => {
      console.log(`- ${char.name} (${char.age} лет): ${char.archetype}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при анализе персонажей:', error);
  }
}

// Запускаем анализ
analyzeCharacters();











