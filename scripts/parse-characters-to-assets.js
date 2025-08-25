const fs = require('fs');
const path = require('path');

// Функция для извлечения характеристик из текста
function extractCharacteristics(text) {
  const characteristics = {};
  
  // Физические характеристики (0-10)
  const enduranceMatch = text.match(/Выносливость.*?(\d+)\/10/);
  if (enduranceMatch) characteristics.endurance = parseInt(enduranceMatch[1]);
  
  const sensitivityMatch = text.match(/Чувствительность.*?(\d+)\/10/);
  if (sensitivityMatch) characteristics.sensitivity = parseInt(sensitivityMatch[1]);
  
  const flexibilityMatch = text.match(/Гибкость.*?(\d+)\/10/);
  if (flexibilityMatch) characteristics.flexibility = parseInt(flexibilityMatch[1]);
  
  // Психологические характеристики (0-10)
  const emotionalStabilityMatch = text.match(/Эмоциональная стабильность.*?(\d+)\/10/);
  if (emotionalStabilityMatch) characteristics.emotional_stability = parseInt(emotionalStabilityMatch[1]);
  
  const adaptabilityMatch = text.match(/Адаптивность.*?(\d+)\/10/);
  if (adaptabilityMatch) characteristics.adaptability = parseInt(adaptabilityMatch[1]);
  
  const intelligenceMatch = text.match(/Интеллект.*?(\d+)\/10/);
  if (intelligenceMatch) characteristics.intelligence = parseInt(intelligenceMatch[1]);
  
  // Социальные характеристики (0-10)
  const sociabilityMatch = text.match(/Общительность.*?(\d+)\/10/);
  if (sociabilityMatch) characteristics.sociability = parseInt(sociabilityMatch[1]);
  
  const empathyMatch = text.match(/Эмпатия.*?(\d+)\/10/);
  if (empathyMatch) characteristics.empathy = parseInt(empathyMatch[1]);
  
  const dominanceMatch = text.match(/Доминантность.*?(\d+)\/10/);
  if (dominanceMatch) characteristics.dominance = parseInt(dominanceMatch[1]);
  
  // Личностные характеристики (0-10)
  const selfEsteemMatch = text.match(/Самооценка.*?(\d+)\/10/);
  if (selfEsteemMatch) characteristics.self_esteem = parseInt(selfEsteemMatch[1]);
  
  const optimismMatch = text.match(/Оптимизм.*?(\d+)\/10/);
  if (optimismMatch) characteristics.optimism = parseInt(optimismMatch[1]);
  
  const curiosityMatch = text.match(/Любопытство.*?(\d+)\/10/);
  if (curiosityMatch) characteristics.curiosity = parseInt(curiosityMatch[1]);
  
  // Специальные характеристики (0-10)
  const sexualExperienceMatch = text.match(/Сексуальная опытность.*?(\d+)\/10/);
  if (sexualExperienceMatch) characteristics.sexual_experience = parseInt(sexualExperienceMatch[1]);
  
  const resistanceMatch = text.match(/Сопротивляемость.*?(\d+)\/10/);
  if (resistanceMatch) characteristics.resistance = parseInt(resistanceMatch[1]);
  
  const dependencyMatch = text.match(/Зависимость.*?(\d+)\/10/);
  if (dependencyMatch) characteristics.dependency = parseInt(dependencyMatch[1]);
  
  return characteristics;
}

// Функция для извлечения фетишей из текста
function extractFetishes(text) {
  const fetishes = {};
  
  // Ищем фетиши в разделе "Фетиши и предпочтения"
  const fetishSection = text.match(/## 🎭 Фетиши и предпочтения\s*\n([\s\S]*?)(?=\n## |$)/);
  if (fetishSection) {
    const fetishText = fetishSection[1];
    console.log(`   📝 Найден раздел фетишей, длина: ${fetishText.length}`);
    console.log(`   📝 Первые 200 символов: ${fetishText.substring(0, 200)}`);
    
    // Основные фетиши (формат с дефисами)
    const innocenceMatch = fetishText.match(/-\s*\*\*Невинность\*\*:\s*(\d+)\/10/);
    if (innocenceMatch) {
      fetishes.innocence = parseInt(innocenceMatch[1]);
      console.log(`   ✅ Найден фетиш: innocence = ${fetishes.innocence}`);
    }
    
    const curiosityMatch = fetishText.match(/-\s*\*\*Любопытство\*\*:\s*(\d+)\/10/);
    if (curiosityMatch) {
      fetishes.curiosity = parseInt(curiosityMatch[1]);
      console.log(`   ✅ Найден фетиш: curiosity = ${fetishes.curiosity}`);
    }
    
    const tendernessMatch = fetishText.match(/-\s*\*\*Нежность\*\*:\s*(\d+)\/10/);
    if (tendernessMatch) {
      fetishes.tenderness = parseInt(tendernessMatch[1]);
      console.log(`   ✅ Найден фетиш: tenderness = ${fetishes.tenderness}`);
    }
    
    const attentionMatch = fetishText.match(/-\s*\*\*Внимание\*\*:\s*(\d+)\/10/);
    if (attentionMatch) {
      fetishes.attention = parseInt(attentionMatch[1]);
      console.log(`   ✅ Найден фетиш: attention = ${fetishes.attention}`);
    }
    
    const trustMatch = fetishText.match(/-\s*\*\*Доверие\*\*:\s*(\d+)\/10/);
    if (trustMatch) {
      fetishes.trust = parseInt(trustMatch[1]);
      console.log(`   ✅ Найден фетиш: trust = ${fetishes.trust}`);
    }
    
    const submissionMatch = fetishText.match(/-\s*\*\*Подчинение\*\*:\s*(\d+)\/10/);
    if (submissionMatch) {
      fetishes.submission = parseInt(submissionMatch[1]);
      console.log(`   ✅ Найден фетиш: submission = ${fetishes.submission}`);
    }
    
    const playMatch = fetishText.match(/-\s*\*\*Игра\*\*:\s*(\d+)\/10/);
    if (playMatch) {
      fetishes.play = parseInt(playMatch[1]);
      console.log(`   ✅ Найден фетиш: play = ${fetishes.play}`);
    }
    
    const dependencyMatch = fetishText.match(/-\s*\*\*Зависимость\*\*:\s*(\d+)\/10/);
    if (dependencyMatch) {
      fetishes.dependency = parseInt(dependencyMatch[1]);
      console.log(`   ✅ Найден фетиш: dependency = ${fetishes.dependency}`);
    }
    
    // Романтические фетиши
    const romanticFantasiesMatch = fetishText.match(/-\s*\*\*Романтические фантазии\*\*:\s*(\d+)\/10/);
    if (romanticFantasiesMatch) {
      fetishes.romantic_fantasies = parseInt(romanticFantasiesMatch[1]);
      console.log(`   ✅ Найден фетиш: romantic_fantasies = ${fetishes.romantic_fantasies}`);
    }
    
    const princeDependencyMatch = fetishText.match(/-\s*\*\*Зависимость от принца\*\*:\s*(\d+)\/10/);
    if (princeDependencyMatch) {
      fetishes.prince_dependency = parseInt(princeDependencyMatch[1]);
      console.log(`   ✅ Найден фетиш: prince_dependency = ${fetishes.prince_dependency}`);
    }
    
    const sensoryOverloadMatch = fetishText.match(/-\s*\*\*Сенсорная перегрузка\*\*:\s*(\d+)\/10/);
    if (sensoryOverloadMatch) {
      fetishes.sensory_overload = parseInt(sensoryOverloadMatch[1]);
      console.log(`   ✅ Найден фетиш: sensory_overload = ${fetishes.sensory_overload}`);
    }
    
    const ageRolesMatch = fetishText.match(/-\s*\*\*Возрастные роли\*\*:\s*(\d+)\/10/);
    if (ageRolesMatch) {
      fetishes.age_roles = parseInt(ageRolesMatch[1]);
      console.log(`   ✅ Найден фетиш: age_roles = ${fetishes.age_roles}`);
    }
  } else {
    console.log(`   ❌ Раздел фетишей не найден`);
  }
  
  return fetishes;
}

// Функция для извлечения черт характера из текста
function extractTraits(text) {
  const traits = [];
  
  // Ищем черты характера в разделе "Общий характер" и "Особенности поведения"
  const characterSection = text.match(/### Общий характер([\s\S]*?)(?=###|$)/);
  const behaviorSection = text.match(/### Особенности поведения([\s\S]*?)(?=###|$)/);
  
  const combinedText = (characterSection ? characterSection[1] : '') + (behaviorSection ? behaviorSection[1] : '');
  
  // Определяем черты на основе ключевых слов
  if (combinedText.includes('любопытн') || combinedText.includes('интерес')) traits.push('curious');
  if (combinedText.includes('доверчив') || combinedText.includes('доверяет')) traits.push('trusting');
  if (combinedText.includes('невинн') || combinedText.includes('невинная')) traits.push('innocent');
  if (combinedText.includes('романтичн') || combinedText.includes('мечтательн')) traits.push('romantic');
  if (combinedText.includes('игрив') || combinedText.includes('игра')) traits.push('playful');
  if (combinedText.includes('художественн') || combinedText.includes('творческ')) traits.push('artistic');
  if (combinedText.includes('феминн') || combinedText.includes('женственн')) traits.push('feminine');
  if (combinedText.includes('академическ') || combinedText.includes('студент')) traits.push('academic');
  if (combinedText.includes('призрак') || combinedText.includes('невидимк')) traits.push('ghostly');
  if (combinedText.includes('материнск') || combinedText.includes('защитниц')) traits.push('maternal');
  if (combinedText.includes('защитн') || combinedText.includes('защищает')) traits.push('protective');
  if (combinedText.includes('тёмн') || combinedText.includes('фея')) traits.push('dark_fairy');
  if (combinedText.includes('наркоман') || combinedText.includes('зависим')) traits.push('addictive');
  if (combinedText.includes('ощущен') || combinedText.includes('искатель')) traits.push('sensation_seeker');
  if (combinedText.includes('выживальщиц') || combinedText.includes('адаптивн')) traits.push('survivor');
  if (combinedText.includes('адаптивн') || combinedText.includes('приспосабливается')) traits.push('adaptive');
  
  // Базовые черты
  traits.push('loyal', 'quick_learner');
  
  return traits;
}

// Функция для создания состояний на основе характеристик
function createStatesFromCharacteristics(characteristics) {
  const states = {
    mood: 75,
    anxiety: 25,
    burnout: 20,
    engagement: 80,
    entitlement: 30,
    insight: 70,
    routine: 50,
    compliance: 60,
    neuroplasticity: 80,
    cognitiveLoad: 40
  };
  
  // Корректируем состояния на основе характеристик
  if (characteristics.optimism) {
    states.mood = Math.min(100, 75 + (characteristics.optimism - 5) * 5);
  }
  
  if (characteristics.emotional_stability) {
    states.anxiety = Math.max(0, 25 - (characteristics.emotional_stability - 5) * 5);
  }
  
  if (characteristics.endurance) {
    states.burnout = Math.max(0, 20 - (characteristics.endurance - 5) * 3);
  }
  
  if (characteristics.curiosity) {
    states.engagement = Math.min(100, 80 + (characteristics.curiosity - 5) * 4);
  }
  
  if (characteristics.self_esteem) {
    states.entitlement = Math.min(100, 30 + (characteristics.self_esteem - 5) * 8);
  }
  
  if (characteristics.intelligence) {
    states.insight = Math.min(100, 70 + (characteristics.intelligence - 5) * 6);
  }
  
  if (characteristics.dominance) {
    states.compliance = Math.max(0, 60 - (characteristics.dominance - 5) * 8);
  }
  
  return states;
}

// Функция для извлечения базовой информации
function extractBasicInfo(text) {
  const nameMatch = text.match(/\*\*Имя\*\*: (.+)/);
  const ageMatch = text.match(/\*\*Возраст\*\*: (\d+)/);
  const categoryMatch = text.match(/\*\*Категория\*\*: (.+)/);
  const archetypeMatch = text.match(/\*\*Архетип\*\*: "(.+)"/);
  
  return {
    name: nameMatch ? nameMatch[1].trim() : '',
    age: ageMatch ? parseInt(ageMatch[1]) : 0,
    category: categoryMatch ? categoryMatch[1].trim() : '',
    archetype: archetypeMatch ? archetypeMatch[1].trim() : ''
  };
}

// Функция для определения ранга на основе возраста и характеристик
function determineRank(age, characteristics) {
  if (age <= 13) return "Junior";
  if (age <= 16) return "Middle";
  return "Senior";
}

// Функция для определения специализации на основе архетипа
function determineSpecialization(archetype) {
  const specializations = {
    "Невинная овечка": "Базовое подчинение",
    "Романтическая принцесса": "Романтическое подчинение",
    "Наркоман": "Экспериментальное подчинение",
    "Крыса": "Адаптивное подчинение",
    "Злодей Лаборант": "Доминирование",
    "Гик": "Техническое подчинение",
    "Призрак": "Скрытное подчинение",
    "Феминный Студент": "Академическое подчинение",
    "Сирота": "Эмоциональное подчинение",
    "Актёр": "Творческое подчинение",
    "Любопытный": "Исследовательское подчинение",
    "Эхо": "Мистическое подчинение",
    "Альфа": "Лидерство",
    "Зеркало": "Отражение",
    "Козлова": "Адаптивное подчинение",
    "Соколова": "Адаптивное подчинение",
    "Секретарша": "Административное подчинение"
  };
  
  return specializations[archetype] || "Базовое подчинение";
}

// Функция для создания аватара на основе архетипа
function determineAvatar(archetype) {
  const avatars = {
    "Невинная овечка": "🐑",
    "Романтическая принцесса": "🌸",
    "Наркоман": "💊",
    "Крыса": "🐀",
    "Злодей Лаборант": "👨‍🔬",
    "Гик": "🤓",
    "Призрак": "👻",
    "Феминный Студент": "👨‍🎓",
    "Сирота": "👧",
    "Актёр": "🎭",
    "Любопытный": "🔍",
    "Эхо": "🌙",
    "Альфа": "👑",
    "Зеркало": "🪞",
    "Козлова": "👩",
    "Соколова": "👩‍🦰",
    "Секретарша": "👩‍💼"
  };
  
  return avatars[archetype] || "👤";
}

// Функция для создания базовых состояний
function createBaseStates() {
  return {
    mood: 75,
    anxiety: 25,
    burnout: 20,
    engagement: 80,
    entitlement: 30,
    insight: 70,
    routine: 50,
    compliance: 60,
    neuroplasticity: 80,
    cognitiveLoad: 40
  };
}

// Основная функция парсинга
function parseCharactersToAssets() {
  const charactersDir = path.join(__dirname, '../obsidiabvault/Калибратор активов/02_Персонажи/Персонажи');
  const outputPath = path.join(__dirname, '../data/assets-from-characters.json');
  
  const assets = [];
  let assetId = 1;
  
  try {
    const files = fs.readdirSync(charactersDir);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(charactersDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const basicInfo = extractBasicInfo(content);
        const characteristics = extractCharacteristics(content);
        const fetishes = extractFetishes(content);
        const traits = extractTraits(content);
        
        console.log(`🔍 Отладка для ${basicInfo.name}:`);
        console.log(`   - Характеристики: ${Object.keys(characteristics).length}`);
        console.log(`   - Фетиши: ${Object.keys(fetishes).length}`);
        console.log(`   - Черты: ${traits.length}`);
        if (Object.keys(fetishes).length > 0) {
          console.log(`   - Фетиши:`, fetishes);
        }
        
        if (basicInfo.name && Object.keys(characteristics).length > 0) {
          const rank = determineRank(basicInfo.age, characteristics);
          const specialization = determineSpecialization(basicInfo.archetype);
          const avatar = determineAvatar(basicInfo.archetype);
          
          const asset = {
            id: `asset_${assetId}`,
            name: basicInfo.name,
            rank: rank,
            avatar: avatar,
            price: 150 + (assetId * 25), // Базовая цена с небольшим увеличением
            specialization: specialization,
            description: `${basicInfo.name} - ${basicInfo.archetype || basicInfo.category}`,
            status: "available",
            owner: null,
            location: "talent_exchange",
            attributes: characteristics,
            skills: {
              maid: Math.floor(Math.random() * 3) + 1,
              cooking: Math.floor(Math.random() * 3) + 1,
              neural_hacking: Math.floor(Math.random() * 4) + 1,
              orgasm_control: Math.floor(Math.random() * 3) + 1,
              field: Math.floor(Math.random() * 3) + 1,
              etiquette: Math.floor(Math.random() * 3) + 1,
              logistics: Math.floor(Math.random() * 3) + 1,
              medical: Math.floor(Math.random() * 2) + 1,
              maintenance: Math.floor(Math.random() * 3) + 1,
              data: Math.floor(Math.random() * 3) + 1,
              dance: Math.floor(Math.random() * 2) + 1,
              seduction: Math.floor(Math.random() * 3) + 1,
              interrogation: Math.floor(Math.random() * 2) + 1,
              surveillance: Math.floor(Math.random() * 3) + 1
            },
            traits: traits,
            preferences: {
              work_type: ["service", "technical"],
              environment: ["clean", "quiet"],
              avoid: ["violence", "chaos"]
            },
            condition: createStatesFromCharacteristics(characteristics),
            fetishes: fetishes,
            metadata: {
              age: basicInfo.age,
              category: basicInfo.category,
              archetype: basicInfo.archetype,
              source_file: file
            }
          };
          
          assets.push(asset);
          assetId++;
          
          console.log(`✅ Обработан персонаж: ${basicInfo.name} (${basicInfo.archetype})`);
        }
      }
    }
    
    const output = { assets };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    
    console.log(`\n🎉 Успешно создано ${assets.length} активов из персонажей!`);
    console.log(`📁 Файл сохранен: ${outputPath}`);
    
    return assets;
    
  } catch (error) {
    console.error('❌ Ошибка при парсинге персонажей:', error);
    return [];
  }
}

// Запуск парсинга
if (require.main === module) {
  parseCharactersToAssets();
}

module.exports = { parseCharactersToAssets };
