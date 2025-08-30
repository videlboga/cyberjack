const fs = require('fs');
const path = require('path');

// Функция для загрузки JSON файла
function loadJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ Ошибка загрузки ${filePath}:`, error.message);
    return null;
  }
}

// Функция для анализа структуры конфига
function analyzeConfigStructure(config, source) {
  const structure = {
    source,
    hasActions: !!config.actions,
    hasContracts: !!config.contracts,
    hasEvents: !!config.events,
    hasCharacters: !!config.characters,
    hasEquipment: !!config.equipment,
    hasSystem: !!config.system,
    hasStoryScenes: !!config.storyScenes,
    hasUsers: !!config.users,
    hasCharacterAI: !!config.characterAI,
    hasMarket: !!config.market,
    hasAssets: !!config.assets,
    hasTemplates: !!config.templates,
    hasConfig: !!config.config,
    hasCategories: !!config.categories,
    hasAvailable: !!config.available,
    hasAnomalies: !!config.anomalies,
    hasCrises: !!config.crises,
    hasOpportunities: !!config.opportunities,
    hasTalentExchange: !!config.talentExchange,
    hasVoidRescues: !!config.voidRescues,
    hasCorporateContracts: !!config.corporateContracts,
    hasScenes: !!config.scenes,
    hasAttributes: !!config.attributes,
    hasStates: !!config.states,
    hasFetishes: !!config.fetishes
  };

  // Подсчитываем количество элементов
  const counts = {
    actionsCount: config.actions?.actions?.length || config.actions?.length || 0,
    contractsCount: config.contracts?.contracts?.length || config.contracts?.available?.length || config.contracts?.length || 0,
    eventsCount: config.events?.events?.length || config.events?.anomalies?.length || config.events?.length || 0,
    charactersCount: config.characters?.characters?.length || config.characters?.length || 0,
    equipmentCount: config.equipment?.equipment?.length || config.equipment?.length || 0,
    systemCount: config.system?.attributes?.length || config.system?.length || 0,
    storyScenesCount: config.storyScenes?.scenes?.length || config.storyScenes?.length || 0,
    usersCount: config.users?.users?.length || config.users?.length || 0,
    marketCount: config.market?.talentExchange?.length || config.market?.length || 0,
    assetsCount: config.assets?.length || 0
  };

  return { structure, counts };
}

// Функция для сравнения конфигов
function compareConfigs(config1, config2, source1, source2) {
  const structure1 = analyzeConfigStructure(config1, source1);
  const structure2 = analyzeConfigStructure(config2, source2);

  const similarities = [];
  const differences = [];

  // Сравниваем структуру
  Object.keys(structure1.structure).forEach(key => {
    if (key === 'source') return;
    
    if (structure1.structure[key] && structure2.structure[key]) {
      similarities.push(key);
    } else if (structure1.structure[key] !== structure2.structure[key]) {
      differences.push(key);
    }
  });

  // Сравниваем количество элементов
  Object.keys(structure1.counts).forEach(key => {
    const count1 = structure1.counts[key];
    const count2 = structure2.counts[key];
    
    if (count1 > 0 && count2 > 0) {
      if (count1 === count2) {
        similarities.push(`${key}: ${count1}`);
      } else {
        differences.push(`${key}: ${count1} vs ${count2}`);
      }
    }
  });

  return { similarities, differences };
}

// Основная функция анализа
function analyzeConfigDuplication() {
  console.log('🔍 Начинаем анализ дублирования конфигов...\n');
  
  const dataDir = path.join(__dirname, '../data');
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  
  console.log(`📁 Найдено ${files.length} JSON файлов в папке data:\n`);
  
  const configs = new Map();
  const configStructures = [];
  
  // Загружаем все конфиги
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const config = loadJsonFile(filePath);
    
    if (config) {
      configs.set(file, config);
      const analysis = analyzeConfigStructure(config, file);
      configStructures.push(analysis);
      
      console.log(`📄 ${file}:`);
      console.log(`   Структура: ${Object.keys(analysis.structure).filter(k => k !== 'source' && analysis.structure[k]).join(', ')}`);
      console.log(`   Элементы: ${Object.entries(analysis.counts).filter(([k, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
      console.log('');
    }
  }
  
  // Анализируем дублирование
  console.log('🔄 Анализ дублирования:\n');
  
  const fileNames = Array.from(configs.keys());
  const duplicates = [];
  
  for (let i = 0; i < fileNames.length; i++) {
    for (let j = i + 1; j < fileNames.length; j++) {
      const file1 = fileNames[i];
      const file2 = fileNames[j];
      const config1 = configs.get(file1);
      const config2 = configs.get(file2);
      
      const comparison = compareConfigs(config1, config2, file1, file2);
      
      if (comparison.similarities.length > 0) {
        console.log(`📊 Сравнение ${file1} vs ${file2}:`);
        console.log(`   Сходства: ${comparison.similarities.join(', ')}`);
        if (comparison.differences.length > 0) {
          console.log(`   Различия: ${comparison.differences.join(', ')}`);
        }
        console.log('');
        
        // Если много сходств, считаем потенциальным дубликатом
        if (comparison.similarities.length > 3) {
          duplicates.push({
            file1,
            file2,
            similarities: comparison.similarities.length,
            differences: comparison.differences.length
          });
        }
      }
    }
  }
  
  // Выводим рекомендации
  console.log('💡 Рекомендации по рефакторингу:\n');
  
  if (duplicates.length > 0) {
    console.log('⚠️  Обнаружены потенциальные дубликаты:');
    duplicates.forEach(dup => {
      console.log(`   - ${dup.file1} ↔ ${dup.file2} (${dup.similarities} сходств, ${dup.differences} различий)`);
    });
    console.log('');
  }
  
  // Анализируем unified vs обычные файлы
  const unifiedFiles = files.filter(f => f.includes('-unified'));
  const regularFiles = files.filter(f => !f.includes('-unified'));
  
  console.log(`📋 Unified файлы (${unifiedFiles.length}): ${unifiedFiles.join(', ')}`);
  console.log(`📋 Обычные файлы (${regularFiles.length}): ${regularFiles.join(', ')}`);
  console.log('');
  
  // Проверяем, есть ли дублирование между unified и обычными файлами
  const baseNames = new Map();
  files.forEach(file => {
    const baseName = file.replace('-unified.json', '.json').replace('.json', '');
    if (!baseNames.has(baseName)) {
      baseNames.set(baseName, []);
    }
    baseNames.get(baseName).push(file);
  });
  
  const potentialConflicts = Array.from(baseNames.entries()).filter(([base, files]) => files.length > 1);
  
  if (potentialConflicts.length > 0) {
    console.log('⚠️  Потенциальные конфликты имен:');
    potentialConflicts.forEach(([base, files]) => {
      console.log(`   - ${base}: ${files.join(' ↔ ')}`);
    });
    console.log('');
  }
  
  // Рекомендации по консолидации
  console.log('🎯 План консолидации:');
  console.log('   1. Определить основной источник данных для каждого типа');
  console.log('   2. Удалить дублирующиеся файлы');
  console.log('   3. Обновить импорты в коде');
  console.log('   4. Создать единый загрузчик конфигов');
  console.log('   5. Добавить версионирование для отслеживания изменений');
}

// Запускаем анализ
analyzeConfigDuplication();







