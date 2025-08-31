// Диагностический скрипт для проверки отображения поз в компонентах
const fs = require('fs');
const path = require('path');

// Функция для поиска всех упоминаний поз в файлах
function findPoseReferences() {
  const componentsDir = path.join(__dirname, '../app/prod/components');
  const files = fs.readdirSync(componentsDir).filter(file => file.endsWith('.tsx'));
  
  console.log('🔍 Анализ компонентов на предмет отображения поз...\n');
  
  const poseReferences = [];
  
  for (const file of files) {
    const filePath = path.join(componentsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Ищем упоминания поз
    const poseMatches = content.match(/poses|Позы/g);
    const characterAIMatches = content.match(/characterAI/g);
    const poseDisplayMatches = content.match(/PoseDisplay/g);
    
    if (poseMatches || characterAIMatches || poseDisplayMatches) {
      console.log(`📄 ${file}:`);
      console.log(`   Упоминания "poses": ${poseMatches ? poseMatches.length : 0}`);
      console.log(`   Упоминания "characterAI": ${characterAIMatches ? characterAIMatches.length : 0}`);
      console.log(`   Упоминания "PoseDisplay": ${poseDisplayMatches ? poseDisplayMatches.length : 0}`);
      
      // Ищем конкретные строки с позами
      const lines = content.split('\n');
      const poseLines = lines.filter((line, index) => {
        return line.includes('poses') || line.includes('Позы') || line.includes('pose');
      });
      
      if (poseLines.length > 0) {
        console.log(`   Строки с позами:`);
        poseLines.forEach((line, index) => {
          console.log(`     ${index + 1}: ${line.trim()}`);
        });
      }
      
      poseReferences.push({
        file,
        poseCount: poseMatches ? poseMatches.length : 0,
        characterAICount: characterAIMatches ? characterAIMatches.length : 0,
        poseDisplayCount: poseDisplayMatches ? poseDisplayMatches.length : 0,
        poseLines: poseLines.length
      });
    }
  }
  
  return poseReferences;
}

// Функция для анализа конкретного компонента
function analyzeComponent(fileName) {
  const filePath = path.join(__dirname, '../app/prod/components', fileName);
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`\n🔍 Детальный анализ ${fileName}:`);
  
  // Ищем все места, где отображаются позы
  const poseDisplayPatterns = [
    /poses\.map\(/g,
    /Object\.values\(.*poses/g,
    /characterAI.*poses/g,
    /availablePoses/g
  ];
  
  poseDisplayPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`   Найдены совпадения с ${pattern}: ${matches.length}`);
    }
  });
  
  // Ищем строки с отображением поз
  const lines = content.split('\n');
  const poseDisplayLines = lines.filter((line, index) => {
    return line.includes('poses') && (line.includes('map') || line.includes('Object.values'));
  });
  
  if (poseDisplayLines.length > 0) {
    console.log(`   Строки отображения поз:`);
    poseDisplayLines.forEach((line, index) => {
      console.log(`     ${index + 1}: ${line.trim()}`);
    });
  }
}

// Функция для проверки дублирования в конфигурации
function checkConfigDuplication() {
  console.log('\n🔍 Проверка дублирования в конфигурации...');
  
  const gameConfigPath = path.join(__dirname, '../data/game-config-unified.json');
  const gameConfig = JSON.parse(fs.readFileSync(gameConfigPath, 'utf8'));
  
  const poses = gameConfig.characterAI?.poses || {};
  const poseIds = Object.keys(poses);
  
  console.log(`   Всего поз в конфигурации: ${poseIds.length}`);
  console.log(`   ID поз: ${poseIds.join(', ')}`);
  
  // Проверяем на дублирование ID
  const uniqueIds = new Set(poseIds);
  if (uniqueIds.size !== poseIds.length) {
    console.log(`   ⚠️  ОБНАРУЖЕНО ДУБЛИРОВАНИЕ ID!`);
    const duplicates = poseIds.filter((id, index) => poseIds.indexOf(id) !== index);
    console.log(`   Дублирующиеся ID: ${duplicates.join(', ')}`);
  }
  
  // Проверяем на дублирование имен
  const poseNames = Object.values(poses).map(pose => pose.name);
  const uniqueNames = new Set(poseNames);
  if (uniqueNames.size !== poseNames.length) {
    console.log(`   ⚠️  ОБНАРУЖЕНО ДУБЛИРОВАНИЕ ИМЕН!`);
    const duplicateNames = poseNames.filter((name, index) => poseNames.indexOf(name) !== index);
    console.log(`   Дублирующиеся имена: ${duplicateNames.join(', ')}`);
  }
}

// Основная функция
function analyzePoseDisplay() {
  console.log('🎭 Анализ отображения поз в компонентах\n');
  
  // Анализируем все компоненты
  const references = findPoseReferences();
  
  // Детально анализируем проблемные компоненты
  const problematicComponents = ['ActionToolPanel.tsx', 'PoseDisplay.tsx', 'QuickActionPanel.tsx'];
  
  problematicComponents.forEach(component => {
    if (fs.existsSync(path.join(__dirname, '../app/prod/components', component))) {
      analyzeComponent(component);
    }
  });
  
  // Проверяем конфигурацию
  checkConfigDuplication();
  
  // Итоговая статистика
  console.log('\n📊 Итоговая статистика:');
  console.log(`   Проанализировано компонентов: ${references.length}`);
  console.log(`   Компонентов с упоминанием поз: ${references.filter(r => r.poseCount > 0).length}`);
  console.log(`   Компонентов с characterAI: ${references.filter(r => r.characterAICount > 0).length}`);
  
  const totalPoseReferences = references.reduce((sum, r) => sum + r.poseCount, 0);
  console.log(`   Общее количество упоминаний поз: ${totalPoseReferences}`);
  
  if (totalPoseReferences > 10) {
    console.log(`   ⚠️  МНОГО УПОМИНАНИЙ ПОЗ - ВОЗМОЖНО ДУБЛИРОВАНИЕ!`);
  }
}

// Запускаем анализ
analyzePoseDisplay();













