// Диагностический скрипт для проверки дублирования поз
const fs = require('fs');
const path = require('path');

// Функция для загрузки JSON файла
function loadJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Ошибка загрузки файла ${filePath}:`, error.message);
    return null;
  }
}

// Функция для анализа поз в конфигурации
function analyzePoses(config, source) {
  const poses = config?.characterAI?.poses || {};
  const poseIds = Object.keys(poses);
  
  console.log(`\n📊 Анализ поз из ${source}:`);
  console.log(`   Количество поз: ${poseIds.length}`);
  console.log(`   ID поз: ${poseIds.join(', ')}`);
  
  // Проверяем на дублирование ID
  const uniqueIds = new Set(poseIds);
  if (uniqueIds.size !== poseIds.length) {
    console.log(`   ⚠️  ОБНАРУЖЕНО ДУБЛИРОВАНИЕ ID!`);
    const duplicates = poseIds.filter((id, index) => poseIds.indexOf(id) !== index);
    console.log(`   Дублирующиеся ID: ${duplicates.join(', ')}`);
  }
  
  return poseIds;
}

// Функция для сравнения поз между источниками
function comparePoses(poses1, poses2, source1, source2) {
  const ids1 = new Set(poses1);
  const ids2 = new Set(poses2);
  
  const common = [...ids1].filter(id => ids2.has(id));
  const onlyIn1 = [...ids1].filter(id => !ids2.has(id));
  const onlyIn2 = [...ids2].filter(id => !ids1.has(id));
  
  console.log(`\n🔄 Сравнение ${source1} vs ${source2}:`);
  console.log(`   Общие позы: ${common.length} (${common.join(', ')})`);
  console.log(`   Только в ${source1}: ${onlyIn1.length} (${onlyIn1.join(', ')})`);
  console.log(`   Только в ${source2}: ${onlyIn2.length} (${onlyIn2.join(', ')})`);
  
  if (common.length > 0) {
    console.log(`   ⚠️  ОБНАРУЖЕНО ПЕРЕСЕЧЕНИЕ ПОЗ!`);
  }
}

// Основная функция анализа
function analyzePoseDuplication() {
  console.log('🔍 Начинаем анализ дублирования поз...\n');
  
  // Загружаем основные конфигурационные файлы
  const gameConfig = loadJsonFile(path.join(__dirname, '../data/game-config-unified.json'));
  const characterAIConfig = loadJsonFile(path.join(__dirname, '../lib/character/character-ai-config.ts'));
  
  if (!gameConfig) {
    console.error('❌ Не удалось загрузить game-config-unified.json');
    return;
  }
  
  // Анализируем позы в game-config-unified.json
  const gameConfigPoses = analyzePoses(gameConfig, 'game-config-unified.json');
  
  // Проверяем, есть ли другие файлы с позами
  const dataDir = path.join(__dirname, '../data');
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  
  const allPoses = new Map();
  allPoses.set('game-config-unified.json', gameConfigPoses);
  
  // Анализируем все JSON файлы в папке data
  for (const file of files) {
    if (file === 'game-config-unified.json') continue;
    
    const filePath = path.join(dataDir, file);
    const config = loadJsonFile(filePath);
    
    if (config && config.characterAI && config.characterAI.poses) {
      const poses = analyzePoses(config, file);
      allPoses.set(file, poses);
    }
  }
  
  // Сравниваем позы между всеми источниками
  const sources = Array.from(allPoses.keys());
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      comparePoses(allPoses.get(sources[i]), allPoses.get(sources[j]), sources[i], sources[j]);
    }
  }
  
  // Проверяем общее количество уникальных поз
  const allUniquePoses = new Set();
  for (const poses of allPoses.values()) {
    poses.forEach(pose => allUniquePoses.add(pose));
  }
  
  console.log(`\n📈 Итоговая статистика:`);
  console.log(`   Всего уникальных поз: ${allUniquePoses.size}`);
  console.log(`   Список всех уникальных поз: ${Array.from(allUniquePoses).join(', ')}`);
  
  // Проверяем, есть ли позы в character-ai-config.ts
  console.log(`\n🔍 Проверяем character-ai-config.ts...`);
  const configContent = fs.readFileSync(path.join(__dirname, '../lib/character/character-ai-config.ts'), 'utf8');
  const posesMatch = configContent.match(/poses:\s*{([^}]*)}/);
  if (posesMatch) {
    console.log(`   Найдена секция poses в character-ai-config.ts`);
    console.log(`   Содержимое: ${posesMatch[1].trim()}`);
  } else {
    console.log(`   Секция poses не найдена в character-ai-config.ts`);
  }
}

// Запускаем анализ
analyzePoseDuplication();



